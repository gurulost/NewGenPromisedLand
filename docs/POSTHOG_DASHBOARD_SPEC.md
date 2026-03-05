# PostHog Dashboard Spec (Gameplay Tuning)

This is the implementation-ready dashboard spec for the telemetry currently wired in the client.
Use it to build the first production dashboard set in PostHog without guessing event names or properties.

## Scope

This spec uses only events already emitted by:
- `client/src/utils/telemetry/usageAnalytics.ts`
- `client/src/utils/telemetry/gameplayAnalytics.ts`
- shared logic bridge events via `initSharedTelemetryBridge()`

`usageAnalytics` also registers `session_id` and `visit_number` as PostHog super-properties, so gameplay events can be analyzed at session level.

## Canonical Event Values

Use these exact values for filters and breakdowns:

- `game_mode`: `standard`, `tutorialEpisode`
- `action_source`: `local_offline`, `online_host`, `online_guest`, `online_remote`, `system`
- `end_source`: `victory_condition`, `reset_to_menu`
- `save_source`: `manual_save_menu`, `advanced_save_system_manual`, `advanced_save_system_auto`
- `load_source`: `main_menu_autosave`, `save_load_menu_autosave`, `save_load_menu`, `advanced_save_system`, `online_forced_resync`, `online_lobby_snapshot`, `unknown`
- `selection` (`menu_selection`): `resume_autosave`, `single_player_vs_ai`, `local_multiplayer`, `online_multiplayer`, `open_load_menu`, `tutorial_episode`, `load_autosave`, `load_saved_game`
- `blocked_reason` (`gameplay_action_blocked`): `rules_rejected`, `game_state_not_ready`, `ai_turn_in_progress`, `not_player_turn`, `missing_actor_id`, `queue_rejected`, `queue_network_error`
- `traffic_type`: `direct`, `campaign`, `organic_search`, `social`, `referral`

## Dashboard 1: Acquisition + Session Quality

1. `Sessions per Day`
- Type: Trend (daily)
- Event: `usage_session_started`
- Breakdown: none
- Metric: `count`

2. `New vs Returning Sessions`
- Type: Stacked bar (daily)
- Event: `usage_session_started`
- Breakdown: `is_returning_visitor`
- Metric: `count`

3. `Traffic Mix`
- Type: Stacked area (daily)
- Event: `usage_session_started`
- Breakdown: `traffic_type`
- Metric: `count`

4. `Top Referrers`
- Type: Bar
- Event: `usage_session_started`
- Breakdown: `referrer_domain`
- Filter: `referrer_domain != direct`

5. `Median Session Duration`
- Type: Trend (daily)
- Event: `usage_session_ended`
- Metric: `median(session_duration_seconds)`

6. `Median Active Ratio`
- Type: Trend (daily)
- Event: `usage_session_ended`
- Metric: `median(active_ratio)`

7. `Return Interval`
- Type: Trend (daily)
- Event: `usage_return_visit`
- Metric: `avg(days_since_last_seen)`

8. `Pages per Session (SQL)`
- Type: SQL insight
- Query:
```sql
SELECT
  toDate(timestamp) AS day,
  avg(pageviews) AS avg_pageviews_per_session
FROM (
  SELECT
    toDate(timestamp) AS timestamp_day,
    properties.session_id AS session_id,
    count() AS pageviews,
    min(timestamp) AS timestamp
  FROM events
  WHERE event = 'usage_page_view'
    AND timestamp >= now() - INTERVAL 30 DAY
  GROUP BY timestamp_day, session_id
)
GROUP BY day
ORDER BY day;
```

## Dashboard 2: Activation Funnel

1. `Main Menu Intent Mix`
- Type: Bar
- Event: `menu_selection`
- Filter: `location = main_menu`
- Breakdown: `selection`

2. `Session -> Start -> First Turn Funnel`
- Type: Funnel
- Steps:
  1. `usage_session_started`
  2. `game_started`
  3. `turn_ended`
- Conversion window: 24 hours
- Breakdown: `game_mode`

