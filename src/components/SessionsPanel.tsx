import { useEffect, useState } from "react";

type Client = { id: number; full_name: string; code: string };
type Case = { id: number; client_id: number; method_code: string; primary_problem_code: string; start_date: string; target_description?: string | null };
type CaseFull = Case & { previous_therapies: Array<{ therapy_type_code: string; duration_months?: number | null; note?: string | null }>;
                         medications: Array<{ med_code: string; since_month?: number | null; dosage_note?: string | null }> };
type Session = { id: number; case_id: number; date: string; topic?: string | null; sud_session?: number | null; duration_min?: number | null };

const METHOD_OPTIONS = [
  { code: "AUFLOESENDE_HYPNOSE", label: "Auflösende Hypnose" },
  { code: "EMDR",                 label: "EMDR" },
  { code: "GESPRACH",             label: "Gesprächstherapie" },
  { code: "UNSPEC",               label: "Unbestimmt" }
];

const toMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function SessionsPanel() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | "">("");
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | "">("");
  const [caseFull, setCaseFull] = useState<CaseFull | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formular neue Sitzung
  const [topic, setTopic] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sud, setSud] = useState<number | "">("");
  const [duration, setDuration] = useState<number | "">("");
  const [note, setNote] = useState("");

  async function loadClients() {
    setBusy(true); setError(null);
    try {
      const data = await window.api.clients.list();
      setClients(data);
    } catch (e: unknown) { setError(toMsg(e)); }
    finally { setBusy(false); }
  }
  async function loadCases(clientId: number) {
    setBusy(true); setError(null);
    try { setCases(await window.api.cases.listByClient(clientId)); }
    catch (e: unknown) { setError(toMsg(e)); }
    finally { setBusy(false); }
  }
  async function loadCaseFull(caseId: number) {
    setBusy(true); setError(null);
    try { setCaseFull(await window.api.cases.readFull(caseId)); }
    catch (e: unknown) { setError(toMsg(e)); }
    finally { setBusy(false); }
  }
  async function loadSessions(caseId: number) {
    setBusy(true); setError(null);
    try { setSessions(await window.api.sessions.listByCase(caseId)); }
    catch (e: unknown) { setError(toMsg(e)); }
    finally { setBusy(false); }
  }

  useEffect(() => { void loadClients(); }, []);
  useEffect(() => {
    if (selectedClientId !== "") {
      setSelectedCaseId(""); setCaseFull(null); setSessions([]); void loadCases(Number(selectedClientId));
    } else { setCases([]); setSessions([]); setCaseFull(null); }
  }, [selectedClientId]);
  useEffect(() => {
    if (selectedCaseId !== "") { void loadCaseFull(Number(selectedCaseId)); void loadSessions(Number(selectedCaseId)); }
    else { setCaseFull(null); setSessions([]); }
  }, [selectedCaseId]);

  async function createQuickCase() {
    if (selectedClientId === "") return;
    setBusy(true); setError(null);
    try {
      const res = await window.api.cases.create({ client_id: Number(selectedClientId) });
      await loadCases(Number(selectedClientId));
      setSelectedCaseId(res.id);
    } catch (e: unknown) { setError(toMsg(e)); }
    finally { setBusy(false); }
  }

  async function saveMethod(newMethod: string) {
    if (selectedCaseId === "" || !caseFull) return;
    setBusy(true); setError(null);
    try {
      await window.api.cases.updateMethod({ case_id: Number(selectedCaseId), method_code: newMethod });
      await loadCaseFull(Number(selectedCaseId));
    } catch (e: unknown) { setError(toMsg(e)); }
    finally { setBusy(false); }
  }

  async function createSession(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedCaseId === "") return;
    setBusy(true); setError(null);
    try {
      await window.api.sessions.create({
        case_id: Number(selectedCaseId),
        date, topic: topic || null,
        sud_session: sud === "" ? null : Number(sud),
        duration_min: duration === "" ? null : Number(duration),
        note: note || null
      });
      setTopic(""); setSud(""); setDuration(""); setNote("");
      await loadSessions(Number(selectedCaseId));
    } catch (e: unknown) { setError(toMsg(e)); }
    finally { setBusy(false); }
  }

  return (
    <section className="n4-panel">
      <h2>Sitzungen</h2>

      <div className="n4-row">
        <label style={{ flex: 1 }}>
          Klient
          <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">– auswählen –</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </label>
        <button onClick={() => void loadClients()} disabled={busy}>Neu laden</button>
      </div>

      <div className="n4-row">
        <label style={{ flex: 1 }}>
          Fall (Case)
          <select value={selectedCaseId} onChange={e => setSelectedCaseId(e.target.value ? Number(e.target.value) : "")} disabled={selectedClientId === ""}>
            <option value="">– auswählen –</option>
            {cases.map(cs => (
              <option key={cs.id} value={cs.id}>
                #{cs.id} • {cs.primary_problem_code || "UNSPEC"} • {cs.start_date}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => void createQuickCase()} disabled={busy || selectedClientId === ""}>Neuen Fall anlegen</button>
      </div>

      {/* Anamnese-Übersicht & Methode */}
      {caseFull && (
        <div className="n4-card" style={{ marginTop: 8 }}>
          <h3 style={{ marginTop: 0 }}>Anamnese</h3>
          <div className="n4-row">
            <div><strong>Problem:</strong> {caseFull.primary_problem_code || "—"}</div>
            <div style={{ flex: 1 }}><strong>Ziel:</strong> {caseFull.target_description || "—"}</div>
          </div>
          <div className="n4-row">
            <label>
              Methode
              <select value={caseFull.method_code} onChange={e => void saveMethod(e.target.value)}>
                {METHOD_OPTIONS.map(m => <option key={m.code} value={m.code}>{m.label}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
            <div>
              <h4 style={{ marginTop: 0 }}>Vor‑Therapien</h4>
              <ul>
                {caseFull.previous_therapies.length ? caseFull.previous_therapies.map((t, i) =>
                  <li key={i}>{t.therapy_type_code} {t.duration_months ? `• ${t.duration_months} Monate` : ""} {t.note ? `• ${t.note}` : ""}</li>
                ) : <li style={{ opacity: .7 }}>—</li>}
              </ul>
            </div>
            <div>
              <h4 style={{ marginTop: 0 }}>Medikation</h4>
              <ul>
                {caseFull.medications.length ? caseFull.medications.map((m, i) =>
                  <li key={i}>{m.med_code} {m.since_month ? `• seit ${m.since_month} Monat(en)` : ""} {m.dosage_note ? `• ${m.dosage_note}` : ""}</li>
                ) : <li style={{ opacity: .7 }}>—</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Formular neue Sitzung */}
      <div className="n4-card" style={{ marginTop: 12 }}>
        <form onSubmit={createSession} className="n4-form">
          <div className="n4-row">
            <label>
              Datum
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </label>
            <label>
              Thema
              <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Sitzungsthema…" />
            </label>
            <label>
              SUD (0–10)
              <input type="number" min={0} max={10} value={sud} onChange={e => setSud(e.target.value === "" ? "" : Number(e.target.value))} />
            </label>
            <label>
              Dauer (min)
              <input type="number" min={0} value={duration} onChange={e => setDuration(e.target.value === "" ? "" : Number(e.target.value))} />
            </label>
          </div>
          <label className="n4-block">
            Notiz
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Freitext (FTS5) – wird in personal.sqlite gespeichert…" />
          </label>
          <button type="submit" disabled={busy || selectedCaseId === ""}>Sitzung anlegen</button>
        </form>
        {error && <p className="n4-error">⚠️ {error}</p>}
      </div>

      {/* Liste Sitzungen */}
      <div className="n4-card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Liste (neueste zuerst)</h3>
        <div className="n4-table-wrap">
          <table className="n4-table">
            <thead><tr><th>ID</th><th>Datum</th><th>Thema</th><th>SUD</th><th>Dauer</th></tr></thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.date?.slice(0, 10)}</td>
                  <td>{s.topic ?? "—"}</td>
                  <td>{s.sud_session ?? "—"}</td>
                  <td>{s.duration_min ?? "—"}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", opacity: .7 }}>Noch keine Sitzungen</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
