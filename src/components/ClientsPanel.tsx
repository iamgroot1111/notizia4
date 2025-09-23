import { type FormEvent, useEffect, useMemo, useState } from "react";
import AnamnesisEditor, { type Anamnesis } from "./AnamnesisEditor";

type Client = { id: number; code: string; full_name: string; gender?: string | null; age_years?: number | null };

const toMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function ClientsPanel() {
  const [list, setList] = useState<Client[]>([]);
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<string | "">("");
  const [age, setAge] = useState<number | "">("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Anamnese (optional)
  const [ana, setAna] = useState<Anamnesis>({
    primary_problem_code: undefined,
    target_description: "",
    previous_therapies: [],
    medications: []
  });

  async function reload() {
    setBusy(true); setError(null);
    try { setList(await window.api.clients.list()); }
    catch (e: unknown) { setError(toMsg(e)); }
    finally { setBusy(false); }
  }
  useEffect(() => { void reload(); }, []);

  function hasAnamnesisContent(a: Anamnesis) {
    return Boolean(
      a.primary_problem_code ||
      (a.target_description && a.target_description.trim()) ||
      a.previous_therapies.length ||
      a.medications.length
    );
  }

  async function createClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fullName.trim()) return;

    setBusy(true); setError(null);
    try {
      const res = await window.api.clients.create({
        full_name: fullName.trim(),
        gender: gender || null,
        age_years: age === "" ? null : Number(age)
      });

      // Wenn Anamnese erfasst wurde -> direkt einen Fall anlegen und Anamnese speichern
      if (hasAnamnesisContent(ana)) {
        const caseRes = await window.api.cases.create({
          client_id: res.id,
          primary_problem_code: ana.primary_problem_code,
          target_description: ana.target_description || null
        });
        await window.api.cases.saveAnamnesis({
          case_id: caseRes.id,
          primary_problem_code: ana.primary_problem_code,
          target_description: ana.target_description || null,
          previous_therapies: ana.previous_therapies,
          medications: ana.medications
        });
      }

      // Reset
      setFullName(""); setGender(""); setAge("");
      setAna({ primary_problem_code: undefined, target_description: "", previous_therapies: [], medications: [] });
      await reload();
    } catch (e: unknown) {
      setError(toMsg(e));
    } finally { setBusy(false); }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(c =>
      c.full_name.toLowerCase().includes(q)
      || (c.gender ?? "").toLowerCase().includes(q)
      || String(c.age_years ?? "").includes(q)
    );
  }, [list, query]);

  return (
    <section className="n4-panel">
      <h2>Klienten</h2>

      <form onSubmit={createClient} className="n4-form">
        <div className="n4-row">
          <label style={{ flex: 1 }}>
            Voller Name
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="z. B. Holger Meier" required />
          </label>
          <label>
            Geschlecht
            <select value={gender} onChange={e => setGender(e.target.value)}>
              <option value="">– auswählen –</option>
              <option value="w">weiblich</option>
              <option value="m">männlich</option>
              <option value="d">divers</option>
              <option value="u">unbekannt</option>
            </select>
          </label>
          <label>
            Alter
            <input type="number" min={0} value={age} onChange={e => setAge(e.target.value === "" ? "" : Number(e.target.value))} />
          </label>
          <button type="submit" disabled={busy || !fullName}>Anlegen</button>
        </div>

        {/* Anamnese-Block (optional) */}
        <AnamnesisEditor value={ana} onChange={setAna} />
      </form>

      <div className="n4-row" style={{ marginTop: 8 }}>
        <label style={{ flex: 1 }}>
          Suchen
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, Geschlecht oder Alter…" />
        </label>
        <button onClick={() => void reload()} disabled={busy}>Aktualisieren</button>
      </div>

      {error && <p className="n4-error">⚠️ {error}</p>}

      <div className="n4-table-wrap">
        <table className="n4-table">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Geschlecht</th><th>Alter</th></tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.full_name}</td>
                <td>{c.gender ?? "—"}</td>
                <td>{c.age_years ?? "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: "center", opacity: .7 }}>Keine Einträge</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
