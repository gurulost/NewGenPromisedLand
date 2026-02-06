import express, { type Request, Response, NextFunction, type Express } from "express";
import { registerRoutes } from "./routes";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());
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

    if (!fs.existsSync(distPath)) {
      throw new Error(
        `Could not find the build directory: ${distPath}, make sure to build the client first`,
      );
    }

    app.use(express.static(distPath));
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
  const listenOptions: Parameters<typeof server.listen>[0] = {
    port,
    host: "0.0.0.0",
    ...(process.env.REUSE_PORT === "false" ? {} : { reusePort: true }),
  };

  server.listen(listenOptions, () => {
    logMessage(`serving on port ${port}`);
  });
})();
