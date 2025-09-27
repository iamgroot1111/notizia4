import { useEffect, useState } from "react";

type Row = {
  id: number;
  username: string;
  role: string;
  created_at: string;
  must_change_pw?: number;
};
type Role = "therapist" | "admin";

export default function UsersAdminPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [u, setU] = useState("frauke");
  //  const [role, setRole] = useState<"therapist"|"admin">("therapist");
  const [pw, setPw] = useState(""); // leer lassen => wird generiert
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<Role>("therapist");

  async function load() {
    const r = await window.api.auth.users.list();
    setRows(r);
  }
  useEffect(() => {
    load();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = await window.api.auth.users.create({
        username: u.trim(),
        role,
        password: pw || undefined,
      });
      if (res.tempPassword) {
        setMsg(
          `Benutzer '${u}' angelegt. Initiales Passwort: ${res.tempPassword}`
        );
      } else {
        setMsg(`Benutzer '${u}' angelegt.`);
      }
      setU("");
      setPw("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="n4-page">
      <h2>Benutzerverwaltung</h2>

      <form
        onSubmit={createUser}
        className="n4-card n4-form"
        style={{ maxWidth: 520, marginBottom: 16 }}
      >
        <h3 style={{ marginTop: 0 }}>Neuen Benutzer anlegen</h3>
        <label>
          Benutzername
          <input
            value={u}
            onChange={(e) => setU(e.target.value)}
            placeholder="z.B. frauke"
          />
        </label>
        <label>
          Rolle
          <select
            value={role}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setRole(e.target.value as Role)
            }
          >
            <option value="therapist">Therapeut:in</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
        <label>
          Initiales Passwort (optional)
          <input
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="leer lassen = wird generiert"
          />
        </label>
        {err && <p className="n4-error">⚠ {err}</p>}
        {msg && <p className="n4-success">✅ {msg}</p>}
        <button className="n4-primary" disabled={busy}>
          Benutzer anlegen
        </button>
      </form>

      <div className="n4-card" style={{ overflowX: "auto" }}>
        <table className="n4-table">
          <thead>
            <tr>
              <th>Benutzer</th>
              <th>Rolle</th>
              <th>Erstellt</th>
              <th>PW-Wechsel offen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.username}</td>
                <td>{r.role === "admin" ? "Administrator" : "Therapeut:in"}</td>
                <td>
                  {r.created_at?.replace("T", " ").replace("Z", "") ?? ""}
                </td>
                <td>{r.must_change_pw ? "ja" : "nein"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
