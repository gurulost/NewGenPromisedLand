# Error Logging & Monitoring System

Chronicles of the Promised Land has a comprehensive error logging and monitoring system designed to catch bugs in development and production.

## Architecture Overview

### Client-Side Error Tracking

**errorReporting.ts** - Custom error reporting system
- Captures all JavaScript errors and promise rejections
- Tracks user actions (last 50 actions) for bug reproduction
- Categorizes errors by type (game_logic, rendering, ui, network, critical)
- Integrates with Sentry for production monitoring
- Shows user-friendly error dialogs for critical failures

**gameDebug.ts** - Development debugging system
- Session tracking with unique IDs
- Performance monitoring (FPS, memory, render times)
- Enhanced console output with emojis and styling
- Debug report export for support

**sentry.ts** - Sentry integration
- Production error tracking
- Session replay for critical errors
- Breadcrumb tracking of user actions
- Error filtering and sampling

**webVitals.ts** - Performance monitoring
- Core Web Vitals tracking (CLS, INP, LCP, FCP, TTFB)
- Real-time performance metrics
- Game phase correlation

### Server-Side Logging

**server/utils/logger.ts** and **server/ops.ts** - Server logging and operational health
- Lightweight structured console logging helpers
- Request ID propagation through `x-request-id`
- `/__health` runtime and database dependency checks
- Graceful shutdown state tracking
- Error stack trace capture in the Express error handler

### Player Bug Reports

**client/src/components/ui/BugReportHost.tsx / BugReportDialog.tsx** - In-game issue intake
- Adds a low-friction `Something not working?` launcher in the desktop utility dock and mobile game menu
- Supports one-click report entry from critical error dialogs and the React error boundary
- Queues retryable submissions offline and automatically replays them when connectivity returns

**bugReport.ts** - Client diagnostics + submission orchestration
- Captures current game snapshot, UI mode state, recent actions, recent errors, and runtime/session context
- Uses a client-generated `submissionId` so retries and queue replays stay idempotent
- Uploads screenshots through a presigned R2 URL when object storage is configured

**/api/bug-reports** - Server intake
- Validates/sanitizes incoming reports
- Computes a dedupe fingerprint and counts matching reports over the last 24 hours
- Persists the report to Postgres and optionally sends a webhook summary
- Exposes a token-protected detail endpoint at `/api/bug-reports/:reportId` when `BUG_REPORT_VIEW_TOKEN` is configured

## Setup Instructions

### 1. Basic Setup (No External Services)

The logging system works without external monitoring services. The app still needs the normal server environment such as `DATABASE_URL`.

```bash
npm run dev
```

Client errors will be logged to the browser console, and server logs will appear in the terminal.

### 2. Production Setup with Sentry

For production error tracking, set up Sentry:

**Step 1: Create Sentry Account**
1. Go to https://sentry.io and create an account
2. Create a new project (choose React)
3. Copy your DSN (looks like `https://xxxxx@sentry.io/xxxxx`)

**Step 2: Configure Environment**
```bash
# Copy the example env file
cp .env.example .env

# Add your Sentry DSN
VITE_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
```

**Step 3: (Optional) Enable Source Maps Upload**
```bash
# In .env, add:
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-auth-token
```

**Step 4: Rebuild for Production**
```bash
npm run build
```

### 3. Alternative: LogRocket or Bugsnag

If you prefer LogRocket or Bugsnag instead of Sentry:

1. Replace the Sentry integration in `client/src/utils/sentry.ts`
2. Update `client/src/utils/errorReporting.ts` to use the new service
3. Update `client/src/main.tsx` to initialize the new service

### 4. Optional Setup for Bug Report Screenshots and Alerts

If you want player screenshots and new-report alerts in production:

```bash
# Optional webhook for report notifications
BUG_REPORT_WEBHOOK_URL=https://hooks.example.com/services/...

# Optional base URL + shared token for direct "Full Report" links in webhook alerts
BUG_REPORT_PUBLIC_URL=https://your-app.example.com
BUG_REPORT_VIEW_TOKEN=replace-with-a-long-random-secret

# Optional DB/admin deep-link template used in webhook alerts
# Supported placeholders: {id} {reportId} {submissionId} {fingerprint} {category} {source} {createdAt}
BUG_REPORT_DB_URL_TEMPLATE=https://db.example.com/bug_reports?id={id}

# Optional object storage used by voice notes and bug-report screenshots
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://cdn.example.com/assets
```

Without the `R2_*` variables, bug reports still submit successfully, but screenshot uploads are skipped.

If `BUG_REPORT_WEBHOOK_URL` points to Slack or Discord, the server now formats richer alert payloads:
- full player message
- expected behavior
- contact info
- screenshot link and preview when present
- diagnostics summary
- an AI triage pack block optimized for copy/pasting directly into Codex/ChatGPT
- `bug_reports.id=<id>` DB lookup hint
- optional direct links to the full report JSON and to your DB/admin console if configured

