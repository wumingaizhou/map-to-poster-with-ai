import { computed } from "vue";
import { useAiChatStore } from "@/stores/ai-chat/ai-chat-store";
import type { ChatSession } from "@/types/ai-chat/ui-types";
export function useChatSession() {
  const aiChatStore = useAiChatStore();
  const sessions = computed(() => aiChatStore.getSessions);
  const currentSessionId = computed(() => aiChatStore.getCurrentSessionId);
  const messages = computed(() => aiChatStore.getCurrentSessionMessages);
  function createSession(title: string = "新对话"): string {
    return aiChatStore.addSession(title);
  }
  function selectSession(sessionId: string): void {
    aiChatStore.selectSession(sessionId);
  }
  function deleteSession(sessionId: string): void {
    aiChatStore.deleteSession(sessionId);
  }
  function updateSessionTitle(sessionId: string, title: string): void {
    aiChatStore.updateSession(sessionId, title);
  }
  function getSessionMessages(sessionId: string) {
    return aiChatStore.getSessionMessages(sessionId);
  }
  function clearCurrentSessionMessages(): void {
    aiChatStore.clearSessionMessages(currentSessionId.value);
  }
  return {
    sessions,
    currentSessionId,
    messages,
    createSession,
    selectSession,
    deleteSession,
    updateSessionTitle,
    getSessionMessages,
    clearCurrentSessionMessages
  };
}
