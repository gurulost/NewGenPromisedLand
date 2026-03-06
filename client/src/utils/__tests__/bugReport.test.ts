import { beforeEach, describe, expect, it, vi } from "vitest";

const localGameState = {
  gameState: {
    id: "game-1",
    turn: 7,
    phase: "playing",
    currentPlayerIndex: 0,
    players: [{ id: "player-1", name: "Tester", factionId: "NEPHITES" }],
    units: new Array(3).fill(null),
    cities: new Array(2).fill(null),
    map: { width: 12, height: 8 },
    lastAction: { type: "END_TURN" },
    winner: undefined,
  },
  onlineSession: null,
};

const gameUiState = {
  selectedUnit: { id: "unit-1" },
  isMovementMode: true,
  isAttackMode: false,
  isRoadBuildMode: false,
  constructionMode: { isActive: false },
  spawnSelectionMode: { isActive: false, unitType: null },
};

const authState = {
  user: { id: 9, username: "dave" },
};

const debugSummary = {
  session: { sessionId: "session-1" },
  errorCounts: { game_logic: 1 },
  severityCounts: { error: 1 },
  performanceIssues: 0,
  recentLogs: Array.from({ length: 40 }, (_, index) => ({ id: index, type: "ui" })),
};

const debugReport = {
  errors: Array.from({ length: 18 }, (_, index) => ({ id: index, message: `error-${index}` })),
  recentActions: Array.from({ length: 30 }, (_, index) => ({ id: index, type: `action-${index}` })),
  summary: { totalErrors: 18 },
};

vi.mock("@/lib/deviceId", () => ({
  getDeviceId: () => "device-1",
}));

vi.mock("@/lib/stores/useLocalGame", () => ({
  useLocalGame: {
    getState: () => localGameState,
  },
}));

vi.mock("@/lib/stores/useGameState", () => ({
  useGameState: {
    getState: () => gameUiState,
  },
}));

vi.mock("@/lib/stores/useAuth", () => ({
  useAuth: {
    getState: () => authState,
  },
}));

vi.mock("@/utils/gameDebug", () => ({
  gameDebugger: {
    getDebugSummary: () => debugSummary,
  },
}));

vi.mock("@/utils/errorReporting", () => ({
  gameErrorReporter: {
    getDebugReport: () => debugReport,
  },
}));

const captureMock = vi.fn();
vi.mock("@/utils/telemetry/posthog", () => ({
  capture: (...args: unknown[]) => captureMock(...args),
}));

vi.mock("@/utils/telemetry/usageAnalytics", () => ({
  getUsageAnalyticsContext: () => ({
    sessionId: "usage-1",
    visitNumber: 4,
    build: { app_version: "1.0.0" },
  }),
}));

import {
  collectBugReportDiagnostics,
  flushQueuedBugReports,
  submitBugReport,
} from "@/utils/bugReport";

describe("bugReport utilities", () => {
  beforeEach(() => {
    localStorage.clear();
    captureMock.mockReset();
    vi.restoreAllMocks();
  });

  it("caps diagnostic history sizes", () => {
    const diagnostics = collectBugReportDiagnostics();

    expect((diagnostics.recentActions as unknown[]).length).toBe(20);
    expect((diagnostics.recentErrors as unknown[]).length).toBe(10);
    expect(((diagnostics.debugSummary as Record<string, unknown>).recentLogs as unknown[]).length).toBe(25);
    expect((diagnostics.gameSnapshot as Record<string, unknown>).turn).toBe(7);
  });

  it("queues a retryable submission failure for later flush", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: "temporary outage" }),
    })));

    const result = await submitBugReport({
      source: "desktop_corner",
      category: "gameplay",
      playerMessage: "The board locked after ending my turn and I could not keep playing.",
      reproFrequency: "sometimes",
      includeDiagnostics: true,
      includeScreenshot: false,
    });

    expect(result.queued).toBe(true);
    const queued = JSON.parse(localStorage.getItem("ngpl_bug_report_queue_v1") || "[]");
    expect(queued).toHaveLength(1);
    expect(queued[0].submissionId).toBe(result.submissionId);
  });

  it("flushes queued reports after connectivity recovers", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: "temporary outage" }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        reportId: "BR-000001",
        duplicateCount24h: 1,
        fingerprint: "abc123",
        receivedAt: new Date().toISOString(),
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await submitBugReport({
      source: "desktop_corner",
      category: "ui",
      playerMessage: "The UI panel stayed stuck on screen after I closed the city view.",
      reproFrequency: "once",
      includeDiagnostics: false,
      includeScreenshot: false,
    });

    const flushResult = await flushQueuedBugReports();

    expect(flushResult.sentCount).toBe(1);
    expect(localStorage.getItem("ngpl_bug_report_queue_v1")).toBeNull();
  });

  it("cleans up an uploaded screenshot when a queued report is rejected permanently", async () => {
    localStorage.setItem("ngpl_bug_report_queue_v1", JSON.stringify([{
      submissionId: "bug_cleanup_1",
      source: "desktop_corner",
      category: "ui",
      playerMessage: "The city panel never responded after I opened it.",
      reproFrequency: "once",
      includeDiagnostics: false,
      includeScreenshot: true,
      screenshotUrl: "https://cdn.example.com/assets/bug-reports/bug_cleanup_1.jpeg",
      clientTimestampMs: Date.now(),
    }]));

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid screenshot url" }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const flushResult = await flushQueuedBugReports();

    expect(flushResult.sentCount).toBe(0);
    expect(flushResult.remainingCount).toBe(0);
    expect(localStorage.getItem("ngpl_bug_report_queue_v1")).toBeNull();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/bug-reports/screenshot-cleanup",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});
