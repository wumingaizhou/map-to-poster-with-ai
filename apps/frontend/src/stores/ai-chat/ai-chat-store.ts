import { defineStore } from "pinia";
import { ref, shallowRef, computed, triggerRef } from "vue";
import { v4 as uuidv4 } from "uuid";
import type { Message, ChatSession } from "@/types/ai-chat/ui-types";
import type { SSEEvent } from "@/types/ai-chat/sse-types";
import type { ISSEManager } from "@/types/sse";
import { uiConfig } from "@/config";
type ToolEventType = "tool-call" | "tool-result";
type ToolEventIndexItem = { timestampMs: number; event: SSEEvent & { type: ToolEventType } };
function toTimestampMs(timestamp: string): number {
  const ms = Date.parse(timestamp);
  return Number.isFinite(ms) ? ms : Date.now();
}
function lowerBoundByTimestamp(items: ToolEventIndexItem[], target: number): number {
  let left = 0;
  let right = items.length;
  while (left < right) {
    const mid = (left + right) >>> 1;
    if (items[mid]!.timestampMs < target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
}
interface EventSourceState {
  manager: ISSEManager | null;
  sessionId: string | null;
  isConnected: boolean;
}
const initialSessionId = uuidv4();
export const useAiChatStore = defineStore("aiChat", () => {
  const sessions = ref<ChatSession[]>([{ id: initialSessionId, title: "新对话" }]);
  const messages = shallowRef<Record<string, Message[]>>({});
  const currentSessionId = ref<string>(initialSessionId);
  const eventSourceState = ref<EventSourceState>({
    manager: null,
    sessionId: null,
    isConnected: false
  });
  const sseEventHistory = shallowRef<SSEEvent[]>([]);
  const toolEventsIndex = new Map<string, ToolEventIndexItem[]>();
  const pendingMessageUpdates = new Map<string, { content: string; rafId: number | null }>();
  const getSessions = computed(() => sessions.value);
  const getCurrentSessionId = computed(() => currentSessionId.value);
  const getCurrentSessionMessages = computed(() => {
    return messages.value[currentSessionId.value] ?? [];
  });
  const getSessionMessages = (sessionId: string): Message[] => {
    return messages.value[sessionId] ?? [];
  };
  const getEventSourceManager = computed(() => eventSourceState.value);
  const getSSEEventHistory = computed(() => sseEventHistory.value);
  const isSSEConnected = computed(() => eventSourceState.value.isConnected);
  function addSession(title: string): string {
    const newSession: ChatSession = {
      id: uuidv4(),
      title
    };
    sessions.value.push(newSession);
    currentSessionId.value = newSession.id;
    messages.value[newSession.id] = [];
    triggerRef(messages);
    return newSession.id;
  }
  function deleteSession(id: string): void {
    const index = sessions.value.findIndex(session => session.id === id);
    if (index === -1) return;
    sessions.value.splice(index, 1);
    delete messages.value[id];
    triggerRef(messages);
    if (currentSessionId.value === id && sessions.value.length > 0) {
      const firstSession = sessions.value[0];
      if (firstSession) {
        currentSessionId.value = firstSession.id;
      }
    }
    if (sessions.value.length === 0) {
      const newSessionId = uuidv4();
      sessions.value.push({ id: newSessionId, title: "新对话" });
      currentSessionId.value = newSessionId;
      messages.value[newSessionId] = [];
      triggerRef(messages);
    }
  }
  function selectSession(id: string): void {
    currentSessionId.value = id;
  }
  function updateSession(id: string, title: string): void {
    const session = sessions.value.find(s => s.id === id);
    if (session) {
      session.title = title;
    }
  }
  function addMessage(sessionId: string, message: Message): void {
    const sessionMessages = messages.value[sessionId] ?? [];
    messages.value[sessionId] = [...sessionMessages, message];
    triggerRef(messages);
  }
  function clearSessionMessages(sessionId: string): void {
    if (messages.value[sessionId]) {
      messages.value[sessionId] = [];
      triggerRef(messages);
    }
  }
  function commitMessageUpdate(sessionId: string, messageId: string, updater: (message: Message) => void): void {
    const sessionMessages = messages.value[sessionId];
    if (!sessionMessages) return;
    const messageIndex = sessionMessages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;
    const nextMessage = { ...sessionMessages[messageIndex] } as Message;
    updater(nextMessage);
    const nextMessages = sessionMessages.slice();
    nextMessages[messageIndex] = nextMessage;
    messages.value[sessionId] = nextMessages;
    triggerRef(messages);
  }
  function updateMessageContent(sessionId: string, messageId: string, content: string): void {
    const sessionMessages = messages.value[sessionId];
    if (!sessionMessages) return;
    const messageExists = sessionMessages.some(msg => msg.id === messageId);
    if (!messageExists) return;
    const key = `${sessionId}:${messageId}`;
    const pending = pendingMessageUpdates.get(key);
    if (pending) {
      pending.content = content;
    } else {
      const state = { content, rafId: null as number | null };
      state.rafId = requestAnimationFrame(() => {
        commitMessageUpdate(sessionId, messageId, target => {
          target.content = state.content;
        });
        pendingMessageUpdates.delete(key);
      });
      pendingMessageUpdates.set(key, state);
    }
  }
  function flushPendingMessageUpdates(sessionId: string, messageId: string): void {
    const key = `${sessionId}:${messageId}`;
    const pending = pendingMessageUpdates.get(key);
    if (pending) {
      if (pending.rafId !== null) {
        cancelAnimationFrame(pending.rafId);
      }
      commitMessageUpdate(sessionId, messageId, target => {
        target.content = pending.content;
      });
      pendingMessageUpdates.delete(key);
    }
  }
  function markMessageComplete(sessionId: string, messageId: string): void {
    flushPendingMessageUpdates(sessionId, messageId);
    commitMessageUpdate(sessionId, messageId, target => {
      target.isComplete = true;
    });
  }
  function markMessagePartial(sessionId: string, messageId: string, finalContent: string): void {
    flushPendingMessageUpdates(sessionId, messageId);
    commitMessageUpdate(sessionId, messageId, target => {
      target.content = finalContent;
      target.isComplete = true;
      target.isPartial = true;
    });
  }
  function updateEventSourceConnection(
    manager: ISSEManager | null,
    sessionId: string | null,
    isConnected: boolean
  ): void {
    eventSourceState.value = {
      manager,
      sessionId,
      isConnected
    };
  }
  function addSSEEvent(event: SSEEvent): void {
    const normalizedEvent: SSEEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString()
    };
    sseEventHistory.value.push(normalizedEvent);
    if (normalizedEvent.sessionId && (normalizedEvent.type === "tool-call" || normalizedEvent.type === "tool-result")) {
      const sessionId = normalizedEvent.sessionId;
      const sessionEvents = toolEventsIndex.get(sessionId) ?? [];
      const timestampMs = toTimestampMs(normalizedEvent.timestamp);
      const indexItem: ToolEventIndexItem = { timestampMs, event: normalizedEvent as ToolEventIndexItem["event"] };
      const last = sessionEvents[sessionEvents.length - 1];
      if (last && timestampMs < last.timestampMs) {
        sessionEvents.push(indexItem);
        sessionEvents.sort((a, b) => a.timestampMs - b.timestampMs);
      } else {
        sessionEvents.push(indexItem);
      }
      toolEventsIndex.set(sessionId, sessionEvents);
    }
    if (sseEventHistory.value.length > uiConfig.sseEventHistoryMax) {
      sseEventHistory.value = sseEventHistory.value.slice(-uiConfig.sseEventHistorySlice);
      toolEventsIndex.clear();
      for (const e of sseEventHistory.value) {
        if (!e.sessionId) continue;
        if (e.type !== "tool-call" && e.type !== "tool-result") continue;
        const sessionId = e.sessionId;
        const sessionEvents = toolEventsIndex.get(sessionId) ?? [];
        sessionEvents.push({
          timestampMs: toTimestampMs(e.timestamp),
          event: e as ToolEventIndexItem["event"]
        });
        toolEventsIndex.set(sessionId, sessionEvents);
      }
      for (const sessionEvents of toolEventsIndex.values()) {
        sessionEvents.sort((a, b) => a.timestampMs - b.timestampMs);
      }
    }
    triggerRef(sseEventHistory);
  }
  function clearSSEEventHistory(): void {
    sseEventHistory.value = [];
    toolEventsIndex.clear();
    triggerRef(sseEventHistory);
  }
  function disconnectEventSource(): void {
    const { manager } = eventSourceState.value;
    if (manager) {
      manager.disconnect();
    }
    eventSourceState.value = {
      manager: null,
      sessionId: null,
      isConnected: false
    };
  }
  function getToolEventsInRange(sessionId: string, startTime: number, endTime: number): SSEEvent[] {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    sseEventHistory.value.length;
    const events = toolEventsIndex.get(sessionId);
    if (!events || events.length === 0) return [];
    const start = lowerBoundByTimestamp(events, startTime);
    const end = lowerBoundByTimestamp(events, endTime);
    if (start >= end) return [];
    return events.slice(start, end).map(item => item.event);
  }
  function getMessageRelatedEvents(sessionId: string, messageId: string): SSEEvent[] {
    const sessionMessages = messages.value[sessionId];
    if (!sessionMessages) return [];
    const messageIndex = sessionMessages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return [];
    const message = sessionMessages[messageIndex];
    if (!message) return [];
    if (message.role !== "assistant") return [];
    const startTime = message.timestamp;
    const nextMessage = sessionMessages[messageIndex + 1];
    const endTime = nextMessage ? nextMessage.timestamp : Number.MAX_SAFE_INTEGER;
    return getToolEventsInRange(sessionId, startTime, endTime);
  }
  return {
    sessions,
    messages,
    currentSessionId,
    eventSourceState,
    sseEventHistory,
    getSessions,
    getCurrentSessionId,
    getCurrentSessionMessages,
    getSessionMessages,
    getEventSourceManager,
    getSSEEventHistory,
    isSSEConnected,
    addSession,
    deleteSession,
    selectSession,
    updateSession,
    addMessage,
    clearSessionMessages,
    updateMessageContent,
    markMessageComplete,
    markMessagePartial,
    flushPendingMessageUpdates,
    updateEventSourceConnection,
    addSSEEvent,
    clearSSEEventHistory,
    disconnectEventSource,
    getToolEventsInRange,
    getMessageRelatedEvents
  };
});
