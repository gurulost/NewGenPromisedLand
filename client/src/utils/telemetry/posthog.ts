// Lightweight PostHog wrapper with env gating and graceful fallback
import type posthog from 'posthog-js';

type PostHogClient = typeof posthog | null;
type CaptureOptions = Record<string, unknown> | undefined;

let client: PostHogClient = null;
let pendingIdentify: { distinctId: string; properties?: Record<string, unknown> } | null = null;
let pendingReset = false;

export async function initPosthog(apiKey?: string, host?: string) {
  if (!apiKey) return null;
  if (client) return client;
  try {
    const ph = (await import('posthog-js')).default;
    ph.init(apiKey, {
      api_host: host || 'https://us.i.posthog.com',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false,
      person_profiles: 'identified_only',
    });
    client = ph;
    if (pendingIdentify) {
      ph.identify(pendingIdentify.distinctId, pendingIdentify.properties);
      pendingIdentify = null;
      pendingReset = false;
    } else if (pendingReset) {
      ph.reset();
      pendingReset = false;
    }
    return ph;
  } catch (error) {
    console.warn('PostHog init failed (falling back to no-op):', error);
    return null;
  }
}

export function capture(
  event: string,
  properties?: Record<string, unknown>,
  options?: CaptureOptions,
) {
  const activeClient = client as unknown as { capture?: (...args: unknown[]) => void } | null;
  activeClient?.capture?.(event, properties, options);
}

export function register(properties: Record<string, unknown>) {
  const activeClient = client as unknown as { register?: (props: Record<string, unknown>) => void } | null;
  activeClient?.register?.(properties);
}

export function registerOnce(properties: Record<string, unknown>) {
  const activeClient = client as unknown as { register_once?: (props: Record<string, unknown>) => void } | null;
  activeClient?.register_once?.(properties);
}

export function unregister(property: string) {
  const activeClient = client as unknown as { unregister?: (name: string) => void } | null;
  activeClient?.unregister?.(property);
}

export function identify(distinctId: string, properties?: Record<string, unknown>) {
  const activeClient = client as unknown as {
    identify?: (id: string, props?: Record<string, unknown>) => void;
  } | null;
  if (activeClient?.identify) {
    activeClient.identify(distinctId, properties);
    return;
  }
  pendingIdentify = { distinctId, properties };
  pendingReset = false;
}

export function reset() {
  const activeClient = client as unknown as { reset?: () => void } | null;
  if (activeClient?.reset) {
    activeClient.reset();
    return;
  }
  pendingIdentify = null;
  pendingReset = true;
}

export function getPosthog() {
  return client;
}
