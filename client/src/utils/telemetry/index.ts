import { initPosthog, capture as capturePH } from './posthog';
import { initSentry, captureException } from './sentry';
import { reportWebVitals } from './webVitals';
import { initUsageAnalytics } from './usageAnalytics';
import { initSharedTelemetryBridge } from './gameplayAnalytics';

export async function initTelemetry() {
  // Use import.meta.env for Vite client-side environment variables only
  const env = (import.meta as any).env;
  const posthogKey = env?.VITE_POSTHOG_KEY || env?.VITE_PUBLIC_POSTHOG_KEY;
  const posthogHost = env?.VITE_POSTHOG_HOST || env?.VITE_PUBLIC_POSTHOG_HOST;
  const sentryDsn = env?.VITE_SENTRY_DSN;
  const sentryEnv = env?.VITE_SENTRY_ENV;

  await initPosthog(posthogKey, posthogHost);
  initSharedTelemetryBridge();
  initUsageAnalytics();
  await initSentry(sentryDsn, sentryEnv);
  reportWebVitals();
}

export const telemetry = {
  capture: capturePH,
  captureException,
};
