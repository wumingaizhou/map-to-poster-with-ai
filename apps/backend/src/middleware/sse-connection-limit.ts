import { Request, Response, NextFunction, RequestHandler } from "express";
import { config } from "../config/env";
import { createLogger } from "../utils/logger";
const log = createLogger("SseConnectionLimit");
let totalConnections = 0;
const ipConnections = new Map<string, number>();
const sessionConnections = new Map<string, number>();
function increment(map: Map<string, number>, key: string): number {
  const next = (map.get(key) ?? 0) + 1;
  map.set(key, next);
  return next;
}
function decrement(map: Map<string, number>, key: string): number {
  const current = map.get(key) ?? 0;
  const next = Math.max(0, current - 1);
  if (next === 0) map.delete(key);
  else map.set(key, next);
  return next;
}
function buildSessionKey(resourceId: string, threadId: string): string {
  return `${resourceId}:${threadId}`;
}
export function sseConnectionLimit(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const maxTotal = config.sse.maxConnectionsTotal;
    const maxPerIp = config.sse.maxConnectionsPerIp;
    const maxPerSession = config.sse.maxConnectionsPerSession;
    const ip = req.ip || "unknown";
    const rawThreadId = (req.params as { threadId?: unknown }).threadId;
    const threadId = typeof rawThreadId === "string" ? rawThreadId : "unknown";
    const sessionKey = req.auth?.resourceId ? buildSessionKey(req.auth.resourceId, threadId) : threadId;
    const currentTotal = totalConnections;
    const currentIp = ipConnections.get(ip) ?? 0;
    const currentSession = sessionConnections.get(sessionKey) ?? 0;
    if (currentTotal >= maxTotal || currentIp >= maxPerIp || currentSession >= maxPerSession) {
      log.warn(
        {
          ip,
          threadId,
          sessionKey,
          currentTotal,
          currentIp,
          currentSession,
          maxTotal,
          maxPerIp,
          maxPerSession
        },
        "SSE connection limit exceeded"
      );
      res.status(429).json({
        success: false,
        error: {
          message: "Too many SSE connections, please try again later",
          code: "SSE_CONNECTION_LIMIT_EXCEEDED"
        },
        timestamp: new Date().toISOString()
      });
      return;
    }
    totalConnections += 1;
    increment(ipConnections, ip);
    increment(sessionConnections, sessionKey);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      totalConnections = Math.max(0, totalConnections - 1);
      decrement(ipConnections, ip);
      decrement(sessionConnections, sessionKey);
    };
    res.on("close", release);
    next();
  };
}
