import * as Sentry from '@sentry/react';

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

export interface SentryConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  enabled?: boolean;
}

export function initSentry(config: SentryConfig = {}) {
  const sentryDsn = config.dsn || import.meta.env.VITE_SENTRY_DSN;

  if (!sentryDsn && isProduction) {
    console.warn('[Sentry] No DSN provided, error tracking disabled');
    return;
  }

  const enabled = config.enabled ?? isProduction;

  if (!enabled) {
    console.log('[Sentry] Disabled in development mode');
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDsn,
      environment: config.environment || import.meta.env.MODE || 'development',
      release: config.release || `chronicles@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,

      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
          maskAllInputs: true,
        }),
      ],

      tracesSampleRate: isDevelopment ? 1.0 : 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,

      beforeSend(event, hint) {
        if (isDevelopment) {
          console.log('[Sentry] Event captured:', event, hint);
        }

        if (event.exception?.values?.[0]?.value?.includes('ResizeObserver')) {
          return null;
        }

        if (event.exception?.values?.[0]?.value?.includes('Non-Error promise rejection')) {
          return null;
        }

        return event;
      },

      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        'Non-Error promise rejection captured',
        'Network request failed',
        'Failed to fetch',
        'NetworkError',
        'AbortError',
      ],
    });

    console.log('[Sentry] Initialized successfully');
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error);
  }
}

export function setSentryUser(user: { id: string; username?: string; faction?: string }) {
  Sentry.setUser({
    id: user.id,
    username: user.username,
    faction: user.faction,
  });
}

export function setSentryGameContext(game: {
  gameId?: string;
  turn?: number;
  phase?: string;
  mapSize?: string;
  playerCount?: number;
}) {
  Sentry.setContext('game', {
    gameId: game.gameId,
    turn: game.turn,
    phase: game.phase,
    mapSize: game.mapSize,
    playerCount: game.playerCount,
  });
}

export function clearSentryUser() {
  Sentry.setUser(null);
}

export function captureSentryException(error: Error, context?: Record<string, unknown>) {
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
}

export function captureSentryMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level);
}

export function addSentryBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
  Sentry.addBreadcrumb(breadcrumb);
}

export { Sentry };
