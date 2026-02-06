import { AsyncLocalStorage } from "async_hooks";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { randomUUID } from "crypto";
export interface RequestContext {
  requestId: string;
  startTime: number;
  resourceId?: string;
}
const requestContextStorage = new AsyncLocalStorage<RequestContext>();
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}
export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}
export function getRequestStartTime(): number | undefined {
  return requestContextStorage.getStore()?.startTime;
}
export function getRequestResourceId(): string | undefined {
  return requestContextStorage.getStore()?.resourceId;
}
export function setRequestResourceId(resourceId: string): void {
  const ctx = requestContextStorage.getStore();
  if (!ctx) return;
  const next = typeof resourceId === "string" ? resourceId.trim() : "";
  if (!next) return;
  if (ctx.resourceId && ctx.resourceId !== next) return;
  ctx.resourceId = next;
}
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return requestContextStorage.run(context, fn);
}
export function requestContextMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers["x-request-id"] as string | undefined) || `req-${randomUUID()}`;
    const startTime = Date.now();
    const context: RequestContext = {
      requestId,
      startTime
    };
    res.setHeader("X-Request-ID", requestId);
    requestContextStorage.run(context, () => {
      next();
    });
  };
}
export { requestContextStorage };
