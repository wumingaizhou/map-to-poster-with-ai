export interface AiChatRequestDTO {
  userMessage: string;
  config?: {
    resourceId?: string;
    threadId?: string;
    sessionKey?: string;
  };
}
export interface ChatStreamResultDTO {
  stream: ReadableStream;
  resourceId: string;
  threadId: string;
}
export interface StreamSessionEventsInputDTO {
  sessionId: string;
  lastEventId?: string;
  callback: (event: unknown) => void;
}
export interface StreamSessionEventsSubscriptionDTO {
  missedEvents: Array<{ id: string; event: unknown }>;
  unsubscribe: () => void;
}
