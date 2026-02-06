<script setup lang="ts">
import { computed } from "vue";
import type { Message } from "@/types/ai-chat/ui-types";
import type { PosterPreviewViewModel, ToolEventItemViewModel } from "@/types/ai-chat/view-models";
import MessageContentRender from "./MessageContentRender.vue";
import ToolEventItem from "./ToolEventItem.vue";
import PosterPreviewThumbnail from "./PosterPreviewThumbnail.vue";

const props = defineProps<{
  message: Message;
  eventItems?: ToolEventItemViewModel[];
  posterPreview?: PosterPreviewViewModel;
}>();

const isUser = computed(() => props.message.role === "user");
const showEvents = computed(() => (props.eventItems?.length ?? 0) > 0);
const showPosterPreview = computed(() => !isUser.value && Boolean(props.posterPreview?.versionId));
const alignmentClass = computed(() => (isUser.value ? "items-end" : "items-start"));
const contentDirectionClass = computed(() => (isUser.value ? "flex-row-reverse" : "flex-row"));
const bubbleClass = computed(() =>
  isUser.value ? "bg-gray-100 text-gray-900 font-medium rounded-xl" : "bg-transparent text-fg font-medium rounded-xl"
);
</script>

<template>
  <div class="flex flex-col mb-6 sm:mb-8" :class="alignmentClass">
    <div v-if="showEvents" class="flex flex-col gap-2 pl-2 sm:pl-3 w-[92%] sm:w-[85%]">
      <ToolEventItem v-for="eventItem in eventItems" :key="eventItem.id" :event="eventItem" />
    </div>

    <div class="flex gap-2 max-w-[92%] sm:max-w-[85%]" :class="contentDirectionClass">
      <div class="p-2.5 sm:p-3 text-[13px] font-light leading-relaxed whitespace-pre-wrap" :class="bubbleClass">
        <MessageContentRender v-if="!isUser" :content="message.content" :is-final="message.isComplete" />
        <div v-else>{{ message.content }}</div>

        <div v-if="showPosterPreview" class="mt-2">
          <PosterPreviewThumbnail :version-id="posterPreview!.versionId" />
        </div>
      </div>
    </div>
  </div>
</template>
