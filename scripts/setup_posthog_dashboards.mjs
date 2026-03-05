#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    out[key] = value;
  }
  return out;
}

const fileEnv = {
  ...loadDotEnvFile(path.join(ROOT, '.posthog.env')),
};

const POSTHOG_HOST = process.env.POSTHOG_HOST || fileEnv.POSTHOG_HOST;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID || fileEnv.POSTHOG_PROJECT_ID;
const POSTHOG_PERSONAL_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY || fileEnv.POSTHOG_PERSONAL_API_KEY;

if (!POSTHOG_HOST || !POSTHOG_PROJECT_ID || !POSTHOG_PERSONAL_API_KEY) {
  console.error('Missing POSTHOG_HOST, POSTHOG_PROJECT_ID, or POSTHOG_PERSONAL_API_KEY.');
  process.exit(1);
}

const API_BASE = `${POSTHOG_HOST.replace(/\/$/, '')}/api/projects/${POSTHOG_PROJECT_ID}`;
const DATE_RANGE_30D = { date_from: '-30d', explicitDate: false };
const DATE_RANGE_90D = { date_from: '-90d', explicitDate: false };
const DEFAULT_TRENDS_FILTER = {
  display: 'ActionsLineGraph',
  showLegend: true,
  yAxisScaleType: 'linear',
  showValuesOnSeries: false,
  smoothingIntervals: 1,
  showPercentStackView: false,
  aggregationAxisFormat: 'numeric',
  showAlertThresholdLines: false,
};

function eventNode(event, opts = {}) {
  const node = {
    kind: 'EventsNode',
    name: opts.name || event,
    event,
  };
  if (opts.custom_name) node.custom_name = opts.custom_name;
  if (opts.math) node.math = opts.math;
  if (opts.math_property) node.math_property = opts.math_property;
  if (opts.properties && opts.properties.length) node.properties = opts.properties;
  return node;
}

function eventProp(key, value, operator = 'exact') {
  return { type: 'event', key, value, operator };
}

function trendsQuery({
  series,
  interval = 'day',
  dateRange = DATE_RANGE_30D,
  properties = [],
  display = 'ActionsLineGraph',
  breakdown,
  showLegend = true,
}) {
  return {
    kind: 'InsightVizNode',
    source: {
      kind: 'TrendsQuery',
      series,
      interval,
      dateRange,
      properties,
      trendsFilter: {
        ...DEFAULT_TRENDS_FILTER,
        display,
        showLegend,
      },
      breakdownFilter: breakdown
        ? { breakdown, breakdown_type: 'event' }
        : { breakdown_type: 'event' },
      filterTestAccounts: false,
      version: 2,
    },
  };
}

function funnelQuery({
  steps,
  interval = 'day',
  dateRange = DATE_RANGE_30D,
  breakdown,
  windowInterval = 1,
  windowUnit = 'day',
}) {
  return {
    kind: 'InsightVizNode',
    source: {
      kind: 'FunnelsQuery',
      series: steps,
      interval,
      dateRange,
      properties: [],
      funnelsFilter: {
        layout: 'horizontal',
        exclusions: [],
        funnelVizType: 'steps',
        funnelOrderType: 'ordered',
        funnelStepReference: 'total',
        funnelWindowInterval: windowInterval,
        breakdownAttributionType: 'first_touch',
        funnelWindowIntervalUnit: windowUnit,
      },
      breakdownFilter: breakdown
        ? { breakdown, breakdown_type: 'event' }
        : { breakdown_type: 'event' },
      filterTestAccounts: false,
      version: 2,
    },
  };
}

function retentionQuery({
  startEvent,
  returnEvent,
  period = 'Day',
  totalIntervals = 30,
  dateRange = DATE_RANGE_90D,
  breakdown,
}) {
  return {
    kind: 'InsightVizNode',
    source: {
      kind: 'RetentionQuery',
      dateRange,
      properties: [],
      retentionFilter: {
        period,
        targetEntity: { id: startEvent, type: 'events' },
        retentionType: 'retention_first_time',
        totalIntervals,
        returningEntity: { id: returnEvent, type: 'events' },
      },
      breakdownFilter: breakdown
        ? { breakdown, breakdown_type: 'event' }
        : undefined,
      filterTestAccounts: false,
      version: 2,
    },
  };
}

