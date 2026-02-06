import { sseConfig } from "@/config";
import { ExponentialBackoffStrategy, type IReconnectStrategy } from "@/utils/reconnect-strategy";
import type { ISSEManager, SSEEventCallback, SSEErrorCallback } from "@/types/sse";
export type { ISSEManager, SSEEventCallback, SSEErrorCallback } from "@/types/sse";
export interface SSEManagerOptions {
  maxRetries?: number;
  retryDelayBase?: number;
  autoReconnect?: boolean;
  reconnectStrategy?: IReconnectStrategy;
  onReconnect?: (lastEventId: string | null) => void | Promise<void>;
}
export class SSEManager implements ISSEManager {
  private eventSource: EventSource | null = null;
  private lastEventId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private options: Required<Omit<SSEManagerOptions, "onReconnect" | "reconnectStrategy">> &
    Pick<SSEManagerOptions, "onReconnect">;
  private listeners: Map<string, Set<SSEEventCallback>> = new Map();
  private errorListeners: Set<SSEErrorCallback> = new Set();
  private reconnectStrategy: IReconnectStrategy;
  private wrappedCallbacks: WeakMap<SSEEventCallback, SSEEventCallback> = new WeakMap();
  private isReconnecting = false;
  private connectPromise: Promise<void> | null = null;
  constructor(
    private url: string,
    options: SSEManagerOptions = {}
  ) {
    this.options = {
      maxRetries: options.maxRetries ?? sseConfig.maxRetries,
      retryDelayBase: options.retryDelayBase ?? sseConfig.retryDelayBase,
      autoReconnect: options.autoReconnect ?? sseConfig.autoReconnect,
      onReconnect: options.onReconnect
    };
    this.reconnectStrategy =
      options.reconnectStrategy ??
      new ExponentialBackoffStrategy({
        baseDelay: this.options.retryDelayBase,
        maxDelay: sseConfig.maxReconnectDelay,
        maxAttempts: this.options.maxRetries
      });
  }
  connect(): Promise<void> {
    if (this.isConnected) {
      return Promise.resolve();
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }
    this.connectPromise = this.doConnect().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }
  private doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      if (this.eventSource) {
        this.cleanupEventSource();
      }
      const connectUrl = this.buildUrl();
      try {
        this.eventSource = new EventSource(connectUrl);
        this.setupEventListeners(resolve, reject);
      } catch (e) {
        reject(e);
      }
    });
  }
  private cleanupEventSource(): void {
    if (!this.eventSource) return;
    this.listeners.forEach((callbacks, type) => {
      if (type !== "message" && type !== "open") {
        callbacks.forEach(callback => {
          const wrapped = this.wrappedCallbacks.get(callback);
          if (wrapped) {
            this.eventSource!.removeEventListener(type, wrapped);
          }
        });
      }
    });
    this.eventSource.close();
    this.eventSource = null;
  }
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.listeners.clear();
    this.errorListeners.clear();
    this.reconnectStrategy.reset();
    this.isReconnecting = false;
    this.connectPromise = null;
  }
  addEventListener(type: string, callback: SSEEventCallback): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
    if (this.eventSource && type !== "message" && type !== "open") {
      this.eventSource.addEventListener(type, this.getWrappedCallback(callback));
    }
  }
  removeEventListener(type: string, callback: SSEEventCallback): void {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.delete(callback);
      if (typeListeners.size === 0) {
        this.listeners.delete(type);
      }
    }
    if (this.eventSource && type !== "message" && type !== "open") {
      const wrapped = this.wrappedCallbacks.get(callback);
      if (wrapped) {
        this.eventSource.removeEventListener(type, wrapped);
      }
    }
    this.wrappedCallbacks.delete(callback);
  }
  addErrorListener(callback: SSEErrorCallback): void {
    this.errorListeners.add(callback);
  }
  removeErrorListener(callback: SSEErrorCallback): void {
    this.errorListeners.delete(callback);
  }
  get readyState(): number {
    return this.eventSource?.readyState ?? EventSource.CLOSED;
  }
  get isConnected(): boolean {
    return this.readyState === EventSource.OPEN;
  }
  getLastEventId(): string | null {
    return this.lastEventId;
  }
  private buildUrl(): string {
    let url: URL;
    try {
      url = new URL(this.url);
    } catch {
      url = new URL(this.url, window.location.origin);
    }
    if (this.lastEventId) {
      url.searchParams.append("lastEventId", this.lastEventId);
    }
    return url.toString();
  }
  private setupEventListeners(onConnected?: () => void, onConnectionFailed?: (error: Event) => void): void {
    if (!this.eventSource) return;
    let hasConnectedOnce = false;
    this.eventSource.onmessage = event => {
      if (event.lastEventId) {
        this.lastEventId = event.lastEventId;
      }
      const messageListeners = this.listeners.get("message");
      if (messageListeners) {
        messageListeners.forEach(callback => callback(event));
      }
    };
    this.eventSource.onerror = error => {
      this.errorListeners.forEach(callback => callback(error));
      this.eventSource?.close();
      this.eventSource = null;
      if (!hasConnectedOnce && onConnectionFailed) {
        onConnectionFailed(error);
        return;
      }
      if (this.options.autoReconnect && this.reconnectStrategy.canRetry()) {
        this.scheduleReconnect();
      }
    };
    this.eventSource.onopen = () => {
      hasConnectedOnce = true;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      const finalizeConnection = () => {
        this.isReconnecting = false;
        this.reconnectStrategy.reset();
        onConnected?.();
        const openListeners = this.listeners.get("open");
        if (openListeners) {
          openListeners.forEach(callback => {
            callback(new MessageEvent("open", { data: "Connection opened" }));
          });
        }
      };
      if (this.isReconnecting && this.options.onReconnect) {
        const maybePromise = this.options.onReconnect(this.lastEventId);
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise
            .then(() => {
              finalizeConnection();
            })
            .catch((e: unknown) => {
              console.error("[SSEManager] onReconnect callback error:", e);
              finalizeConnection();
            });
        } else {
          finalizeConnection();
        }
      } else {
        finalizeConnection();
      }
    };
    this.listeners.forEach((callbacks, type) => {
      if (type !== "message" && type !== "open") {
        callbacks.forEach(callback => {
          this.eventSource!.addEventListener(type, this.getWrappedCallback(callback));
        });
      }
    });
  }
  private getWrappedCallback(callback: SSEEventCallback): SSEEventCallback {
    const existing = this.wrappedCallbacks.get(callback);
    if (existing) return existing;
    const wrapped: SSEEventCallback = (event: MessageEvent) => {
      if (event.lastEventId) {
        this.lastEventId = event.lastEventId;
      }
      callback(event);
    };
    this.wrappedCallbacks.set(callback, wrapped);
    return wrapped;
  }
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = this.reconnectStrategy.nextDelay();
    const { attempts, maxAttempts } = this.reconnectStrategy;
    const attemptsInfo = maxAttempts === 0 ? `${attempts}/∞` : `${attempts}/${maxAttempts}`;
    console.log(`[SSEManager] Reconnect in ${Math.round(delay)}ms (attempt ${attemptsInfo})`);
    this.isReconnecting = true;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
