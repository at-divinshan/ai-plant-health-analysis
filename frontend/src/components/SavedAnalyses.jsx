import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Bookmark, CalendarDays, MapPin, Sprout, Trash2 } from "lucide-react";
import AnalysisSharing from "./AnalysisSharing.jsx";
import AnalysisResult from "./AnalysisResult.jsx";
import { formatAnalysisDate } from "../services/savedAnalyses.js";

export default function SavedAnalyses({ entries, selectedId, storageError, loading, importWarning, onRetry, onDelete, onAnalyze }) {
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const dialog = useRef(null);
  const heading = useRef(null);
  const selected = entries.find(entry => entry.id === selectedId);

  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [selectedId]);

  useEffect(() => {
    if (pendingDelete) dialog.current?.showModal();
    else dialog.current?.close();
  }, [pendingDelete]);

  function askDelete(entry) {
    setDeleteError("");
    setNotice("");
    setPendingDelete(entry);
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true); setDeleteError("");
    try {
      await onDelete(pendingDelete.id);
      setPendingDelete(null); setNotice("Analysis deleted.");
      if (selectedId) window.location.hash = "saved";
    } catch (err) { setDeleteError(err.message); }
    finally { setDeleting(false); }
  }

  return (
    <section className="container saved-page" aria-labelledby="saved-title">
      <div className="saved-heading">
        <span className="eyebrow"><Bookmark size={15} /> YOUR PLANT CARE JOURNAL</span>
        <h1 id="saved-title" ref={heading} tabIndex={-1}>{selectedId ? "Saved plant analysis" : "Saved Analyses"}</h1>
        <p>Keep your plant’s story close. Analyses are saved in the database, with no account needed.</p>
        <p className="storage-note">View complete analyses and manage sharing assignments with people.</p>
      </div>
      {storageError && <p className="alert" role="alert">{storageError} <button className="btn btn-secondary" onClick={onRetry}>Retry</button></p>}
      {importWarning && <p className="alert" role="alert">{importWarning} <button className="btn btn-secondary" onClick={onRetry}>Retry import</button></p>}
      {notice && <p className="save-success" role="status">{notice}</p>}
      {loading ? <p className="spinner-box" role="status">Loading saved analyses…</p> : selectedId ? (
        <>
          <div className="saved-toolbar">
            <a href="#saved" className="btn btn-secondary"><ArrowLeft size={17} /> All saved analyses</a>
            {selected && <button className="btn btn-delete" onClick={() => askDelete(selected)}><Trash2 size={17} /> Delete analysis</button>}
          </div>
          {selected ? <><AnalysisResult plant={selected.plant} result={selected.result} analyzedAt={selected.analyzedAt} onReset={onAnalyze} /><AnalysisSharing key={selected.id} analysisId={selected.id} /></> :
            <div className="card saved-empty"><Bookmark size={32} /><h2>Analysis unavailable</h2><p>It may have been deleted or the database could not be reached.</p></div>}
        </>
      ) : entries.length ? (
        <div className="saved-grid">
          {entries.map(entry => (
            <article className="card saved-card" key={entry.id}>
              <div className="saved-card-top"><span className="form-icon"><Sprout size={23} /></span><span className="guidance-badge">{entry.plant.plant_type}</span></div>
              <h2>{entry.plant.plant_name}</h2>
              <time dateTime={entry.analyzedAt}><CalendarDays size={14} />{formatAnalysisDate(entry.analyzedAt)}</time>
              <p className="saved-location"><MapPin size={14} />{entry.plant.location || "Location not provided"}</p>
              <h3>Possible issue</h3><p className="saved-summary">{entry.result.possible_issue}</p>
              <div className="saved-card-actions">
                <a href={`#saved/${encodeURIComponent(entry.id)}`} className="btn btn-primary">View full analysis <ArrowUpRight size={16} /></a>
                <button className="btn btn-delete" aria-label={`Delete analysis for ${entry.plant.plant_name}`} onClick={() => askDelete(entry)}><Trash2 size={17} /></button>
              </div>
            </article>
          ))}
        </div>
      ) : !storageError && (
        <div className="card saved-empty"><span className="form-icon"><Bookmark size={27} /></span><h2>Your plant journal starts here</h2><p>Analyze a plant, then choose Save Analysis to keep its care guidance here.</p><a href="#analyze" className="btn btn-primary">Analyze your plant <ArrowUpRight size={17} /></a></div>
      )}
      <dialog ref={dialog} className="delete-dialog" onCancel={event => { if (deleting) event.preventDefault(); else setPendingDelete(null); }} aria-labelledby="delete-title" aria-describedby="delete-description">
        <h2 id="delete-title">Delete saved analysis?</h2>
        <p id="delete-description">The saved analysis for <strong>{pendingDelete?.plant.plant_name}</strong> and its sharing assignments will be removed from the database. This cannot be undone.</p>
        {deleteError && <p className="alert" role="alert">{deleteError}</p>}
        <div className="saved-toolbar"><button className="btn btn-secondary" autoFocus disabled={deleting} onClick={() => setPendingDelete(null)}>Cancel</button><button className="btn btn-delete" disabled={deleting} onClick={confirmDelete}><Trash2 size={17} /> {deleting ? "Deleting…" : "Delete analysis"}</button></div>
      </dialog>
    </section>
  );
}
