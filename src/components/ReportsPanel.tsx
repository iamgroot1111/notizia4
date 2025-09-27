// src/components/ReportsPanel.tsx
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";

/** Den Row‑Typ direkt aus der Bridge ableiten – bleibt immer konsistent */
type Row = Awaited<ReturnType<typeof window.api.reports.methodProblem>>[number];

const fmt = (n: number | null | undefined, digits = 1) =>
  n == null ? "—" : Number(n).toFixed(digits);

export default function ReportsPanel() {
  // UI‑State
  const [source, setSource] = useState<"personal" | "study">("personal");
  const [statusFilter, setStatusFilter] = useState<"" | "current" | "closed">(
    ""
  );
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Daten
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await window.api.reports.methodProblem({ source });
      console.log("report sample keys=", Object.keys(data[0] || {}), data[0]); // ← hilft beim Prüfen
      setRows(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [source]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (statusFilter ? r.status === statusFilter : true) &&
        (qq
          ? r.method_label.toLowerCase().includes(qq) ||
            r.problem_label.toLowerCase().includes(qq)
          : true)
    );
  }, [rows, q, statusFilter]);

  async function exportStudyCsv() {
    setBusy(true);
    setError(null);
    try {
      // ACHTUNG: preload.cjs stellt "csv()" bereit (nicht "toCsv()")
      const { path } = await window.api.export.study.toCsv();
      alert(`CSV gespeichert: ${path}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="n4-panel">
      <h2>Auswertungen</h2>

      <div className="n4-row">
        <label>
          Quelle
          <select
            value={source}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              setSource(e.target.value as "personal" | "study")
            }
          >
            <option value="personal">Personal (live)</option>
            <option value="study">Study (anonymisiert)</option>
          </select>
        </label>

        <label>
          Status
          <select
            value={statusFilter}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              setStatusFilter(e.target.value as "" | "current" | "closed")
            }
          >
            <option value="">– alle –</option>
            <option value="current">aktuell</option>
            <option value="closed">abgeschlossen</option>
          </select>
        </label>

        <label style={{ flex: 1 }}>
          Suchen
          <input
            value={q}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setQ(e.target.value)
            }
            placeholder="Methode oder Problem …"
          />
        </label>

        <button onClick={() => void load()} disabled={busy}>
          Aktualisieren
        </button>

        {source === "study" && (
          <button
            onClick={() => void exportStudyCsv()} // <-- Helper nutzen
            disabled={busy}
          >
            Study als CSV
          </button>
        )}
      </div>

      {error && <p className="n4-error">⚠️ {error}</p>}

      <div className="n4-table-wrap" style={{ marginTop: 8 }}>
        <table className="n4-table">
          <thead>
            <tr>
              <th>Methode</th>
              <th>Problem</th>
              <th>Status</th>
              <th>Fälle</th>
              <th>Ø Sitzungen</th>
              <th>Ø SUD Start</th>
              <th>Ø SUD Letzt</th>
              <th>Ø Δ SUD</th>
              <th>% mit Vor-Therapie</th>
              <th>Ø Dauer Vor-Therapie (Mon)</th>
              <th>% m</th>
              <th>% w</th>
              <th>% d</th>
              <th>% u</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i}>
                <td>{r.method_label}</td>
                <td>{r.problem_label}</td>
                <td>{r.status}</td>
                <td>{r.cases_n}</td>
                <td>{fmt(r.avg_sessions, 1)}</td>
                <td>{fmt(r.avg_sud_start, 1)}</td>
                <td>{fmt(r.avg_sud_last, 1)}</td>
                <td>{fmt(r.avg_sud_delta, 1)}</td>
                <td>{fmt(r.pct_prev_therapies, 0)}</td>
                <td>{fmt(r.avg_prev_duration_mon, 1)}</td>
                <td>{fmt(r.pct_m, 0)}</td>
                <td>{fmt(r.pct_w, 0)}</td>
                <td>{fmt(r.pct_d, 0)}</td>
                <td>{fmt(r.pct_u, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
