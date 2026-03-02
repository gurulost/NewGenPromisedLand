import express, { type Request, Response, NextFunction, type Express } from "express";
import { registerRoutes } from "./routes";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));
app.get("/__health", (_req, res) => {
  res.status(200).json({ ok: true });
});

const logMessage = (message: string, source = "express") => {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
};

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      logMessage(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("[express] request error", {
      status,
      message,
      stack: err?.stack,
    });

    res.status(status).json({ message });
  });

  // Static file serving for production
  function serveStatic(app: Express) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const distPath = path.resolve(__dirname, "public");
    const sourcePublicPath = path.resolve(__dirname, "..", "client", "public");

    if (!fs.existsSync(distPath)) {
      throw new Error(
        `Could not find the build directory: ${distPath}, make sure to build the client first`,
      );
    }

    app.use(express.static(distPath));
    // Large static media assets are served directly from source public assets
    // when available so production runs from this repo remain fully functional.
    if (fs.existsSync(sourcePublicPath)) {
      app.use(express.static(sourcePublicPath));
    }
    app.use("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  // Only setup Vite in development to avoid pulling dev deps in production
  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve API + client on a configurable port (defaults to 5000).
  const requestedPort = Number(process.env.PORT);
  const port = Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : 5000;
  const shouldPreferReusePort = process.env.REUSE_PORT !== "false";
  const listenBaseOptions = { port, host: "0.0.0.0" } as const;

  const listenOnce = (allowReusePort: boolean) =>
    new Promise<void>((resolve, reject) => {
      const listenOptions: Parameters<typeof server.listen>[0] = allowReusePort
        ? { ...listenBaseOptions, reusePort: true }
        : listenBaseOptions;

      const cleanup = () => {
        server.off("error", onListenError);
        server.off("listening", onListening);
      };

      const onListenError = (err: NodeJS.ErrnoException) => {
        cleanup();
        reject(err);
      };

      const onListening = () => {
        cleanup();
        resolve();
      };

      server.once("error", onListenError);
      server.once("listening", onListening);
      server.listen(listenOptions);
    });

  try {
    await listenOnce(shouldPreferReusePort);
    logMessage(`serving on port ${port}${shouldPreferReusePort ? " (reusePort enabled)" : ""}`);
  } catch (err) {
    const listenError = err as NodeJS.ErrnoException;
    const shouldRetryWithoutReusePort =
      shouldPreferReusePort && (listenError.code === "ENOTSUP" || listenError.code === "EINVAL");

    if (shouldRetryWithoutReusePort) {
      logMessage("reusePort unsupported in this environment; retrying without it.");
      try {
        await listenOnce(false);
        logMessage(`serving on port ${port}`);
      } catch (fallbackError) {
        const finalError = fallbackError as NodeJS.ErrnoException;
        console.error("[express] failed to start server", {
          code: finalError.code,
          message: finalError.message,
        });
        process.exit(1);
      }
    } else {
      console.error("[express] failed to start server", {
        code: listenError.code,
        message: listenError.message,
      });
      process.exit(1);
    }
  }
})();
