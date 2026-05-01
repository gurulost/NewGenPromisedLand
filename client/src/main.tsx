import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ToastProvider } from "./components/ui/ToastProvider";

function scheduleTelemetryInit() {
  const init = () => {
    void import("./utils/telemetry")
      .then(({ initTelemetry }) => initTelemetry())
      .catch((error) => {
        console.warn("Telemetry init failed:", error);
      });
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(init, { timeout: 3000 });
    return;
  }

  globalThis.setTimeout(init, 0);
}

createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <App />
  </ToastProvider>
);

scheduleTelemetryInit();
