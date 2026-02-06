import { z } from "zod";
export interface AiChatRequestDTO {
  userMessage: string;
  config?: {
    resourceId?: string;
    threadId?: string;
  };
}
export interface ChatStreamEvent {
  type: string;
  [key: string]: unknown;
}
export interface ChatStreamConfig {
  onMessage?: (chunk: string) => void;
  onEvent?: (event: ChatStreamEvent) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}
export const sseEventTypeSchema = z.enum([
  "connected",
  "heartbeat",
  "start",
  "step-start",
  "text-delta",
  "tool-call",
  "tool-result",
  "step-finish",
  "finish",
  "routing-agent-start",
  "routing-agent-text-delta",
  "routing-agent-end",
  "agent-execution-start",
  "agent-execution-end",
  "workflow-execution-start",
  "workflow-execution-end",
  "network-execution-event-step-finish",
  "network-execution-event-finish",
  "error",
  "message"
]);
export type SSEEventTypeFromSchema = z.infer<typeof sseEventTypeSchema>;
export function isValidSSEEventType(type: string): type is SSEEventTypeFromSchema {
  return sseEventTypeSchema.safeParse(type).success;
}
export const sseEventDataSchema = z
  .object({
    type: sseEventTypeSchema.optional(),
    timestamp: z.string().optional(),
    payload: z.unknown().optional()
  })
  .passthrough();
export type SSEEventData = z.infer<typeof sseEventDataSchema>;
export function validateSSEEventData(data: unknown): {
  success: boolean;
  data?: SSEEventData;
  error?: string;
} {
  const result = sseEventDataSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")
  };
}
