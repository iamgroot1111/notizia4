import React, { useEffect, useMemo, useState, type FormEvent } from "react";

/* ---------- Typen direkt aus der Preload-Bridge ableiten ---------- */
type Client = Awaited<ReturnType<typeof window.api.clients.list>>[number];
type CaseRow = Awaited<ReturnType<typeof window.api.cases.listByClient>>[number];
type CaseFull = NonNullable<
  Awaited<ReturnType<typeof window.api.cases.readFull>>
>;
type CatalogItem = { code: string; label: string };
type Gender = "m" | "w" | "d" | "u";

/** exakte Payload-Typen der Bridge (kein any) */
type ClientsCreatePayload = Parameters<typeof window.api.clients.create>[0];
type CasesCreatePayload = Parameters<typeof window.api.cases.create>[0];
type SaveAnamnesisPayload =
  Parameters<typeof window.api.cases.saveAnamnesis>[0];

/* ---------- Detail-Listen ---------- */
type PrevTher = {
  therapy_type_code: string;
  since_month: string | null; // YYYY-MM
  duration_months: number | null;
  is_completed: boolean;
  note: string | null;
};

type MedItem = {
  med_code: string;
  since_month: string | null; // YYYY-MM
  dosage_note: string | null;
};

const toMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Monate zwischen YYYY-MM (oder YYYY-MM-DD) und Referenzdatum (ISO yyyy-mm-dd) */
function monthsBetweenYM(sinceYYYYMM: string, refISO?: string): number | null {
  if (!sinceYYYYMM) return null;
  const parts = sinceYYYYMM.split("-");
  const sy = parseInt(parts[0]!, 10);
  const sm = parseInt(parts[1]!, 10);
  if (!sy || !sm) return null;
  const ref = refISO ? new Date(refISO) : new Date();
  const ry = ref.getFullYear();
  const rm = ref.getMonth() + 1; // 1..12
  const months = (ry - sy) * 12 + (rm - sm);
  return Math.max(0, months);
}

