import { useState } from "react";

export default function ChangePasswordDialog({ onDone }: { onDone: () => void }) {
  const [cur, setCur] = useState("");
  const [n1, setN1] = useState("");
  const [n2, setN2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (n1.length < 8) { setErr("Neues Passwort: mindestens 8 Zeichen."); return; }
    if (n1 !== n2) { setErr("Neue Passwörter stimmen nicht überein."); return; }

    setBusy(true);
    try {
      await window.api.auth.changePassword({ currentPassword: cur, newPassword: n1 });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="n4-login" role="dialog" aria-labelledby="cpw-title" aria-modal="true">
      <form onSubmit={submit} className="n4-card n4-form" style={{ maxWidth: 420 }}>
        <h2 id="cpw-title" style={{ textAlign: "center", marginTop: 0 }}>Passwort ändern</h2>
        <label>Aktuelles Passwort
          <input type="password" value={cur} onChange={e=>setCur(e.target.value)} autoComplete="current-password" />
        </label>
        <label>Neues Passwort
          <input type="password" value={n1} onChange={e=>setN1(e.target.value)} autoComplete="new-password" />
        </label>
        <label>Neues Passwort (Wiederholung)
          <input type="password" value={n2} onChange={e=>setN2(e.target.value)} autoComplete="new-password" />
        </label>
        {err && <p className="n4-error">⚠ {err}</p>}
        <button className="n4-primary" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Speichere…" : "Speichern"}
        </button>
      </form>
    </div>
  );
}
