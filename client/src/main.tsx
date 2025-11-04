import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initTelemetryStore } from "./services/telemetryStore";
import { initSentry } from "./utils/sentry";
import { initWebVitals } from "./utils/webVitals";
import { initPostHog, trackPerformanceMetric } from "./utils/posthog";
import { gameDebugger } from "./utils/gameDebug";

initSentry({
  enabled: import.meta.env.PROD,
});

initPostHog();

initWebVitals({
  sessionId: gameDebugger.getSessionId(),
  onReport: (report) => {
    if (import.meta.env.DEV) {
      console.log('[Web Vitals]', report.metric.name, report.metric.value);
    }
    
    trackPerformanceMetric({
      name: report.metric.name,
      value: report.metric.value,
      rating: report.metric.rating,
    });
  },
});

initTelemetryStore();

if (import.meta.env.DEV) {
  import('./services/telemetryConsole').then(module => module.initTelemetryConsole());
}

createRoot(document.getElementById("root")!).render(<App />);
