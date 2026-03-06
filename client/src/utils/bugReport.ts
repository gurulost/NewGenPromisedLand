import {
  BUG_REPORT_DIAGNOSTIC_LIMITS,
  BUG_REPORT_SCREENSHOT_LIMITS,
  type BugReportCategory,
  type BugReportReproFrequency,
  type BugReportSource,
  type SubmitBugReportRequest,
  type SubmitBugReportResponse,
} from "@shared/types/bugReport";

import { getDeviceId } from "@/lib/deviceId";
import { useAuth } from "@/lib/stores/useAuth";
import { useGameState } from "@/lib/stores/useGameState";
import { useLocalGame } from "@/lib/stores/useLocalGame";
import { gameDebugger } from "@/utils/gameDebug";
import { gameErrorReporter } from "@/utils/errorReporting";
import { capture } from "@/utils/telemetry/posthog";
import { getUsageAnalyticsContext } from "@/utils/telemetry/usageAnalytics";

export const BUG_REPORT_OPEN_EVENT = "ngpl:open-bug-report";

const BUG_REPORT_QUEUE_KEY = "ngpl_bug_report_queue_v1";
const MAX_QUEUE_ITEMS = 20;
const MAX_QUEUE_BYTES = 220_000;

let flushPromise: Promise<{ sentCount: number; remainingCount: number }> | null = null;

class ApiError extends Error {
  status?: number;
}

type QueuedBugReport = SubmitBugReportRequest;

export interface OpenBugReportDetail {
  source?: BugReportSource;
  category?: BugReportCategory;
  playerMessage?: string;
  expectedBehavior?: string;
}

export interface BugReportDraftInput {
  source: BugReportSource;
  category: BugReportCategory;
  playerMessage: string;
  expectedBehavior?: string;
  reproFrequency: BugReportReproFrequency;
  contact?: string;
  includeDiagnostics: boolean;
  includeScreenshot: boolean;
}

export interface BugReportSubmitResult {
  queued: boolean;
  response?: SubmitBugReportResponse;
  submissionId: string;
}

const sanitizeDiagnosticValue = (value: unknown, depth = 0): unknown => {
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 300);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (depth >= 4) return String(value).slice(0, 300);

  if (Array.isArray(value)) {
    return value.slice(0, 25).map((entry) => sanitizeDiagnosticValue(entry, depth + 1));
  }

  if (typeof value !== "object") return String(value).slice(0, 300);

  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 25)) {
    sanitized[key] = sanitizeDiagnosticValue(entry, depth + 1);
  }
  return sanitized;
};

const compactPayloadForQueue = (payload: SubmitBugReportRequest): SubmitBugReportRequest => {
  let next = payload;
  let serialized = JSON.stringify(next);
  if (serialized.length <= MAX_QUEUE_BYTES) return next;

  next = {
    ...next,
    diagnostics: {
      queuedAt: new Date().toISOString(),
      queueCompacted: true,
      gameSnapshot: (next.diagnostics as Record<string, unknown> | undefined)?.gameSnapshot ?? null,
      recentActions: Array.isArray((next.diagnostics as Record<string, unknown> | undefined)?.recentActions)
        ? ((next.diagnostics as Record<string, unknown>).recentActions as unknown[]).slice(0, 8)
        : [],
      recentErrors: Array.isArray((next.diagnostics as Record<string, unknown> | undefined)?.recentErrors)
        ? ((next.diagnostics as Record<string, unknown>).recentErrors as unknown[]).slice(0, 4)
        : [],
    },
  };
  serialized = JSON.stringify(next);
  if (serialized.length <= MAX_QUEUE_BYTES) return next;

  return {
    ...next,
    includeDiagnostics: false,
    diagnostics: undefined,
  };
};

const readQueue = (): QueuedBugReport[] => {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(BUG_REPORT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (items: QueuedBugReport[]): void => {
  if (typeof localStorage === "undefined") return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(BUG_REPORT_QUEUE_KEY);
      return;
    }
    localStorage.setItem(BUG_REPORT_QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE_ITEMS)));
  } catch {
    // Ignore storage failures.
  }
};

const queuePayload = (payload: SubmitBugReportRequest): void => {
  const current = readQueue().filter((entry) => entry.submissionId !== payload.submissionId);
  current.push(compactPayloadForQueue(payload));
  writeQueue(current.slice(-MAX_QUEUE_ITEMS));
};

