<script setup lang="ts">
import AiChatPanel from "../presentation/AiChatPanel.vue";
import { useChat } from "@/composables/ai-chat/use-chat";
import { onMounted, ref, watch } from "vue";
import { useMessageEvents } from "@/composables/ai-chat/use-chat-event-view-model";
import { useIdleCallback } from "@/composables/utils/use-idle-callback";
import { idleTaskConfig } from "@/config";
import type { SSEEvent } from "@/types/ai-chat/sse-types";

const props = withDefaults(
  defineProps<{
    title?: string;
    threadId?: string;
    buildUserMessage?: (visibleText: string) => string;
    onSseEvent?: (event: SSEEvent) => void;
  }>(),
  {
    title: "地图海报设计助手",
    threadId: undefined,
    buildUserMessage: undefined,
    onSseEvent: undefined
  }
);

const { messages, loading, error, currentSessionId, session, message } = useChat({
  buildUserMessage: props.buildUserMessage,
  onSseEvent: props.onSseEvent
});

const { messageEventsMap, messagePosterPreviewMap } = useMessageEvents(currentSessionId, messages);

const { scheduleIdleTask } = useIdleCallback();

const lastSentMessage = ref<string | null>(null);

onMounted(() => {
  if (props.threadId) {
    session.select(props.threadId);
  } else if (!currentSessionId.value) {
    session.create();
  }
  scheduleIdleTask(
    () => {
      void import("markstream-vue/index.css");
      void import("markstream-vue");
    },
    {
      timeout: idleTaskConfig.markdownPrefetchIdleTimeoutMs,
      fallbackDelay: idleTaskConfig.markdownPrefetchFallbackDelayMs
    }
  );
});

watch(
  () => props.threadId,
  next => {
    if (!next) return;
    session.select(next);
  }
);

const handleSendMessage = async (text: string) => {
  lastSentMessage.value = text;
  await message.send(text);
};

const handleRetry = async () => {
  if (lastSentMessage.value) {
    message.clearError();
    await message.send(lastSentMessage.value);
  }
};

const handleDismissError = () => {
  message.clearError();
};
</script>

<template>
  <AiChatPanel
    :messages="messages"
    :message-events-map="messageEventsMap"
    :message-poster-preview-map="messagePosterPreviewMap"
    :is-loading="loading"
    :error="error"
    :title="props.title"
    @send-message="handleSendMessage"
    @retry="handleRetry"
    @dismiss-error="handleDismissError"
  />
</template>
