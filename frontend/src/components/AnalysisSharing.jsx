import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { peopleApi, sharingApi } from "../services/databaseApi.js";

export default function AnalysisSharing({ analysisId }) {
  const [people, setPeople] = useState([]);
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setReady(false); setError(""); setNotice("");
    Promise.all([peopleApi.list(), sharingApi.list(analysisId)])
      .then(([people, shares]) => { if (active) { setReady(true); setPeople(people); setSelected(shares.map(share => share.person.id)); } })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [analysisId, revision]);
  async function save() {
    if (busy || loading || !ready) return;
    setBusy(true); setError(""); setNotice("");
    try { const data = await sharingApi.update(analysisId, selected); setNotice(data.message); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const visible = people.filter(person => `${person.name} ${person.email || ""}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="card sharing-panel" aria-labelledby="sharing-title">
    <h2 id="sharing-title"><Users size={22} /> Share with people</h2>
    <p>Select one or more people to record a sharing assignment. This does not send email, messages, or a private access link.</p>
    {error && <p className="alert" role="alert">{error} <button className="btn btn-secondary" disabled={busy} onClick={() => setRevision(value => value + 1)}>Reload</button></p>}
    {notice && <p className="save-success" role="status">{notice}</p>}
    {loading ? <p role="status">Loading people and assignments…</p> : !people.length ? <p>No people available. <a href="#people" className="text-link">Add people</a> to get started.</p> : <>
      <div className="field"><label htmlFor="share-search">Find a person</label><input id="share-search" type="search" value={query} onChange={event => setQuery(event.target.value)} /></div>
      <div className="share-people">{visible.map(person => <label className="share-person" key={person.id}><input type="checkbox" checked={selected.includes(person.id)} disabled={busy || !ready} onChange={event => setSelected(current => event.target.checked ? [...current, person.id] : current.filter(id => id !== person.id))} /><span><strong>{person.name}</strong><small>{person.email || "No email provided"}</small></span></label>)}{!visible.length && <p>No matching people.</p>}</div>
      <button className="btn btn-primary" disabled={busy || !ready} onClick={save}>{busy ? "Saving…" : `Save sharing assignments (${selected.length})`}</button>
    </>}
  </section>;
}
