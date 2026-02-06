import { Request, Response } from "express";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { BaseController } from "../base/base-controller";
import { ChatStreamUseCase } from "../../usecases/business/ai-chat/chat-stream-usecase";
import { StreamSessionEventsUseCase } from "../../usecases/business/ai-chat/stream-session-events-usecase";
import { AiChatRequestDTO } from "../../types/ai-chat/ai-chat-dto";
import { AppError } from "../../errors/app-error";
import { config } from "../../config/env";
import { getRequestContext, runWithRequestContext } from "../../middleware/request-context";
interface SSEEvent {
  type?: string;
  _eventId?: string;
  [key: string]: unknown;
}
function safeFlush(res: Response): void {
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }
  const maybeFlush = (res as unknown as { flush?: () => void }).flush;
  if (typeof maybeFlush === "function") {
    maybeFlush.call(res);
  }
}
function isNodeReadable(stream: unknown): stream is Readable {
  return (
    stream !== null && typeof stream === "object" && "pipe" in stream && typeof (stream as Readable).pipe === "function"
  );
}
function isClientDisconnectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: unknown; name?: unknown; message?: unknown };
  const code = typeof maybeError.code === "string" ? maybeError.code : "";
  if (
    code === "ERR_STREAM_PREMATURE_CLOSE" ||
    code === "ERR_STREAM_DESTROYED" ||
    code === "ECONNRESET" ||
    code === "EPIPE"
  ) {
    return true;
  }
  const name = typeof maybeError.name === "string" ? maybeError.name : "";
  if (name === "AbortError") return true;
  const message = typeof maybeError.message === "string" ? maybeError.message : "";
  return message.toLowerCase().includes("premature close");
}
export class AiChatController extends BaseController {
  constructor(
    private readonly chatStreamUseCase: ChatStreamUseCase,
    private readonly streamSessionEventsUseCase: StreamSessionEventsUseCase
  ) {
    super("AiChatController");
  }
  async chatStream(req: Request, res: Response): Promise<Response> {
    try {
      const requestData: AiChatRequestDTO = req.body;
      const authResourceId = req.auth?.resourceId;
      if (authResourceId) {
        requestData.config = { ...(requestData.config ?? {}), resourceId: authResourceId };
      } else {
        const existingThreadId = requestData.config?.threadId;
        const threadId =
          typeof existingThreadId === "string" && existingThreadId
            ? existingThreadId
            : `thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        requestData.config = { ...(requestData.config ?? {}), threadId, sessionKey: threadId };
      }
      this.log("Starting chat stream", { userMessageLength: requestData.userMessage.length });
      const result = await this.chatStreamUseCase.execute(requestData);
      res.setHeader("X-Session-ID", result.threadId);
      res.setHeader("X-Thread-ID", result.threadId);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      req.socket.setTimeout(0);
      res.setTimeout(0);
      safeFlush(res);
      const nodeStream = isNodeReadable(result.stream) ? result.stream : this.readableStreamToNodeStream(result.stream);
      res.on("close", () => {
        if (!res.writableEnded && !nodeStream.destroyed) {
          nodeStream.destroy();
        }
      });
      try {
        await pipeline(nodeStream, res);
      } catch (pipelineError) {
        if (isClientDisconnectError(pipelineError)) {
          this.log("Chat stream client disconnected", { threadId: result.threadId });
          return res;
        }
        throw pipelineError;
      }
      return res;
    } catch (error) {
      if (isClientDisconnectError(error)) {
        this.log("Chat stream client disconnected");
      } else {
        this.logError("Chat stream failed", error);
      }
      if (!res.headersSent) {
        return this.sendErrorResponse(res, error);
      }
      res.end();
      return res;
    }
  }
  private sendErrorResponse(res: Response, error: unknown): Response {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          ...(error.code && { code: error.code })
        },
        timestamp: new Date().toISOString()
      });
    }
    const message = config.isProduction
      ? "Internal server error"
      : error instanceof Error
        ? error.message
        : "Internal server error";
    return res.status(500).json({
      success: false,
      error: {
        message,
        code: "INTERNAL_ERROR"
      },
      timestamp: new Date().toISOString()
    });
  }
  private readableStreamToNodeStream(readable: ReadableStream): Readable {
    const readableFromWeb = (Readable as unknown as { fromWeb?: (stream: ReadableStream) => Readable }).fromWeb;
    if (typeof readableFromWeb === "function") {
      return readableFromWeb(readable);
    }
    const reader = readable.getReader();
    let cancelled = false;
    const stream = new Readable({
      async read(this: Readable) {
        try {
          const { done, value } = await reader.read();
          if (done) this.push(null);
          else this.push(value);
        } catch (err) {
          this.destroy(err instanceof Error ? err : new Error(String(err)));
        }
      },
      destroy(error, callback) {
        if (cancelled) {
          callback(error);
          return;
        }
        cancelled = true;
        void reader
          .cancel()
          .catch(() => undefined)
          .finally(() => callback(error));
      }
    });
    return stream;
  }
  async streamSessionEvents(req: Request, res: Response): Promise<Response> {
    let unsubscribe: (() => void) | undefined;
    let heartbeat: NodeJS.Timeout | null = null;
    let closed = false;
    const sseRequestContext = getRequestContext();
    const withSseRequestContext = <T>(fn: () => T): T => {
      if (!sseRequestContext) return fn();
      return runWithRequestContext(sseRequestContext, fn);
    };
    const cleanup = () => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (err) {
          this.logError("Failed to unsubscribe SSE listener", err);
        } finally {
          unsubscribe = undefined;
        }
      }
    };
    try {
      const rawThreadId = (req.params as { threadId?: string | string[] }).threadId;
      const threadId = Array.isArray(rawThreadId) ? rawThreadId[0] : rawThreadId;
      if (!threadId || typeof threadId !== "string") {
        return res.status(400).json({
          success: false,
          error: {
            message: "threadId is required",
            code: "VALIDATION_ERROR"
          },
          timestamp: new Date().toISOString()
        });
      }
      const authResourceId = req.auth?.resourceId;
      const sessionKey = authResourceId ? `${authResourceId}:${threadId}` : threadId;
      const queryLastEventId = (req.query as { lastEventId?: string }).lastEventId;
      const headerLastEventId =
        typeof req.headers["last-event-id"] === "string" ? req.headers["last-event-id"] : undefined;
      const lastEventId = queryLastEventId || headerLastEventId;
      this.log("Starting SSE stream", { threadId, sessionKey, lastEventId });
      const closeStream = (reason: string, error?: unknown) => {
        if (closed) return;
        closed = true;
        if (error) {
          this.logError(reason, error);
        } else {
          this.log(reason, { threadId, sessionKey });
        }
        cleanup();
        if (!res.writableEnded) res.end();
      };
      const handleClientClose = () => withSseRequestContext(() => closeStream("SSE client disconnected"));
      req.on("close", handleClientClose);
      res.on("close", handleClientClose);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      req.socket.setTimeout(0);
      res.setTimeout(0);
      const maxQueueSize = 1000;
      const writeQueue: string[] = [];
      let writing = false;
      const waitForDrainOrClose = () =>
        new Promise<void>(resolve => {
          const onDrain = () => {
            cleanupListeners();
            resolve();
          };
          const onClose = () => {
            cleanupListeners();
            resolve();
          };
          const cleanupListeners = () => {
            res.removeListener("drain", onDrain);
            res.removeListener("close", onClose);
          };
          res.once("drain", onDrain);
          res.once("close", onClose);
        });
      const flushQueue = async () => {
        if (writing) return;
        writing = true;
        try {
          while (!closed && writeQueue.length > 0) {
            const destroyed = (res as unknown as { destroyed?: boolean }).destroyed;
            if (res.writableEnded || destroyed) {
              closeStream("SSE response ended");
              break;
            }
            const chunk = writeQueue.shift();
            if (typeof chunk !== "string") continue;
            const ok = res.write(chunk);
            safeFlush(res);
            if (!ok) {
              await waitForDrainOrClose();
            }
          }
        } catch (writeError) {
          closeStream("Failed to write SSE chunk", writeError);
        } finally {
          writing = false;
        }
      };
      const enqueue = (chunk: string) => {
        if (closed) return;
        writeQueue.push(chunk);
        if (writeQueue.length > maxQueueSize) {
          this.logger.warn(
            { threadId, sessionKey, queueSize: writeQueue.length, maxQueueSize },
            "SSE write queue overflow"
          );
          closeStream("SSE write queue overflow");
          return;
        }
        void flushQueue();
      };
      const buildEventChunk = (event: unknown, overrides?: { id?: string }) => {
        const sseEvent = event as SSEEvent;
        const eventId =
          overrides?.id ||
          (typeof sseEvent._eventId === "string" ? sseEvent._eventId : undefined) ||
          `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const eventType = typeof sseEvent.type === "string" ? sseEvent.type : "message";
        return `id: ${eventId}\n` + `event: ${eventType}\n` + `data: ${JSON.stringify(event)}\n\n`;
      };
      const enqueueEvent = (event: unknown, overrides?: { id?: string }) => {
        try {
          enqueue(buildEventChunk(event, overrides));
        } catch (err) {
          this.logError("Failed to serialize SSE event", err);
        }
      };
      let replaying = true;
      const bufferedDuringReplay: string[] = [];
      const subscription = await this.streamSessionEventsUseCase.execute({
        sessionId: sessionKey,
        ...(lastEventId ? { lastEventId } : {}),
        callback: (event: unknown) =>
          withSseRequestContext(() => {
            try {
              const chunk = buildEventChunk(event);
              if (replaying) bufferedDuringReplay.push(chunk);
              else enqueue(chunk);
            } catch (err) {
              this.logError("Failed to serialize SSE event", err);
            }
          })
      });
      unsubscribe = subscription.unsubscribe;
      safeFlush(res);
      enqueue(": SSE connection established\n\n");
      enqueue(`retry: ${config.sse.retryTime}\n\n`);
      for (const { id, event } of subscription.missedEvents) {
        enqueueEvent(event, { id });
      }
      replaying = false;
      for (const chunk of bufferedDuringReplay) {
        enqueue(chunk);
      }
      bufferedDuringReplay.length = 0;
      if (closed) {
        cleanup();
        return res;
      }
      heartbeat = setInterval(() => {
        withSseRequestContext(() => {
          if (closed) return;
          enqueue(": heartbeat\n\n");
        });
      }, config.sse.heartbeatInterval);
      return res;
    } catch (error) {
      this.logError("SSE stream failed", error);
      cleanup();
      if (!res.headersSent) {
        return this.sendErrorResponse(res, error);
      }
      if (!res.writableEnded) res.end();
      return res;
    }
  }
}
