import { createHash } from "crypto";

import type { BugReport } from "@shared/schema";
import type { SubmitBugReportRequest } from "@shared/types/bugReport";

import { logger } from "./utils/logger";

const MAX_DEPTH = 4;
const MAX_OBJECT_KEYS = 25;
const MAX_ARRAY_ITEMS = 25;
const MAX_STRING_LENGTH = 300;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const clampString = (value: unknown, max = MAX_STRING_LENGTH): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
};

const normalizeForFingerprint = (value: unknown): string => {
  const next = clampString(value, 500) ?? "";
  return next.toLowerCase().replace(/\s+/g, " ").trim();
};

const extractFirstString = (...values: unknown[]): string => {
  for (const value of values) {
    const next = clampString(value, 160);
    if (next) return next;
  }
  return "";
};

const sanitizeDiagnosticValue = (value: unknown, depth = 0): unknown => {
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (depth >= MAX_DEPTH) {
    return clampString(String(value), MAX_STRING_LENGTH);
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((entry) => sanitizeDiagnosticValue(entry, depth + 1));
  }

  const record = asRecord(value);
  if (!record) return clampString(String(value), MAX_STRING_LENGTH);

  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record).slice(0, MAX_OBJECT_KEYS)) {
    sanitized[key] = sanitizeDiagnosticValue(entry, depth + 1);
  }
  return sanitized;
};

const getNestedRecord = (value: unknown, key: string): Record<string, unknown> | null => {
  const record = asRecord(value);
  return record ? asRecord(record[key]) : null;
};

const extractErrorSignature = (diagnostics: Record<string, unknown> | undefined): string => {
  if (!diagnostics) return "";
  const errorReport = getNestedRecord(diagnostics, "errorReport");
  const fallbackErrors = Array.isArray(diagnostics.recentErrors) ? diagnostics.recentErrors : [];
  const errors = Array.isArray(errorReport?.errors) ? errorReport?.errors : fallbackErrors;
  const firstError = asRecord(errors[0]);
  const context = asRecord(firstError?.context);
  return extractFirstString(
    firstError?.message,
    firstError?.type,
    context?.component,
  );
};

const extractActionSignature = (diagnostics: Record<string, unknown> | undefined): string => {
  if (!diagnostics) return "";
  const recentActions = Array.isArray(diagnostics.recentActions) ? diagnostics.recentActions : [];
  const firstAction = asRecord(recentActions[0]);
  return extractFirstString(firstAction?.type, firstAction?.details);
};

const extractPhase = (diagnostics: Record<string, unknown> | undefined): string => {
  if (!diagnostics) return "";
  const gameSnapshot = getNestedRecord(diagnostics, "gameSnapshot");
  return extractFirstString(gameSnapshot?.phase, gameSnapshot?.gamePhase);
};

export function sanitizeBugReportDiagnostics(diagnostics: unknown): Record<string, unknown> | undefined {
  const sanitized = sanitizeDiagnosticValue(diagnostics);
  return asRecord(sanitized) ?? undefined;
}

export function buildBugReportFingerprint(
  payload: Pick<SubmitBugReportRequest, "category" | "playerMessage" | "expectedBehavior">,
  diagnostics?: Record<string, unknown>,
): string {
  const fingerprintBasis = [
    payload.category,
    normalizeForFingerprint(payload.playerMessage),
    normalizeForFingerprint(payload.expectedBehavior),
    normalizeForFingerprint(extractPhase(diagnostics)),
    normalizeForFingerprint(extractErrorSignature(diagnostics)),
    normalizeForFingerprint(extractActionSignature(diagnostics)),
  ].join("|");

  return createHash("sha256").update(fingerprintBasis).digest("hex").slice(0, 16);
}

export function formatBugReportId(id: number): string {
  return `BR-${String(id).padStart(6, "0")}`;
}

export function parseBugReportId(value: string): number | null {
  const normalized = String(value ?? "").trim();
  const match = normalized.match(/^BR-(\d{1,12})$/i) ?? normalized.match(/^(\d{1,12})$/);
  if (!match) return null;
  const numericId = Number(match[1]);
  return Number.isSafeInteger(numericId) && numericId > 0 ? numericId : null;
}

