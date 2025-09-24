import { useEffect, useMemo, useState, type FormEvent } from "react";

/* Typen von der Bridge ableiten */
type Client      = Awaited<ReturnType<typeof window.api.clients.list>>[number];
type CaseRow     = Awaited<ReturnType<typeof window.api.cases.listByClient>>[number];
type CatalogItem = { code: string; label: string };
type Gender = "m" | "w" | "d" | "u";

/* Detail-Listen */
type PrevTher = { therapy_type_code: string; since_month: string | null; duration_months: number | null; is_completed: boolean; note: string | null; };
type MedItem  = { med_code: string; since_month: string | null; dosage_note: string | null; };

const toMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function ClientsPanel() {
  /* Kataloge */
  const [methods, setMethods] = useState<CatalogItem[]>([]);
  const [problems, setProblems] = useState<CatalogItem[]>([]);
  const [therTypes, setTherTypes] = useState<CatalogItem[]>([]);
  const [medCatalog, setMedCatalog] = useState<CatalogItem[]>([]);

  /* Daten */
  const [clients, setClients] = useState<Client[]>([]);
  const [ageByClient, setAgeByClient] = useState<Record<number, number | null>>({});

  /* Status */
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Anlegen */
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [ageAtStart, setAgeAtStart] = useState<number | "">("");

  /* Suche + Listen-UI */
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(true);

  /* Aufklapp-Details */
  const [openClientId, setOpenClientId] = useState<number | null>(null);
  const [clientCases, setClientCases] = useState<CaseRow[]>([]);
  const [editCase, setEditCase] = useState<Partial<CaseRow & {
    sud_current: number | null;
    problem_since_month: string | null;
  }>>({});

  const [prevTherapies, setPrevTherapies] = useState<PrevTher[]>([]);
  const [medications, setMedications]   = useState<MedItem[]>([]);

  /* Laden */
  async function reload() {
    setBusy(true); setError(null);
    try {
      const list = await window.api.clients.list();
      setClients(list);
      const ages = await Promise.all(list.map(async c => {
        const cs = await window.api.cases.listByClient(c.id);
        const newest = cs[0];
        return [c.id, newest?.age_years_at_start ?? null] as const;
      }));
      setAgeByClient(Object.fromEntries(ages));
    } catch (e) { setError(toMsg(e)); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    void reload();
    window.api.catalog.therapyMethods().then(setMethods).catch(() => setMethods([]));
    window.api.catalog.problemCategories().then(setProblems).catch(() => setProblems([]));
    window.api.catalog.previousTherapyTypes().then(setTherTypes).catch(() => setTherTypes([]));
    window.api.catalog.medicationCatalog().then(setMedCatalog).catch(() => setMedCatalog([]));
  }, []);

  /* Klient anlegen: nur Name, Geschlecht, Alter (Start) */
  async function createClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fullName.trim() || !gender || ageAtStart === "") return;

    setBusy(true); setError(null);
    try {
      await window.api.clients.create({
        full_name: fullName.trim(),
        gender: gender as Gender,
        intake: { age_years_at_start: Number(ageAtStart) } // nur Alter; Rest in der Anamnese unten
      });
      setFullName(""); setGender(""); setAgeAtStart("");
      await reload();
    } catch (e) { setError(toMsg(e)); }
    finally { setBusy(false); }
  }

  /* Suche */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? clients.filter(c => c.full_name.toLowerCase().includes(q)) : clients;
  }, [clients, query]);

  /* Details auf/zu */
  async function toggleDetails(clientId: number) {
    if (openClientId === clientId) {
      setOpenClientId(null);
      setClientCases([]); setEditCase({}); setPrevTherapies([]); setMedications([]);
      return;
    }
    setOpenClientId(clientId);
    const cs = await window.api.cases.listByClient(clientId);
    setClientCases(cs);
    if (cs[0]) {
      const full = await window.api.cases.readFull(cs[0].id);
      if (full) {
        setEditCase({
          id: full.id,
          method_code: full.method_code,
          primary_problem_code: full.primary_problem_code,
          target_description: full.target_description ?? "",
          sud_start: full.sud_start ?? null,
          sud_current: full.sud_current ?? null,
          problem_since_month: full.problem_since_month ?? null,
          problem_duration_months: full.problem_duration_months ?? null,
          age_years_at_start: full.age_years_at_start ?? null,
        });
        setPrevTherapies(full.previous_therapies || []);
        setMedications(full.medications || []);
      }
    } else {
      setEditCase({});
      setPrevTherapies([]); setMedications([]);
    }
  }

  async function createAnamnesis() {
    if (!openClientId) return;
    const v = prompt("Alter (Start) in Jahren:");
    if (!v) return;
    const age = Number(v);
    if (Number.isNaN(age)) return alert("Bitte eine Zahl eingeben.");
    await window.api.cases.create({
      client_id: openClientId,
      method_code: "AUFLOESENDE_HYPNOSE",
      primary_problem_code: "UNSPEC",
      age_years_at_start: age
    });
    await toggleDetails(openClientId);
    await reload();
  }

  async function saveAnamnesis() {
    if (!editCase.id) return;
    setBusy(true); setError(null);
    try {
      await window.api.cases.saveAnamnesis({
        case_id: editCase.id,
        method_code: editCase.method_code,
        primary_problem_code: editCase.primary_problem_code,
        target_description: (editCase.target_description ?? null) as string | null,
        sud_start: (editCase.sud_start ?? null) as number | null,
        sud_current: (editCase.sud_current ?? null) as number | null,
        problem_since_month: (editCase.problem_since_month ?? null) as string | null,
        problem_duration_months: (editCase.problem_duration_months ?? null) as number | null,
        age_years_at_start: (editCase.age_years_at_start ?? null) as number | null,
        previous_therapies: prevTherapies,
        medications: medications
      });
      if (openClientId) await toggleDetails(openClientId);
      await reload();
    } catch (e) { setError(toMsg(e)); }
    finally { setBusy(false); }
  }

  async function deleteAnamnesis() {
    if (!editCase.id) return;
    if (!confirm("Anamnese (mit Sitzungen) löschen?")) return;
    await window.api.cases.delete(editCase.id);
    if (openClientId) await toggleDetails(openClientId);
    await reload();
  }

  /* Hilfsfunktionen für Listen im Detail */
  function addPrevTher() {
    setPrevTherapies(v => [...v, {
      therapy_type_code: therTypes[0]?.code || "",
      since_month: null, duration_months: null, is_completed: false, note: null
    }]);
  }
  function updPrevTher(i: number, patch: Partial<PrevTher>) {
    setPrevTherapies(v => v.map((x,idx) => idx===i ? {...x, ...patch} : x));
  }
  function delPrevTher(i: number) {
    setPrevTherapies(v => v.filter((_,idx)=> idx!==i));
  }

  function addMed() {
    setMedications(v => [...v, { med_code: medCatalog[0]?.code || "", since_month: null, dosage_note: null }]);
  }
  function updMed(i: number, patch: Partial<MedItem>) {
    setMedications(v => v.map((x,idx) => idx===i ? {...x, ...patch} : x));
  }
  function delMed(i: number) {
    setMedications(v => v.filter((_,idx)=> idx!==i));
  }

  /* Render */
  return (
    <section className="n4-panel">
      <h2>Klienten</h2>

      {/* Anlegen */}
      <form onSubmit={createClient} className="n4-form" aria-label="Klient anlegen">
        <div className="n4-row">
          <label style={{ flex: 2 }}>
            Voller Name
            <input value={fullName} onChange={e => setFullName(e.target.value)} required />
          </label>
          <label>
            Geschlecht
            <select value={gender} onChange={e => setGender(e.target.value as Gender | "")} required>
              <option value="">– wählen –</option>
              <option value="m">m</option>
              <option value="w">w</option>
              <option value="d">d</option>
              <option value="u">u</option>
            </select>
          </label>
          <label>
            Alter (Start)
            <input type="number" min={0} max={120}
                   value={ageAtStart}
                   onChange={e => setAgeAtStart(e.target.value === "" ? "" : Number(e.target.value))}
                   required />
          </label>
          <button type="submit" disabled={busy || !fullName.trim() || !gender || ageAtStart === ""}>
            Anlegen
          </button>
        </div>
      </form>

      {/* Suche + Listen-Schalter */}
      <div className="n4-row" style={{ marginTop: 8 }}>
        <label style={{ flex: 1 }}>
          Suchen
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name …" />
        </label>
        <button onClick={() => setListOpen(o => !o)}>{listOpen ? "Liste ausblenden" : "Liste anzeigen"}</button>
        <button onClick={() => void reload()} disabled={busy}>Aktualisieren</button>
      </div>

      {error && <p className="n4-error">⚠️ {error}</p>}

      {/* Liste */}
      {listOpen && (
        <div className="n4-table-wrap" style={{ marginTop: 8 }}>
          <table className="n4-table">
            <thead><tr><th style={{width:36}}></th><th>ID</th><th>Name</th><th>Alter</th><th>Geschlecht</th></tr></thead>
            <tbody>
              {filtered.map(c => (
                <>
                  <tr key={c.id}>
                    <td>
                      <button onClick={() => void toggleDetails(c.id)}
                              title={openClientId === c.id ? "Einklappen" : "Aufklappen"}>
                        {openClientId === c.id ? "▾" : "▸"}
                      </button>
                    </td>
                    <td>{c.id}</td>
                    <td>{c.full_name}</td>
                    <td>{ageByClient[c.id] ?? "—"}</td>
                    <td>{c.gender ?? "—"}</td>
                  </tr>

                  {openClientId === c.id && (
                    <tr key={`details_${c.id}`}>
                      <td></td>
                      <td colSpan={4}>
                        <div className="n4-card">

                          {/* Anamnese */}
                          <div className="n4-row" style={{alignItems:"center"}}>
                            <h3 style={{margin: 0, flex:1}}>Fall (Anamnese)</h3>
                            {clientCases.length === 0 &&
                              <button onClick={() => void createAnamnesis()}>Anamnese anlegen</button>}
                          </div>

                          {clientCases.length > 0 && (
                            <>
                              <div className="n4-row">
                                <label>
                                  Methode (Fall)
                                  <select
                                    value={editCase.method_code ?? ""}
                                    onChange={e => setEditCase(v => ({...v, method_code: e.target.value}))}>
                                    {methods.map(m => <option key={m.code} value={m.code}>{m.label}</option>)}
                                  </select>
                                </label>

                                <label>
                                  Alter (Start)
                                  <input type="number" min={0} max={120}
                                         value={editCase.age_years_at_start ?? ""}
                                         onChange={e => setEditCase(v => ({
                                           ...v, age_years_at_start: e.target.value === "" ? null : Number(e.target.value)
                                         }))}/>
                                </label>

                                <label>
                                  Problem
                                  <select
                                    value={editCase.primary_problem_code ?? ""}
                                    onChange={e => setEditCase(v => ({...v, primary_problem_code: e.target.value}))}>
                                    {problems.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
                                  </select>
                                </label>
                              </div>

                              <div className="n4-row">
                                <label>
                                  Problem seit wann
                                  <input type="month"
                                         value={editCase.problem_since_month ?? ""}
                                         onChange={e => setEditCase(v => ({...v, problem_since_month: e.target.value || null}))}/>
                                </label>

                                <label>
                                  SUD (Start, 0–10)
                                  <input type="number" min={0} max={10}
                                         value={editCase.sud_start ?? ""}
                                         onChange={e => setEditCase(v => ({
                                           ...v, sud_start: e.target.value === "" ? null : Number(e.target.value)
                                         }))}/>
                                </label>

                                <label>
                                  SUD (aktuell, 0–10)
                                  <input type="number" min={0} max={10}
                                         value={editCase.sud_current ?? ""}
                                         onChange={e => setEditCase(v => ({
                                           ...v, sud_current: e.target.value === "" ? null : Number(e.target.value)
                                         }))}/>
                                </label>

                                <label>
                                  Problem‑Dauer (Monate)
                                  <input type="number" min={0}
                                         value={editCase.problem_duration_months ?? ""}
                                         onChange={e => setEditCase(v => ({
                                           ...v, problem_duration_months: e.target.value === "" ? null : Number(e.target.value)
                                         }))}/>
                                </label>
                              </div>

                              <label className="n4-block">
                                Ziel (Wunsch des Klienten)
                                <input
                                  value={(editCase.target_description as string | undefined) ?? ""}
                                  onChange={e => setEditCase(v => ({...v, target_description: e.target.value}))}
                                />
                              </label>

                              {/* Bisherige Therapien */}
                              <h4 style={{marginTop:12}}>Bisherige Therapien</h4>
                              <div className="n4-table-wrap">
                                <table className="n4-table">
                                  <thead>
                                    <tr><th>Art</th><th>seit wann</th><th>Dauer (Monate)</th><th>abgeschlossen</th><th>Notiz</th><th></th></tr>
                                  </thead>
                                  <tbody>
                                  {prevTherapies.map((t,i) => (
                                    <tr key={i}>
                                      <td>
                                        <select value={t.therapy_type_code}
                                                onChange={e => updPrevTher(i, { therapy_type_code: e.target.value })}>
                                          {therTypes.map(tt => <option key={tt.code} value={tt.code}>{tt.label}</option>)}
                                        </select>
                                      </td>
                                      <td>
                                        <input type="month" value={t.since_month ?? ""}
                                               onChange={e => updPrevTher(i, { since_month: e.target.value || null })}/>
                                      </td>
                                      <td>
                                        <input type="number" min={0} value={t.duration_months ?? ""}
                                               onChange={e => updPrevTher(i, { duration_months: e.target.value === "" ? null : Number(e.target.value) })}/>
                                      </td>
                                      <td>
                                        <input type="checkbox" checked={!!t.is_completed}
                                               onChange={e => updPrevTher(i, { is_completed: e.target.checked })}/>
                                      </td>
                                      <td>
                                        <input value={t.note ?? ""} onChange={e => updPrevTher(i, { note: e.target.value || null })}/>
                                      </td>
                                      <td><button onClick={() => delPrevTher(i)}>🗑</button></td>
                                    </tr>
                                  ))}
                                  {prevTherapies.length === 0 &&
                                    <tr><td colSpan={6} style={{textAlign:"center",opacity:.7}}>keine Einträge</td></tr>}
                                  </tbody>
                                </table>
                              </div>
                              <button onClick={addPrevTher} type="button">+ Therapie hinzufügen</button>

                              {/* Medikamente */}
                              <h4 style={{marginTop:12}}>Medikamente</h4>
                              <div className="n4-table-wrap">
                                <table className="n4-table">
                                  <thead><tr><th>Medikament</th><th>seit wann</th><th>Dosierung/Notiz</th><th></th></tr></thead>
                                  <tbody>
                                  {medications.map((m,i) => (
                                    <tr key={i}>
                                      <td>
                                        <select value={m.med_code}
                                                onChange={e => updMed(i, { med_code: e.target.value })}>
                                          {medCatalog.map(mc => <option key={mc.code} value={mc.code}>{mc.label}</option>)}
                                        </select>
                                      </td>
                                      <td>
                                        <input type="month" value={m.since_month ?? ""}
                                               onChange={e => updMed(i, { since_month: e.target.value || null })}/>
                                      </td>
                                      <td>
                                        <input value={m.dosage_note ?? ""} onChange={e => updMed(i, { dosage_note: e.target.value || null })}/>
                                      </td>
                                      <td><button onClick={() => delMed(i)}>🗑</button></td>
                                    </tr>
                                  ))}
                                  {medications.length === 0 &&
                                    <tr><td colSpan={4} style={{textAlign:"center",opacity:.7}}>keine Einträge</td></tr>}
                                  </tbody>
                                </table>
                              </div>
                              <button onClick={addMed} type="button">+ Medikament hinzufügen</button>

                              <div className="n4-row" style={{marginTop:12}}>
                                <button onClick={() => void saveAnamnesis()} disabled={busy}>Anamnese speichern</button>
                                <button onClick={() => void deleteAnamnesis()} disabled={busy}>Anamnese löschen</button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{textAlign:"center",opacity:.7}}>Keine Einträge</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
