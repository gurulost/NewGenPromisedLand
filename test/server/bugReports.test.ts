import { describe, expect, it } from "vitest";

import {
  buildBugReportFingerprint,
  buildBugReportWebhookPayload,
  formatBugReportId,
  sanitizeBugReportDiagnostics,
} from "../../server/bugReports";

describe("bugReports helpers", () => {
  it("builds a stable fingerprint from normalized content", () => {
    const diagnostics = {
      gameSnapshot: { phase: "playing" },
      recentErrors: [{ message: "Unhandled Promise Rejection" }],
      recentActions: [{ type: "END_TURN" }],
    };

    const first = buildBugReportFingerprint({
      category: "crash",
      playerMessage: "  The game froze after end turn  ",
      expectedBehavior: "The AI turn should finish",
    }, diagnostics);

    const second = buildBugReportFingerprint({
      category: "crash",
      playerMessage: "the game froze after   end turn",
      expectedBehavior: "the AI turn should finish",
    }, diagnostics);

    expect(first).toBe(second);
    expect(first).toHaveLength(16);
  });

  it("sanitizes deep diagnostics payloads", () => {
    const sanitized = sanitizeBugReportDiagnostics({
      deep: { a: { b: { c: { d: { e: "trim me" } } } } },
      list: Array.from({ length: 50 }, (_, index) => ({ index })),
      text: "x".repeat(400),
    });

    expect((sanitized?.list as unknown[]).length).toBe(25);
    expect((sanitized?.text as string).length).toBe(300);
  });

  it("formats webhook payloads with a readable summary", () => {
    const payload = buildBugReportWebhookPayload({
      reportId: formatBugReportId(42),
      report: {
        id: 42,
        submissionId: "sub-1",
        userId: null,
        deviceId: "device-1",
        source: "desktop_corner",
        category: "ui",
        status: "open",
        playerMessage: "City panel stopped responding",
        expectedBehavior: null,
        reproFrequency: "sometimes",
        contact: null,
        includeDiagnostics: true,
        includeScreenshot: false,
        screenshotUrl: null,
        fingerprint: "abc123",
        duplicateCount24h: 2,
        diagnostics: { gameSnapshot: { turn: 9, phase: "playing" } },
        createdAt: new Date("2026-03-05T13:00:00Z"),
      },
    });

    expect(payload.text).toContain("BR-000042");
    expect(payload.text).toContain("duplicates(24h): 2");
    expect((payload.bugReport as Record<string, unknown>).category).toBe("ui");
  });
});