const formatLabel = (value: string): string =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const truncateForWebhook = (value: unknown, max: number): string | null => {
  const next = clampString(value, Math.max(16, max + 1));
  if (!next) return null;
  if (next.length <= max) return next;
  return `${next.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
};

const normalizeForCodeBlock = (value: string | null | undefined): string =>
  String(value ?? "")
    .replace(/```/g, "'''")
    .replace(/\r\n/g, "\n")
    .trim();

const compactGitSha = (value: string | null | undefined): string | null => {
  const next = clampString(value, 80);
  if (!next) return null;
  return next.length > 12 ? next.slice(0, 12) : next;
};

const getLastArrayRecord = (value: unknown): Record<string, unknown> | null => {
  if (!Array.isArray(value) || value.length === 0) return null;
  return asRecord(value[value.length - 1]);
};

const getSessionId = (diagnostics: Record<string, unknown> | undefined): string | null => {
  if (!diagnostics) return null;
  const usageAnalytics = getNestedRecord(diagnostics, "usageAnalytics");
  const debugSummary = getNestedRecord(diagnostics, "debugSummary");
  const debugSession = getNestedRecord(debugSummary, "session");
  return extractFirstString(usageAnalytics?.sessionId, debugSession?.sessionId) || null;
};

export function summarizeBugReportDiagnostics(diagnostics: unknown): Record<string, string | number | null> {
  const sanitized = asRecord(diagnostics);
  if (!sanitized) return {};

  const gameSnapshot = getNestedRecord(sanitized, "gameSnapshot");
  const auth = getNestedRecord(sanitized, "auth");
  const onlineSession = getNestedRecord(sanitized, "onlineSession");
  const usageAnalytics = getNestedRecord(sanitized, "usageAnalytics");
  const build = getNestedRecord(usageAnalytics, "build");
  const environment = getNestedRecord(sanitized, "environment");
  const recentAction = getLastArrayRecord(sanitized.recentActions);
  const recentError = getLastArrayRecord(sanitized.recentErrors);
  const viewport = getNestedRecord(environment, "viewport");

  return {
    turn: typeof gameSnapshot?.turn === "number" ? gameSnapshot.turn : null,
    phase: extractFirstString(gameSnapshot?.phase, gameSnapshot?.gamePhase) || null,
    currentPlayer: extractFirstString(gameSnapshot?.currentPlayerName, gameSnapshot?.currentPlayerId) || null,
    faction: extractFirstString(gameSnapshot?.currentPlayerFactionId) || null,
    mapSize:
      typeof gameSnapshot?.mapWidth === "number" && typeof gameSnapshot?.mapHeight === "number"
        ? `${gameSnapshot.mapWidth}x${gameSnapshot.mapHeight}`
        : null,
    lastAction: extractFirstString(gameSnapshot?.lastActionType, recentAction?.type) || null,
    recentAction: extractFirstString(recentAction?.type, recentAction?.details) || null,
    recentError: extractFirstString(recentError?.message, recentError?.type, extractErrorSignature(sanitized)) || null,
    sessionId: getSessionId(sanitized),
    username: extractFirstString(auth?.username) || null,
    lobbyCode: extractFirstString(onlineSession?.lobbyCode) || null,
    appVersion: extractFirstString(build?.app_version) || null,
    gitSha: compactGitSha(extractFirstString(build?.git_sha)),
    buildEnvironment: extractFirstString(build?.environment) || null,
    platform: extractFirstString(build?.platform) || null,
    browser: truncateForWebhook(environment?.userAgent, 120),
    pageUrl: truncateForWebhook(environment?.href, 160),
    viewport:
      typeof viewport?.width === "number" && typeof viewport?.height === "number"
        ? `${viewport.width}x${viewport.height}`
        : null,
  };
}

function detectWebhookTarget(webhookUrl?: string): "slack" | "discord" | "generic" {
  const normalized = String(webhookUrl ?? "").trim().toLowerCase();
  if (!normalized) return "generic";
  if (normalized.includes("hooks.slack.com/services/")) return "slack";
  if (normalized.includes("discord.com/api/webhooks/") || normalized.includes("discordapp.com/api/webhooks/")) {
    return "discord";
  }
  return "generic";
}

