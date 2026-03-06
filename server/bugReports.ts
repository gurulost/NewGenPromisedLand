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

export function buildBugReportWebhookPayload(params: {
  report: BugReport;
  reportId: string;
}): Record<string, unknown> {
  const diagnostics = asRecord(params.report.diagnostics);
  const gameSnapshot = getNestedRecord(diagnostics, "gameSnapshot");
  const summaryLines = [
    `Bug report ${params.reportId}`,
    `${params.report.category} / ${params.report.reproFrequency}`,
    `duplicates(24h): ${params.report.duplicateCount24h}`,
    gameSnapshot
      ? `game: turn ${gameSnapshot.turn ?? "?"}, phase ${gameSnapshot.phase ?? "?"}`
      : null,
    `message: ${String(params.report.playerMessage).slice(0, 240)}`,
  ].filter(Boolean);

  const text = summaryLines.join("\n");
  return {
    text,
    content: text,
    bugReport: {
      reportId: params.reportId,
      fingerprint: params.report.fingerprint,
      category: params.report.category,
      reproFrequency: params.report.reproFrequency,
      duplicateCount24h: params.report.duplicateCount24h,
      screenshotUrl: params.report.screenshotUrl ?? null,
      createdAt: params.report.createdAt,
    },
  };
}

export async function sendBugReportWebhook(params: {
  webhookUrl?: string;
  report: BugReport;
  reportId: string;
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