export default function ClientsPanel(): React.JSX.Element {
  /* ---------- Kataloge ---------- */
  const [methods, setMethods] = useState<CatalogItem[]>([]);
  const [problems, setProblems] = useState<CatalogItem[]>([]);
  const [therTypes, setTherTypes] = useState<CatalogItem[]>([]);
  const [medCatalog, setMedCatalog] = useState<CatalogItem[]>([]);

  /* ---------- Daten ---------- */
  const [clients, setClients] = useState<Client[]>([]);
  const [ageByClient, setAgeByClient] = useState<Record<number, number | null>>(
    {}
  );

  /* ---------- Status ---------- */
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------- Anlegen ---------- */
  const [fullName, setFullName] = useState<string>("");
  const [gender, setGender] = useState<Gender | "">("");
  const [ageAtStart, setAgeAtStart] = useState<number | "">("");

  /* ---------- Suche + Listen-UI ---------- */
  const [query, setQuery] = useState<string>("");
  const [listOpen, setListOpen] = useState<boolean>(true);

  /* ---------- Aufklapp-Details ---------- */
  const [openClientId, setOpenClientId] = useState<number | null>(null);
  const [clientCases, setClientCases] = useState<CaseRow[]>([]);
  const [editCase, setEditCase] = useState<
    Partial<
      CaseRow & {
        // zusätzliche, im Full-Objekt vorhandene Felder:
        sud_start: number | null;
        sud_current: number | null;
        problem_since_month: string | null;
        problem_duration_months: number | null;
        age_years_at_start: number | null;
        target_description: string | null;
      }
    >
  >({});

  const [prevTherapies, setPrevTherapies] = useState<PrevTher[]>([]);
  const [medications, setMedications] = useState<MedItem[]>([]);

  /* ---------- Laden ---------- */
  async function reload(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const list = await window.api.clients.list();
      setClients(list);
      const ages = await Promise.all(
        list.map(async (c) => {
          const cs = await window.api.cases.listByClient(c.id);
          const newest = cs[0];
          return [c.id, newest?.age_years_at_start ?? null] as const;
        })
      );
      setAgeByClient(Object.fromEntries(ages));
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void reload();
    window.api.catalog.therapyMethods().then(setMethods).catch(() => setMethods([]));
    window.api.catalog.problemCategories().then(setProblems).catch(() => setProblems([]));
    window.api.catalog.previousTherapyTypes().then(setTherTypes).catch(() => setTherTypes([]));
    window.api.catalog.medicationCatalog().then(setMedCatalog).catch(() => setMedCatalog([]));
  }, []);

  /* ---------- Klient anlegen: nur Name, Geschlecht, Alter (Start) ---------- */
  async function createClient(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!fullName.trim() || !gender || ageAtStart === "") return;

    setBusy(true);
    setError(null);
    try {
      const payload: ClientsCreatePayload = {
        full_name: fullName.trim(),
        gender: gender as Gender,
        // Server legt den Case bei Bedarf später an – wir geben nur das Startalter im Intake mit.
        intake: { age_years_at_start: Number(ageAtStart) },
      };
      await window.api.clients.create(payload);
      setFullName("");
      setGender("");
      setAgeAtStart("");
      await reload();
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setBusy(false);
    }
  }

  /* ---------- Suche ---------- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? clients.filter((c) => c.full_name.toLowerCase().includes(q)) : clients;
  }, [clients, query]);

  /* ---------- Details auf/zu ---------- */
  async function toggleDetails(clientId: number): Promise<void> {
    if (openClientId === clientId) {
      setOpenClientId(null);
      setClientCases([]);
      setEditCase({});
      setPrevTherapies([]);
      setMedications([]);
      return;
    }
    setOpenClientId(clientId);
    const cs = await window.api.cases.listByClient(clientId);
    setClientCases(cs);
    if (cs[0]) {
      const full: CaseFull | null = await window.api.cases.readFull(cs[0].id);
      if (full) {
        setEditCase({
          id: full.id,
          client_id: full.client_id,
          start_date: full.start_date,
          method_code: full.method_code,
          primary_problem_code: full.primary_problem_code,
          target_description: full.target_description ?? null,
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
      setPrevTherapies([]);
      setMedications([]);
    }
  }

  async function createAnamnesis(): Promise<void> {
    if (!openClientId) return;
    const v = prompt("Alter (Start) in Jahren:");
    if (!v) return;
    const age = Number(v);
    if (Number.isNaN(age)) {
      alert("Bitte eine Zahl eingeben.");
      return;
    }
    const payload: CasesCreatePayload = {
      client_id: openClientId,
      method_code: "AUFLOESENDE_HYPNOSE",
      primary_problem_code: "UNSPEC",
      age_years_at_start: age,
      // start_date setzt der Server (heute) – wir schicken es nicht.
    };
    await window.api.cases.create(payload);
    await toggleDetails(openClientId);
    await reload();
  }

  async function saveAnamnesis(): Promise<void> {
    if (!editCase.id) return;
    setBusy(true);
    setError(null);
    try {
      // falls "seit wann" gesetzt ist und Dauer leer -> clientseitig berechnen
      let duration = editCase.problem_duration_months ?? null;
      if (editCase.problem_since_month && duration == null) {
        const ref = editCase.start_date ?? new Date().toISOString().slice(0, 10);
        duration = monthsBetweenYM(editCase.problem_since_month, ref);
      }

      const payload: SaveAnamnesisPayload = {
        case_id: editCase.id,
        method_code: editCase.method_code ?? null,
        primary_problem_code: editCase.primary_problem_code ?? null,
        target_description: editCase.target_description ?? null,
        sud_start: editCase.sud_start ?? null,
        sud_current: editCase.sud_current ?? null,
        problem_since_month: editCase.problem_since_month ?? null,
        problem_duration_months: duration,
        age_years_at_start: editCase.age_years_at_start ?? null,
        previous_therapies: prevTherapies,
        medications: medications,
      };

      await window.api.cases.saveAnamnesis(payload);
      if (openClientId) await toggleDetails(openClientId);
      await reload();
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAnamnesis(): Promise<void> {
    if (!editCase.id) return;
    if (!confirm("Anamnese (mit Sitzungen) löschen?")) return;
    await window.api.cases.delete(editCase.id);
    if (openClientId) await toggleDetails(openClientId);
    await reload();
  }

  /* ---------- Helpers: Detail-Listen ---------- */
  function addPrevTher(): void {
    setPrevTherapies((v) => [
      ...v,
      {
        therapy_type_code: therTypes[0]?.code || "",
        since_month: null,
        duration_months: null,
        is_completed: false,
        note: null,
      },
    ]);
  }
  function updPrevTher(i: number, patch: Partial<PrevTher>): void {
    setPrevTherapies((v) => v.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function delPrevTher(i: number): void {
    setPrevTherapies((v) => v.filter((_, idx) => idx !== i));
  }

  function addMed(): void {
    setMedications((v) => [
      ...v,
      { med_code: medCatalog[0]?.code || "", since_month: null, dosage_note: null },
    ]);
  }
  function updMed(i: number, patch: Partial<MedItem>): void {
    setMedications((v) => v.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function delMed(i: number): void {
    setMedications((v) => v.filter((_, idx) => idx !== i));
  }

  /* ---------- Render ---------- */
  return (
    <section className="n4-panel">
      <h2>Klienten</h2>

      {/* Anlegen */}
      <form onSubmit={createClient} className="n4-form" aria-label="Klient anlegen">
        <div className="n4-row">
          <label style={{ flex: 2 }}>
            Voller Name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </label>
          <label>
            Geschlecht
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender | "")}
              required
            >
              <option value="">– wählen –</option>
              <option value="m">m</option>
              <option value="w">w</option>
              <option value="d">d</option>
              <option value="u">u</option>
            </select>
          </label>
          <label>
            Alter (Start)
            <input
              type="number"
              min={0}
              max={120}
              value={ageAtStart}
              onChange={(e) =>
                setAgeAtStart(e.target.value === "" ? "" : Number(e.target.value))
              }
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy || !fullName.trim() || !gender || ageAtStart === ""}
          >
            Anlegen
          </button>
        </div>
      </form>

      {/* Suche + Listen-Schalter */}
      <div className="n4-row" style={{ marginTop: 8 }}>
        <label style={{ flex: 1 }}>
          Suchen
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name …"
          />
        </label>
        <button type="button" onClick={() => setListOpen((o) => !o)}>
          {listOpen ? "Liste ausblenden" : "Liste anzeigen"}
        </button>
        <button type="button" onClick={() => void reload()} disabled={busy}>
          Aktualisieren
        </button>
      </div>

      {error && <p className="n4-error">⚠️ {error}</p>}

      {/* Liste */}
      {listOpen && (
        <div className="n4-table-wrap" style={{ marginTop: 8 }}>
          <table className="n4-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>ID</th>
                <th>Name</th>
                <th>Alter</th>
                <th>Geschlecht</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <React.Fragment key={c.id}>
                  <tr>
                    <td>
                      <button
                        type="button"
                        onClick={() => void toggleDetails(c.id)}
                        title={openClientId === c.id ? "Einklappen" : "Aufklappen"}
                      >
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
                          <div className="n4-row" style={{ alignItems: "center" }}>
                            <h3 style={{ margin: 0, flex: 1 }}>Fall (Anamnese)</h3>
                            {clientCases.length === 0 && (
                              <button type="button" onClick={() => void createAnamnesis()}>
                                Anamnese anlegen
                              </button>
                            )}
                          </div>

                          {clientCases.length > 0 && (
                            <>
                              <div className="n4-row">
                                <label>
                                  Methode (Fall)
                                  <select
                                    value={editCase.method_code ?? ""}
                                    onChange={(e) =>
                                      setEditCase((v) => ({
                                        ...v,
                                        method_code: e.target.value,
                                      }))
                                    }
                                  >
                                    {methods.map((m) => (
                                      <option key={m.code} value={m.code}>
                                        {m.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label>
                                  Alter (Start)
                                  <input
                                    type="number"
                                    min={0}
                                    max={120}
                                    value={editCase.age_years_at_start ?? ""}
                                    onChange={(e) =>
                                      setEditCase((v) => ({
                                        ...v,
                                        age_years_at_start:
                                          e.target.value === "" ? null : Number(e.target.value),
                                      }))
                                    }
                                  />
                                </label>

                                <label>
                                  Problem
                                  <select
                                    value={editCase.primary_problem_code ?? ""}
                                    onChange={(e) =>
                                      setEditCase((v) => ({
                                        ...v,
                                        primary_problem_code: e.target.value,
                                      }))
                                    }
                                  >
                                    {problems.map((p) => (
                                      <option key={p.code} value={p.code}>
                                        {p.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>

                              <div className="n4-row">
                                <label>
                                  Seit wann belastend (Monat)
                                  <input
                                    type="month"
                                    min="1900-01"
                                    max="2100-12"
                                    value={editCase.problem_since_month ?? ""}
                                    onChange={(e) => {
                                      const since = e.target.value || null;
                                      setEditCase((v) => {
                                        const next = { ...v, problem_since_month: since };
                                        const ref =
                                          v?.start_date ?? new Date().toISOString().slice(0, 10);
                                        next.problem_duration_months = since
                                          ? monthsBetweenYM(since, ref)
                                          : v.problem_duration_months ?? null;
                                        return next;
                                      });
                                    }}
                                  />
                                </label>

                                <label>
                                  SUD (aktuell, 0–10)
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    value={editCase.sud_current ?? ""}
                                    onChange={(e) =>
                                      setEditCase((v) => ({
                                        ...v,
                                        sud_current:
                                          e.target.value === "" ? null : Number(e.target.value),
                                      }))
                                    }
                                  />
                                </label>

                                <label>
                                  Problemdauer (Monate)
                                  <input
                                    type="number"
                                    min={0}
                                    value={editCase.problem_duration_months ?? ""}
                                    onChange={(e) =>
                                      setEditCase((v) => ({
                                        ...v,
                                        problem_duration_months:
                                          e.target.value === "" ? null : Number(e.target.value),
                                      }))
                                    }
                                    readOnly={!!editCase.problem_since_month}
                                    placeholder={
                                      editCase.problem_since_month
                                        ? "wird aus 'Seit wann' berechnet"
                                        : undefined
                                    }
                                    title={
                                      editCase.problem_since_month
                                        ? "Automatisch aus 'Seit wann' berechnet"
                                        : ""
                                    }
                                  />
                                </label>
                              </div>

                              <label className="n4-block">
                                Ziel (Wunsch des Klienten)
                                <input
                                  value={editCase.target_description ?? ""}
                                  onChange={(e) =>
                                    setEditCase((v) => ({
                                      ...v,
                                      target_description: e.target.value,
                                    }))
                                  }
                                />
                              </label>

                              {/* Bisherige Therapien */}
                              <h4 style={{ marginTop: 12 }}>Bisherige Therapien</h4>
                              <div className="n4-table-wrap">
                                <table className="n4-table">
                                  <thead>
                                    <tr>
                                      <th>Art</th>
                                      <th>wann</th>
                                      <th>Dauer (Monate)</th>
                                      <th>abgeschlossen</th>
                                      <th>Notiz</th>
                                      <th></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {prevTherapies.map((t, i) => (
                                      <tr key={i}>
                                        <td>
                                          <select
                                            value={t.therapy_type_code}
                                            onChange={(e) =>
                                              updPrevTher(i, {
                                                therapy_type_code: e.target.value,
                                              })
                                            }
                                          >
                                            {therTypes.map((tt) => (
                                              <option key={tt.code} value={tt.code}>
                                                {tt.label}
                                              </option>
                                            ))}
                                          </select>
                                        </td>
                                        <td>
                                          <input
                                            type="month"
                                            value={t.since_month ?? ""}
                                            onChange={(e) =>
                                              updPrevTher(i, {
                                                since_month: e.target.value || null,
                                              })
                                            }
                                          />
                                        </td>
                                        <td>
                                          <input
                                            type="number"
                                            min={0}
                                            value={t.duration_months ?? ""}
                                            onChange={(e) =>
                                              updPrevTher(i, {
                                                duration_months:
                                                  e.target.value === ""
                                                    ? null
                                                    : Number(e.target.value),
                                              })
                                            }
                                          />
                                        </td>
                                        <td>
                                          <input
                                            type="checkbox"
                                            checked={!!t.is_completed}
                                            onChange={(e) =>
                                              updPrevTher(i, { is_completed: e.target.checked })
                                            }
                                          />
                                        </td>
                                        <td>
                                          <input
                                            value={t.note ?? ""}
                                            onChange={(e) =>
                                              updPrevTher(i, { note: e.target.value || null })
                                            }
                                          />
                                        </td>
                                        <td>
                                          <button type="button" onClick={() => delPrevTher(i)}>
                                            🗑
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                    {prevTherapies.length === 0 && (
                                      <tr>
                                        <td colSpan={6} style={{ textAlign: "center", opacity: 0.7 }}>
                                          keine Einträge
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                              <button onClick={addPrevTher} type="button">
                                + Therapie hinzufügen
                              </button>

                              {/* Medikamente */}
                              <h4 style={{ marginTop: 12 }}>Medikamente</h4>
                              <div className="n4-table-wrap">
                                <table className="n4-table">
                                  <thead>
                                    <tr>
                                      <th>Medikament</th>
                                      <th>seit wann</th>
                                      <th>Dosierung/Notiz</th>
                                      <th></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {medications.map((m, i) => (
                                      <tr key={i}>
                                        <td>
                                          <select
                                            value={m.med_code}
                                            onChange={(e) => updMed(i, { med_code: e.target.value })}
                                          >
                                            {medCatalog.map((mc) => (
                                              <option key={mc.code} value={mc.code}>
                                                {mc.label}
                                              </option>
                                            ))}
                                          </select>
                                        </td>
                                        <td>
                                          <input
                                            type="month"
                                            value={m.since_month ?? ""}
                                            onChange={(e) =>
                                              updMed(i, { since_month: e.target.value || null })
                                            }
                                          />
                                        </td>
                                        <td>
                                          <input
                                            value={m.dosage_note ?? ""}
                                            onChange={(e) =>
                                              updMed(i, { dosage_note: e.target.value || null })
                                            }
                                          />
                                        </td>
                                        <td>
                                          <button type="button" onClick={() => delMed(i)}>
                                            🗑
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                    {medications.length === 0 && (
                                      <tr>
                                        <td colSpan={4} style={{ textAlign: "center", opacity: 0.7 }}>
                                          keine Einträge
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                              <button onClick={addMed} type="button">
                                + Medikament hinzufügen
                              </button>

                              <div className="n4-row" style={{ marginTop: 12 }}>
                                <button onClick={() => void saveAnamnesis()} disabled={busy}>
                                  Anamnese speichern
                                </button>
                                <button onClick={() => void deleteAnamnesis()} disabled={busy}>
                                  Anamnese löschen
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", opacity: 0.7 }}>
                    Keine Einträge
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