function buildBugReportDetailUrl(params: {
  publicBaseUrl?: string;
  reportId: string;
  viewToken?: string;
}): string | null {
  const publicBaseUrl = params.publicBaseUrl?.trim();
  const viewToken = params.viewToken?.trim();
  if (!publicBaseUrl || !viewToken) return null;

  try {
    const detailUrl = new URL(publicBaseUrl);
    const basePath = detailUrl.pathname.replace(/\/$/, "");
    detailUrl.pathname = `${basePath}/api/bug-reports/${encodeURIComponent(params.reportId)}`.replace(/\/{2,}/g, "/");
    detailUrl.search = "";
    detailUrl.hash = "";
    detailUrl.searchParams.set("token", viewToken);
    return detailUrl.toString();
  } catch {
    return null;
  }
}

function expandBugReportUrlTemplate(
  template: string | undefined,
  values: Record<string, string | number | null | undefined>,
): string | null {
  const normalized = template?.trim();
  if (!normalized) return null;

  try {
    return normalized.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
      const value = values[key];
      return encodeURIComponent(value == null ? "" : String(value));
    });
  } catch {
    return null;
  }
}

export function buildBugReportLinks(params: {
  report: BugReport;
  reportId: string;
  publicBaseUrl?: string;
  viewToken?: string;
  dbUrlTemplate?: string;
}): {
  detailUrl: string | null;
  databaseUrl: string | null;
  screenshotUrl: string | null;
  databaseLookup: string;
} {
  const detailUrl = buildBugReportDetailUrl({
    publicBaseUrl: params.publicBaseUrl,
    reportId: params.reportId,
    viewToken: params.viewToken,
  });
  const databaseLookup = `bug_reports.id=${params.report.id}`;
  const databaseUrl = expandBugReportUrlTemplate(params.dbUrlTemplate, {
    id: params.report.id,
    reportId: params.reportId,
    submissionId: params.report.submissionId,
    fingerprint: params.report.fingerprint,
    category: params.report.category,
    source: params.report.source,
    createdAt: params.report.createdAt.toISOString(),
  });

  return {
    detailUrl,
    databaseUrl,
    screenshotUrl: params.report.screenshotUrl ?? null,
    databaseLookup,
  };
}

function summarizeRecentItems(
  value: unknown,
  extractor: (entry: Record<string, unknown>) => string,
  maxItems = 3,
  maxLength = 120,
): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-maxItems)
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => truncateForWebhook(extractor(entry), maxLength))
    .filter((entry): entry is string => Boolean(entry));
}