function sqlTableQuery(query) {
  return {
    kind: 'DataVisualizationNode',
    display: 'ActionsTable',
    source: {
      kind: 'HogQLQuery',
      query,
    },
  };
}

function prefixed(name) {
  return `[ACTIVE NGPL] ${name}`;
}

const autoTags = ['ngpl', 'gameplay-analytics', 'autocreated'];

const DASHBOARD_SPECS = [
  {
    name: prefixed('Acquisition + Session Quality'),
    description: 'Usage acquisition, session quality, and return-visit health.',
    cards: [
      {
        name: prefixed('Sessions per Day'),
        query: trendsQuery({
          series: [eventNode('usage_session_started')],
          display: 'ActionsLineGraph',
          showLegend: false,
        }),
      },
      {
        name: prefixed('New vs Returning Sessions'),
        query: trendsQuery({
          series: [eventNode('usage_session_started')],
          breakdown: 'is_returning_visitor',
          display: 'ActionsStackedBar',
        }),
      },
      {
        name: prefixed('Traffic Mix'),
        query: trendsQuery({
          series: [eventNode('usage_session_started')],
          breakdown: 'traffic_type',
          display: 'ActionsAreaGraph',
        }),
      },
      {
        name: prefixed('Sessions by Country'),
        query: trendsQuery({
          series: [eventNode('usage_session_started')],
          breakdown: '$geoip_country_name',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: prefixed('Sessions by Region/State'),
        query: trendsQuery({
          series: [eventNode('usage_session_started')],
          breakdown: '$geoip_subdivision_1_name',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: prefixed('Sessions by City'),
        query: trendsQuery({
          series: [eventNode('usage_session_started')],
          breakdown: '$geoip_city_name',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: prefixed('Session -> Game Start Rate by Country (SQL)'),
        query: sqlTableQuery(`
WITH sessions AS (
    SELECT
        properties.session_id AS session_id,
        coalesce(nullIf(toString(properties.$geoip_country_name), ''), 'unknown') AS country
    FROM events
    WHERE event = 'usage_session_started'
      AND timestamp >= now() - INTERVAL 30 DAY
),
game_starts AS (
    SELECT DISTINCT properties.session_id AS session_id
    FROM events
    WHERE event = 'game_started'
      AND timestamp >= now() - INTERVAL 30 DAY
)
SELECT
    sessions.country AS country,
    uniqExact(sessions.session_id) AS sessions,
    uniqExactIf(sessions.session_id, game_starts.session_id IS NOT NULL) AS sessions_with_game_start,
    round(
        uniqExactIf(sessions.session_id, game_starts.session_id IS NOT NULL) /
        nullIf(uniqExact(sessions.session_id), 0),
        4
    ) AS start_rate
FROM sessions
LEFT JOIN game_starts
    ON game_starts.session_id = sessions.session_id
GROUP BY country
HAVING sessions >= 10
ORDER BY sessions DESC
`),
      },
      {
        name: prefixed('Top Referrers'),
        query: trendsQuery({
          series: [eventNode('usage_session_started')],
          breakdown: 'referrer_domain',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: prefixed('Avg Session Duration (s)'),
        query: trendsQuery({
          series: [eventNode('usage_session_ended', { math: 'avg', math_property: 'session_duration_seconds' })],
          display: 'ActionsLineGraph',
          showLegend: false,
        }),
      },
      {
        name: prefixed('Avg Active Ratio'),
        query: trendsQuery({
          series: [eventNode('usage_session_ended', { math: 'avg', math_property: 'active_ratio' })],
          display: 'ActionsLineGraph',
          showLegend: false,
        }),
      },
      {
        name: prefixed('Avg Return Interval (days)'),
        query: trendsQuery({
          series: [eventNode('usage_return_visit', { math: 'avg', math_property: 'days_since_last_seen' })],
          display: 'ActionsLineGraph',
          showLegend: false,
        }),
      },
      {
        name: prefixed('Pages per Session (SQL)'),
        query: sqlTableQuery(`
SELECT
    day,
    round(avg(pageviews), 3) AS avg_pageviews_per_session
FROM (
    SELECT
        toDate(timestamp) AS day,
        properties.session_id AS session_id,
        count() AS pageviews
    FROM events
    WHERE event = 'usage_page_view'
      AND timestamp >= now() - INTERVAL 30 DAY
    GROUP BY day, session_id
)
GROUP BY day
ORDER BY day ASC
`),
      },
    ],
  },
  {
    name: prefixed('Activation Funnel'),
    description: 'From session start to first meaningful gameplay.',
    cards: [
      {
        name: prefixed('Main Menu Intent Mix'),
        query: trendsQuery({
          series: [eventNode('menu_selection')],
          properties: [eventProp('location', 'main_menu')],
          breakdown: 'selection',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: prefixed('Session -> Start -> First Turn'),
        query: funnelQuery({
          steps: [
            eventNode('usage_session_started', { custom_name: 'Session Started' }),
            eventNode('game_started', { custom_name: 'Game Started' }),
            eventNode('turn_ended', { custom_name: 'First Turn Ended' }),
          ],
          breakdown: 'game_mode',
          windowInterval: 1,
          windowUnit: 'day',
        }),
      },
      {
        name: prefixed('Session -> Load -> First Turn'),
        query: funnelQuery({
          steps: [
            eventNode('usage_session_started', { custom_name: 'Session Started' }),
            eventNode('game_loaded', { custom_name: 'Game Loaded' }),
            eventNode('turn_ended', { custom_name: 'First Turn Ended' }),
          ],
          breakdown: 'load_source',
          windowInterval: 1,
          windowUnit: 'day',
        }),
      },
      {
        name: prefixed('Tutorial Start Share'),
        query: trendsQuery({
          series: [eventNode('game_started')],
          properties: [eventProp('game_mode', 'tutorialEpisode')],
          display: 'ActionsLineGraph',
          showLegend: false,
        }),
      },
      {
        name: prefixed('Player Choices by Type'),
        query: trendsQuery({
          series: [eventNode('player_choice')],
          breakdown: 'choice_type',
          display: 'ActionsStackedBar',
        }),
      },
      {
        name: prefixed('Player Choice Values'),
        query: trendsQuery({
          series: [eventNode('player_choice')],
          breakdown: 'choice_value',
          display: 'ActionsBarValue',
        }),
      },
    ],
  },
  {
    name: prefixed('Retention + Re-engagement'),
    description: 'How often people return and whether they re-enter gameplay.',
    cards: [
      {
        name: prefixed('N-Day Retention (Session Started -> Session Started)'),
        query: retentionQuery({
          startEvent: 'usage_session_started',
          returnEvent: 'usage_session_started',
          period: 'Day',
          totalIntervals: 30,
          breakdown: 'traffic_type',
        }),
      },
      {
        name: prefixed('Returning Visitor Play Rate (SQL)'),
        query: sqlTableQuery(`
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
    uniqExact(returning_sessions.session_id) AS returning_sessions,
    uniqExact(sessions_with_start.session_id) AS returning_sessions_that_started_game,
    round(
        uniqExact(sessions_with_start.session_id) /
        nullIf(uniqExact(returning_sessions.session_id), 0),
        4
    ) AS returning_play_rate
FROM returning_sessions
LEFT JOIN sessions_with_start
    ON sessions_with_start.session_id = returning_sessions.session_id
`),
      },
      {
        name: prefixed('Load Source Distribution'),
        query: trendsQuery({
          series: [eventNode('game_loaded')],
          breakdown: 'load_source',
          display: 'ActionsPie',
        }),
      },
      {
        name: prefixed('Save Source Distribution'),
        query: trendsQuery({
          series: [eventNode('game_saved')],
          breakdown: 'save_source',
          display: 'ActionsPie',
        }),
      },
      {
        name: prefixed('Resume Autosave -> Successful Load'),
        query: funnelQuery({
          steps: [
            eventNode('menu_selection', {
              custom_name: 'Resume Clicked',
              properties: [eventProp('selection', 'resume_autosave')],
            }),
            eventNode('game_loaded', { custom_name: 'Game Loaded' }),
          ],
          windowInterval: 1,
          windowUnit: 'day',
        }),
      },
      {
        name: prefixed('Load Saved Game -> Successful Load'),
        query: funnelQuery({
          steps: [
            eventNode('menu_selection', {
              custom_name: 'Load Saved Clicked',
              properties: [eventProp('selection', 'load_saved_game')],
            }),
            eventNode('game_loaded', { custom_name: 'Game Loaded' }),
          ],
          windowInterval: 1,
          windowUnit: 'day',
        }),
      },
    ],
  },
  {
    name: prefixed('Gameplay Friction + Pace'),
    description: 'Action success/blocks, economy pacing, and progression speed.',
    cards: [
      {
        name: prefixed('Action Volume by Action Type'),
        query: trendsQuery({
          series: [eventNode('gameplay_action')],
          breakdown: 'action_name',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: prefixed('Blocked Volume by Reason'),
        query: trendsQuery({
          series: [eventNode('gameplay_action_blocked')],
          breakdown: 'blocked_reason',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: prefixed('Blocked Rate by Action Type (SQL)'),
        query: sqlTableQuery(`
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
ORDER BY blocked_rate DESC, blocked_count DESC
`),
      },
      {
        name: prefixed('Turns Completed by Mode'),
        query: trendsQuery({
          series: [eventNode('turn_ended')],
          breakdown: 'game_mode',
          display: 'ActionsLineGraph',
        }),
      },
      {
        name: prefixed('Economy at End Turn (Avg)'),
        query: trendsQuery({
          series: [
            eventNode('turn_ended', { name: 'ending_player_stars_after', math: 'avg', math_property: 'ending_player_stars_after' }),
            eventNode('turn_ended', { name: 'ending_player_faith_after', math: 'avg', math_property: 'ending_player_faith_after' }),
            eventNode('turn_ended', { name: 'ending_player_pride_after', math: 'avg', math_property: 'ending_player_pride_after' }),
            eventNode('turn_ended', { name: 'ending_player_dissent_after', math: 'avg', math_property: 'ending_player_dissent_after' }),
          ],
          display: 'ActionsLineGraph',
          showLegend: true,
        }),
      },
      {
        name: prefixed('Research Pace by Tech'),
        query: trendsQuery({
          series: [eventNode('tech_researched')],
          breakdown: 'tech_id',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: prefixed('Expansion Pace (City/Village Capture)'),
        query: trendsQuery({
          series: [eventNode('city_captured'), eventNode('village_captured')],
          breakdown: 'game_mode',
          display: 'ActionsLineGraph',
        }),
      },
      {
        name: prefixed('Production Pace (Unit Types)'),
        query: trendsQuery({
          series: [eventNode('unit_created')],
          breakdown: 'unit_type',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: prefixed('Production Pace (Building Types)'),
        query: trendsQuery({
          series: [eventNode('building_constructed')],
          breakdown: 'building_type',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: prefixed('Completion Outcome Split'),
        query: trendsQuery({
          series: [eventNode('game_ended')],
          breakdown: 'end_source',
          display: 'ActionsStackedBar',
        }),
      },
    ],
  },
  {
    name: prefixed('Combat Balance'),
    description: 'Combat volume, survival, damage, terrain effects, and online parity.',
    cards: [
      {
        name: prefixed('Combat Volume by Matchup (SQL)'),
        query: sqlTableQuery(`
SELECT
    coalesce(properties.attacker_type, 'unknown') AS attacker_type,
    coalesce(properties.defender_type, 'unknown') AS defender_type,
    count() AS combats
FROM events
WHERE event = 'combat_event'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY attacker_type, defender_type
ORDER BY combats DESC
`),
      },
      {
        name: prefixed('Attacker Survival Rate by Unit Type (SQL)'),
        query: sqlTableQuery(`
SELECT
    coalesce(properties.attacker_type, 'unknown') AS attacker_type,
    count() AS combats,
    countIf(toBool(properties.attacker_survived) = 1) AS attacker_survived_count,
    round(
        countIf(toBool(properties.attacker_survived) = 1) / nullIf(count(), 0),
        4
    ) AS attacker_survival_rate
FROM events
WHERE event = 'combat_event'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY attacker_type
ORDER BY combats DESC
`),
      },
      {
        name: prefixed('Defender Survival Rate by Unit Type (SQL)'),
        query: sqlTableQuery(`
SELECT
    coalesce(properties.defender_type, 'unknown') AS defender_type,
    count() AS combats,
    countIf(toBool(properties.defender_survived) = 1) AS defender_survived_count,
    round(
        countIf(toBool(properties.defender_survived) = 1) / nullIf(count(), 0),
        4
    ) AS defender_survival_rate
FROM events
WHERE event = 'combat_event'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY defender_type
ORDER BY combats DESC
`),
      },
      {
        name: prefixed('Average Damage by Matchup (SQL)'),
        query: sqlTableQuery(`
SELECT
    coalesce(properties.attacker_type, 'unknown') AS attacker_type,
    coalesce(properties.defender_type, 'unknown') AS defender_type,
    round(avg(toFloatOrZero(properties.attacker_damage)), 3) AS avg_attacker_damage,
    round(avg(toFloatOrZero(properties.defender_damage)), 3) AS avg_defender_damage,
    count() AS combats
FROM events
WHERE event = 'combat_event'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY attacker_type, defender_type
ORDER BY combats DESC
`),
      },
      {
        name: prefixed('Combat by Terrain'),
        query: trendsQuery({
          series: [eventNode('combat_event')],
          breakdown: 'terrain_type',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: prefixed('Attack Distance vs Outcomes (SQL)'),
        query: sqlTableQuery(`
SELECT
    coalesce(toString(properties.attack_distance), 'unknown') AS attack_distance,
    count() AS combats,
    round(
        countIf(toBool(properties.attacker_survived) = 1) / nullIf(count(), 0),
        4
    ) AS attacker_survival_rate
FROM events
WHERE event = 'combat_event'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY attack_distance
ORDER BY toIntOrZero(attack_distance) ASC
`),
      },
      {
        name: prefixed('Online vs Offline Combat Outcomes (SQL)'),
        query: sqlTableQuery(`
SELECT
    if(toBool(properties.is_online) = 1, 'online', 'offline') AS connectivity,
    if(toBool(properties.attacker_survived) = 1, 'attacker_survived', 'attacker_defeated') AS attacker_outcome,
    count() AS combats
FROM events
WHERE event = 'combat_event'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY connectivity, attacker_outcome
ORDER BY combats DESC
`),
      },
    ],
  },
  {
    name: prefixed('Online Reliability + Logic Telemetry'),
    description: 'Multiplayer reliability and shared logic event quality.',
    cards: [
      {
        name: prefixed('Online Action Blocks by Reason'),
        query: trendsQuery({
          series: [eventNode('gameplay_action_blocked')],
          properties: [eventProp('is_online', true)],
          breakdown: 'blocked_reason',
          display: 'ActionsBarValue',
        }),
      },
      {
        name: prefixed('Queue Reject/Network Error Trend'),
        query: trendsQuery({
          series: [
            eventNode('gameplay_action_blocked', {
              name: 'queue_rejected',
              properties: [eventProp('blocked_reason', 'queue_rejected')],
            }),
            eventNode('gameplay_action_blocked', {
              name: 'queue_network_error',
              properties: [eventProp('blocked_reason', 'queue_network_error')],
            }),
          ],
          display: 'ActionsLineGraph',
        }),
      },
      {
        name: prefixed('Forced Resync Load Rate'),
        query: trendsQuery({
          series: [eventNode('game_loaded')],
          properties: [eventProp('load_source', 'online_forced_resync')],
          display: 'ActionsLineGraph',
          showLegend: false,
        }),
      },
      {
        name: prefixed('Shared Logic Event Volume by Channel'),
        query: trendsQuery({
          series: [eventNode('logic_telemetry_event')],
          breakdown: 'channel',
          display: 'ActionsAreaGraph',
        }),
      },
      {
        name: prefixed('Shared Logic Failures by Channel/Reason (SQL)'),
        query: sqlTableQuery(`
SELECT
    coalesce(properties.channel, 'unknown') AS channel,
    coalesce(properties.reason, 'unknown') AS reason,
    count() AS failures
FROM events
WHERE event = 'logic_telemetry_event'
  AND coalesce(toString(properties.status), '') != 'success'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY channel, reason
ORDER BY failures DESC
`),
      },
    ],
  },
];

async function api(pathName, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${pathName}`, {
    method,
    headers: {
      Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${method} ${pathName}`);
    err.details = data;
    throw err;
  }

  return data;
}

async function paginate(pathName) {
  const limit = 100;
  let offset = 0;
  const all = [];
  while (true) {
    const page = await api(`${pathName}${pathName.includes('?') ? '&' : '?'}limit=${limit}&offset=${offset}`);
    const results = Array.isArray(page.results) ? page.results : [];
    all.push(...results);
    if (!page.next || results.length === 0) break;
    offset += limit;
  }
  return all;
}

async function ensureDashboard(name, description) {
  const dashboards = await paginate('/dashboards/');
  let existing = dashboards.find((d) => d.name === name);
  if (existing) {
    const updated = await api(`/dashboards/${existing.id}/`, {
      method: 'PATCH',
      body: { description },
    });
    return { dashboard: updated, created: false };
  }

  const created = await api('/dashboards/', {
    method: 'POST',
    body: {
      name,
      description,
      pinned: false,
      tags: autoTags,
    },
  });
  return { dashboard: created, created: true };
}

async function ensureInsight({ name, description, query, dashboardId }) {
  const insights = await paginate('/insights/?basic=true');
  let existing = insights.find((i) => i.name === name && !i.deleted);

  if (!existing) {
    const created = await api('/insights/', {
      method: 'POST',
      body: {
        name,
        description,
        query,
        dashboards: [dashboardId],
        tags: autoTags,
      },
    });
    return { insight: created, created: true, attached: true };
  }

  const existingFull = await api(`/insights/${existing.id}/`);
  const dashboards = Array.isArray(existingFull.dashboards) ? existingFull.dashboards : [];
  const nextDashboards = dashboards.includes(dashboardId) ? dashboards : [...dashboards, dashboardId];
  const patched = await api(`/insights/${existing.id}/`, {
    method: 'PATCH',
    body: {
      description,
      query,
      dashboards: nextDashboards,
      tags: autoTags,
    },
  });

  return {
    insight: patched,
    created: false,
    attached: !dashboards.includes(dashboardId),
  };
}

async function main() {
  const createdDashboards = [];
  const reusedDashboards = [];
  const createdInsights = [];
  const updatedInsights = [];

  for (const dashboardSpec of DASHBOARD_SPECS) {
    const { dashboard, created } = await ensureDashboard(dashboardSpec.name, dashboardSpec.description);
    if (created) createdDashboards.push({ id: dashboard.id, name: dashboard.name });
    else reusedDashboards.push({ id: dashboard.id, name: dashboard.name });

    for (const card of dashboardSpec.cards) {
      const result = await ensureInsight({
        name: card.name,
        description: dashboardSpec.description,
        query: card.query,
        dashboardId: dashboard.id,
      });

      if (result.created) {
        createdInsights.push({ id: result.insight.id, name: result.insight.name, dashboard: dashboard.name });
      } else {
        updatedInsights.push({ id: result.insight.id, name: result.insight.name, dashboard: dashboard.name, attached: result.attached });
      }

      // Small throttle to avoid API burst limits.
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  const summary = {
    project_id: POSTHOG_PROJECT_ID,
    dashboards_created: createdDashboards,
    dashboards_reused: reusedDashboards,
    insights_created_count: createdInsights.length,
    insights_updated_count: updatedInsights.length,
    insights_created: createdInsights,
    insights_updated: updatedInsights,
    generated_at: new Date().toISOString(),
  };

  const outPath = path.join(ROOT, 'docs', 'posthog-dashboard-setup-summary.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log('Setup complete.');
  console.log(`Dashboards created: ${createdDashboards.length}`);
  console.log(`Dashboards reused: ${reusedDashboards.length}`);
  console.log(`Insights created: ${createdInsights.length}`);
  console.log(`Insights updated: ${updatedInsights.length}`);
  console.log(`Summary written: ${outPath}`);
}

main().catch((error) => {
  console.error('Failed to set up PostHog dashboards.');
  if (error?.details) {
    console.error(JSON.stringify(error.details, null, 2));
  } else {
    console.error(error);
  }
  process.exit(1);
});
