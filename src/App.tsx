import { useState } from "react";
import AppHeader from "./components/AppHeader";
import ClientsPanel from "./components/ClientsPanel";
import SessionsPanel from "./components/SessionsPanel";
import ReportsPanel from "./components/ReportsPanel";
import "./styles/app.css";

type Tab = "clients" | "sessions" | "reports";

export default function App() {
  const [tab, setTab] = useState<Tab>("clients");

  return (
    <>
      <AppHeader />
      <main className="n4-page">
        <nav className="n4-row" aria-label="Hauptmenü" style={{ marginBottom: 12 }}>
          <button onClick={() => setTab("clients")}  aria-pressed={tab === "clients"}>Klienten</button>
          <button onClick={() => setTab("sessions")} aria-pressed={tab === "sessions"}>Sitzungen</button>
          <button onClick={() => setTab("reports")}  aria-pressed={tab === "reports"}>Auswertungen</button>
        </nav>

        {tab === "clients"  && <ClientsPanel />}
        {tab === "sessions" && <SessionsPanel />}
        {tab === "reports"  && <ReportsPanel />}
      </main>
    </>
  );
}
