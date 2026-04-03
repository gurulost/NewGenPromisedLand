import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildHealthSnapshot,
  createGracefulShutdownController,
  createRuntimeState,
  formatAccessLogLine,
  shouldLogRequest,
} from "../../server/ops";

afterEach(() => {
  vi.useRealTimers();
});

describe("server ops helpers", () => {
  it("reports degraded health when a critical dependency fails", async () => {
    const startedAt = Date.parse("2026-04-02T12:00:00.000Z");
    const runtimeState = createRuntimeState(startedAt);

    const snapshot = await buildHealthSnapshot({
      runtimeState,
      dependencyChecks: [
        {
          name: "database",
          critical: true,
          check: async () => {
            throw new Error("database unavailable");
          },
        },
      ],
      now: startedAt + 5_000,
    });

    expect(snapshot.ok).toBe(false);
    expect(snapshot.status).toBe("degraded");
    expect(snapshot.uptimeMs).toBe(5_000);
    expect(snapshot.dependencies.database).toMatchObject({
      critical: true,
      ok: false,
      error: "database unavailable",
    });
  });

  it("reports shutting_down health during graceful shutdown", async () => {
    const runtimeState = createRuntimeState();
    runtimeState.shuttingDown = true;
    runtimeState.shutdownSignal = "SIGTERM";

    const snapshot = await buildHealthSnapshot({
      runtimeState,
      dependencyChecks: [
        {
          name: "database",
          check: async () => ({ ok: true, latencyMs: 1 }),
        },
      ],
    });

    expect(snapshot.ok).toBe(false);
    expect(snapshot.status).toBe("shutting_down");
    expect(snapshot.shutdownSignal).toBe("SIGTERM");
    expect(snapshot.dependencies).toEqual({});
  });

  it("formats access logs without response payloads and suppresses healthy probe noise", () => {
    expect(shouldLogRequest("/__health", 200)).toBe(false);
    expect(shouldLogRequest("/__health", 503)).toBe(true);
    expect(shouldLogRequest("/api/lobbies", 200)).toBe(true);

    expect(
      formatAccessLogLine({
        method: "POST",
        pathname: "/api/bug-reports",
        statusCode: 201,
        durationMs: 12.34,
        requestId: "req-123",
        contentLength: 128,
      }),
    ).toBe("POST /api/bug-reports 201 in 12.3ms reqId=req-123 bytes=128");
  });

  it("closes the HTTP server and cleanup hooks on graceful shutdown", async () => {
    const close = vi.fn((callback: (error?: Error | null) => void) => callback());
    const closeIdleConnections = vi.fn();
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const fatalExit = vi.fn();
    const runtimeState = createRuntimeState();
    const controller = createGracefulShutdownController({
      server: {
        close,
        closeIdleConnections,
      } as any,
      runtimeState,
      cleanup,
      fatalExit: fatalExit as any,
      log: vi.fn(),
      logError: vi.fn(),
    });

    await controller.shutdown("SIGTERM");

    expect(runtimeState.shuttingDown).toBe(true);
    expect(runtimeState.shutdownSignal).toBe("SIGTERM");
    expect(close).toHaveBeenCalledOnce();
    expect(closeIdleConnections).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(fatalExit).not.toHaveBeenCalled();
  });

  it("forces termination when graceful shutdown times out", async () => {
    const close = vi.fn();
    const closeAllConnections = vi.fn();
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const fatalExit = vi.fn();
    const controller = createGracefulShutdownController({
      server: {
        close,
        closeAllConnections,
      } as any,
      runtimeState: createRuntimeState(),
      cleanup,
      timeoutMs: 10,
      fatalExit: fatalExit as any,
      log: vi.fn(),
      logError: vi.fn(),
    });

    await controller.shutdown("SIGTERM");

    expect(close).toHaveBeenCalledOnce();
    expect(closeAllConnections).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(fatalExit).toHaveBeenCalledWith(1);
  });
});
