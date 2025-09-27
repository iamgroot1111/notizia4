import { useEffect, useRef, useState } from "react";

export default function LoginPanel({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [u, setU] = useState("admin");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    userRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await window.api.auth.login({ username: u, password: p });
      onLoggedIn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="n4-login">
      <form
        onSubmit={submit}
        className="n4-card n4-form"
        aria-labelledby="login-title"
      >
        <img
          className="n4-logo"
          src="/notizia_logo.png"
          alt="Notizia Logo"
          width={150}
          height={150}
          draggable={false}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <h2 id="login-title" style={{ textAlign: "center", marginTop: 0 }}>
          Anmelden
        </h2>

        <label>
          Benutzername
          <input
            ref={userRef}
            value={u}
            onChange={(e) => setU(e.target.value)}
            autoComplete="username"
          />
        </label>

        <label>
          Passwort
          <div className="n4-input-row">
            <input
              type={showPw ? "text" : "password"}
              value={p}
              onChange={(e) => setP(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="n4-ghost"
              aria-pressed={showPw}
              onClick={() => setShowPw((s) => !s)}
              title={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
            >
              {showPw ? "🙈" : "👁"}
            </button>
          </div>
        </label>

        {err && (
          <p className="n4-error" aria-live="polite">
            ⚠ {err}
          </p>
        )}

        <button
          disabled={busy}
          className="n4-primary"
          style={{ width: "100%" }}
        >
          {busy ? "Prüfe…" : "Login"}
        </button>
      </form>
    </div>
  );
}
