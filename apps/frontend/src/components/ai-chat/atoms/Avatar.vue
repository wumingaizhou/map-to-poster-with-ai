<script setup lang="ts">
import { computed } from "vue";
import type { Role } from "@/types/ai-chat/ui-types";

const props = defineProps<{ role: Role }>();

const containerClass = computed(() =>
  props.role === "assistant" ? "bg-primary" : "bg-surface-subtle border border-border"
);

const iconColor = computed(() => (props.role === "assistant" ? "text-white" : "text-muted"));
</script>

<template>
  <div :class="['w-7 h-7 rounded flex items-center justify-center shrink-0', containerClass]">
    <!-- AI Icon (Simulated) -->
    <svg
      v-if="role === 'assistant'"
      xmlns="http://www.w3.org/2000/svg"
      :class="['w-3 h-3', iconColor]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path
        d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"
      />
      <path d="m5 3 1 1" />
      <path d="m19 3-1 1" />
      <path d="m5 21 1-1" />
      <path d="m19 21-1-1" />
    </svg>
    <!-- User Icon -->
    <svg
      v-else
      xmlns="http://www.w3.org/2000/svg"
      :class="['w-3 h-3', iconColor]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  </div>
</template>
