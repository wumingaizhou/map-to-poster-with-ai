import { ref } from "vue";
import { v4 as uuidv4 } from "uuid";
import { useAiChatStore } from "@/stores/ai-chat/ai-chat-store";
import type { Message, ChatError } from "@/types/ai-chat/ui-types";
import type { SSEEvent } from "@/types/ai-chat/sse-types";
import type { AiChatRequestDTO } from "@/api/api-resources/ai-chat/ai-chat-dto";
import { aiChatConfig } from "@/config";
import { aiChatService } from "@/services/api-services";
import { useChatSession } from "./use-chat-session";
import { useChatSSE } from "./use-chat-sse";
import { handleError } from "@/shared/error-handler";
export type UseChatOptions = {
  buildUserMessage?: (visibleText: string) => string;
  onSseEvent?: (event: SSEEvent) => void;
};
export function useChat(options: UseChatOptions = {}) {
  const aiChatStore = useAiChatStore();
  const chatSession = useChatSession();
  const chatSSE = useChatSSE();
  const loading = ref(false);
  const error = ref<ChatError | null>(null);
  let currentRequestController: AbortController | null = null;
  async function sendMessage(text: string): Promise<void> {
    if (!text.trim()) return;
    error.value = null;
    loading.value = true;
    const sessionId = chatSession.currentSessionId.value;
    if (currentRequestController) {
      currentRequestController.abort();
    }
    currentRequestController = new AbortController();
    const requestSignal = currentRequestController.signal;
    const userMsg: Message = {
      id: uuidv4(),
      role: "user",
      content: text,
      timestamp: Date.now()
    };
    const aiMsgId = uuidv4();
    const aiMsg: Message = {
      id: aiMsgId,
      role: "assistant",
      content: "",
      timestamp: Date.now()
    };
    aiChatStore.addMessage(sessionId, userMsg);
    aiChatStore.addMessage(sessionId, aiMsg);
    try {
      await ensureSSEConnection(sessionId, requestSignal);
      if (requestSignal.aborted) {
        return;
      }
      const userMessage = options.buildUserMessage ? options.buildUserMessage(text) : text;
      const request: AiChatRequestDTO = {
        userMessage,
        config: {
          threadId: sessionId
        }
      };
      let accumulatedContent = "";
      let isAbortedDueToError = false;
      await aiChatService.chatStream(request, {
        signal: requestSignal,
        onMessage: (chunk: string) => {
          if (requestSignal.aborted || isAbortedDueToError) return;
          try {
            accumulatedContent += chunk;
            aiChatStore.updateMessageContent(sessionId, aiMsgId, accumulatedContent);
          } catch (storeError) {
            isAbortedDueToError = true;
            console.error("[useChat] Failed to update message content, marking as partial:", storeError);
            try {
              aiChatStore.markMessagePartial(sessionId, aiMsgId, accumulatedContent);
            } catch (markError) {
              console.error("[useChat] Failed to mark message as partial:", markError);
            }
            error.value = {
              message: "消息内容更新失败，部分内容可能未显示",
              code: "STORE_UPDATE_ERROR",
              recoverable: false
            };
            currentRequestController?.abort();
          }
        },
        onError: (err: Error) => {
          if (requestSignal.aborted) return;
          error.value = { message: err.message, code: "STREAM_ERROR", recoverable: true };
          handleError(err, { customMessage: "AI 聊天流式响应错误" });
        },
        onComplete: () => {
          if (requestSignal.aborted) return;
          try {
            aiChatStore.markMessageComplete(sessionId, aiMsgId);
          } catch (completeError) {
            console.error("[useChat] Failed to mark message complete:", completeError);
            handleError(completeError, { customMessage: "消息完成标记失败" });
          }
        }
      });
    } catch (err) {
      if (requestSignal.aborted) return;
      const errorMessage = err instanceof Error ? err.message : "发送消息失败";
      error.value = { message: errorMessage, code: "SEND_ERROR", recoverable: true };
      handleError(err, { customMessage: "发送消息失败" });
    } finally {
      if (currentRequestController?.signal === requestSignal) {
        currentRequestController = null;
      }
      loading.value = false;
    }
  }
  function cancelCurrentRequest(): void {
    if (currentRequestController) {
      currentRequestController.abort();
      currentRequestController = null;
      loading.value = false;
    }
  }
  async function ensureSSEConnection(sessionId: string, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return;
    const { eventSourceManager, isSSEConnected } = chatSSE;
    if (
      !eventSourceManager.value.manager ||
      eventSourceManager.value.sessionId !== sessionId ||
      !isSSEConnected.value
    ) {
      try {
        if (signal?.aborted) return;
        await chatSSE.subscribeToSessionEvents(sessionId, (event: SSEEvent) => {
          options.onSseEvent?.(event);
        });
      } catch (sseError) {
        console.warn("⚠️ SSE 订阅失败，但仍尝试发送消息:", sseError);
      }
    }
  }
  function createNewChat(initialMessage?: string): string {
    let title = "新对话";
    if (initialMessage?.trim()) {
      const maxTitleLength = aiChatConfig.autoTitleMaxLength;
      title = initialMessage.trim().slice(0, maxTitleLength) + (initialMessage.length > maxTitleLength ? "..." : "");
    }
    const newSessionId = chatSession.createSession(title);
    if (initialMessage) {
      sendMessage(initialMessage);
    }
    return newSessionId;
  }
  function clearError(): void {
    error.value = null;
    chatSSE.clearError();
  }
  return {
    messages: chatSession.messages,
    loading,
    error,
    currentSessionId: chatSession.currentSessionId,
    session: {
      list: chatSession.sessions,
      current: chatSession.currentSessionId,
      create: createNewChat,
      select: chatSession.selectSession,
      delete: chatSession.deleteSession,
      updateTitle: chatSession.updateSessionTitle,
      clearMessages: chatSession.clearCurrentSessionMessages,
      getMessages: chatSession.getSessionMessages
    },
    message: {
      send: sendMessage,
      cancel: cancelCurrentRequest,
      clearError
    },
    sse: {
      manager: chatSSE.eventSourceManager,
      history: chatSSE.sseEventHistory,
      isConnected: chatSSE.isSSEConnected,
      subscribe: chatSSE.subscribeToSessionEvents,
      disconnect: chatSSE.disconnect,
      clearHistory: chatSSE.clearEventHistory,
      getSessionEvents: chatSSE.getSessionEvents
    }
  };
}
