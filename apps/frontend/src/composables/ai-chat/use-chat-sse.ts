import { computed, ref } from "vue";
import { useAiChatStore } from "@/stores/ai-chat/ai-chat-store";
import type { ChatError } from "@/types/ai-chat/ui-types";
import type { SSEEvent, SSEEventCallback, SSEEventType } from "@/types/ai-chat/sse-types";
import { aiChatService } from "@/services/api-services";
import type { ISSEManager } from "@/types/sse";
import { handleError } from "@/shared/error-handler";
import { validateSSEEventData, isValidSSEEventType } from "@/api/api-resources/ai-chat/ai-chat-dto";
export function useChatSSE() {
  const aiChatStore = useAiChatStore();
  const error = ref<ChatError | null>(null);
  const eventSourceManager = computed(() => aiChatStore.getEventSourceManager);
  const sseEventHistory = computed(() => aiChatStore.getSSEEventHistory);
  const isSSEConnected = computed(() => aiChatStore.isSSEConnected);
  async function subscribeToSessionEvents(
    sessionId: string,
    onEvent: SSEEventCallback,
    onValidationWarning?: (warning: { error: string; rawData: unknown }) => void
  ): Promise<ISSEManager> {
    const existingSseManager = eventSourceManager.value.manager;
    const existingSessionId = eventSourceManager.value.sessionId;
    if (existingSseManager && existingSessionId === sessionId && existingSseManager.isConnected) {
      return existingSseManager;
    }
    if (existingSseManager) {
      disconnect();
    }
    const sseManager = await aiChatService.subscribeToSessionEvents(
      sessionId,
      (messageEvent: MessageEvent) => {
        handleSSEMessage(sessionId, messageEvent, onEvent, onValidationWarning);
      },
      (err: Error) => {
        handleError(err, { customMessage: "SSE 连接错误", showToast: false });
        error.value = { message: err.message, code: "SSE_CONNECTION_ERROR", recoverable: true };
      }
    );
    aiChatStore.updateEventSourceConnection(sseManager, sessionId, true);
    return sseManager;
  }
  function handleSSEMessage(
    sessionId: string,
    messageEvent: MessageEvent,
    onEvent: SSEEventCallback,
    onValidationWarning?: (warning: { error: string; rawData: unknown }) => void
  ): void {
    if (!messageEvent.data) return;
    if (messageEvent.data === "Connection opened") return;
    try {
      const rawData = JSON.parse(messageEvent.data);
      const validation = validateSSEEventData(rawData);
      if (!validation.success) {
        const warningMessage = `[useChatSSE] SSE event validation failed: ${validation.error}`;
        console.warn(warningMessage, rawData);
        onValidationWarning?.({ error: validation.error!, rawData });
      }
      const eventData = validation.data ?? rawData;
      const eventType: SSEEventType = eventData.type || "message";
      const sseEvent: SSEEvent = {
        type: eventType,
        sessionId,
        timestamp: eventData.timestamp || new Date().toISOString(),
        data: eventData,
        payload: eventData.payload || eventData
      };
      aiChatStore.addSSEEvent(sseEvent);
      onEvent(sseEvent);
    } catch (parseError) {
      const nativeEventType = messageEvent.type;
      const eventType: SSEEventType = isValidSSEEventType(nativeEventType)
        ? (nativeEventType as SSEEventType)
        : "message";
      console.warn(`[useChatSSE] SSE event data is not JSON, treating as "${eventType}" event:`, messageEvent.data);
      const sseEvent: SSEEvent = {
        type: eventType,
        sessionId,
        timestamp: new Date().toISOString(),
        data: { message: messageEvent.data },
        payload: { text: messageEvent.data }
      };
      aiChatStore.addSSEEvent(sseEvent);
      onEvent(sseEvent);
    }
  }
  function disconnect(): void {
    aiChatStore.disconnectEventSource();
  }
  function clearEventHistory(): void {
    aiChatStore.clearSSEEventHistory();
  }
  function getSessionEvents(sessionId: string): SSEEvent[] {
    return sseEventHistory.value.filter(event => event.sessionId === sessionId);
  }
  function clearError(): void {
    error.value = null;
  }
  return {
    eventSourceManager,
    sseEventHistory,
    isSSEConnected,
    error,
    subscribeToSessionEvents,
    disconnect,
    clearEventHistory,
    getSessionEvents,
    clearError
  };
}
