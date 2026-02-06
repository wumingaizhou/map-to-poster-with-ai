<script setup lang="ts">
import { ref, onErrorCaptured } from "vue";

const hasError = ref(false);
const errorMessage = ref("");

onErrorCaptured((error: Error) => {
  hasError.value = true;
  errorMessage.value = error.message || "发生未知错误";

  console.error("[ErrorBoundary] Caught error:", error);

  return false;
});

function reset() {
  hasError.value = false;
  errorMessage.value = "";
}
</script>

<template>
  <slot v-if="!hasError" />
  <div v-else class="flex items-center justify-center h-full min-h-40 p-6">
    <div class="text-center max-w-xs">
      <!-- 错误图标 -->
      <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
        <svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <!-- 错误信息 -->
      <h3 class="text-sm font-medium text-fg mb-1">出错了</h3>
      <p class="text-xs text-muted mb-4 wrap-break-word">{{ errorMessage }}</p>

      <!-- 重试按钮 -->
      <button
        @click="reset"
        class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-md transition-colors"
      >
        重试
      </button>
    </div>
  </div>
</template>