Players are now also reminded how to report issues in the start flow:
- local setup screen
- online lobby
- tutorial episode intro
- a once-per-match in-game hint on turn 1 that points to the real report control for the current device

## Usage

### Client-Side Error Reporting

**Automatic Error Capture**
```typescript
// All uncaught errors are automatically captured
throw new Error('Something went wrong');

// Promise rejections are also captured
Promise.reject('Failed to load data');
```

**Manual Error Reporting**
```typescript
import { gameErrorReporter } from '@/utils/errorReporting';

// Report a game logic error
gameErrorReporter.reportGameLogicError(
  'Invalid unit movement',
  gameState,
  'move_unit'
);

// Report a rendering error
gameErrorReporter.reportRenderingError(
  'Failed to load 3D model',
  'UnitModel',
  error.stack
);

// Report a unit action error
gameErrorReporter.reportUnitActionError(
  'Unit cannot attack',
  unit.id,
  coordinate,
  gameState
);
```

**Track User Actions**
```typescript
import { gameErrorReporter } from '@/utils/errorReporting';

// Record user actions for debugging context
gameErrorReporter.recordUserAction('click', {
  button: 'attack',
  target: enemy.id
});

gameErrorReporter.recordUserAction('move_unit', {
  unitId: unit.id,
  from: startCoord,
  to: endCoord
}, endCoord);
```

**Update Sentry Context**
```typescript
import { setSentryUser, setSentryGameContext } from '@/utils/sentry';

// Set user context
setSentryUser({
  id: player.id,
  username: player.name,
  faction: player.factionId,
});

// Set game context
setSentryGameContext({
  gameId: gameState.id,
  turn: gameState.turn,
  phase: gameState.phase,
  mapSize: gameState.map.size,
  playerCount: gameState.players.length,
});
```

### Server-Side Logging

**Using the Logger**
```typescript
import { logger, createRequestLogger } from './utils/logger';

// Basic logging
logger.info('Server started');
logger.warn('Deprecated API used');
logger.error('Database connection failed', { error: err });

app.get('/api/game/:id', (req, res) => {
  const requestLogger = createRequestLogger(req);
  requestLogger.info('Fetching game', { gameId: req.params.id });
  
  try {
    const game = getGame(req.params.id);
    requestLogger.info('Game fetched successfully');
    res.json(game);
  } catch (error) {
    requestLogger.error('Failed to fetch game', error, {
      gameId: req.params.id,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Creating Child Loggers**
```typescript
const requestLogger = createRequestLogger(req);
const userLogger = requestLogger.child({ userId: user.id });
userLogger.info('User action performed', { action: 'purchase' });
```

### Web Vitals Monitoring

**Automatic Tracking**
```typescript
// Web Vitals are automatically tracked in main.tsx
// Results are logged in development
```

**Custom Callbacks**
```typescript
import { registerWebVitalsCallback } from '@/utils/webVitals';

const unsubscribe = registerWebVitalsCallback((report) => {
  console.log(`${report.metric.name}: ${report.metric.value}`);
  
  // Send to analytics service
  analytics.track('web_vital', {
    metric: report.metric.name,
    value: report.metric.value,
    rating: report.metric.rating,
  });
});

// Later: unsubscribe()
```

**Update Game Phase**
```typescript
import { updateGamePhase } from '@/utils/webVitals';

// Correlate performance metrics with game phases
updateGamePhase('playing');
```

## Error Types

### Client Errors

- **game_logic** - Invalid game state, rule violations, AI errors
- **rendering** - Three.js/WebGL errors, model loading failures
- **ui** - React component errors, state management issues
- **network** - API request failures, WebSocket disconnections
- **critical** - Unhandled errors that may crash the app

### Severity Levels

- **info** - Informational messages
- **warning** - Potential issues that don't break functionality
- **error** - Errors that affect specific features
- **critical** - Errors that may crash the app or corrupt data

## Viewing Logs

### Development

**Browser Console**
- All errors logged with severity-based styling
- User actions logged with 🎯 prefix
- Performance metrics logged with [Web Vitals] prefix

**Terminal**
- Pretty-printed server logs with colors
- Request/response logging for API calls
- Error stack traces

### Production

**Sentry Dashboard**
- Real-time error tracking
- Error grouping and frequency
- User impact analysis
- Session replays for critical errors
- Performance monitoring
- Release tracking

**Export Debug Reports**
```typescript
import { gameDebugger } from '@/utils/gameDebug';