export function buildBugReportAiTriagePack(params: {
  report: BugReport;
  reportId: string;
  links?: {
    detailUrl: string | null;
    databaseUrl: string | null;
    screenshotUrl: string | null;
    databaseLookup: string;
  };
}, options?: {
  mode?: "compact" | "full";
}): string {
  const mode = options?.mode ?? "full";
  const playerMessageLimit = mode === "compact" ? 700 : 1500;
  const expectedLimit = mode === "compact" ? 320 : 800;
  const contactLimit = mode === "compact" ? 180 : 320;
  const recentItemsLimit = mode === "compact" ? 2 : 3;
  const recentItemLength = mode === "compact" ? 90 : 140;
  const linkLength = mode === "compact" ? 180 : 260;
  const browserLength = mode === "compact" ? 100 : 160;
  const diagnostics = asRecord(params.report.diagnostics);
  const diagnosticsSummary = summarizeBugReportDiagnostics(diagnostics);
  const recentActionsTail = summarizeRecentItems(
    diagnostics?.recentActions,
    (entry) => extractFirstString(entry.type, entry.details),
    recentItemsLimit,
    recentItemLength,
  );
  const recentErrorsTail = summarizeRecentItems(
    diagnostics?.recentErrors,
    (entry) => extractFirstString(entry.message, entry.type),
    recentItemsLimit,
    recentItemLength,
  );

  const sections: string[] = [];
  sections.push("AI BUG TRIAGE PACK");
  sections.push("Paste this entire block into Codex/ChatGPT and ask for likely root cause, files to inspect, and a fix plan.");
  sections.push("");
  sections.push("REPORT");
  sections.push(`- report_id: ${params.reportId}`);
  sections.push(`- category: ${params.report.category}`);
  sections.push(`- source: ${params.report.source}`);
  sections.push(`- repro_frequency: ${params.report.reproFrequency}`);
  sections.push(`- duplicate_count_24h: ${params.report.duplicateCount24h}`);
  sections.push(`- fingerprint: ${params.report.fingerprint}`);
  sections.push(`- submission_id: ${params.report.submissionId}`);
  sections.push(`- created_at: ${params.report.createdAt.toISOString()}`);
  sections.push("");
  sections.push("PLAYER REPORT");
  sections.push("What happened:");
  sections.push(normalizeForCodeBlock(truncateForWebhook(params.report.playerMessage, playerMessageLimit)));
  if (params.report.expectedBehavior) {
    sections.push("");
    sections.push("Expected behavior:");
    sections.push(normalizeForCodeBlock(truncateForWebhook(params.report.expectedBehavior, expectedLimit)));
  }
  if (params.report.contact) {
    sections.push("");
    sections.push(`Contact: ${normalizeForCodeBlock(truncateForWebhook(params.report.contact, contactLimit))}`);
  }
  sections.push("");
  sections.push("GAME CONTEXT");
  sections.push(`- turn: ${diagnosticsSummary.turn ?? "n/a"}`);
  sections.push(`- phase: ${diagnosticsSummary.phase ?? "n/a"}`);
  sections.push(`- player: ${diagnosticsSummary.currentPlayer ?? "n/a"}`);
  sections.push(`- faction: ${diagnosticsSummary.faction ?? "n/a"}`);
  sections.push(`- map_size: ${diagnosticsSummary.mapSize ?? "n/a"}`);
  sections.push(`- lobby_code: ${diagnosticsSummary.lobbyCode ?? "n/a"}`);
  sections.push(`- session_id: ${diagnosticsSummary.sessionId ?? "n/a"}`);
  sections.push(`- last_action: ${diagnosticsSummary.lastAction ?? "n/a"}`);
  sections.push(`- recent_action: ${diagnosticsSummary.recentAction ?? "n/a"}`);
  sections.push(`- recent_error: ${diagnosticsSummary.recentError ?? "n/a"}`);
  sections.push("");
  sections.push("BUILD CONTEXT");
  sections.push(`- app_version: ${diagnosticsSummary.appVersion ?? "n/a"}`);
  sections.push(`- git_sha: ${diagnosticsSummary.gitSha ?? "n/a"}`);
  sections.push(`- build_environment: ${diagnosticsSummary.buildEnvironment ?? "n/a"}`);
  sections.push(`- platform: ${diagnosticsSummary.platform ?? "n/a"}`);
  sections.push(`- viewport: ${diagnosticsSummary.viewport ?? "n/a"}`);
  sections.push(`- browser: ${truncateForWebhook(diagnosticsSummary.browser, browserLength) ?? "n/a"}`);
  sections.push(`- page_url: ${truncateForWebhook(diagnosticsSummary.pageUrl, linkLength) ?? "n/a"}`);

  if (recentActionsTail.length || recentErrorsTail.length) {
    sections.push("");
    sections.push("RECENT SIGNALS");
    if (recentActionsTail.length) {
      sections.push("Recent actions tail:");
      for (const action of recentActionsTail) {
        sections.push(`- ${normalizeForCodeBlock(action)}`);
      }
    }
    if (recentErrorsTail.length) {
      sections.push("Recent errors tail:");
      for (const error of recentErrorsTail) {
        sections.push(`- ${normalizeForCodeBlock(error)}`);
      }
    }
  }

  if (params.links) {
    sections.push("");
    sections.push("LINKS");
    sections.push(`- screenshot_url: ${truncateForWebhook(params.links.screenshotUrl, linkLength) ?? "n/a"}`);
    sections.push(`- full_report_url: ${truncateForWebhook(params.links.detailUrl, linkLength) ?? "n/a"}`);
    sections.push(`- database_lookup: ${params.links.databaseLookup}`);
    sections.push(`- database_url: ${truncateForWebhook(params.links.databaseUrl, linkLength) ?? "n/a"}`);
  }

  const pack = sections.join("\n").trim();
  const maxLength = mode === "compact" ? 2200 : 10_000;
  if (pack.length <= maxLength) return pack;
  return `${pack.slice(0, Math.max(0, maxLength - 13)).trimEnd()}\n[truncated]`;
}

