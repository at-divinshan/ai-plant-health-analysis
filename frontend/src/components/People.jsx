import { useEffect, useRef, useState } from "react";
import PersonPlants from "./PersonPlants.jsx";
import { Sprout, Users, Plus, Search, Pencil, Trash2, Mail } from "lucide-react";
import { peopleApi } from "../services/databaseApi.js";

export default function People({ onAnalyze }) {
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [people, setPeople] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", email: "" });
  const [pending, setPending] = useState(null);
  const [revision, setRevision] = useState(0);
  const dialog = useRef(null);
  const nameInput = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      peopleApi.list(query).then(data => { if (active) { setPeople(data); setError(""); } })
        .catch(err => { if (active) { setPeople([]); setError(err.message); } })
        .finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [query, revision]);
  useEffect(() => { if (pending) dialog.current?.showModal(); else dialog.current?.close(); }, [pending]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const values = { name: form.name.trim(), email: form.email.trim() || null };
      if (editing) await peopleApi.edit(editing, values); else await peopleApi.add(values);
      setNotice(editing ? "Person updated." : "Person added.");
      setForm({ name: "", email: "" }); setEditing(null); setRevision(value => value + 1);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!pending || busy) return;
    setBusy(true); setError("");
    try {
      await peopleApi.remove(pending.id);
      if (editing === pending.id) { setEditing(null); setForm({ name: "", email: "" }); }
      setPending(null); setNotice("Person deleted. Their sharing assignments were removed."); setRevision(value => value + 1);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (selectedPerson !== null) return <PersonPlants onAnalyze={onAnalyze} personId={selectedPerson} onBack={() => setSelectedPerson(null)} />;

  return <section className="container saved-page">
    <div className="saved-heading"><span className="eyebrow"><Users size={16} /> YOUR PLANT CARE COMMUNITY</span><h1>People</h1><p>Manage the people associated with your saved analyses.</p></div>
    {error && !pending && <p className="alert" role="alert">{error} <button className="btn btn-secondary" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
    {notice && <p className="save-success" role="status">{notice}</p>}
    <form className="card people-form" onSubmit={submit}>
      <h2>{editing ? "Edit person" : "Add a person"}</h2>
      <div className="people-fields">
        <div className="field"><label htmlFor="person-name">Name *</label><input ref={nameInput} id="person-name" value={form.name} maxLength={150} required disabled={busy} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div className="field"><label htmlFor="person-email">Email (optional)</label><input id="person-email" type="email" value={form.email} maxLength={255} disabled={busy} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
      </div>
      <div className="result-actions"><button className="btn btn-primary" disabled={busy}><Plus size={17} />{busy ? "Saving…" : editing ? "Save changes" : "Add person"}</button>{editing && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setEditing(null); setForm({ name: "", email: "" }); }}>Cancel edit</button>}</div>
    </form>
    <div className="field people-search"><label htmlFor="people-search"><Search size={16} /> Search people</label><input id="people-search" type="search" maxLength={150} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or email" /></div>
    {loading ? <p className="spinner-box" role="status">Loading people…</p> : <div className="saved-grid">
      {people.map(person => <article className="card saved-card" key={person.id}><span className="form-icon"><Users size={22} /></span><h2>{person.name}</h2><p className="saved-location"><Mail size={15} />{person.email || "No email provided"}</p><div className="saved-card-actions">
        <button className="btn btn-secondary" onClick={() => setSelectedPerson(person.id)}><Sprout size={16} />View Plants</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => { setEditing(person.id); setForm({ name: person.name, email: person.email || "" }); nameInput.current?.focus(); }}><Pencil size={16} />Edit</button>
        <button className="btn btn-delete" disabled={busy} onClick={() => { setError(""); setPending(person); }}><Trash2 size={16} />Delete</button>
      </div></article>)}
      {!people.length && !error && <div className="card saved-empty"><h2>{query ? "No matching people" : "No people yet"}</h2><p>{query ? "Try another name or email." : "Add a person to assign saved analyses to them."}</p></div>}
    </div>}
    <dialog ref={dialog} className="delete-dialog" onCancel={event => { if (busy) event.preventDefault(); else setPending(null); }} aria-labelledby="delete-person-title">
      <h2 id="delete-person-title">Delete this person?</h2><p>{pending?.name} and their sharing assignments will be removed. Their plants will become unassigned; saved analyses will remain.</p>{error && <p className="alert" role="alert">{error}</p>}
      <div className="saved-toolbar"><button className="btn btn-secondary" autoFocus disabled={busy} onClick={() => setPending(null)}>Cancel</button><button className="btn btn-delete" disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Delete person"}</button></div>
    </dialog>
  </section>;
}
