<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { Message, ChatError } from "@/types/ai-chat/ui-types";
import type { PosterPreviewViewModel, ToolEventItemViewModel } from "@/types/ai-chat/view-models";
import MessageBubble from "../atoms/MessageBubble.vue";
import ChatInputArea from "../atoms/ChatInputArea.vue";

const props = defineProps<{
  messages: Message[];
  messageEventsMap?: ReadonlyMap<string, ToolEventItemViewModel[]>;
  messagePosterPreviewMap?: ReadonlyMap<string, PosterPreviewViewModel>;
  isLoading: boolean;
  title?: string;
  error?: ChatError | null;
}>();

const emit = defineEmits<{
  "send-message": [content: string];
  retry: [];
  "dismiss-error": [];
}>();

const messageContainer = ref<HTMLElement | null>(null);

const scrollToBottom = async () => {
  await nextTick();
  if (messageContainer.value) {
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
  }
};

watch(
  () => props.messages.length,
  () => {
    scrollToBottom();
  }
);

watch(
  () => props.isLoading,
  isLoading => {
    if (!isLoading) {
      scrollToBottom();
    }
  }
);
</script>

<template>
  <div class="flex flex-col h-full bg-surface overflow-hidden">
    <div class="shrink-0 px-4 py-3 md:px-5 md:py-3 border-b border-border">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="flex flex-col">
            <h3 class="text-sm font-semibold text-fg">
              {{ title || "地图海报设计助手" }}
            </h3>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="error"
      class="shrink-0 px-4 py-2.5 bg-red-50 border-b border-red-200 flex items-center justify-between gap-3"
    >
      <div class="flex items-center gap-2 min-w-0">
        <svg class="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span class="text-xs text-red-700 truncate">{{ error.message }}</span>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button
          v-if="error.recoverable"
          @click="emit('retry')"
          class="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-100 active:bg-red-200 rounded transition-colors touch-target"
        >
          重试
        </button>
        <button
          @click="emit('dismiss-error')"
          class="p-2 text-red-400 hover:text-red-600 hover:bg-red-100 active:bg-red-200 rounded transition-colors touch-target flex items-center justify-center"
          aria-label="关闭错误提示"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <div
      ref="messageContainer"
      class="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-3 md:p-4 scroll-smooth overscroll-contain"
    >
      <div v-if="messages.length === 0" class="h-full flex items-center justify-center">
        <div class="text-center px-6 py-8">
          <div
            class="w-12 h-12 md:w-14 md:h-14 mx-auto mb-3 rounded bg-surface-subtle flex items-center justify-center"
          >
            <svg class="w-6 h-6 md:w-7 md:h-7 text-muted-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h4 class="text-sm font-medium text-fg mb-1">开始对话</h4>
          <p class="text-xs text-muted max-w-50 mx-auto leading-relaxed">输入消息与助手交流</p>
        </div>
      </div>
      <MessageBubble
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
        :event-items="messageEventsMap?.get(msg.id)"
        :poster-preview="messagePosterPreviewMap?.get(msg.id)"
      />
    </div>

    <ChatInputArea
      :is-loading="isLoading"
      @send-message="(text: string) => emit('send-message', text)"
      class="shrink-0 border-t border-border"
    />
  </div>
</template>
