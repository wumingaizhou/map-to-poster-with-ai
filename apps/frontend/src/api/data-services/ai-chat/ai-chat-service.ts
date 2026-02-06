import { DataService, type ErrorContext } from "../base/data-service-base";
import type { BusinessError } from "../base/business-error-base";
import type { AiChatResource } from "../../api-resources/ai-chat/ai-chat-resource";
import type { AiChatRequestDTO, ChatStreamConfig } from "../../api-resources/ai-chat/ai-chat-dto";
import { AiChatServiceError } from "./errors";
import { FetchSSEManager } from "../../api-resources/_utils/fetch-sse-manager";
import type { ISSEManager } from "../../api-resources/_utils/sse-manager";
import { sseConfig } from "@/config";
import { ApiHttpError } from "@/api/api-client/errors";
import { clearAuthToken } from "@/services/auth/auth-session";
export class AiChatService extends DataService {
  private readonly aiChatResource: AiChatResource;
  constructor(aiChatResource: AiChatResource) {
    super({ logToConsole: false });
    this.aiChatResource = aiChatResource;
  }
  async chatStream(request: AiChatRequestDTO, config: ChatStreamConfig = {}): Promise<void> {
    let stream: ReadableStream<Uint8Array>;
    try {
      stream = await this.aiChatResource.chatStream(request, { signal: config.signal });
    } catch (connectionError) {
      if (connectionError instanceof ApiHttpError && connectionError.status === 401 && !config.signal?.aborted) {
        clearAuthToken();
        try {
          stream = await this.aiChatResource.chatStream(request, { signal: config.signal });
        } catch (retryError) {
          return this.handleChatError(retryError, config.onError);
        }
      } else {
        return this.handleChatError(connectionError, config.onError);
      }
    }
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          const finalChunk = decoder.decode();
          if (finalChunk) {
            config.onMessage?.(finalChunk);
          }
          config.onComplete?.();
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          config.onMessage?.(chunk);
          config.onEvent?.({
            type: "text-delta",
            data: chunk
          });
        }
      }
    } catch (streamError) {
      return this.handleChatError(streamError, config.onError);
    } finally {
      reader.releaseLock();
    }
  }
  private handleChatError(error: unknown, onError?: (error: Error) => void): void {
    const businessError = this.toBusinessError(error, { operation: "chatStream" });
    if (onError) {
      onError(businessError);
    } else {
      throw businessError;
    }
  }
  async subscribeToSessionEvents(
    sessionId: string,
    onEvent: (event: MessageEvent) => void,
    onError?: (error: Error) => void
  ): Promise<ISSEManager> {
    try {
      const baseUrl = this.aiChatResource.getBaseUrl();
      const path = `/ai-chat/events/${encodeURIComponent(sessionId)}/stream`;
      const cleanBaseUrl = baseUrl.replace(/\/$/, "");
      const url = cleanBaseUrl + path;
      const sseManager = new FetchSSEManager(url, {
        maxRetries: sseConfig.maxRetries,
        retryDelayBase: sseConfig.retryDelayBase,
        autoReconnect: sseConfig.autoReconnect
      });
      sseManager.addEventListener("start", onEvent);
      sseManager.addEventListener("step-start", onEvent);
      sseManager.addEventListener("step-finish", onEvent);
      sseManager.addEventListener("tool-call", onEvent);
      sseManager.addEventListener("tool-result", onEvent);
      sseManager.addEventListener("finish", onEvent);
      sseManager.addErrorListener(error => {
        const businessError = this.toBusinessError(error, {
          operation: "subscribeToSessionEvents",
          metadata: { sessionId }
        });
        onError?.(businessError);
      });
      await sseManager.connect();
      return sseManager;
    } catch (error) {
      throw this.toBusinessError(error, {
        operation: "subscribeToSessionEvents",
        metadata: { sessionId }
      });
    }
  }
  protected override mapToDomainError(error: unknown, context?: ErrorContext): BusinessError | null {
    const sessionId = context?.metadata?.sessionId as string | undefined;
    const sessionInfo = sessionId ? ` for session ${sessionId}` : "";
    if (error instanceof Error) {
      return new AiChatServiceError(`AI chat failed${sessionInfo}: ${error.message}`, error);
    }
    if (error instanceof CustomEvent) {
      const detail = error.detail;
      const parts: string[] = [];
      if (detail && typeof detail === "object") {
        const anyDetail = detail as any;
        if (typeof anyDetail.status === "number") parts.push(`status=${anyDetail.status}`);
        if (typeof anyDetail.statusText === "string" && anyDetail.statusText)
          parts.push(`statusText=${anyDetail.statusText}`);
        if (typeof anyDetail.willRetry === "boolean") parts.push(`willRetry=${anyDetail.willRetry}`);
        if (typeof anyDetail.hadRetriedAuth === "boolean") parts.push(`hadRetriedAuth=${anyDetail.hadRetriedAuth}`);
      }
      const extra = parts.length > 0 ? ` (${parts.join(", ")})` : "";
      return new AiChatServiceError(`AI chat failed${sessionInfo}: SSE error event (${error.type})${extra}`, error);
    }
    if (error instanceof Event) {
      return new AiChatServiceError(`AI chat failed${sessionInfo}: SSE error event (${error.type})`, error);
    }
    return null;
  }
}
