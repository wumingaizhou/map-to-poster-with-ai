import { computed, type ComputedRef, type Ref } from "vue";
import type { SSEEvent } from "@/types/ai-chat/sse-types";
import type {
  EventItemStatus,
  EventItemType,
  PosterPreviewViewModel,
  ToolEventItemViewModel
} from "@/types/ai-chat/view-models";
import type { Message } from "@/types/ai-chat/ui-types";
import { useAiChatStore } from "@/stores/ai-chat/ai-chat-store";
const TOOL_CALL_TYPE = "tool-call";
const TOOL_RESULT_TYPE = "tool-result";
const POSTER_ITERATE_TOOL_NAME = "posterIterateStyle";
function isWorkflowTool(toolName: string | undefined): boolean {
  if (!toolName) return false;
  return toolName.startsWith("workflow-");
}
function resolveResultStatus(eventResult?: SSEEvent): EventItemStatus {
  if (!eventResult) return "pending";
  const payload = eventResult.payload;
  if (payload?.error) {
    return "error";
  }
  const result = payload?.result;
  if (result) {
    if (result.success === false || result.error) {
      return "error";
    }
    if (result.status === "failed" || result.status === "tripwire") {
      return "error";
    }
    if (result.status === "suspended") {
      return "pending";
    }
  }
  if (payload?.success === false) {
    return "error";
  }
  return "success";
}
function resolveEventType(toolName: string | undefined): EventItemType {
  return isWorkflowTool(toolName) ? "workflow" : "tool";
}
function buildEventItem(callEvent: SSEEvent, index: number, resultEvent?: SSEEvent): ToolEventItemViewModel {
  const toolName = callEvent.payload?.toolName;
  const toolCallId = callEvent.payload?.toolCallId;
  return {
    id: toolCallId ?? `${callEvent.timestamp}-${index}`,
    type: resolveEventType(toolName),
    name: toolName || "unknown",
    status: resolveResultStatus(resultEvent),
    args: callEvent.payload?.args ?? null
  };
}
export function useChatEventViewModel() {
  const buildEventItems = (events: SSEEvent[]): ToolEventItemViewModel[] => {
    const toolResultsById = new Map<string, SSEEvent>();
    for (const event of events) {
      if (event.type === TOOL_RESULT_TYPE) {
        const toolCallId = event.payload?.toolCallId;
        if (toolCallId) {
          toolResultsById.set(toolCallId, event);
        }
      }
    }
    return events
      .filter(event => event.type === TOOL_CALL_TYPE)
      .map((event, index) => {
        const toolCallId = event.payload?.toolCallId;
        const resultEvent = toolCallId ? toolResultsById.get(toolCallId) : undefined;
        return buildEventItem(event, index, resultEvent);
      });
  };
  return {
    buildEventItems
  };
}
function extractPosterPreviewFromToolResult(event: SSEEvent): PosterPreviewViewModel | null {
  if (event.type !== TOOL_RESULT_TYPE) return null;
  const payload = event.payload;
  if (!payload || typeof payload !== "object") return null;
  const toolName = (payload as { toolName?: unknown }).toolName;
  if (toolName !== POSTER_ITERATE_TOOL_NAME) return null;
  if ((payload as { error?: unknown }).error) return null;
  const result = (payload as { result?: unknown }).result;
  if (!result || typeof result !== "object") return null;
  if ((result as { success?: unknown }).success === false) return null;
  if ((result as { error?: unknown }).error) return null;
  if ((result as { status?: unknown }).status === "failed") return null;
  const newVersion = (result as { newVersion?: unknown }).newVersion;
  if (!newVersion || typeof newVersion !== "object") return null;
  const versionId = (newVersion as { versionId?: unknown }).versionId;
  if (typeof versionId !== "string" || !versionId) return null;
  const preview: PosterPreviewViewModel = { versionId };
  const versionNo = (newVersion as { versionNo?: unknown }).versionNo;
  if (typeof versionNo === "number") {
    preview.versionNo = versionNo;
  }
  const createdAt = (newVersion as { createdAt?: unknown }).createdAt;
  if (typeof createdAt === "string") {
    preview.createdAt = createdAt;
  }
  return preview;
}
export function useMessageEvents(
  sessionId: Ref<string>,
  messages: ComputedRef<Message[]> | Ref<Message[]>
): {
  messageEventsMap: ComputedRef<ReadonlyMap<string, ToolEventItemViewModel[]>>;
  messagePosterPreviewMap: ComputedRef<ReadonlyMap<string, PosterPreviewViewModel>>;
} {
  const aiChatStore = useAiChatStore();
  const { buildEventItems } = useChatEventViewModel();
  const messageMaps = computed<{
    messageEventsMap: ReadonlyMap<string, ToolEventItemViewModel[]>;
    messagePosterPreviewMap: ReadonlyMap<string, PosterPreviewViewModel>;
  }>(() => {
    const eventsMap = new Map<string, ToolEventItemViewModel[]>();
    const previewMap = new Map<string, PosterPreviewViewModel>();
    const currentSessionId = sessionId.value;
    const sessionMessages = messages.value;
    for (let i = 0; i < sessionMessages.length; i++) {
      const message = sessionMessages[i];
      if (!message || message.role !== "assistant") continue;
      const startTime = message.timestamp;
      const nextMessage = sessionMessages[i + 1];
      const endTime = nextMessage ? nextMessage.timestamp : Number.MAX_SAFE_INTEGER;
      const events = aiChatStore.getToolEventsInRange(currentSessionId, startTime, endTime);
      const eventItems = buildEventItems(events);
      if (eventItems.length > 0) {
        eventsMap.set(message.id, eventItems);
      }
      let lastPreview: PosterPreviewViewModel | null = null;
      for (const event of events) {
        const preview = extractPosterPreviewFromToolResult(event);
        if (preview) lastPreview = preview;
      }
      if (lastPreview) {
        previewMap.set(message.id, lastPreview);
      }
    }
    return {
      messageEventsMap: eventsMap,
      messagePosterPreviewMap: previewMap
    };
  });
  const messageEventsMap = computed<ReadonlyMap<string, ToolEventItemViewModel[]>>(
    () => messageMaps.value.messageEventsMap
  );
  const messagePosterPreviewMap = computed<ReadonlyMap<string, PosterPreviewViewModel>>(
    () => messageMaps.value.messagePosterPreviewMap
  );
  return {
    messageEventsMap,
    messagePosterPreviewMap
  };
}
