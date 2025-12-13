// Minimal Sentry wrapper with env gating and graceful fallback
import type * as SentryType from '@sentry/react';

let sentry: typeof SentryType | null = null;
let sentryReady = false;

export async function initSentry(dsn?: string, environment?: string) {
  if (!dsn) return;
  try {
    sentry = await import('@sentry/react');
    sentry.init({
      dsn,
      environment,
      tracesSampleRate: 0.1,
    });
    sentryReady = true;
  } catch (error) {
    console.warn('Sentry init failed (falling back to no-op):', error);
  }
}

export function captureException(error: unknown, context?: Record<string, any>) {
  if (!sentryReady || !sentry) return;
  sentry.captureException(error, { extra: context });
}

export function captureMessage(message: string, context?: Record<string, any>) {
  if (!sentryReady || !sentry) return;
  sentry.captureMessage(message, { extra: context });
}
