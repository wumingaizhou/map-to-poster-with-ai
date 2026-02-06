import express, { Application, Request, Response, NextFunction, Router } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import http from "http";
import type { Socket } from "net";
import { BaseRouter } from "./routes/base/base-router";
import { config } from "./config/env";
import { globalErrorHandler } from "./middleware/error-handler";
import { requestContextMiddleware } from "./middleware/request-context";
import { jwtAuth } from "./middleware/jwt-auth";
import { createLogger, requestLogger } from "./utils/logger";
import { ForbiddenError } from "./errors/app-error";
import { getEventLoopDelayMetrics, getMemoryMetrics } from "./utils/perf";
import { getReadinessWarnings } from "./utils/readiness-warnings";
const log = createLogger("App");
type RouterConfig = BaseRouter | { basePath: string; router: Router };
export class App {
  public readonly app: Application;
  private readonly apiPrefix: string;
  private server: http.Server | null = null;
  private readonly connections = new Set<Socket>();
  constructor(routers: RouterConfig[], apiPrefix: string = "/api") {
    this.app = express();
    this.apiPrefix = apiPrefix;
    this.initializeMiddleware();
    this.initializeRoutes(routers);
    this.initializeErrorHandling();
  }
  private initializeMiddleware(): void {
    this.app.set("trust proxy", config.trustProxy);
    this.app.set("etag", false);
    this.app.disable("x-powered-by");
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", ...config.cors.origins],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: config.isProduction ? [] : null
          }
        },
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
      })
    );
    this.app.use(
      cors({
        origin: (origin, callback) => {
          const allowedOrigins = config.cors.origins;
          if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new ForbiddenError(`Origin '${origin}' not allowed by CORS policy`));
          }
        },
        methods: config.cors.methods,
        allowedHeaders: config.cors.allowedHeaders,
        exposedHeaders: config.cors.exposedHeaders,
        credentials: false,
        maxAge: config.cors.maxAge
      })
    );
    this.app.use(
      compression({
        threshold: config.http.compressionThreshold,
        filter: (req, res) => {
          const accept = req.headers.accept;
          const contentTypeHeader = res.getHeader("Content-Type");
          const contentType = Array.isArray(contentTypeHeader)
            ? contentTypeHeader.join(",")
            : typeof contentTypeHeader === "string"
              ? contentTypeHeader
              : "";
          if (
            (typeof accept === "string" && accept.includes("text/event-stream")) ||
            contentType.includes("text/event-stream") ||
            (typeof req.path === "string" && req.path.includes("/ai-chat/events/") && req.path.endsWith("/stream"))
          ) {
            return false;
          }
          if (typeof req.path === "string" && req.path.endsWith("/ai-chat/stream")) {
            return false;
          }
          return compression.filter(req, res);
        }
      })
    );
    this.app.use(express.json({ limit: config.http.bodyLimit }));
    this.app.use(express.urlencoded({ extended: true, limit: config.http.bodyLimit }));
    this.app.use(requestContextMiddleware());
    this.app.use(this.apiPrefix, jwtAuth({ required: false, mode: "try" }));
    this.app.use(requestLogger());
  }
  private initializeRoutes(routers: RouterConfig[]): void {
    this.app.get("/health/live", (_req: Request, res: Response) => {
      res.status(200).json({
        success: true,
        data: {
          status: "alive",
          uptime: process.uptime()
        },
        timestamp: new Date().toISOString()
      });
    });
    this.app.get("/health/ready", async (_req: Request, res: Response) => {
      const eventLoopDelay = getEventLoopDelayMetrics();
      const memory = getMemoryMetrics();
      const warnings = await getReadinessWarnings();
      const checks = {
        eventLoopDelayP99Ms: eventLoopDelay.p99Ms,
        memoryRssMb: memory.rssMb
      };
      res.status(200).json({
        success: true,
        data: {
          status: "ready",
          warnings,
          checks: {
            eventLoopDelayP99Ms: checks.eventLoopDelayP99Ms,
            memoryRssMb: checks.memoryRssMb
          },
          perf: {
            eventLoopDelay,
            memory
          },
          uptime: process.uptime()
        },
        timestamp: new Date().toISOString()
      });
    });
    routers.forEach(routerConfig => {
      const isBaseRouter = routerConfig instanceof BaseRouter || "getBasePath" in routerConfig;
      const basePath = isBaseRouter
        ? (routerConfig as BaseRouter).getBasePath()
        : (routerConfig as { basePath: string; router: Router }).basePath;
      const router = isBaseRouter
        ? (routerConfig as BaseRouter).router
        : (routerConfig as { basePath: string; router: Router }).router;
      const fullPath = this.apiPrefix + basePath;
      this.app.use(fullPath, router);
      log.info({ path: fullPath }, "Router registered");
    });
  }
  private initializeErrorHandling(): void {
    this.app.use((_req: Request, res: Response, next: NextFunction) => {
      res.status(404).json({
        success: false,
        error: {
          message: "Route not found",
          code: "ROUTE_NOT_FOUND"
        },
        timestamp: new Date().toISOString()
      });
    });
    this.app.use(globalErrorHandler);
  }
  public listen(port: number): http.Server {
    this.server = this.app.listen(port, () => {
      const address = this.server?.address();
      const actualPort = typeof address === "object" && address && "port" in address ? address.port : port;
      log.info(
        {
          port: actualPort,
          live: `http://localhost:${actualPort}/health/live`,
          ready: `http://localhost:${actualPort}/health/ready`,
          apiBase: `http://localhost:${actualPort}${this.apiPrefix}`
        },
        "Server started"
      );
    });
    this.server.on("connection", socket => {
      this.connections.add(socket);
      socket.on("close", () => {
        this.connections.delete(socket);
      });
    });
    return this.server;
  }
  public async close(): Promise<void> {
    const server = this.server;
    if (!server) return;
    this.server = null;
    await new Promise<void>((resolve, reject) => {
      const forceCloseAfterMs = Math.min(5000, config.app.forceExitTimeout);
      const forceTimer = setTimeout(() => {
        for (const socket of this.connections) {
          socket.destroy();
        }
      }, forceCloseAfterMs);
      forceTimer.unref?.();
      for (const socket of this.connections) {
        socket.end();
      }
      server.close(err => {
        clearTimeout(forceTimer);
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