3. `Session -> Load -> First Turn Funnel`
- Type: Funnel
- Steps:
  1. `usage_session_started`
  2. `game_loaded`
  3. `turn_ended`
- Conversion window: 24 hours
- Breakdown: `load_source`

4. `Tutorial Start Share`
- Type: Trend
- Event: `game_started`
- Filter: `game_mode = tutorialEpisode`
- Metric: `count`

5. `Player Setup Choices`
- Type: Bar
- Event: `player_choice`
- Breakdown: `choice_type` and `choice_value`

## Dashboard 3: Retention + Re-engagement

1. `N-Day Retention`
- Type: Retention
- Start event: `usage_session_started`
- Returning event: `usage_session_started`
- Intervals: day 1, day 7, day 30
- Breakdown: `traffic_type`

2. `Returning Visitor Play Rate (SQL)`
- Type: SQL insight
- Query:
```sql
WITH returning_sessions AS (
  SELECT DISTINCT properties.session_id AS session_id
  FROM events
  WHERE event = 'usage_return_visit'
    AND timestamp >= now() - INTERVAL 30 DAY
),
sessions_with_start AS (
  SELECT DISTINCT properties.session_id AS session_id
  FROM events
  WHERE event = 'game_started'
    AND timestamp >= now() - INTERVAL 30 DAY
)
SELECT
  countDistinct(returning_sessions.session_id) AS returning_sessions,
  countDistinct(sessions_with_start.session_id) AS returning_sessions_that_started_game,
  round(
    countDistinct(sessions_with_start.session_id) /
    nullIf(countDistinct(returning_sessions.session_id), 0),
    4
  ) AS returning_play_rate
FROM returning_sessions
LEFT JOIN sessions_with_start
  ON sessions_with_start.session_id = returning_sessions.session_id;
```

3. `Load Source Distribution`
- Type: Pie
- Event: `game_loaded`
- Breakdown: `load_source`

4. `Save Source Distribution`
- Type: Pie
- Event: `game_saved`
- Breakdown: `save_source`

5. `Resume Intent -> Successful Load Funnel`
- Type: Funnel
- Steps:
  1. `menu_selection` where `selection in (resume_autosave, load_autosave, load_saved_game)`
  2. `game_loaded`
- Conversion window: 30 minutes

## Dashboard 4: Gameplay Friction + Pace

1. `Action Volume by Action Type`
- Type: Trend (daily)
- Event: `gameplay_action`
- Breakdown: `action_name`

2. `Blocked Volume by Reason`
- Type: Trend (daily)
- Event: `gameplay_action_blocked`
- Breakdown: `blocked_reason`

3. `Blocked Rate by Action Type (SQL)`
- Type: SQL insight
- Query:
```sql
SELECT
  coalesce(properties.action_name, 'unknown') AS action_name,
  countIf(event = 'gameplay_action') AS applied_count,
  countIf(event = 'gameplay_action_blocked') AS blocked_count,
  round(
    countIf(event = 'gameplay_action_blocked') /
    nullIf(countIf(event = 'gameplay_action') + countIf(event = 'gameplay_action_blocked'), 0),
    4
  ) AS blocked_rate
FROM events
WHERE event IN ('gameplay_action', 'gameplay_action_blocked')
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY action_name
ORDER BY blocked_rate DESC, blocked_count DESC;
```

4. `Turns Completed per Game`
- Type: Trend
- Event: `turn_ended`
- Metric: `count`
- Breakdown: `game_mode`

5. `Economy at End Turn`
- Type: Trend
- Event: `turn_ended`
- Metrics: `avg(ending_player_stars_after)`, `avg(ending_player_faith_after)`, `avg(ending_player_pride_after)`, `avg(ending_player_dissent_after)`
- Breakdown: `game_mode`

6. `Research Pace`
- Type: Trend
- Event: `tech_researched`
- Breakdown: `tech_id`
- Metric: `count`

7. `Expansion Pace`
- Type: Trend
- Events: `city_captured`, `village_captured`
- Metric: `count`
- Breakdown: `game_mode`

