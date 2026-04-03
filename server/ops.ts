import { randomUUID } from "crypto";
import type { Express, Request } from "express";
import type { Server } from "http";

export const REQUEST_ID_HEADER = "x-request-id";

export type RuntimeState = {
  startedAt: number;
  shuttingDown: boolean;
  shutdownSignal?: NodeJS.Signals;
};

export type DependencyStatus = {
  critical: boolean;
  ok: boolean;
  latencyMs?: number;
  error?: string;
};

export type DependencyCheck = {
  name: string;
  critical?: boolean;
  check: () => Promise<Omit<DependencyStatus, "critical">>;
};

export type HealthSnapshot = {
  ok: boolean;
  status: "ok" | "degraded" | "shutting_down";
  checkedAt: string;
  uptimeMs: number;
  dependencies: Record<string, DependencyStatus>;
  shutdownSignal?: NodeJS.Signals;
};

export type Queryable = {
  query: (queryText: string) => Promise<unknown>;
};

type ClosableServer = Server & {
  closeIdleConnections?: () => void;
  closeAllConnections?: () => void;
};

type ShutdownOptions = {
  server: ClosableServer;
  runtimeState: RuntimeState;
  cleanup?: () => Promise<void>;
  timeoutMs?: number;
  log?: (message: string) => void;
  logError?: (message: string, error: unknown) => void;
  fatalExit?: (code: number) => void;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "Unknown error";
};

const normalizeHeaderValue = (value: string | string[] | number | undefined): string | null => {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return String(value);
};

const getIncomingRequestId = (req: Request): string | null => {
  const headerValue = req.header(REQUEST_ID_HEADER);
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  return trimmed ? trimmed : null;
};

export function createRuntimeState(startedAt = Date.now()): RuntimeState {
  return {
    startedAt,
    shuttingDown: false,
  };
}

export function createDatabaseHealthCheck(database: Queryable, name = "database"): DependencyCheck {
  return {
    name,
    critical: true,
    async check() {
      const startedAt = Date.now();
      await database.query("select 1");
      return {
        ok: true,
        latencyMs: Date.now() - startedAt,
      };
    },
  };
}

export async function buildHealthSnapshot({
  runtimeState,
  dependencyChecks,
  now = Date.now(),
}: {
  runtimeState: RuntimeState;
  dependencyChecks: DependencyCheck[];
  now?: number;
}): Promise<HealthSnapshot> {
  const checkedAt = new Date(now).toISOString();
  const uptimeMs = Math.max(0, now - runtimeState.startedAt);

  if (runtimeState.shuttingDown) {
    return {
      ok: false,
      status: "shutting_down",
      checkedAt,
      uptimeMs,
      dependencies: {},
      shutdownSignal: runtimeState.shutdownSignal,
    };
  }

  const dependencyEntries = await Promise.all(
    dependencyChecks.map(async ({ name, critical = true, check }) => {
      const startedAt = Date.now();
      try {
        const result = await check();
        return [name, { critical, ...result }] as const;
      } catch (error) {
        return [
          name,
          {
            critical,
            ok: false,
            latencyMs: Date.now() - startedAt,
            error: toErrorMessage(error),
          },
        ] as const;
      }
    }),
  );

  const dependencies = Object.fromEntries(dependencyEntries);
  const ok = dependencyEntries.every(([, dependency]) => dependency.ok || !dependency.critical);

  return {
    ok,
    status: ok ? "ok" : "degraded",
    checkedAt,
    uptimeMs,
    dependencies,
  };
}

export function shouldLogRequest(pathname: string, statusCode: number): boolean {
  if (pathname === "/__health") {
    return statusCode >= 400;
  }
  return pathname.startsWith("/api");
}

