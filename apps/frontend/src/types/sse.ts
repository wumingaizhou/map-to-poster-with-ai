export interface SSEEventCallback {
  (event: MessageEvent): void;
}
export interface SSEErrorCallback {
  (error: Event): void;
}
export interface ISSEManager {
  connect(): Promise<void>;
  disconnect(): void;
  addEventListener(type: string, callback: SSEEventCallback): void;
  removeEventListener(type: string, callback: SSEEventCallback): void;
  addErrorListener(callback: SSEErrorCallback): void;
  removeErrorListener(callback: SSEErrorCallback): void;
  readonly readyState: number;
  readonly isConnected: boolean;
}