export function buildBugReportDetailPayload(params: {
  report: BugReport;
  reportId: string;
  publicBaseUrl?: string;
  viewToken?: string;
  dbUrlTemplate?: string;
}): Record<string, unknown> {
  const links = buildBugReportLinks(params);
  return {
    reportId: params.reportId,
    report: {
      id: params.report.id,
      submissionId: params.report.submissionId,
      source: params.report.source,
      category: params.report.category,
      status: params.report.status,
      playerMessage: params.report.playerMessage,
      expectedBehavior: params.report.expectedBehavior ?? null,
      reproFrequency: params.report.reproFrequency,
      contact: params.report.contact ?? null,
      includeDiagnostics: params.report.includeDiagnostics,
      includeScreenshot: params.report.includeScreenshot,
      screenshotUrl: params.report.screenshotUrl ?? null,
      fingerprint: params.report.fingerprint,
      duplicateCount24h: params.report.duplicateCount24h,
      diagnostics: asRecord(params.report.diagnostics) ?? null,
      diagnosticsSummary: summarizeBugReportDiagnostics(params.report.diagnostics),
      createdAt: params.report.createdAt,
    },
    links,
    aiTriagePack: buildBugReportAiTriagePack({
      report: params.report,
      reportId: params.reportId,
      links,
    }),
  };
}

