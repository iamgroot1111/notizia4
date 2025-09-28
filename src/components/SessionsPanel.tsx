// src/components/SessionsPanel.tsx
import { useEffect, useState, type FormEvent } from "react";

type Client      = Awaited<ReturnType<typeof window.api.clients.list>>[number];
type CaseRow     = Awaited<ReturnType<typeof window.api.cases.listByClient>>[number];
type SessionRow  = Awaited<ReturnType<typeof window.api.sessions.listByCase>>[number];
type CatalogItem = { code: string; label: string };

const toMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function SessionsPanel() {
  const [clients,  setClients]  = useState<Client[]>([]);
  const [cases,    setCases]    = useState<CaseRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [methods,  setMethods]  = useState<CatalogItem[]>([]);
  const [problems, setProblems] = useState<CatalogItem[]>([]);

  const [clientId, setClientId] = useState<number | "">("");
  const [caseId,   setCaseId]   = useState<number | "">("");

  // Eingabe (neu anlegen)
  const [date,     setDate]     = useState<string>("");
  const [topic,    setTopic]    = useState<string>("");
  const [sud,      setSud]      = useState<number | "">("");
  const [duration, setDuration] = useState<number | "">("");
  const [methodSession, setMethodSession] = useState<string>("");
  const [newProblem,    setNewProblem]    = useState<string>("");
  const [changeNote,    setChangeNote]    = useState<string>("");
  const [note,          setNote]          = useState<string>("");

  // Edit-Row (UI-only Felder enthalten)
  type EditRow = {
    id: number;
    date: string;
    topic: string | null;
    sud_session: number | null;
    duration_min: number | null;
    method_code_session: string | null; // UI -> cases.updateMethod
    new_problem_code: string | null;    // UI -> cases.saveAnamnesis
    change_note: string | null;         // UI -> als Notiz nutzbar, hier nur Anzeige
  };
  const [editId,  setEditId]  = useState<number | null>(null);
  const [editRow, setEditRow] = useState<EditRow | null>(null);

  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* -------------------------------- effects -------------------------------- */

  useEffect(() => {
    window.api.clients.list().then(setClients);
    window.api.catalog.therapyMethods().then(setMethods);
    window.api.catalog.problemCategories().then(setProblems);
  }, []);

  useEffect(() => {
    if (clientId === "") { setCases([]); setCaseId(""); setSessions([]); return; }
    window.api.cases.listByClient(Number(clientId)).then(cs => {
      setCases(cs);
      // ★ first als number | ""
      const first: number | "" = cs.length > 0 ? cs[0].id : "";
      setCaseId(first);
      // ★ TS-sicher nur bei number laden
      if (typeof first === "number") {
        void loadSessions(first);
      }
    });
  }, [clientId]);

  useEffect(() => {
    // ★ ebenfalls TS-sicher
    if (typeof caseId === "number") {
      void loadSessions(caseId);
    }
  }, [caseId]);

  async function loadSessions(id: number) {
    setSessions(await window.api.sessions.listByCase(id));
  }

  /* ------------------------------- create row ------------------------------- */

  function clearForm() {
    setDate(""); setTopic(""); setSud(""); setDuration("");
    setMethodSession(""); setNewProblem(""); setChangeNote(""); setNote("");
  }

  async function createSession(e: FormEvent) {
    e.preventDefault();
    if (caseId === "") return;
    setBusy(true); setError(null);
    try {
      const iso = date ? new Date(date).toISOString() : new Date().toISOString();
      const notePayload =
        (note && note.trim()) || (changeNote && changeNote.trim())
          ? (note || changeNote)
          : null;

      // 1) Sitzung anlegen (+ optional Notiz)
      await window.api.sessions.create({
        case_id: Number(caseId),
        date: iso,
        topic: topic || null,
        sud_session: sud === "" ? null : Number(sud),
        duration_min: duration === "" ? null : Number(duration),
        note: notePayload,
      });

      // 2) Optional: Methode/Problem am Fall ändern
      if (methodSession) {
        await window.api.cases.updateMethod({
          case_id: Number(caseId),
          method_code: methodSession,
        });
      }
      if (newProblem) {
        await window.api.cases.saveAnamnesis({
          case_id: Number(caseId),
          primary_problem_code: newProblem,
        });
      }

      clearForm();
      await loadSessions(Number(caseId));
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setBusy(false);
    }
  }

  /* --------------------------------- edit row -------------------------------- */

  function startEditRow(s: SessionRow) {
    setEditId(s.id);
    setEditRow({
      id: s.id,
      date: s.date?.slice(0, 10),
      topic: s.topic ?? null,
      sud_session: s.sud_session ?? null,
      duration_min: s.duration_min ?? null,
      method_code_session: null,
      new_problem_code: null,
      change_note: null,
    });
  }

  async function saveEditRow() {
    if (!editRow || !editId || caseId === "") return;
    setBusy(true); setError(null);
    try {
      // 1) Session updaten (zulässige Felder)
      await window.api.sessions.update({
        id: editId,
        topic: editRow.topic ?? null,
        sud_session: editRow.sud_session ?? null,
        duration_min: editRow.duration_min ?? null,
      });

      // 2) Optional am Fall ändern
      if (editRow.method_code_session) {
        await window.api.cases.updateMethod({
          case_id: Number(caseId),
          method_code: editRow.method_code_session,
        });
      }
      if (editRow.new_problem_code) {
        await window.api.cases.saveAnamnesis({
          case_id: Number(caseId),
          primary_problem_code: editRow.new_problem_code,
        });
      }

      setEditId(null);
      setEditRow(null);
      await loadSessions(Number(caseId));
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteRow(id: number) {
    if (!confirm("Sitzung löschen?")) return;
    await window.api.sessions.delete(id);
    await loadSessions(Number(caseId));
  }

  /* ---------------------------------- render --------------------------------- */

  return (
    <section className="n4-panel">
      <h2>Sitzungen</h2>

      {/* Auswahl */}
      <div className="n4-row n4-form">
        <label>
          Klient
          <select
            value={clientId}
            onChange={e => setClientId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">– wählen –</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </label>

        <label>
          Fall
          <select
            value={caseId}
            onChange={e => setCaseId(e.target.value === "" ? "" : Number(e.target.value))}
            disabled={clientId === ""}
          >
            <option value="">– wählen –</option>
            {cases.map(cs =>
              <option key={cs.id} value={cs.id}>#{cs.id} • {cs.method_code} • {cs.primary_problem_code}</option>
            )}
          </select>
        </label>
      </div>

      {/* Neu anlegen */}
      <form onSubmit={createSession} className="n4-form">
        <div className="n4-row n4-row--3">
          <label>Datum
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label>Topic
            <input value={topic} onChange={e => setTopic(e.target.value)} />
          </label>
          <label>SUD
            <input type="number" min={0} max={10}
                   value={sud}
                   onChange={e => setSud(e.target.value === "" ? "" : Number(e.target.value))} />
          </label>
        </div>

        <div className="n4-row n4-row--3">
          <label>Dauer (Min.)
            <input type="number" min={0}
                   value={duration}
                   onChange={e => setDuration(e.target.value === "" ? "" : Number(e.target.value))} />
          </label>
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
        </div>

        <div className="n4-row">
          <label className="n4-grow">Veränderungen seit letzter Sitzung
            <input value={changeNote} onChange={e => setChangeNote(e.target.value)} />
          </label>
        </div>

        <label className="n4-block">Notiz
          <textarea value={note} onChange={e => setNote(e.target.value)} />
        </label>

        <button type="submit" className="n4-primary" disabled={busy || caseId === ""}>
          Sitzung speichern
        </button>
      </form>

      {error && <p className="n4-error" role="alert">⚠️ {error}</p>}

      {/* Tabelle */}
      <div className="n4-table-wrap" style={{ marginTop: 12 }}>
        <table className="n4-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Topic</th>
              <th>SUD</th>
              <th>Min</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s =>
              editId === s.id && editRow ? (
                <tr key={s.id}>
                  <td>
                    {/* Datum read-only (IPC-Update unterstützt date nicht) */}
                    <input type="date" value={editRow.date ?? ""} disabled />
                  </td>
                  <td>
                    <input
                      value={editRow.topic ?? ""}
                      onChange={e => setEditRow(r => r && ({ ...r, topic: e.target.value }))}
                    />

                    <div className="n4-row n4-row--2" style={{ marginTop: 8 }}>
                      <label>Methode (diese Sitzung)
                        <select
                          value={editRow.method_code_session ?? ""}
                          onChange={e => setEditRow(r => r && ({ ...r, method_code_session: e.target.value || null }))}
                        >
                          <option value="">– wie im Fall –</option>
                          {methods.map(m => <option key={m.code} value={m.code}>{m.label}</option>)}
                        </select>
                      </label>
                      <label>Neues Problem?
                        <select
                          value={editRow.new_problem_code ?? ""}
                          onChange={e => setEditRow(r => r && ({ ...r, new_problem_code: e.target.value || null }))}
                        >
                          <option value="">– keines –</option>
                          {problems.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
                        </select>
                      </label>
                    </div>

                    <div className="n4-row" style={{ marginTop: 8 }}>
                      <label className="n4-grow">Veränderungen seit letzter Sitzung
                        <input
                          value={editRow.change_note ?? ""}
                          onChange={e => setEditRow(r => r && ({ ...r, change_note: e.target.value || null }))}
                        />
                      </label>
                    </div>
                  </td>

                  <td>
                    <input type="number" min={0} max={10}
                           value={editRow.sud_session ?? ""}
                           onChange={e => setEditRow(r => r && ({
                             ...r,
                             sud_session: e.target.value === "" ? null : Number(e.target.value)
                           }))} />
                  </td>
                  <td>
                    <input type="number" min={0}
                           value={editRow.duration_min ?? ""}
                           onChange={e => setEditRow(r => r && ({
                             ...r,
                             duration_min: e.target.value === "" ? null : Number(e.target.value)
                           }))} />
                  </td>
                  <td className="n4-actions">
                    <button className="n4-primary" onClick={() => void saveEditRow()}>Speichern</button>
                    <button onClick={() => { setEditId(null); setEditRow(null); }}>Abbrechen</button>
                  </td>
                </tr>
              ) : (
                <tr key={s.id}>
                  <td>{s.date.slice(0, 10)}</td>
                  <td>{s.topic ?? "—"}</td>
                  <td>{s.sud_session ?? "—"}</td>
                  <td>{s.duration_min ?? "—"}</td>
                  <td className="n4-actions">
                    <button onClick={() => startEditRow(s)}>✎</button>
                    <button onClick={() => void deleteRow(s.id)}>🗑</button>
                  </td>
                </tr>
              )
            )}
            {sessions.length === 0 &&
              <tr><td colSpan={5} style={{ textAlign: "center", opacity: .7 }}>Noch keine Sitzungen</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
