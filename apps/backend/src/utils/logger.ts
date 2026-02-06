import pino, { Logger, LoggerOptions } from "pino";
import { config } from "../config/env";
import { getRequestId, getRequestResourceId, getRequestStartTime } from "../middleware/request-context";
type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";
function getLogLevel(): LogLevel {
  if (config.nodeEnv === "production") {
    return "info";
  }
  if (config.nodeEnv === "test") {
    return "warn";
  }
  return "debug";
}
function createBaseLogger(): Logger {
  const isDevelopment = config.nodeEnv !== "production";
  const options: LoggerOptions = {
    level: getLogLevel(),
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin() {
      const requestId = getRequestId();
      const resourceId = getRequestResourceId();
      return {
        ...(requestId ? { reqId: requestId } : {}),
        ...(resourceId ? { resourceId } : {})
      };
    }
  };
  if (isDevelopment) {
    options.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname"
      }
    };
  } else {
    options.base = { pid: process.pid };
  }
  return pino(options);
}
export const logger = createBaseLogger();
export function createLogger(moduleName: string): Logger {
  return logger.child({ module: moduleName });
}
export function requestLogger() {
  return (
    req: { method: string; url: string; headers: Record<string, unknown> },
    res: { statusCode: number; on: (event: string, callback: () => void) => void },
    next: () => void
  ) => {
    const startTime = getRequestStartTime() ?? Date.now();
    logger.info({
      msg: "Request started",
      method: req.method,
      url: req.url
    });
    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const level = res.statusCode >= 400 ? "warn" : "info";
      logger[level]({
        msg: "Request completed",
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
    });
    next();
  };
}
