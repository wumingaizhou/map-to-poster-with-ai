import type { ISSEManager } from "@/types/sse";
import type { SSEEventTypeFromSchema } from "@/api/api-resources/ai-chat/ai-chat-dto";
export type SSEEventType = SSEEventTypeFromSchema;
export interface SSEEvent {
  type: SSEEventType;
  sessionId?: string;
  timestamp: string;
  data?: any;
  payload?: any;
}
export type SSEEventCallback = (event: SSEEvent) => void;
export interface EventSourceManager {
  eventSource: EventSource | ISSEManager | null;
  sessionId: string | null;
  isConnected: boolean;
}
