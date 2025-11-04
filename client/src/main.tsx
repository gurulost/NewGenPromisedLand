import { createRoot } from "react-dom/client";
import { PostHogProvider } from 'posthog-js/react';
import App from "./App";
import "./index.css";
import { initTelemetryStore } from "./services/telemetryStore";
import { initSentry } from "./utils/sentry";
import { initWebVitals } from "./utils/webVitals";
import { trackPerformanceMetric } from "./utils/posthog";
import { gameDebugger } from "./utils/gameDebug";

initSentry({
  enabled: import.meta.env.PROD,
});

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

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  person_profiles: 'identified_only',
  capture_pageview: false,
  capture_pageleave: true,
  autocapture: false,
  session_recording: {
    recordCrossOriginIframes: false,
  },
  loaded: (posthog: any) => {
    if (import.meta.env.DEV) {
      console.log('[PostHog] Initialized successfully');
    }
  },
} as const;

createRoot(document.getElementById("root")!).render(
  posthogKey ? (
    <PostHogProvider apiKey={posthogKey} options={posthogOptions}>
      <App />
    </PostHogProvider>
  ) : (
    <>
      {import.meta.env.DEV && console.log('[PostHog] Not initialized - VITE_PUBLIC_POSTHOG_KEY not set')}
      <App />
    </>
  )
);
