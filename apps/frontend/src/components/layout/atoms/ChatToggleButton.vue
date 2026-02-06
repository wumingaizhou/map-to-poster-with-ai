<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: "sm" | "md";
  }>(),
  {
    size: "md"
  }
);

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <button
    type="button"
    @click="emit('click')"
    class="rounded transition-colors flex items-center justify-center"
    :class="
      size === 'sm'
        ? 'p-2 hover:bg-surface-muted active:bg-surface-subtle touch-target'
        : 'p-2 hover:bg-primary-subtle focus-visible-ring'
    "
    title="地图海报设计助手"
    :aria-label="size === 'sm' ? '打开 AI 助手' : '切换 AI 助手'"
  >
    <svg
      class="w-5 h-5"
      :class="size === 'sm' ? 'text-muted-subtle' : 'text-muted hover:text-primary'"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        :stroke-width="size === 'sm' ? '2' : '1.75'"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  </button>
</template>