// Export logs for support
const report = gameDebugger.exportErrorReport();
// Downloads JSON file with full debug info
```

## Performance Monitoring

### Core Web Vitals Thresholds

- **CLS** (Cumulative Layout Shift)
  - Good: ≤ 0.1
  - Needs Improvement: 0.1 - 0.25
  - Poor: > 0.25

- **INP** (Interaction to Next Paint)
  - Good: ≤ 200ms
  - Needs Improvement: 200-500ms
  - Poor: > 500ms

- **LCP** (Largest Contentful Paint)
  - Good: ≤ 2.5s
  - Needs Improvement: 2.5-4s
  - Poor: > 4s

- **FCP** (First Contentful Paint)
  - Good: ≤ 1.8s
  - Needs Improvement: 1.8-3s
  - Poor: > 3s

- **TTFB** (Time to First Byte)
  - Good: ≤ 800ms
  - Needs Improvement: 800-1800ms
  - Poor: > 1800ms

## Best Practices

### 1. Error Context

Always provide rich context when reporting errors:

```typescript
gameErrorReporter.reportError({
  type: 'game_logic',
  severity: 'error',
  message: 'Unit movement validation failed',
  context: {
    gameState: sanitizedGameState,
    playerAction: 'move_unit',
    component: 'MovementValidator',
    gamePhase: 'playing',
    currentPlayer: player.name,
  }
});
```

### 2. User Action Tracking

Record user actions before operations that might fail:

```typescript
// Before risky operation
gameErrorReporter.recordUserAction('attack', {
  attackerId: attacker.id,
  defenderId: defender.id,
});

// Perform operation
const result = combatSystem.attack(attacker, defender);
```

### 3. Performance Monitoring

Track performance-critical operations:

```typescript
import { gameDebugger } from '@/utils/gameDebug';

gameDebugger.startPerformanceMark('pathfinding');
const path = findPath(start, end);
gameDebugger.endPerformanceMark('pathfinding', 100); // Warn if > 100ms
```

### 4. Server Logging

Use structured logging for better searchability:

```typescript
logger.info('Game created', {
  gameId: game.id,
  playerCount: players.length,
  mapSize: game.map.size,
  duration: Date.now() - startTime,
});
```

### 5. Error Filtering

Filter out noise in production:

```typescript
// Sentry config already filters:
// - ResizeObserver errors
// - Network failures
// - Non-Error promise rejections
```

## Troubleshooting

### Sentry Not Capturing Errors

1. Check that VITE_SENTRY_DSN is set correctly
2. Verify Sentry is initialized (check browser console for "[Sentry] Initialized successfully")
3. Ensure error severity is 'error' or 'critical' (warnings aren't sent)
4. Check Sentry filters aren't blocking your error type

### Source Maps Not Uploading

1. Verify SENTRY_AUTH_TOKEN is set
2. Check that build produces source maps (`dist/public/**/*.map`)
3. Ensure `sourcemap: true` is in vite config (requires editing vite.config.ts)
4. Run build in production mode: `NODE_ENV=production npm run build`

### Web Vitals Not Showing

1. Web Vitals only work in browser (not SSR)
2. Some metrics require user interaction (INP)
3. Check browser console for [Web Vitals] logs

### Logs Not Appearing

1. Check LOG_LEVEL environment variable
2. Ensure pino-pretty is installed for development
3. Verify NODE_ENV is set correctly

## Advanced Topics

### Custom Error Grouping

Configure Sentry to group errors by game context:

```typescript
// In sentry.ts
Sentry.init({
  beforeSend(event) {
    // Group by game phase
    if (event.contexts?.game?.phase) {
      event.fingerprint = [
        event.exception?.values?.[0]?.type,
        event.contexts.game.phase,
      ];
    }
    return event;
  },
});
```

### Error Rate Alerting

Set up alerts in Sentry:
1. Go to Alerts → Create Alert Rule
2. Choose "Errors" metric
3. Set threshold (e.g., > 10 errors in 5 minutes)
4. Configure notification channel (email, Slack, etc.)

### Session Replay

Replay user sessions leading to errors:
1. Errors with severity 'critical' automatically trigger replay
2. View replays in Sentry dashboard
3. See user actions, console logs, network requests

## Cost Optimization

### Sentry Plan Limits

Check the current Sentry plan limits before enabling high-volume replay or performance sampling in production.

### Optimize Sample Rates

```typescript
// In sentry.ts
tracesSampleRate: 0.1,  // 10% of transactions
replaysSessionSampleRate: 0.1,  // 10% of sessions
replaysOnErrorSampleRate: 1.0,  // 100% when errors occur
```

### Filter Noise

```typescript
// In sentry.ts
beforeSend(event) {
  // Don't send known non-critical errors
  if (event.exception?.values?.[0]?.value?.includes('ResizeObserver')) {
    return null;
  }
  return event;
},
```

## Support

For issues with the error logging system:
1. Check browser console for error messages
2. Review server logs for warnings
3. Export debug report (`gameDebugger.exportErrorReport()`)
4. Create an issue with the exported report attached