const createSubmissionId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `bug_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const isRetryableError = (error: unknown): boolean => {
  if (!(error instanceof ApiError)) return true;
  if (typeof error.status !== "number") return true;
  return error.status >= 500 || error.status === 429;
};

const postJson = async <T,>(url: string, body: Record<string, unknown>): Promise<T> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Device-Id": getDeviceId(),
    },
    body: JSON.stringify(body),
    credentials: "include",
  });

  if (!response.ok) {
    const error = new ApiError(`Request failed (${response.status})`);
    error.status = response.status;
    try {
      const payload = await response.json();
      if (payload?.error) {
        error.message = String(payload.error);
      }
    } catch {
      // Ignore parse failures.
    }
    throw error;
  }

  return response.json() as Promise<T>;
};

const uploadScreenshotBlob = async (submissionId: string, blob: Blob): Promise<string> => {
  const presign = await postJson<{
    uploadUrl: string;
    publicUrl: string;
  }>("/api/bug-reports/screenshot-upload", {
    submissionId,
    mimeType: blob.type || "image/jpeg",
    contentLength: blob.size,
  });

  const response = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": blob.type || "image/jpeg" },
    body: blob,
  });

  if (!response.ok) {
    const error = new ApiError(`Upload to storage failed (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return presign.publicUrl;
};

const captureScreenshotBlob = async (): Promise<Blob | null> => {
  if (typeof document === "undefined") return null;
  const sourceCanvas = document.querySelector("canvas");
  if (!(sourceCanvas instanceof HTMLCanvasElement) || sourceCanvas.width <= 0 || sourceCanvas.height <= 0) {
    return null;
  }

  const scale = Math.min(
    1,
    BUG_REPORT_SCREENSHOT_LIMITS.maxWidth / sourceCanvas.width,
    BUG_REPORT_SCREENSHOT_LIMITS.maxHeight / sourceCanvas.height,
  );
  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
  targetCanvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));

  const context = targetCanvas.getContext("2d");
  if (!context) return null;
  context.drawImage(sourceCanvas, 0, 0, targetCanvas.width, targetCanvas.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    targetCanvas.toBlob(resolve, "image/jpeg", 0.65);
  });

  if (!blob || blob.size > BUG_REPORT_SCREENSHOT_LIMITS.maxBytes) {
    return null;
  }
  return blob;
};

export function isBugReportingEnabled(): boolean {
  return (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_BUG_REPORTING_ENABLED !== "false";
}

export function openBugReportDialog(detail: OpenBugReportDetail = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BUG_REPORT_OPEN_EVENT, { detail }));
}