export function buildBugReportWebhookPayload(params: {
  report: BugReport;
  reportId: string;
  webhookUrl?: string;
  publicBaseUrl?: string;
  viewToken?: string;
  dbUrlTemplate?: string;
}): Record<string, unknown> {
  const target = detectWebhookTarget(params.webhookUrl);
  const diagnostics = asRecord(params.report.diagnostics);
  const diagnosticsSummary = summarizeBugReportDiagnostics(diagnostics);
  const links = buildBugReportLinks({
    report: params.report,
    reportId: params.reportId,
    publicBaseUrl: params.publicBaseUrl,
    viewToken: params.viewToken,
    dbUrlTemplate: params.dbUrlTemplate,
  });
  const aiTriagePack = buildBugReportAiTriagePack({
    report: params.report,
    reportId: params.reportId,
    links,
  });
  const compactAiTriagePack = buildBugReportAiTriagePack({
    report: params.report,
    reportId: params.reportId,
    links,
  }, { mode: "compact" });
  const detailsText = [
    links.detailUrl ? `details: ${links.detailUrl}` : null,
    links.databaseUrl ? `db link: ${links.databaseUrl}` : null,
    links.screenshotUrl ? `screenshot: ${links.screenshotUrl}` : null,
    `db lookup: ${links.databaseLookup}`,
  ].filter(Boolean).join("\n");
  const summaryLines = [
    `Bug report ${params.reportId}`,
    `${formatLabel(params.report.category)} / ${formatLabel(params.report.reproFrequency)} / ${formatLabel(params.report.source)}`,
    `duplicates(24h): ${params.report.duplicateCount24h}`,
    diagnosticsSummary.turn != null || diagnosticsSummary.phase
      ? `game: turn ${diagnosticsSummary.turn ?? "?"}, phase ${diagnosticsSummary.phase ?? "?"}`
      : null,
    `message: ${truncateForWebhook(params.report.playerMessage, 240) ?? ""}`,
  ].filter(Boolean);

  const text = summaryLines.join("\n");

  if (target === "slack") {
    const fields = [
      `*Category*\n${formatLabel(params.report.category)}`,
      `*Repro*\n${formatLabel(params.report.reproFrequency)}`,
      `*Source*\n${formatLabel(params.report.source)}`,
      `*Duplicates (24h)*\n${params.report.duplicateCount24h}`,
      diagnosticsSummary.turn != null ? `*Turn*\n${diagnosticsSummary.turn}` : null,
      diagnosticsSummary.phase ? `*Phase*\n${diagnosticsSummary.phase}` : null,
      diagnosticsSummary.currentPlayer ? `*Player*\n${diagnosticsSummary.currentPlayer}` : null,
      diagnosticsSummary.faction ? `*Faction*\n${diagnosticsSummary.faction}` : null,
      diagnosticsSummary.lastAction ? `*Last Action*\n${diagnosticsSummary.lastAction}` : null,
      diagnosticsSummary.appVersion ? `*Build*\n${diagnosticsSummary.appVersion}` : null,
      diagnosticsSummary.gitSha ? `*Git SHA*\n${diagnosticsSummary.gitSha}` : null,
      diagnosticsSummary.sessionId ? `*Session*\n${truncateForWebhook(diagnosticsSummary.sessionId, 80)}` : null,
    ].filter((value): value is string => Boolean(value));

    const blocks: Record<string, unknown>[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `Bug report ${params.reportId}`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: fields.map((field) => ({
          type: "mrkdwn",
          text: field,
        })),
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*What happened?*\n${truncateForWebhook(params.report.playerMessage, 2800) ?? "No message provided."}`,
        },
      },
    ];

    if (params.report.expectedBehavior) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Expected behavior*\n${truncateForWebhook(params.report.expectedBehavior, 1800)}`,
        },
      });
    }

    if (params.report.contact) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Contact*\n${truncateForWebhook(params.report.contact, 300)}`,
        },
      });
    }

    const diagnosticLines = [
      diagnosticsSummary.mapSize ? `*Map*: ${diagnosticsSummary.mapSize}` : null,
      diagnosticsSummary.lobbyCode ? `*Lobby*: ${diagnosticsSummary.lobbyCode}` : null,
      diagnosticsSummary.username ? `*User*: ${diagnosticsSummary.username}` : null,
      diagnosticsSummary.recentAction ? `*Recent action*: ${truncateForWebhook(diagnosticsSummary.recentAction, 180)}` : null,
      diagnosticsSummary.recentError ? `*Recent error*: ${truncateForWebhook(diagnosticsSummary.recentError, 180)}` : null,
    ].filter(Boolean);
    if (diagnosticLines.length) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Diagnostics summary*\n${diagnosticLines.join("\n")}`,
        },
      });
    }

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
          "*AI triage pack*",
          "Copy the code block below and paste it directly into Codex/ChatGPT.",
          `\`\`\`${compactAiTriagePack}\`\`\``,
        ].join("\n"),
        },
      });

    if (links.screenshotUrl) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Screenshot*\n<${links.screenshotUrl}|Open screenshot>`,
        },
      });
      blocks.push({
        type: "image",
        image_url: links.screenshotUrl,
        alt_text: `Screenshot for ${params.reportId}`,
      });
    }

    const buttonElements = [
      links.detailUrl ? {
        type: "button",
        text: { type: "plain_text", text: "Full Report", emoji: true },
        url: links.detailUrl,
      } : null,
      links.databaseUrl ? {
        type: "button",
        text: { type: "plain_text", text: "DB/Admin Link", emoji: true },
        url: links.databaseUrl,
      } : null,
      links.screenshotUrl ? {
        type: "button",
        text: { type: "plain_text", text: "Screenshot", emoji: true },
        url: links.screenshotUrl,
      } : null,
    ].filter(Boolean) as Array<{
      type: string;
      text: { type: string; text: string; emoji: boolean };
      url: string;
    }>;
    if (buttonElements.length) {
      blocks.push({
        type: "actions",
        elements: buttonElements,
      });
    }

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: [
            `submission: \`${params.report.submissionId}\``,
            `fingerprint: \`${params.report.fingerprint}\``,
            links.databaseLookup,
          ].join(" • "),
        },
      ],
    });

    return { text, blocks };
  }

  if (target === "discord") {
    const fields = [
      { name: "Category", value: formatLabel(params.report.category), inline: true },
      { name: "Repro", value: formatLabel(params.report.reproFrequency), inline: true },
      { name: "Source", value: formatLabel(params.report.source), inline: true },
      { name: "Duplicates (24h)", value: String(params.report.duplicateCount24h), inline: true },
      diagnosticsSummary.turn != null ? { name: "Turn", value: String(diagnosticsSummary.turn), inline: true } : null,
      diagnosticsSummary.phase ? { name: "Phase", value: String(diagnosticsSummary.phase), inline: true } : null,
      diagnosticsSummary.currentPlayer ? { name: "Player", value: String(diagnosticsSummary.currentPlayer), inline: true } : null,
      diagnosticsSummary.faction ? { name: "Faction", value: String(diagnosticsSummary.faction), inline: true } : null,
      params.report.expectedBehavior
        ? { name: "Expected", value: truncateForWebhook(params.report.expectedBehavior, 1000) ?? "n/a", inline: false }
        : null,
      params.report.contact
        ? { name: "Contact", value: truncateForWebhook(params.report.contact, 1000) ?? "n/a", inline: false }
        : null,
      diagnosticsSummary.recentAction
        ? { name: "Recent Action", value: truncateForWebhook(diagnosticsSummary.recentAction, 1000) ?? "n/a", inline: false }
        : null,
      diagnosticsSummary.recentError
        ? { name: "Recent Error", value: truncateForWebhook(diagnosticsSummary.recentError, 1000) ?? "n/a", inline: false }
        : null,
      links.detailUrl ? { name: "Full Report", value: links.detailUrl, inline: false } : null,
      links.databaseUrl ? { name: "DB/Admin Link", value: links.databaseUrl, inline: false } : null,
      links.screenshotUrl ? { name: "Screenshot", value: links.screenshotUrl, inline: false } : null,
      { name: "Database Lookup", value: links.databaseLookup, inline: false },
    ].filter(Boolean) as Array<{ name: string; value: string; inline: boolean }>;

    return {
      content: `Bug report ${params.reportId}`,
      aiTriagePack,
      embeds: [
        {
          title: `Bug report ${params.reportId}`,
          url: links.detailUrl ?? links.databaseUrl ?? links.screenshotUrl ?? undefined,
          description: truncateForWebhook(params.report.playerMessage, 4000),
          color: 0xf59e0b,
          fields,
          footer: {
            text: `submission ${params.report.submissionId} • fingerprint ${params.report.fingerprint}`,
          },
          timestamp: params.report.createdAt.toISOString(),
          image: links.screenshotUrl ? { url: links.screenshotUrl } : undefined,
        },
      ],
    };
  }

  return {
    text: `${text}${detailsText ? `\n${detailsText}` : ""}`,
    content: text,
    bugReport: {
      id: params.report.id,
      reportId: params.reportId,
      submissionId: params.report.submissionId,
      fingerprint: params.report.fingerprint,
      category: params.report.category,
      source: params.report.source,
      reproFrequency: params.report.reproFrequency,
      duplicateCount24h: params.report.duplicateCount24h,
      playerMessage: params.report.playerMessage,
      expectedBehavior: params.report.expectedBehavior ?? null,
      contact: params.report.contact ?? null,
      screenshotUrl: params.report.screenshotUrl ?? null,
      createdAt: params.report.createdAt,
      diagnosticsSummary,
      diagnostics: diagnostics ?? null,
    },
    links,
    aiTriagePack,
  };
}

export async function sendBugReportWebhook(params: {
  webhookUrl?: string;
  report: BugReport;
  reportId: string;
  publicBaseUrl?: string;
  viewToken?: string;
  dbUrlTemplate?: string;
}): Promise<void> {
  const webhookUrl = params.webhookUrl?.trim();
  if (!webhookUrl) return;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBugReportWebhookPayload(params)),
      signal: AbortSignal.timeout(2500),
    });

    if (!response.ok) {
      logger.warn("Bug report webhook request failed", {
        reportId: params.reportId,
        status: response.status,
      });
    }
  } catch (error) {
    logger.warn("Bug report webhook delivery failed", {
      reportId: params.reportId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
