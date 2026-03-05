import {
  capture,
  getPosthog,
  register,
  registerOnce,
  unregister,
} from './posthog';

const FIRST_SEEN_AT_KEY = 'ngpl.analytics.first_seen_at';
const LAST_SEEN_AT_KEY = 'ngpl.analytics.last_seen_at';
const VISIT_COUNT_KEY = 'ngpl.analytics.visit_count';
const DAY_MS = 24 * 60 * 60 * 1000;

const SEARCH_DOMAINS = ['google.', 'bing.', 'duckduckgo.', 'yahoo.', 'ecosia.', 'baidu.'];
const SOCIAL_DOMAINS = ['facebook.', 'instagram.', 'x.com', 'twitter.', 't.co', 'youtube.', 'reddit.', 'linkedin.'];

type PageViewTrigger = 'initial' | 'route_change';
type SessionEndReason = 'beforeunload' | 'pagehide';
type TrafficType = 'direct' | 'campaign' | 'organic_search' | 'social' | 'referral';

interface RuntimeState {
  started: boolean;
  ended: boolean;
  sessionId: string;
  sessionStartedAt: number;
  visibleStartedAt: number | null;
  visibleDurationMs: number;
  lastTrackedPath: string;
}

interface AcquisitionContext {
  traffic_type: TrafficType;
  referrer_domain: string;
  referrer_path: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

interface VisitContext {
  firstSeenAt: number;
  lastSeenAt: number | null;
  visitCount: number;
  isReturningVisitor: boolean;
  daysSinceLastSeen: number;
  daysSinceFirstSeen: number;
}

interface BuildContext {
  app_version: string;
  git_sha: string;
  environment: string;
  platform: string;
  is_dev_build: boolean;
}

declare global {
  interface Window {
    __ngplUsageAnalyticsRuntime?: RuntimeState;
  }
}

const clampLength = (value: string | null, max = 200): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
};

const safeGetStorage = (storage: Storage, key: string): string | null => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetStorage = (storage: Storage, key: string, value: string): void => {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore browser storage failures.
  }
};

const parseStoredNumber = (storage: Storage, key: string): number | null => {
  const raw = safeGetStorage(storage, key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const getOrCreateRuntime = (): RuntimeState => {
  if (!window.__ngplUsageAnalyticsRuntime) {
    window.__ngplUsageAnalyticsRuntime = {
      started: false,
      ended: false,
      sessionId: '',
      sessionStartedAt: 0,
      visibleStartedAt: null,
      visibleDurationMs: 0,
      lastTrackedPath: '',
    };
  }
  return window.__ngplUsageAnalyticsRuntime;
};

const now = (): number => Date.now();

const createSessionId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `usage_${now()}_${Math.random().toString(36).slice(2)}`;
};

const readVisitContext = (): VisitContext => {
  const currentTime = now();
  const firstSeenAt = parseStoredNumber(localStorage, FIRST_SEEN_AT_KEY) ?? currentTime;
  const lastSeenAt = parseStoredNumber(localStorage, LAST_SEEN_AT_KEY);
  const previousVisitCount = parseStoredNumber(localStorage, VISIT_COUNT_KEY) ?? 0;
  const visitCount = previousVisitCount + 1;
  const daysSinceLastSeen = lastSeenAt ? Math.max(0, Math.floor((currentTime - lastSeenAt) / DAY_MS)) : 0;
  const daysSinceFirstSeen = Math.max(0, Math.floor((currentTime - firstSeenAt) / DAY_MS));

  safeSetStorage(localStorage, FIRST_SEEN_AT_KEY, String(firstSeenAt));
  safeSetStorage(localStorage, LAST_SEEN_AT_KEY, String(currentTime));
  safeSetStorage(localStorage, VISIT_COUNT_KEY, String(visitCount));

  return {
    firstSeenAt,
    lastSeenAt,
    visitCount,
    isReturningVisitor: visitCount > 1,
    daysSinceLastSeen,
    daysSinceFirstSeen,
  };
};

const parseDomain = (value: string): string => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
};

const parsePath = (value: string): string => {
  try {
    return new URL(value).pathname;
  } catch {
    return '';
  }
};

const classifyTraffic = (utmSource?: string, referrerDomain?: string): TrafficType => {
  if (utmSource) return 'campaign';
  if (!referrerDomain) return 'direct';
  if (SEARCH_DOMAINS.some((domain) => referrerDomain.includes(domain))) return 'organic_search';
  if (SOCIAL_DOMAINS.some((domain) => referrerDomain.includes(domain))) return 'social';
  return 'referral';
};

const getAcquisitionContext = (): AcquisitionContext => {
  const searchParams = new URLSearchParams(window.location.search);
  const utmSource = clampLength(searchParams.get('utm_source'));
  const referrerDomain = parseDomain(document.referrer);
  const referrerPath = parsePath(document.referrer);

  return {
    traffic_type: classifyTraffic(utmSource, referrerDomain),
    referrer_domain: referrerDomain || 'direct',
    referrer_path: referrerPath || '/',
    utm_source: utmSource,
    utm_medium: clampLength(searchParams.get('utm_medium')),
    utm_campaign: clampLength(searchParams.get('utm_campaign')),
    utm_term: clampLength(searchParams.get('utm_term')),
    utm_content: clampLength(searchParams.get('utm_content')),
  };
};

const getCurrentPath = (): string => {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
};

const getPageProperties = () => {
  return {
    page_path: getCurrentPath(),
    page_title: document.title || 'untitled',
    page_url: window.location.href,
  };
};