8. `Production Pace`
- Type: Trend
- Events: `unit_created`, `building_constructed`
- Breakdown: `building_type` (for `building_constructed`) and `unit_type` (for `unit_created`)

9. `Completion Outcome Split`
- Type: Stacked bar (daily)
- Event: `game_ended`
- Breakdown: `end_source`

## Dashboard 5: Combat Balance

1. `Combat Volume by Matchup`
- Type: Table/Bar
- Event: `combat_event`
- Breakdown: `attacker_type`, `defender_type`
- Metric: `count`

2. `Attacker Survival Rate by Unit Type`
- Type: SQL insight
- Query:
```sql
SELECT
  coalesce(properties.attacker_type, 'unknown') AS attacker_type,
  count() AS combats,
  countIf(properties.attacker_survived = true) AS attacker_survived_count,
  round(
    countIf(properties.attacker_survived = true) / nullIf(count(), 0),
    4
  ) AS attacker_survival_rate
FROM events
WHERE event = 'combat_event'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY attacker_type
ORDER BY combats DESC;
```

3. `Defender Survival Rate by Unit Type`
- Type: SQL insight
- Query:
```sql
SELECT
  coalesce(properties.defender_type, 'unknown') AS defender_type,
  count() AS combats,
  countIf(properties.defender_survived = true) AS defender_survived_count,
  round(
    countIf(properties.defender_survived = true) / nullIf(count(), 0),
    4
  ) AS defender_survival_rate
FROM events
WHERE event = 'combat_event'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY defender_type
ORDER BY combats DESC;
```

4. `Average Damage by Matchup`
- Type: Table
- Event: `combat_event`
- Metrics: `avg(attacker_damage)`, `avg(defender_damage)`
- Breakdown: `attacker_type`, `defender_type`

5. `Combat by Terrain`
- Type: Bar
- Event: `combat_event`
- Breakdown: `terrain_type`
- Metric: `count`

6. `Attack Distance vs Outcomes`
- Type: Trend/Table
- Event: `combat_event`
- Breakdown: `attack_distance`
- Metrics: `count`, `% attacker_survived`

7. `Online vs Offline Combat Outcomes`
- Type: Stacked bar
- Event: `combat_event`
- Breakdown: `is_online`, `attacker_survived`

## Dashboard 6: Online Reliability + Shared Logic Telemetry

1. `Online Action Blocks`
- Type: Bar
- Event: `gameplay_action_blocked`
- Filters: `is_online = true`
- Breakdown: `blocked_reason`

2. `Queue/Network Failure Trend`
- Type: Trend (daily)
- Event: `gameplay_action_blocked`
- Filters: `blocked_reason in (queue_rejected, queue_network_error)`

3. `Forced Resync Load Rate`
- Type: Trend (daily)
- Event: `game_loaded`
- Filters: `load_source = online_forced_resync`

4. `Shared Logic Event Volume`
- Type: Stacked area
- Event: `logic_telemetry_event`
- Breakdown: `channel`

5. `Shared Logic Failures`
- Type: Trend
- Event: `logic_telemetry_event`
- Filters: `status != success`
- Breakdown: `channel`, `reason`

## Alerts (PostHog Notifications)

Create these alerts after 2-4 weeks of baseline data:

1. `High gameplay block rate`
- Condition: `blocked_rate > 0.20` for any action with `blocked_count >= 50` in 24h

2. `Session quality regression`
- Condition: `median(session_duration_seconds)` drops by >25% week-over-week

3. `Online queue health`
- Condition: `queue_network_error + queue_rejected` increases >2x week-over-week

4. `Completion regression`
- Condition: ratio of `game_ended(end_source=victory_condition)` to `game_started` drops >20% week-over-week

## Build Order (Fastest to Value)

1. Build Dashboard 1 and 2 first (traffic + activation baseline)
2. Build Dashboard 4 and 5 next (balance + pacing)
3. Add Dashboard 3 and 6 when enough multiplayer/returning data exists
4. Add alerts only after baseline stabilizes
