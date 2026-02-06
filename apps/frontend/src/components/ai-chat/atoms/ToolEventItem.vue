<script setup lang="ts">
import { computed, ref } from "vue";
import type { ToolEventItemViewModel } from "@/types/ai-chat/view-models";

const props = defineProps<{
  event: ToolEventItemViewModel;
}>();

const isExpanded = ref(false);

const statusInfo = computed(() => {
  switch (props.event.status) {
    case "success":
      return { icon: "success", color: "text-success" };
    case "error":
      return { icon: "error", color: "text-red-500" };
    default:
      return { icon: "pending", color: "text-muted-subtle" };
  }
});

const themeClasses = computed(() => {
  if (props.event.type === "workflow") {
    return {
      border: "border-info/20",
      borderHover: "hover:border-info/30",
      bgHover: "hover:bg-info-subtle",
      bgExpanded: "border-info/30 bg-info-subtle",
      iconColor: "text-info",
      borderExpanded: "border-info/20"
    };
  }
  return {
    border: "border-border",
    borderHover: "hover:border-border-strong",
    bgHover: "hover:bg-surface-muted",
    bgExpanded: "border-border-strong bg-surface-muted",
    iconColor: "text-muted",
    borderExpanded: "border-border"
  };
});

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
};

function formatArgs(argsData: unknown): string {
  if (typeof argsData === "string") return argsData;
  try {
    return JSON.stringify(argsData, null, 2);
  } catch {
    return String(argsData);
  }
}

const formattedArgs = computed(() => {
  if (!isExpanded.value) return null;
  if (props.event.args === null || props.event.args === undefined) return null;
  return formatArgs(props.event.args);
});
</script>

<template>
  <div class="w-full font-mono text-[11px] leading-[1.4]">
    <button
      @click="toggleExpand"
      class="flex flex-col items-stretch w-full text-left bg-surface border rounded p-0 cursor-pointer transition-colors overflow-hidden text-muted"
      :class="[
        themeClasses.border,
        themeClasses.borderHover,
        themeClasses.bgHover,
        isExpanded ? themeClasses.bgExpanded : ''
      ]"
    >
      <div class="flex items-center gap-2 px-2.5 py-2 min-h-8">
        <svg
          v-if="event.type === 'tool'"
          class="size-3.5 shrink-0"
          :class="themeClasses.iconColor"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
        >
          <path d="M8 3v10M11 6L8 3 5 6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg
          v-else
          class="size-3.5 shrink-0"
          :class="themeClasses.iconColor"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
        >
          <path
            d="M2 4h4v3H2zM10 4h4v3h-4zM6 9h4v3H6zM4 7v2M12 7v3.5H10M6 10.5H4V7"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="font-medium tracking-tight flex-1 min-w-0 truncate text-fg">{{ event.name }}</span>
        <span class="shrink-0 transition-colors" :class="statusInfo.color" aria-hidden="true">
          <svg
            v-if="statusInfo.icon === 'success'"
            class="size-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
          >
            <circle cx="8" cy="8" r="6.5" stroke-width="1.5" />
            <path d="M5 8.5l2 2 4-4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <svg
            v-else-if="statusInfo.icon === 'error'"
            class="size-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
          >
            <circle cx="8" cy="8" r="6.5" stroke-width="1.5" />
            <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <svg v-else class="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor">
            <circle cx="8" cy="8" r="6.5" stroke-width="1.5" />
            <path d="M8 4.5v3.5l2.5 1.5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <svg
          class="size-3 shrink-0 text-muted-subtle transition-transform"
          :class="{ 'rotate-180': isExpanded }"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
        >
          <path d="M4 6l4 4 4-4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div v-if="isExpanded && formattedArgs" class="px-2.5 pt-2 pb-2.5 border-t" :class="themeClasses.borderExpanded">
        <pre
          class="text-[10px] leading-relaxed text-muted-strong m-0 p-2 bg-surface border border-border rounded overflow-x-auto whitespace-pre-wrap wrap-break-word max-h-48 overflow-y-auto custom-scrollbar"
          >{{ formattedArgs }}</pre
        >
      </div>
    </button>
  </div>
</template>
