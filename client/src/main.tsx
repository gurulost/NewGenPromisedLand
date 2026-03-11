import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initTelemetry } from "./utils/telemetry";
import { ToastProvider } from "./components/ui/ToastProvider";

initTelemetry();

createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <App />
  </ToastProvider>
);
