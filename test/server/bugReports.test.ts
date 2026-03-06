import { describe, expect, it } from "vitest";

import {
  buildBugReportAiTriagePack,
  buildBugReportLinks,
  buildBugReportFingerprint,
  buildBugReportWebhookPayload,
  formatBugReportId,
  parseBugReportId,
  sanitizeBugReportDiagnostics,
  summarizeBugReportDiagnostics,
} from "../../server/bugReports";
import { isBugReportStorageUrlForSubmission } from "../../server/r2";

const baseReport = {
  id: 42,
  submissionId: "sub-1",
  userId: null,
  deviceId: "device-1",
  source: "desktop_corner",
  category: "ui",
  status: "open",
  playerMessage: "City panel stopped responding",
  expectedBehavior: "The city panel should open and remain interactive.",
  reproFrequency: "sometimes",
  contact: "tester@example.com",
  includeDiagnostics: true,
  includeScreenshot: true,
  screenshotUrl: "https://cdn.example.com/assets/bug-reports/sub-1.jpeg",
  fingerprint: "abc123",
  duplicateCount24h: 2,
  diagnostics: {
    gameSnapshot: {
      turn: 9,
      phase: "playing",
      currentPlayerName: "Lehi",
      currentPlayerFactionId: "NEPHITES",
      mapWidth: 12,
      mapHeight: 8,
      lastActionType: "END_TURN",
    },
    usageAnalytics: { sessionId: "usage-1" },
    recentErrors: [{ message: "Unhandled Promise Rejection" }],
    recentActions: [{ type: "OPEN_CITY" }],
  },
  createdAt: new Date("2026-03-05T13:00:00Z"),
} as const;

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

  it("formats generic webhook payloads with a readable summary and rich metadata", () => {
    const payload = buildBugReportWebhookPayload({
      reportId: formatBugReportId(42),
      report: baseReport,
    });

    expect(payload.text).toContain("BR-000042");
    expect(payload.text).toContain("duplicates(24h): 2");
    expect(payload.text).toContain("contact: tester@example.com");
    expect((payload.bugReport as Record<string, unknown>).category).toBe("ui");
    expect((payload.links as Record<string, unknown>).databaseLookup).toBe("bug_reports.id=42");
    expect((payload.bugReport as Record<string, unknown>).playerMessage).toBe("City panel stopped responding");
  });

  it("formats slack payloads with blocks, screenshot preview, and direct links", () => {
    const payload = buildBugReportWebhookPayload({
      reportId: formatBugReportId(42),
      report: baseReport,
      webhookUrl: "https://hooks.slack.com/services/T000/B000/secret",
      publicBaseUrl: "https://game.example.com",
      viewToken: "view-secret",
      dbUrlTemplate: "https://db.example.com/bug_reports?id={id}&submission={submissionId}",
    });

    const blocks = payload.blocks as Array<Record<string, unknown>>;
    expect(payload.text).toContain("details:");
    expect(blocks.some((block) => block.type === "image")).toBe(true);
    expect(JSON.stringify(blocks)).toContain("Full Report");
    expect(JSON.stringify(blocks)).toContain("DB/Admin Link");
    expect(JSON.stringify(blocks)).toContain("AI triage pack");
    expect(JSON.stringify(blocks)).toContain("AI BUG TRIAGE PACK");
    expect(JSON.stringify(blocks)).toContain("https://game.example.com/api/bug-reports/BR-000042?token=view-secret");
  });

  it("formats discord payloads with embeds", () => {
    const payload = buildBugReportWebhookPayload({
      reportId: formatBugReportId(42),
      report: baseReport,
      webhookUrl: "https://discord.com/api/webhooks/123/secret",
      dbUrlTemplate: "https://db.example.com/bug_reports?id={id}",
    });

    expect(payload.content).toBe("Bug report BR-000042");
    expect(Array.isArray(payload.embeds)).toBe(true);
    expect(JSON.stringify(payload.embeds)).toContain("DB/Admin Link");
    expect(JSON.stringify(payload.embeds)).toContain("https://db.example.com/bug_reports?id=42");
  });

  it("builds detail and db links when configured", () => {
    const links = buildBugReportLinks({
      report: baseReport,
      reportId: formatBugReportId(42),
      publicBaseUrl: "https://game.example.com/root/",
      viewToken: "view-secret",
      dbUrlTemplate: "https://db.example.com/bug_reports?id={id}&report={reportId}&fingerprint={fingerprint}",
    });

    expect(links.detailUrl).toBe("https://game.example.com/root/api/bug-reports/BR-000042?token=view-secret");
    expect(links.databaseUrl).toBe("https://db.example.com/bug_reports?id=42&report=BR-000042&fingerprint=abc123");
    expect(links.databaseLookup).toBe("bug_reports.id=42");
  });

  it("builds a paste-ready AI triage pack", () => {
    const pack = buildBugReportAiTriagePack({
      report: baseReport,
      reportId: formatBugReportId(42),
      links: {
        detailUrl: "https://game.example.com/api/bug-reports/BR-000042?token=view-secret",
        databaseUrl: "https://db.example.com/bug_reports?id=42",
        screenshotUrl: baseReport.screenshotUrl,
        databaseLookup: "bug_reports.id=42",
      },
    });

    expect(pack).toContain("AI BUG TRIAGE PACK");
    expect(pack).toContain("What happened:");
    expect(pack).toContain("City panel stopped responding");
    expect(pack).toContain("Expected behavior:");
    expect(pack).toContain("recent_action: OPEN_CITY");
    expect(pack).toContain("database_lookup: bug_reports.id=42");
    expect(pack).toContain("full_report_url: https://game.example.com/api/bug-reports/BR-000042?token=view-secret");
  });

  it("summarizes bug report diagnostics for notifications", () => {
    const summary = summarizeBugReportDiagnostics(baseReport.diagnostics);

    expect(summary.turn).toBe(9);
    expect(summary.phase).toBe("playing");
    expect(summary.currentPlayer).toBe("Lehi");
    expect(summary.lastAction).toBe("END_TURN");
    expect(summary.sessionId).toBe("usage-1");
  });

  it("parses bug report ids from either numeric ids or BR ids", () => {
    expect(parseBugReportId("BR-000042")).toBe(42);
    expect(parseBugReportId("42")).toBe(42);
    expect(parseBugReportId("invalid")).toBeNull();
  });

  it("only accepts screenshot URLs that match the bug-report storage prefix for the submission", () => {
    expect(
      isBugReportStorageUrlForSubmission(
        "https://cdn.example.com/assets/bug-reports/bug_cleanup_1.jpeg",
        "bug_cleanup_1",
        "https://cdn.example.com/assets",
      ),
    ).toBe(true);

    expect(
      isBugReportStorageUrlForSubmission(
        "https://example.com/other/path.jpeg",
        "bug_cleanup_1",
        "https://cdn.example.com/assets",
      ),
    ).toBe(false);

    expect(
      isBugReportStorageUrlForSubmission(
        "https://cdn.example.com/assets/bug-reports/someone_else.jpeg",
        "bug_cleanup_1",
        "https://cdn.example.com/assets",
      ),
    ).toBe(false);
  });
});
