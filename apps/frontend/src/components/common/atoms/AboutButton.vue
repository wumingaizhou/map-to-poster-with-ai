<script setup lang="ts">
const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <button @click="emit('click')" class="p-2 hover:bg-surface-muted rounded transition-colors" title="关于">
    <svg class="w-5 h-5 text-muted-subtle hover:text-fg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  </button>
</template>
