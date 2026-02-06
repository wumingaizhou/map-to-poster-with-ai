<script setup lang="ts">
import LoadingSpinner from "@/components/common/atoms/LoadingSpinner.vue";

defineProps<{
  canDownload: boolean;
  isLoading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  download: [];
}>();
</script>

<template>
  <button
    type="button"
    class="fixed bottom-6 right-6 safe-area-bottom safe-area-right md:absolute md:bottom-4 md:right-4 z-10 w-14 h-14 sm:w-12 sm:h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200"
    :class="[
      canDownload
        ? 'bg-primary text-white hover:bg-primary-hover hover:scale-105 active:scale-95'
        : 'bg-border text-muted-subtle cursor-not-allowed'
    ]"
    :disabled="!canDownload"
    :title="canDownload ? '下载选中的海报' : '请先选中一张海报'"
    @click="emit('download')"
  >
    <LoadingSpinner v-if="isLoading" size="sm" />
    <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  </button>

  <!-- 下载错误提示 -->
  <div
    v-if="error"
    class="fixed bottom-22 right-6 safe-area-right md:absolute md:bottom-18 md:right-4 z-10 max-w-xs px-3 py-2 bg-red-50 border border-red-200 rounded-lg shadow-sm"
  >
    <p class="text-xs text-red-600">{{ error }}</p>
  </div>
</template>
