import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { logger, createRequestLogger } from "./utils/logger";

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

  // Only setup Vite in development to avoid pulling dev deps in production
  if (app.get("env") === "development") {
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
