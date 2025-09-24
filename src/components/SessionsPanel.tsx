// src/components/SessionsPanel.tsx
import { useEffect, useState, type FormEvent } from "react";

type Client = Awaited<ReturnType<typeof window.api.clients.list>>[number];
type CaseRow = Awaited<ReturnType<typeof window.api.cases.listByClient>>[number];
type CatalogItem = { code: string; label: string };

type SessionDraft = Partial<SessionRow> & { case_id: number };

const toMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function SessionsPanel() {
  const [clients, setClients] = useState<Client[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [methods, setMethods] = useState<CatalogItem[]>([]);
  const [problems, setProblems] = useState<CatalogItem[]>([]);

  const [clientId, setClientId] = useState<number | "">("");
  const [caseId, setCaseId] = useState<number | "">("");

  // Eingabe
  const [date, setDate] = useState<string>("");
  const [topic, setTopic] = useState<string>("");
  const [sud, setSud] = useState<number | "">("");
  const [duration, setDuration] = useState<number | "">("");
  const [methodSession, setMethodSession] = useState<string>("");
  const [changeNote, setChangeNote] = useState<string>("");
  const [newProblem, setNewProblem] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // Edit
  const [editId, setEditId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Partial<SessionRow>>({});

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api.clients.list().then(setClients);
    window.api.catalog.therapyMethods().then(setMethods);
    window.api.catalog.problemCategories().then(setProblems);
  }, []);

  useEffect(() => {
    if (clientId === "") { setCases([]); setCaseId(""); setSessions([]); return; }
    window.api.cases.listByClient(Number(clientId)).then(cs => {
      setCases(cs);
      setCaseId(cs[0]?.id ?? "");
      if (cs[0]) loadSessions(cs[0].id);
    });
  }, [clientId]);

  useEffect(() => {
    if (caseId !== "") loadSessions(Number(caseId));
  }, [caseId]);

  async function loadSessions(id: number) {
    setSessions(await window.api.sessions.listByCase(id));
  }

  function clearForm() {
    setDate(""); setTopic(""); setSud(""); setDuration("");
    setMethodSession(""); setChangeNote(""); setNewProblem(""); setNote("");
  }

  async function createSession(e: FormEvent) {
    e.preventDefault();
    if (caseId === "") return;
    setBusy(true); setError(null);
    try {
      await window.api.sessions.create({
        case_id: Number(caseId),
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        topic: topic || null,
        sud_session: sud === "" ? null : Number(sud),
        duration_min: duration === "" ? null : Number(duration),
        method_code_session: methodSession || null,
        change_note: changeNote || null,
        new_problem_code: newProblem || null,
        note: note || null
      });
      clearForm();
      await loadSessions(Number(caseId));
    } catch (e) { setError(toMsg(e)); }
    finally { setBusy(false); }
  }

  function rowToDraft(s: SessionRow): SessionDraft {
    return {
      id: s.id,
      case_id: s.case_id,
      date: s.date?.slice(0, 10),
      topic: s.topic ?? null,
      sud_session: s.sud_session ?? null,
      duration_min: s.duration_min ?? null,
      method_code_session: s.method_code_session ?? null,
      change_note: s.change_note ?? null,
      new_problem_code: s.new_problem_code ?? null,
    };
  }

  function startEditRow(s: SessionRow) {
    setEditId(s.id);
    setEditRow(rowToDraft(s));
  }

  async function saveEditRow() {
    if (editId == null) return;
    setBusy(true); setError(null);
    try {
      await window.api.sessions.update({
        id: editId,
        date: editRow.date ? new Date(editRow.date).toISOString() : undefined,
        topic: editRow.topic ?? null,
        sud_session: (editRow.sud_session ?? null) as number | null,
        duration_min: (editRow.duration_min ?? null) as number | null,
        method_code_session: (editRow.method_code_session ?? null) as string | null,
        change_note: (editRow.change_note ?? null) as string | null,
        new_problem_code: (editRow.new_problem_code ?? null) as string | null,
      });
      setEditId(null); setEditRow({});
      await loadSessions(Number(caseId));
    } catch (e) { setError(toMsg(e)); }
    finally { setBusy(false); }
  }

  async function deleteRow(id: number) {
    if (!confirm("Sitzung löschen?")) return;
    await window.api.sessions.delete(id);
    await loadSessions(Number(caseId));
  }

  return (
    <section className="n4-panel">
      <h2>Sitzungen</h2>

      {/* Auswahl */}
      <div className="n4-row">
        <label>
          Klient
          <select value={clientId} onChange={e => setClientId(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">– wählen –</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </label>
        <label>
          Fall
          <select value={caseId} onChange={e => setCaseId(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">– wählen –</option>
            {cases.map(cs => <option key={cs.id} value={cs.id}>#{cs.id} • {cs.method_code} • {cs.primary_problem_code}</option>)}
          </select>
        </label>
      </div>

      {/* neu anlegen */}
      <form onSubmit={createSession} className="n4-form">
        <div className="n4-row">
          <label>Datum<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label>Topic<input value={topic} onChange={e => setTopic(e.target.value)} /></label>
          <label>SUD<input type="number" min={0} max={10} value={sud}
            onChange={e => setSud(e.target.value === "" ? "" : Number(e.target.value))} /></label>
          <label>Dauer (Min.)<input type="number" min={0} value={duration}
            onChange={e => setDuration(e.target.value === "" ? "" : Number(e.target.value))} /></label>
        </div>
        <div className="n4-row">
          <label>Methode (diese Sitzung)
            <select value={methodSession} onChange={e => setMethodSession(e.target.value)}>
              <option value="">– wie im Fall –</option>
              {methods.map(m => <option key={m.code} value={m.code}>{m.label}</option>)}
            </select>
          </label>
          <label>Neues Problem?
            <select value={newProblem} onChange={e => setNewProblem(e.target.value)}>
              <option value="">– keines –</option>
              {problems.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
            </select>
          </label>
          <label>Veränderungen seit letzter Sitzung
            <input value={changeNote} onChange={e => setChangeNote(e.target.value)} />
          </label>
        </div>
        <label className="n4-block">Notiz<textarea value={note} onChange={e => setNote(e.target.value)} /></label>
        <button type="submit" disabled={busy || caseId === ""}>Sitzung speichern</button>
      </form>

      {error && <p className="n4-error">⚠️ {error}</p>}

      {/* Tabelle */}
      <div className="n4-table-wrap" style={{marginTop: 12}}>
        <table className="n4-table">
          <thead>
            <tr><th>Datum</th><th>Topic</th><th>SUD</th><th>Min</th><th>Methode</th><th>Neu. Problem</th><th>Änderung</th><th></th></tr>
          </thead>
          <tbody>
            {sessions.map(s => editId === s.id ? (
              <tr key={s.id}>
                <td><input type="date" value={(editRow.date as string) ?? ""} onChange={e => setEditRow(v => ({...v, date: e.target.value}))} /></td>
                <td><input value={(editRow.topic as string) ?? ""} onChange={e => setEditRow(v => ({...v, topic: e.target.value}))} /></td>
                <td><input type="number" min={0} max={10}
                           value={(editRow.sud_session as number | null) ?? ""}
                           onChange={e => setEditRow(v => ({...v, sud_session: e.target.value === "" ? null : Number(e.target.value)}))} /></td>
                <td><input type="number" min={0}
                           value={(editRow.duration_min as number | null) ?? ""}
                           onChange={e => setEditRow(v => ({...v, duration_min: e.target.value === "" ? null : Number(e.target.value)}))} /></td>
                <td>
                  <select value={(editRow.method_code_session as string | null) ?? ""}
                          onChange={e => setEditRow(v => ({...v, method_code_session: e.target.value || null}))}>
                    <option value="">– wie im Fall –</option>
                    {methods.map(m => <option key={m.code} value={m.code}>{m.label}</option>)}
                  </select>
                </td>
                <td>
                  <select value={(editRow.new_problem_code as string | null) ?? ""}
                          onChange={e => setEditRow(v => ({...v, new_problem_code: e.target.value || null}))}>
                    <option value="">– keines –</option>
                    {problems.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
                  </select>
                </td>
                <td><input value={(editRow.change_note as string | null) ?? ""}
                           onChange={e => setEditRow(v => ({...v, change_note: e.target.value || null}))} /></td>
                <td>
                  <button onClick={() => void saveEditRow()}>✔</button>
                  <button onClick={() => { setEditId(null); setEditRow({}); }}>✖</button>
                </td>
              </tr>
            ) : (
              <tr key={s.id}>
                <td>{s.date.slice(0,10)}</td>
                <td>{s.topic ?? "—"}</td>
                <td>{s.sud_session ?? "—"}</td>
                <td>{s.duration_min ?? "—"}</td>
                <td>{s.method_code_session ?? "—"}</td>
                <td>{s.new_problem_code ?? "—"}</td>
                <td>{s.change_note ?? "—"}</td>
                <td>
                  <button onClick={() => startEditRow(s)}>✎</button>
                  <button onClick={() => void deleteRow(s.id)}>🗑</button>
                </td>
              </tr>
            ))}
            {sessions.length === 0 &&
              <tr><td colSpan={8} style={{textAlign:"center",opacity:.7}}>Noch keine Sitzungen</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