export function collectBugReportDiagnostics(): Record<string, unknown> {
  const localGame = useLocalGame.getState();
  const uiState = useGameState.getState();
  const authState = useAuth.getState();
  const gameState = localGame.gameState;
  const currentPlayer = gameState?.players?.[gameState.currentPlayerIndex] ?? null;
  const debugSummary = gameDebugger.getDebugSummary();
  const errorDebug = gameErrorReporter.getDebugReport();

  return sanitizeDiagnosticValue({
    collectedAt: new Date().toISOString(),
    usageAnalytics: getUsageAnalyticsContext(),
    auth: {
      userId: authState.user?.id ?? null,
      username: authState.user?.username ?? null,
      isAuthenticated: Boolean(authState.user),
    },
    environment: {
      href: typeof window !== "undefined" ? window.location.href : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      language: typeof navigator !== "undefined" ? navigator.language : null,
      online: typeof navigator !== "undefined" ? navigator.onLine : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      viewport: typeof window !== "undefined"
        ? { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio }
        : null,
      screen: typeof screen !== "undefined"
        ? { width: screen.width, height: screen.height, colorDepth: screen.colorDepth }
        : null,
      memory: typeof performance !== "undefined" && typeof (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize === "number"
        ? {
            usedHeapMb: Math.round(((performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize ?? 0) / (1024 * 1024)),
          }
        : null,
    },
    gameSnapshot: gameState ? {
      gameId: gameState.id,
      turn: gameState.turn,
      phase: gameState.phase,
      mapWidth: gameState.map.width,
      mapHeight: gameState.map.height,
      playerCount: gameState.players.length,
      unitCount: gameState.units.length,
      cityCount: gameState.cities.length,
      currentPlayerId: currentPlayer?.id ?? null,
      currentPlayerName: currentPlayer?.name ?? null,
      currentPlayerFactionId: currentPlayer?.factionId ?? null,
      lastActionType: gameState.lastAction?.type ?? null,
      winner: gameState.winner ?? null,
    } : null,
    onlineSession: localGame.onlineSession ? {
      lobbyCode: localGame.onlineSession.lobbyCode,
      userId: localGame.onlineSession.userId,
      hostUserId: localGame.onlineSession.hostUserId,
      myPlayerIds: localGame.onlineSession.myPlayerIds,
      actionVersion: localGame.onlineSession.actionVersion,
      queueVersion: localGame.onlineSession.queueVersion,
      hostEpoch: localGame.onlineSession.hostEpoch,
    } : null,
    uiState: {
      selectedUnitId: uiState.selectedUnit?.id ?? null,
      isMovementMode: uiState.isMovementMode,
      isAttackMode: uiState.isAttackMode,
      isRoadBuildMode: uiState.isRoadBuildMode,
      constructionMode: uiState.constructionMode,
      spawnSelectionMode: {
        isActive: uiState.spawnSelectionMode.isActive,
        unitType: uiState.spawnSelectionMode.unitType,
      },
    },
    recentActions: errorDebug.recentActions.slice(-BUG_REPORT_DIAGNOSTIC_LIMITS.maxRecentActions),
    recentErrors: errorDebug.errors.slice(-BUG_REPORT_DIAGNOSTIC_LIMITS.maxRecentErrors),
    debugSummary: {
      session: debugSummary.session,
      errorCounts: debugSummary.errorCounts,
      severityCounts: debugSummary.severityCounts,
      performanceIssues: debugSummary.performanceIssues,
      recentLogs: debugSummary.recentLogs.slice(-BUG_REPORT_DIAGNOSTIC_LIMITS.maxRecentLogs),
    },
  }) as Record<string, unknown>;
}

export async function submitBugReport(input: BugReportDraftInput): Promise<BugReportSubmitResult> {
  const submissionId = createSubmissionId();
  const diagnostics = input.includeDiagnostics ? collectBugReportDiagnostics() : undefined;

  let screenshotUrl: string | undefined;
  if (input.includeScreenshot) {
    try {
      const blob = await captureScreenshotBlob();
      if (blob) {
        screenshotUrl = await uploadScreenshotBlob(submissionId, blob);
      } else if (diagnostics) {
        diagnostics.screenshotStatus = "capture_skipped";
      }
    } catch (error) {
      if (diagnostics) {
        diagnostics.screenshotStatus = error instanceof Error ? error.message : String(error);
      }
    }
  }

  const payload: SubmitBugReportRequest = {
    submissionId,
    source: input.source,
    category: input.category,
    playerMessage: input.playerMessage.trim(),
    expectedBehavior: input.expectedBehavior?.trim() || undefined,
    reproFrequency: input.reproFrequency,
    contact: input.contact?.trim() || undefined,
    includeDiagnostics: input.includeDiagnostics,
    includeScreenshot: input.includeScreenshot,
    screenshotUrl,
    diagnostics,
    clientTimestampMs: Date.now(),
  };

  try {
    const response = await postJson<SubmitBugReportResponse>("/api/bug-reports", payload);
    capture("bug_report_submitted", {
      source: payload.source,
      category: payload.category,
      repro_frequency: payload.reproFrequency,
      include_diagnostics: payload.includeDiagnostics,
      include_screenshot: Boolean(payload.screenshotUrl),
      message_length: payload.playerMessage.length,
      fingerprint: response.fingerprint,
    });
    return { queued: false, response, submissionId };
  } catch (error) {
    capture("bug_report_submit_failed", {
      source: payload.source,
      category: payload.category,
      retryable: isRetryableError(error),
      status: error instanceof ApiError ? error.status ?? null : null,
    });

    if (!isRetryableError(error)) {
      throw error;
    }

    queuePayload(payload);
    capture("bug_report_queued_offline", {
      source: payload.source,
      category: payload.category,
      include_diagnostics: payload.includeDiagnostics,
      include_screenshot: Boolean(payload.screenshotUrl),
    });
    return { queued: true, submissionId };
  }
}

export async function flushQueuedBugReports(): Promise<{ sentCount: number; remainingCount: number }> {
  if (flushPromise) return flushPromise;

  flushPromise = (async () => {
    const queue = readQueue();
    if (!queue.length) {
      return { sentCount: 0, remainingCount: 0 };
    }

    let sentCount = 0;
    const remaining: QueuedBugReport[] = [];

    for (let index = 0; index < queue.length; index += 1) {
      const payload = queue[index];
      try {
        await postJson<SubmitBugReportResponse>("/api/bug-reports", payload);
        sentCount += 1;
      } catch (error) {
        if (isRetryableError(error)) {
          remaining.push(payload, ...queue.slice(index + 1));
          break;
        }
      }
    }

    writeQueue(remaining);
    return { sentCount, remainingCount: remaining.length };
  })().finally(() => {
    flushPromise = null;
  });

  return flushPromise;
}
