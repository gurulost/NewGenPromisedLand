import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initTelemetryStore } from "./services/telemetryStore";

initTelemetryStore();

if (import.meta.env.DEV) {
  import('./services/telemetryConsole').then(module => module.initTelemetryConsole());
}

createRoot(document.getElementById("root")!).render(<App />);