export function formatAccessLogLine({
  method,
  pathname,
  statusCode,
  durationMs,
  requestId,
  contentLength,
}: {
  method: string;
  pathname: string;
  statusCode: number;
  durationMs: number;
  requestId: string;
  contentLength?: string | string[] | number;
}): string {
  const parts = [
    `${method} ${pathname} ${statusCode} in ${durationMs.toFixed(1)}ms`,
    `reqId=${requestId}`,
  ];
  const normalizedContentLength = normalizeHeaderValue(contentLength);
  if (normalizedContentLength) {
    parts.push(`bytes=${normalizedContentLength}`);
  }
  return parts.join(" ");
}

export function attachRequestLogging(app: Express, log: (message: string) => void): void {
  app.use((req, res, next) => {
    const requestId = getIncomingRequestId(req) ?? randomUUID();
    res.locals.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
      if (!shouldLogRequest(req.path, res.statusCode)) {
        return;
      }
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      log(
        formatAccessLogLine({
          method: req.method,
          pathname: req.path,
          statusCode: res.statusCode,
          durationMs,
          requestId,
          contentLength: res.getHeader("content-length"),
        }),
      );
    });

    next();
  });
}

export function registerHealthEndpoint(
  app: Express,
  options: {
    runtimeState: RuntimeState;
    dependencyChecks: DependencyCheck[];
  },
): void {
  app.get("/__health", (_req, res) => {
    void buildHealthSnapshot(options)
      .then((snapshot) => {
        res.setHeader("Cache-Control", "no-store");
        res.status(snapshot.ok ? 200 : 503).json(snapshot);
      })
      .catch((error) => {
        const snapshot: HealthSnapshot = {
          ok: false,
          status: "degraded",
          checkedAt: new Date().toISOString(),
          uptimeMs: Math.max(0, Date.now() - options.runtimeState.startedAt),
          dependencies: {
            healthcheck: {
              critical: true,
              ok: false,
              error: toErrorMessage(error),
            },
          },
        };
        res.setHeader("Cache-Control", "no-store");
        res.status(503).json(snapshot);
      });
  });
}

function closeServerWithTimeout(server: ClosableServer, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.closeAllConnections?.();
      reject(new Error(`Timed out waiting ${timeoutMs}ms for HTTP server shutdown`));
    }, timeoutMs);
    if (typeof timeout === "object" && timeout && "unref" in timeout && typeof timeout.unref === "function") {
      timeout.unref();
    }

    const complete = (error?: Error | null) => {
      clearTimeout(timeout);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    try {
      server.close(complete);
      server.closeIdleConnections?.();
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

export function createGracefulShutdownController({
  server,
  runtimeState,
  cleanup,
  timeoutMs = 10_000,
  log = console.log,
  logError = (message, error) => console.error(message, error),
  fatalExit = process.exit,
}: ShutdownOptions) {
  let shutdownPromise: Promise<void> | null = null;
  let cleanupPromise: Promise<void> | null = null;

  const runCleanup = async () => {
    if (!cleanup) return;
    cleanupPromise ??= cleanup();
    await cleanupPromise;
  };

  return {
    async shutdown(signal: NodeJS.Signals): Promise<void> {
      if (shutdownPromise) {
        return shutdownPromise;
      }

      shutdownPromise = (async () => {
        runtimeState.shuttingDown = true;
        runtimeState.shutdownSignal = signal;
        log(`received ${signal}; starting graceful shutdown`);

        try {
          await closeServerWithTimeout(server, timeoutMs);
          await runCleanup();
          log(`graceful shutdown complete after ${signal}`);
        } catch (error) {
          logError(`graceful shutdown failed after ${signal}`, error);
          try {
            await runCleanup();
          } catch (cleanupError) {
            logError("graceful shutdown cleanup failed", cleanupError);
          }
          fatalExit(1);
        }
      })();

      return shutdownPromise;
    },
  };
}

export function registerGracefulShutdownHandlers(
  controller: ReturnType<typeof createGracefulShutdownController>,
  signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"],
): () => void {
  const listeners = signals.map((signal) => {
    const handler = () => {
      void controller.shutdown(signal);
    };
    process.once(signal, handler);
    return { signal, handler };
  });

  return () => {
    for (const { signal, handler } of listeners) {
      process.off(signal, handler);
    }
  };
}
