# Game Analytics System

Chronicles of the Promised Land uses PostHog to track game metrics, player behavior, and performance. This comprehensive analytics system helps us understand how players engage with the game and identify areas for improvement.

## Overview

The analytics system tracks:
- **Player Choices** - Faction selection, map size, difficulty settings
- **Game Lifecycle** - Game starts, saves, loads
- **Gameplay Actions** - Unit creation, movement, combat, city management, technology research
- **Combat Events** - Detailed combat statistics with damage calculations
- **Performance Metrics** - Core Web Vitals (CLS, INP, LCP, FCP, TTFB)
- **User Context** - Session tracking, game state correlation

For production dashboard setup, use:
- [`docs/POSTHOG_DASHBOARD_SPEC.md`](./POSTHOG_DASHBOARD_SPEC.md) - exact dashboard cards, filters, formulas, and SQL insights for gameplay tuning.

## Setup

### 1. Create PostHog Account

1. Go to [https://posthog.com](https://posthog.com) and create a free account
2. Create a new project for your game
3. Copy your Project API Key (starts with `phc_`)

### 2. Configure Environment

```bash
# Copy the example env file if you haven't already
cp .env.example .env

# Add your PostHog API key to .env
VITE_POSTHOG_KEY=phc_your-api-key-here

# (Optional) Set PostHog host if using EU or self-hosted
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

### 3. Integration Method

The game initializes analytics in `client/src/utils/telemetry/index.ts` and starts it from `client/src/main.tsx`:

```typescript
import { initTelemetry } from "./utils/telemetry";

initTelemetry();
```

This approach:
- Initializes PostHog once with env gating (`VITE_POSTHOG_*` with support for legacy `VITE_PUBLIC_POSTHOG_*`)
- Captures default pageview/pageleave plus custom usage events
- Tracks acquisition metadata (`utm_*`, referrer domain/path), session duration, and return visits
- Captures gameplay lifecycle, actions, outcomes, and shared simulation telemetry for tuning
- Gracefully handles missing API key (app runs normally without analytics)

### 4. Restart Development Server

```bash
npm run dev
```

## Tracked Events

### Game Lifecycle Events

**game_started**
- Triggered when a new game begins
- Properties: map_size, player_count, ai_count, factions, human_faction

**game_saved**
- Triggered when the player saves their game
- Properties: game_id, turn, player_count, compressed_size

**game_loaded**
- Triggered when a saved game is loaded
- Properties: game_id, turn, player_count

**game_ended**
- Triggered when a game concludes
- Properties: winner, total_turns, game_duration

### Player Choice Events

**player_choice**
- Triggered when players make configuration choices
- Types:
  - `faction` - Faction selection (properties: player_slot, is_ai)
  - `map_size` - Map size selection (properties: player_count, ai_count)
  - `difficulty` - AI difficulty selection (properties: ai_player_id) - *Note: UI not yet implemented*

### Gameplay Action Events

**gameplay_action**
- Triggered for major in-game actions
- Action types:
  - `unit_created` - New unit built (properties: unit_type, city_id, turn)
  - `unit_moved` - Unit movement (properties: unit_id, turn)
  - `unit_attacked` - Unit combat (properties: attacker_type, defender_type, turn)
  - `city_founded` - New city established (properties: city_id, coordinate, turn)
  - `city_captured` - City conquered (properties: city_id, turn)
  - `tech_researched` - Technology unlocked (properties: tech_id, turn)
  - `building_constructed` - Structure built (properties: structure_type, city_id, turn)
  - `turn_ended` - Turn completed (properties: turn, player_id)

### Combat Event Tracking

**combat_event**
- Triggered for each combat engagement
- Properties:
  - `attacker_type` - Attacking unit type
  - `defender_type` - Defending unit type
  - `attacker_damage` - Damage taken by attacker
  - `defender_damage` - Damage taken by defender
  - `attacker_survived` - Whether attacker survived
  - `defender_survived` - Whether defender survived
  - `terrain_type` - (Optional) Terrain where combat occurred

### Performance Metrics

**performance_metric**
- Triggered for Core Web Vitals measurements
- Metrics tracked:
  - `CLS` - Cumulative Layout Shift
  - `INP` - Interaction to Next Paint
  - `LCP` - Largest Contentful Paint
  - `FCP` - First Contentful Paint
  - `TTFB` - Time to First Byte
- Properties: metric_name, metric_value, metric_rating, game_phase

### Usage Analytics Events

**usage_session_started**
- Triggered once per app session
- Properties include:
  - `traffic_type` (`direct`, `campaign`, `organic_search`, `social`, `referral`)
  - `referrer_domain`, `referrer_path`
  - `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
  - `visit_number`, `is_returning_visitor`, `days_since_last_seen`
  - `session_id`, `page_path`, `page_url`

**usage_page_view**
- Triggered on initial load and route/hash changes
- Properties: `session_id`, `page_path`, `page_title`, `page_url`, `trigger`

**usage_return_visit**
- Triggered when a visitor comes back after at least one previous visit
- Properties: `session_id`, `visit_number`, `days_since_last_seen`, acquisition fields

**usage_session_ended**
- Triggered when the page is hidden/unloaded
- Properties: `session_duration_seconds`, `active_duration_seconds`, `active_ratio`, `end_reason`

Usage analytics also registers stable build/runtime context on all events:
- `app_version`
- `git_sha`
- `environment`
- `platform`
- `is_dev_build`

### Gameplay Tuning Events

The game now emits gameplay tuning events from real state transitions in `useLocalGame` and save/load flows:

- `game_phase_changed`
- `menu_selection`
- `game_started`
- `game_loaded`
- `game_saved`
- `game_ended`
- `gameplay_action`
- `gameplay_action_blocked`
- `turn_ended`
- `combat_event`
- `unit_created`
- `units_removed`
- `building_constructed`
- `city_captured`
- `village_captured`
- `tech_researched`

It also bridges shared simulation telemetry (`emitTelemetry`) into PostHog:

- `logic_telemetry_event` (generic)
- `logic_ability_event`
- `logic_combat_event`
- `logic_technology_event`
- `logic_system_event`

These events make it possible to tune:
- Action success vs blocked rates by action type and reason
- Combat outcomes by unit matchup and terrain
- Research/build/capture pacing by turn and mode
- Session abandonment vs win/loss completion

Gameplay action telemetry now includes correlation IDs for joins:
- `action_id`
- `turn_id`
- `match_id`

And action payload telemetry is intentionally curated to avoid high-cardinality noise:
- `action_payload_summary` (selected key fields only)
- `action_payload_keys`

## Player Identification

### Identifying Players

Players are automatically identified when they start a game:

```typescript
// Automatically called in useLocalGame.startLocalGame
identifyPlayer(playerId, {
  name: playerName,
  faction: factionId,
});
```

### Game Context

Game context is automatically tracked and updated:

```typescript
// Set when game starts
setGameContext({
  gameId: 'local-12345',
  turn: 1,
  phase: 'playing',
  mapSize: 'normal',
  playerCount: 4,
  faction: 'nephites',
});

// Updated throughout gameplay
setGameContext({
  turn: 15, // Updated each turn
  phase: 'playing',
});
```

## Manual Event Tracking

### Using Tracking Functions

If you need to track custom events:

```typescript
import { trackEvent } from '@/utils/posthog';

trackEvent('custom_event_name', {
  custom_property: 'value',
  another_property: 123,
});
```

### Using PostHog Hook in Components

For more advanced use cases, components can directly access the PostHog instance:

```typescript
import { usePostHog } from '@/utils/posthog';

function MyComponent() {
  const posthog = usePostHog();
  
  const handleAction = () => {
    // Direct PostHog API access
    posthog?.capture('button_clicked', {
      button_name: 'special_action',
      context: 'game_menu',
    });
  };
  
  return <button onClick={handleAction}>Click Me</button>;
}
```

**Note**: The `usePostHog()` hook returns `undefined` if PostHog is not initialized (e.g., no API key), so always use optional chaining (`posthog?.`).

## Privacy & Data

### What We Collect

- Game events and player actions (anonymized)
- Performance metrics
- Session duration and frequency
- Game configuration choices

### What We Don't Collect

- Personal information (unless explicitly provided)
- IP addresses (disabled via person_profiles: 'identified_only')
- Sensitive user data
- Screenshots or recordings (except for critical errors in Sentry)

### Data Retention

PostHog free tier retains data for:
- Events: 1 year
- Session recordings: 3 weeks (not enabled)
- User profiles: Indefinite (identified only)

## Viewing Analytics

### PostHog Dashboard

1. Log in to [https://app.posthog.com](https://app.posthog.com)
2. Select your project
3. Navigate to different sections:
   - **Events** - See all tracked events
   - **Insights** - Create custom analytics queries
   - **Dashboards** - Build visualization dashboards
   - **Persons** - View player profiles
   - **Session Replay** - Watch user sessions (if enabled)

### Useful Queries

**Most Popular Factions**
```
Event: player_choice
Filter: choice_type = 'faction'
Group by: choice_value
```

**Average Game Length by Map Size**
```
Event: game_ended
Formula: avg(total_turns)
Group by: map_size
```

**Combat Win Rate by Unit Type**
```
Event: combat_event
Filter: attacker_survived = true
Group by: attacker_type
```

**Performance by Game Phase**
```
Event: performance_metric
Formula: avg(metric_value)
Group by: game_phase, metric_name
```

## Development vs Production

### Development Mode

- PostHog initializes but may have reduced sampling
- If the API key is missing, analytics initialization is skipped
- All events are tracked if API key is provided

### Production Mode

- PostHog fully enabled with API key
- Session replay available for debugging
- Full analytics tracking

## Troubleshooting

### Events Not Appearing

1. **Check API Key**
   ```bash
   echo $VITE_POSTHOG_KEY
   ```

2. **Verify Initialization**
   - Open browser console
   - Look for `[PostHog] Initialized successfully`
   - If not present, check for error messages

3. **Check Network Tab**
   - Open browser DevTools → Network
   - Filter for "posthog" or "i.posthog.com"
   - Verify POST requests are being sent

### Events Sent But Not in Dashboard

- PostHog has a slight delay (usually 1-2 minutes)
- Check the PostHog Live Events stream for real-time view
- Verify you're looking at the correct date range

### Performance Impact

PostHog is designed to be lightweight:
- Events batched and sent asynchronously
- No blocking of game rendering
- Minimal CPU/memory overhead

If you notice performance issues:
1. Check browser console for errors
2. Disable PostHog temporarily to confirm
3. Consider reducing event granularity

## Best Practices

### 1. Event Naming

- Use snake_case for event names
- Keep names descriptive but concise
- Use consistent naming patterns

### 2. Property Structure

- Include relevant context in properties
- Avoid nested objects (flatten when possible)
- Use consistent property names across events

### 3. Performance

- Don't track every mouse movement or frame render
- Batch related events when possible
- Use session replay sparingly (high bandwidth)

### 4. Testing

Before deploying analytics changes:

```bash
# Start game in development
npm run dev

# Play through game scenarios
# - Start new game
# - Select different factions
# - Perform combat
# - Save/load game

# Check PostHog Live Events to verify data
```

## Analytics Roadmap

Future enhancements planned:

- **Funnel Analysis** - Track player progression through game stages
- **Retention Metrics** - Measure player return rates
- **A/B Testing** - Test game balance changes
- **Heatmaps** - Visualize where players click most
- **Feature Flags** - Toggle features for different player segments

## Cost Management

PostHog pricing (as of 2025):

**Free Tier:**
- 1 million events/month
- 15,000 session recordings/month
- 1 year data retention

**Tips to Stay Under Limits:**
- Filter out noisy events in development
- Use sampling for high-frequency events
- Disable session recording unless debugging

## Support

For analytics-related questions:

1. Check [PostHog Documentation](https://posthog.com/docs)
2. Review `client/src/utils/posthog.ts` for implementation details
3. Search PostHog Community Slack
4. Create an issue in the project repository

## Integration with Other Tools

### Sentry Integration

Error events from Sentry are automatically correlated with PostHog sessions through shared session IDs:

```typescript
// Session ID shared between Sentry and PostHog
const sessionId = gameDebugger.getSessionId();
```

### Web Vitals

Performance metrics are automatically sent to PostHog:

```typescript
// Configured in main.tsx
initWebVitals({
  onReport: (report) => {
    trackPerformanceMetric({
      name: report.metric.name,
      value: report.metric.value,
      rating: report.metric.rating,
    });
  },
});
```

## Privacy Compliance

### GDPR & CCPA

PostHog is GDPR and CCPA compliant:
- Users can request data deletion
- Data processing agreements available
- EU hosting option available

### Opt-Out

To allow users to opt out of analytics:

```typescript
import { posthog } from '@/utils/posthog';

// User opts out
posthog.opt_out_capturing();

// User opts back in
posthog.opt_in_capturing();
```

Add opt-out UI in settings menu if required by your privacy policy.

## Conclusion

The analytics system provides valuable insights into player behavior and game performance without compromising user privacy or game performance. Use these insights to make data-driven decisions about game balance, feature development, and user experience improvements.
