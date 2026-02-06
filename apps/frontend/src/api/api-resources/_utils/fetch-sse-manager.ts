import { sseConfig } from "@/config";
import { ExponentialBackoffStrategy, type IReconnectStrategy } from "@/utils/reconnect-strategy";
import type { ISSEManager, SSEErrorCallback, SSEEventCallback } from "@/types/sse";
import { clearAuthToken, getAuthToken } from "@/services/auth/auth-session";
export interface FetchSSEManagerOptions {
  maxRetries?: number;
  retryDelayBase?: number;
  autoReconnect?: boolean;
  reconnectStrategy?: IReconnectStrategy;
}
type ParsedEvent = {
  id?: string;
  event?: string;
  data: string;
};
function toUrlString(rawUrl: string, lastEventId: string | null): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    url = new URL(rawUrl, window.location.origin);
  }
  if (lastEventId) {
    url.searchParams.set("lastEventId", lastEventId);
  }
  return url.toString();
}
function parseEventBlock(block: string): ParsedEvent | null {
  const lines = block.split("\n");
  let eventType: string | undefined;
  let id: string | undefined;
  const dataLines: string[] = [];
  for (const rawLine of lines) {
    if (!rawLine) continue;
    if (rawLine.startsWith(":")) continue;
    const colonIndex = rawLine.indexOf(":");
    const field = colonIndex === -1 ? rawLine : rawLine.slice(0, colonIndex);
    const rawValue = colonIndex === -1 ? "" : rawLine.slice(colonIndex + 1);
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
    if (field === "event") eventType = value;
    else if (field === "id") id = value;
    else if (field === "data") dataLines.push(value);
  }
  if (dataLines.length === 0) return null;
  return {
    ...(id ? { id } : {}),
    ...(eventType ? { event: eventType } : {}),
    data: dataLines.join("\n")
  };
}
export class FetchSSEManager implements ISSEManager {
  private lastEventId: string | null = null;
  private readonly listeners: Map<string, Set<SSEEventCallback>> = new Map();
  private readonly errorListeners: Set<SSEErrorCallback> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectPromise: Promise<void> | null = null;
  private readLoopPromise: Promise<void> | null = null;
  private abortController: AbortController | null = null;
  private readonly reconnectStrategy: IReconnectStrategy;
  private _readyState = 2;
  private _isConnected = false;
  private isDisconnecting = false;
  private hasRetriedAuth = false;
  private hasConnectedOnce = false;
  constructor(
    private readonly url: string,
    options: FetchSSEManagerOptions = {}
  ) {
    const maxRetries = options.maxRetries ?? sseConfig.maxRetries;
    const retryDelayBase = options.retryDelayBase ?? sseConfig.retryDelayBase;
    this.reconnectStrategy =
      options.reconnectStrategy ??
      new ExponentialBackoffStrategy({
        baseDelay: retryDelayBase,
        maxDelay: sseConfig.maxReconnectDelay,
        maxAttempts: maxRetries
      });
    this.autoReconnect = options.autoReconnect ?? sseConfig.autoReconnect;
  }
  private autoReconnect: boolean;
  get readyState(): number {
    return this._readyState;
  }
  get isConnected(): boolean {
    return this._isConnected;
  }
  addEventListener(type: string, callback: SSEEventCallback): void {
    const set = this.listeners.get(type) ?? new Set<SSEEventCallback>();
    set.add(callback);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, callback: SSEEventCallback): void {
    const set = this.listeners.get(type);
    if (!set) return;
    set.delete(callback);
    if (set.size === 0) this.listeners.delete(type);
  }
  addErrorListener(callback: SSEErrorCallback): void {
    this.errorListeners.add(callback);
  }
  removeErrorListener(callback: SSEErrorCallback): void {
    this.errorListeners.delete(callback);
  }
  async connect(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    this.isDisconnecting = false;
    this._readyState = 0;
    this.connectPromise = this.connectInternal()
      .finally(() => {
        this.connectPromise = null;
      })
      .catch(err => {
        throw err;
      });
    return this.connectPromise;
  }
  disconnect(): void {
    this.isDisconnecting = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.abortController?.abort();
    this.abortController = null;
    this._isConnected = false;
    this._readyState = 2;
  }
  private dispatch(type: string, event: MessageEvent): void {
    const callbacks = this.listeners.get(type);
    if (!callbacks || callbacks.size === 0) return;
    callbacks.forEach(cb => cb(event));
  }
  private dispatchError(event?: Event): void {
    const safeEvent = event ?? new Event("error");
    this.errorListeners.forEach(cb => cb(safeEvent));
  }
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (!this.autoReconnect) return;
    if (!this.reconnectStrategy.canRetry()) return;
    if (!this.hasConnectedOnce) return;
    const delay = this.reconnectStrategy.nextDelay();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().catch(() => {});
    }, delay);
  }
  private async connectInternal(): Promise<void> {
    this.abortController?.abort();
    this.abortController = new AbortController();
    this.readLoopPromise = null;
    try {
      const urlWithLastEventId = toUrlString(this.url, this.lastEventId);
      const token = await getAuthToken();
      const res = await fetch(urlWithLastEventId, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`
        },
        signal: this.abortController.signal
      });
      if (res.status === 401 && !this.hasRetriedAuth && !this.isDisconnecting) {
        this.hasRetriedAuth = true;
        clearAuthToken();
        return this.connectInternal();
      }
      const hadRetriedAuth = this.hasRetriedAuth;
      this.hasRetriedAuth = false;
      if (!res.ok) {
        const err = new Error(`[FetchSSEManager] Failed to connect (${res.status})`);
        (err as any).status = res.status;
        (err as any).statusText = res.statusText;
        (err as any).url = urlWithLastEventId;
        (err as any).hadRetriedAuth = hadRetriedAuth;
        throw err;
      }
      if (!res.body) {
        const err = new Error("[FetchSSEManager] Response body is null");
        (err as any).status = res.status;
        (err as any).statusText = res.statusText;
        (err as any).url = urlWithLastEventId;
        (err as any).hadRetriedAuth = hadRetriedAuth;
        throw err;
      }
      this._isConnected = true;
      this._readyState = 1;
      this.hasConnectedOnce = true;
      this.reconnectStrategy.reset();
      this.dispatch("open", new MessageEvent("open", { data: "Connection opened" }));
      const loop = this.readStream(res.body);
      this.readLoopPromise = loop;
      void loop.catch(() => {});
    } catch (err) {
      if (this.isDisconnecting) return;
      this._isConnected = false;
      this._readyState = 2;
      const willRetry = this.autoReconnect && this.reconnectStrategy.canRetry() && this.hasConnectedOnce;
      const detail: Record<string, unknown> = { willRetry };
      if (err && typeof err === "object") {
        const anyErr = err as any;
        if (typeof anyErr.status === "number") detail.status = anyErr.status;
        if (typeof anyErr.statusText === "string") detail.statusText = anyErr.statusText;
        if (typeof anyErr.url === "string") detail.url = anyErr.url;
        if (typeof anyErr.hadRetriedAuth === "boolean") detail.hadRetriedAuth = anyErr.hadRetriedAuth;
      }
      if (err instanceof Error) {
        detail.message = err.message;
      }
      const errorEvent = new CustomEvent("error", { detail });
      this.dispatchError(errorEvent);
      if (willRetry) this.scheduleReconnect();
      throw err;
    }
  }
  private async readStream(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let readError: unknown = null;
    try {
      while (!this.isDisconnecting) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let index: number;
        while ((index = buffer.indexOf("\n\n")) !== -1) {
          const rawBlock = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          const parsed = parseEventBlock(rawBlock);
          if (!parsed) continue;
          const eventType = parsed.event || "message";
          const id = parsed.id;
          if (id) this.lastEventId = id;
          const messageEvent = new MessageEvent(eventType, {
            data: parsed.data,
            lastEventId: id ?? ""
          });
          if (eventType === "message") {
            this.dispatch("message", messageEvent);
          } else {
            this.dispatch(eventType, messageEvent);
          }
        }
      }
    } catch (err) {
      readError = err;
    } finally {
      await reader.cancel();
    }
    this._isConnected = false;
    this._readyState = 2;
    if (!this.isDisconnecting) {
      const willRetry = this.autoReconnect && this.reconnectStrategy.canRetry() && this.hasConnectedOnce;
      const detail: Record<string, unknown> = { willRetry };
      if (readError instanceof Error) detail.message = readError.message;
      const errorEvent = new CustomEvent("error", { detail });
      this.dispatchError(errorEvent);
      if (willRetry) this.scheduleReconnect();
    }
    if (readError) {
      throw readError;
    }
  }
}
