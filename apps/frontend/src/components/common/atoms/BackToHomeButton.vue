<script setup lang="ts">
defineProps<{
  /** 是否禁用 */
  isDisabled?: boolean;
}>();

const emit = defineEmits<{
  /** 点击事件 */
  click: [];
}>();
</script>

<template>
  <button
    type="button"
    class="h-8 px-2.5 rounded bg-surface text-fg border border-border text-xs font-medium hover:bg-surface-subtle active:scale-95 transition disabled:opacity-60 disabled:cursor-not-allowed"
    :disabled="isDisabled"
    @click="emit('click')"
  >
    返回首页
  </button>
</template>
