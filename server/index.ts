import express, { type Request, Response, NextFunction, type Express } from "express";
import { registerRoutes } from "./routes";
<<<<<<< Updated upstream
import { setupVite, serveStatic, log } from "./vite";
import { logger, createRequestLogger } from "./utils/logger";
=======
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
>>>>>>> Stashed changes

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const reqLogger = createRequestLogger(req);
  
  (req as any).logger = reqLogger;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    
    if (req.path.startsWith("/api")) {
      reqLogger.info(`${req.method} ${req.path}`, {
        statusCode: res.statusCode,
        duration,
        method: req.method,
        path: req.path,
      });
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    const reqLogger = (req as any).logger || logger;
    reqLogger.error('Request error', err, {
      status,
      path: req.path,
      method: req.method,
    });

    res.status(status).json({ message });
  });

  // Simple logger for server messages
  function log(message: string, source = "express") {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    console.log(`${formattedTime} [${source}] ${message}`);
  }

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

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
