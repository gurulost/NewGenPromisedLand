import { initPosthog, capture as capturePH } from './posthog';
import { initSentry, captureException } from './sentry';
import { reportWebVitals } from './webVitals';

export async function initTelemetry() {
  // Use import.meta.env for Vite client-side environment variables only
  const posthogKey = (import.meta as any).env?.VITE_POSTHOG_KEY;
  const posthogHost = (import.meta as any).env?.VITE_POSTHOG_HOST;
  const sentryDsn = (import.meta as any).env?.VITE_SENTRY_DSN;
  const sentryEnv = (import.meta as any).env?.VITE_SENTRY_ENV;

  await initPosthog(posthogKey, posthogHost);
  await initSentry(sentryDsn, sentryEnv);
  reportWebVitals();
}

export const telemetry = {
  capture: capturePH,
  captureException,
};