const getBuildContext = (): BuildContext => {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
  const appVersion = String(
    env.VITE_APP_VERSION ??
    env.VITE_RELEASE ??
    env.VITE_PUBLIC_APP_VERSION ??
    'unknown'
  );
  const gitSha = String(
    env.VITE_GIT_SHA ??
    env.VITE_COMMIT_SHA ??
    env.VITE_PUBLIC_GIT_SHA ??
    env.VERCEL_GIT_COMMIT_SHA ??
    'unknown'
  );
  const environment = String(
    env.MODE ??
    env.VITE_ENVIRONMENT ??
    env.VITE_SENTRY_ENV ??
    'unknown'
  );
  const platform = String(
    (navigator as any).userAgentData?.platform ??
    navigator.platform ??
    'unknown'
  );

  return {
    app_version: appVersion.slice(0, 80),
    git_sha: gitSha.slice(0, 80),
    environment: environment.slice(0, 80),
    platform: platform.slice(0, 80),
    is_dev_build: Boolean(env.DEV),
  };
};

const trackPageView = (runtime: RuntimeState, trigger: PageViewTrigger): void => {
  const path = getCurrentPath();
  if (trigger === 'route_change' && path === runtime.lastTrackedPath) {
    return;
  }
  runtime.lastTrackedPath = path;

  capture('usage_page_view', {
    session_id: runtime.sessionId,
    trigger,
    ...getPageProperties(),
  });
};

const flushVisibleDuration = (runtime: RuntimeState, currentTime = now()): void => {
  if (runtime.visibleStartedAt === null) return;
  runtime.visibleDurationMs += Math.max(0, currentTime - runtime.visibleStartedAt);
  runtime.visibleStartedAt = null;
};

const beginVisibleDuration = (runtime: RuntimeState, currentTime = now()): void => {
  if (runtime.visibleStartedAt !== null) return;
  runtime.visibleStartedAt = currentTime;
};

const endSession = (reason: SessionEndReason): void => {
  const runtime = getOrCreateRuntime();
  if (!runtime.started || runtime.ended) return;

  const currentTime = now();
  flushVisibleDuration(runtime, currentTime);
  runtime.ended = true;

  const sessionDurationMs = Math.max(0, currentTime - runtime.sessionStartedAt);
  const activeDurationMs = Math.max(0, runtime.visibleDurationMs);
  const activeRatio = sessionDurationMs > 0
    ? Number((activeDurationMs / sessionDurationMs).toFixed(3))
    : 1;

  capture('usage_session_ended', {
    session_id: runtime.sessionId,
    end_reason: reason,
    session_duration_seconds: Math.round(sessionDurationMs / 1000),
    active_duration_seconds: Math.round(activeDurationMs / 1000),
    active_ratio: activeRatio,
    ...getPageProperties(),
  });

  unregister('session_id');
  unregister('visit_number');
  detachListeners();
};

const handleVisibilityChange = (): void => {
  const runtime = getOrCreateRuntime();
  if (!runtime.started || runtime.ended) return;

  const currentTime = now();
  if (document.visibilityState === 'hidden') {
    flushVisibleDuration(runtime, currentTime);
    return;
  }
  beginVisibleDuration(runtime, currentTime);
};

const handleRouteChange = (): void => {
  const runtime = getOrCreateRuntime();
  if (!runtime.started || runtime.ended) return;
  trackPageView(runtime, 'route_change');
};

const handlePageHide = (): void => {
  endSession('pagehide');
};

const handleBeforeUnload = (): void => {
  endSession('beforeunload');
};

const detachListeners = (): void => {
  window.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('hashchange', handleRouteChange);
  window.removeEventListener('popstate', handleRouteChange);
  window.removeEventListener('pagehide', handlePageHide);
  window.removeEventListener('beforeunload', handleBeforeUnload);
};

const toIso = (timestamp: number | null): string | null => {
  if (!timestamp || !Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
};

export function initUsageAnalytics(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!getPosthog()) return;

  const runtime = getOrCreateRuntime();
  if (runtime.started && !runtime.ended) return;

  const currentTime = now();
  const acquisition = getAcquisitionContext();
  const visit = readVisitContext();

  runtime.started = true;
  runtime.ended = false;
  runtime.sessionId = createSessionId();
  runtime.sessionStartedAt = currentTime;
  runtime.visibleDurationMs = 0;
  runtime.visibleStartedAt = document.visibilityState === 'visible' ? currentTime : null;
  runtime.lastTrackedPath = '';

  register({
    session_id: runtime.sessionId,
    visit_number: visit.visitCount,
    ...getBuildContext(),
  });
  registerOnce({
    first_seen_at: toIso(visit.firstSeenAt),
    first_referrer_domain: acquisition.referrer_domain,
    first_utm_source: acquisition.utm_source ?? 'none',
  });

  capture('usage_session_started', {
    session_id: runtime.sessionId,
    visit_number: visit.visitCount,
    is_returning_visitor: visit.isReturningVisitor,
    days_since_first_seen: visit.daysSinceFirstSeen,
    days_since_last_seen: visit.daysSinceLastSeen,
    first_seen_at: toIso(visit.firstSeenAt),
    last_seen_at: toIso(visit.lastSeenAt),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    ...acquisition,
    ...getPageProperties(),
  });

  if (visit.isReturningVisitor) {
    capture('usage_return_visit', {
      session_id: runtime.sessionId,
      visit_number: visit.visitCount,
      days_since_last_seen: visit.daysSinceLastSeen,
      ...acquisition,
    });
  }

  trackPageView(runtime, 'initial');

  detachListeners();
  window.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('hashchange', handleRouteChange);
  window.addEventListener('popstate', handleRouteChange);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('beforeunload', handleBeforeUnload);
}
