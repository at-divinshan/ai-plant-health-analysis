import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, CalendarDays, Sprout } from "lucide-react";
import { peopleApi } from "../services/databaseApi.js";
import { formatAnalysisDate } from "../services/savedAnalyses.js";
import AnalysisResult from "./AnalysisResult.jsx";
import AnalysisSharing from "./AnalysisSharing.jsx";

export default function PersonPlants({ personId, onBack, onAnalyze }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setSelected(null);
    peopleApi.plants(personId).then(value => { if (active) setData(value); })
      .catch(err => { if (active) { setError(err.message); setData(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [personId, revision]);

  return <section className="container saved-page">
    <div className="saved-heading"><span className="eyebrow"><Sprout size={16} /> PERSONAL PLANT JOURNAL</span><h1>{data ? `${data.person.name}’s plants` : "Person’s plants"}</h1><p>Assigned plants and their saved analysis history.</p></div>
    <div className="saved-toolbar"><button className="btn btn-secondary" onClick={selected ? () => setSelected(null) : onBack}><ArrowLeft size={17} />{selected ? "Back to plants" : "Back to people"}</button></div>
    {loading ? <p className="spinner-box" role="status">Loading plants…</p> : error ? <p className="alert" role="alert">{error} <button className="btn btn-secondary" onClick={() => setRevision(value => value + 1)}>Retry</button></p> : selected ? <>
      <AnalysisResult onReset={onAnalyze} plant={selected.plant} result={selected.result} analyzedAt={selected.analyzedAt} />
      <AnalysisSharing key={selected.id} analysisId={selected.id} />
    </> : <div className="saved-grid">
      {data?.plants.map(plant => <article className="card saved-card" key={plant.id}>
        <div className="saved-card-top"><span className="form-icon"><Sprout size={23} /></span><span className="guidance-badge">{plant.plant_type}</span></div>
        <h2>{plant.plant_name}</h2>
        <time dateTime={plant.savedAt}><CalendarDays size={14} />Saved {formatAnalysisDate(plant.savedAt)}</time>
        <p className="saved-location">{plant.location || "Location not provided"}</p>
        <h3>Symptoms</h3><p className="saved-summary">{plant.symptom}</p>
        {plant.analyses.map(entry => <div key={entry.id}>
          <h3>Possible issue</h3><p className="saved-summary">{entry.result.possible_issue}</p>
          <time dateTime={entry.analyzedAt}>Analyzed {formatAnalysisDate(entry.analyzedAt)}</time>
          <div className="saved-card-actions"><button className="btn btn-primary" onClick={() => { setSelected(entry); window.scrollTo({ top: 0, behavior: "smooth" }); }}>View full analysis <ArrowUpRight size={16} /></button></div>
        </div>)}
        {!plant.analyses.length && <p className="muted">No saved analyses remain for this plant.</p>}
      </article>)}
      {!data?.plants.length && <div className="card saved-empty"><h2>No plants assigned yet</h2><p>Select this person in the analysis form, then save the result to start their plant history.</p><a href="#analyze" className="btn btn-primary">Analyze a plant <ArrowUpRight size={17} /></a></div>}
    </div>}
  </section>;
}
