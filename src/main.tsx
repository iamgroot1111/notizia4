import { createRoot } from "react-dom/client";
import App from "./App";

import { registerSW } from "virtual:pwa-register";
// optional: Electron erkennen, sonst überall registrieren
if (!/electron/i.test(navigator.userAgent)) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById("root")!).render(<App />);
