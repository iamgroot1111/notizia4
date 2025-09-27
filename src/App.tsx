import { useEffect, useState } from "react";
import AppHeader from "./components/AppHeader";
import ClientsPanel from "./components/ClientsPanel";
import SessionsPanel from "./components/SessionsPanel";
import ReportsPanel from "./components/ReportsPanel";
import LoginPanel from "./components/LoginPanel";
import ChangePasswordDialog from "./components/ChangePasswordDialog";
import UsersAdminPanel from "./components/UsersAdminPanel";
import "./styles/app.css";

type Tab = "clients" | "sessions" | "reports" | "users";
type Me = { username: string; role: string; must_change_pw?: boolean };

// Window-Typ mit optionaler Bridge (ohne "any")
type MaybeAuthWindow = Window & {
  api?: {
    auth?: {
      me(): Promise<Me | null>;
      login(p: { username: string; password: string }): Promise<Me>;
      logout(): Promise<{ ok: true }>;
      changePassword(p: {
        currentPassword: string;
        newPassword: string;
      }): Promise<{ ok: true }>;
    };
  };
};

export default function App() {
  const win = window as MaybeAuthWindow;
  const hasAuth = Boolean(win.api?.auth);

  // Electron: undefined = prüfen; null = ausgeloggt; Me = eingeloggt
  // PWA (ohne Auth): sofort durchlassen
  const [me, setMe] = useState<Me | null | undefined>(
    hasAuth ? undefined : { username: "pwa", role: "therapist" }
  );
  const [tab, setTab] = useState<Tab>("clients");

  useEffect(() => {
    if (!hasAuth) return;
    let cancelled = false;
    (async () => {
      try {
        const u = await win.api!.auth!.me();
        if (!cancelled) setMe(u ?? null);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasAuth, win]);

  // 1) Erstabfrage läuft
  if (hasAuth && me === undefined) {
    return (
      <div className="n4-page" style={{ padding: 24 }}>
        Lade…
      </div>
    );
  }

  // 2) Nicht eingeloggt -> Login
  if (hasAuth && me === null) {
    return (
      <LoginPanel
        onLoggedIn={async () => {
          const u = await win.api!.auth!.me();
          setMe(u ?? null);
        }}
      />
    );
  }

  // 3) Eingeloggt, aber Passwort muss geändert werden -> Dialog
  if (hasAuth && me && me.must_change_pw) {
    return (
      <ChangePasswordDialog
        onDone={async () => {
          const u = await win.api!.auth!.me(); // muss jetzt must_change_pw=false liefern
          setMe(u ?? null);
        }}
      />
    );
  }

  // 4) Eingeloggt (oder PWA ohne Auth): App anzeigen
  async function handleLogout() {
    if (!hasAuth) return;
    await win.api!.auth!.logout();
    setMe(null);
  }

  return (
    <>
      <AppHeader />
      <main className="n4-page">
        <nav
          className="n4-row"
          aria-label="Hauptmenü"
          style={{ marginBottom: 12 }}
        >
          <button
            onClick={() => setTab("clients")}
            aria-pressed={tab === "clients"}
          >
            Klienten
          </button>
          <button
            onClick={() => setTab("sessions")}
            aria-pressed={tab === "sessions"}
          >
            Sitzungen
          </button>
          <button
            onClick={() => setTab("reports")}
            aria-pressed={tab === "reports"}
          >
            Auswertungen
          </button>
          {hasAuth && me && (
            <span style={{ marginLeft: "auto" }}>
              Angemeldet: <strong>{me.username} </strong>
              <button onClick={handleLogout}>Logout</button>
            </span>
          )}
          {hasAuth && me?.role === "admin" && (
            <button
              onClick={() => setTab("users")}
              aria-pressed={tab === "users"}
            >
              Benutzer
            </button>
          )}
        </nav>
        {tab === "clients" && <ClientsPanel />}
        {tab === "sessions" && <SessionsPanel />}
        {tab === "reports" && <ReportsPanel />}
        {tab === "users" && me?.role === "admin" && <UsersAdminPanel />}

      </main>
    </>
  );
}
