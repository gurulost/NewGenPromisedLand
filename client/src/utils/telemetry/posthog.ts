// Lightweight PostHog wrapper with env gating and graceful fallback
import type posthog from 'posthog-js';

type PostHogClient = typeof posthog | null;

let client: PostHogClient = null;

export async function initPosthog(apiKey?: string, host?: string) {
  if (!apiKey) return null;
  try {
    const ph = (await import('posthog-js')).default;
    ph.init(apiKey, {
      api_host: host || 'https://app.posthog.com',
      capture_pageview: false,
      capture_pageleave: false,
      loaded: () => {
        // Avoid duplicate pageview capture in SPAs
        ph.capture('$pageview');
      },
    });
    client = ph;
    return ph;
  } catch (error) {
    console.warn('PostHog init failed (falling back to no-op):', error);
    return null;
  }
}

export function capture(event: string, properties?: Record<string, any>) {
  client?.capture(event, properties);
}

export function getPosthog() {
  return client;
}
