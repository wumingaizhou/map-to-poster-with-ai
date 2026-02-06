<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  /** 是否处于加载状态 */
  isLoading: boolean;
}>();

const emit = defineEmits<{
  /** 发送消息 */
  "send-message": [text: string];
}>();

const inputText = ref("");

const handleSend = () => {
  if (!inputText.value.trim() || props.isLoading) return;
  emit("send-message", inputText.value);
  inputText.value = "";
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};
</script>

<template>
  <div class="bg-surface">
    <div class="max-w-4xl mx-auto flex flex-col">
      <div class="p-2.5 sm:p-3 md:p-4">
        <!-- 输入框容器：白色背景、浅灰色边框、圆角12px，发送按钮在内部 -->
        <div class="relative bg-white border border-gray-200 rounded-xl shadow-sm">
          <textarea
            v-model="inputText"
            @keydown="handleKeydown"
            placeholder="请输入你的设计需求"
            class="w-full bg-transparent text-gray-900 rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 pr-14 resize-none focus:outline-none text-sm placeholder:text-gray-400 leading-6"
            rows="2"
            style="min-height: 64px; max-height: 140px"
          ></textarea>

          <!-- 发送按钮：圆形，收纳在右下角，满足 WCAG 44px 最小触摸目标 -->
          <button
            type="button"
            @click="handleSend"
            :disabled="!inputText.trim() || isLoading"
            class="absolute right-2 sm:right-3 bottom-2 sm:bottom-3 w-10 h-10 sm:w-9 sm:h-9 rounded-full text-white transition-all flex items-center justify-center shadow-md"
            :class="[
              !inputText.trim() || isLoading
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-gray-500 hover:bg-gray-600 active:scale-95'
            ]"
            aria-label="发送消息"
          >
            <!-- 向上箭头图标 -->
            <svg
              v-if="!isLoading"
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 19V5" />
              <path d="M5 12l7-7 7 7" />
            </svg>
            <!-- 加载动画 -->
            <svg v-else class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </button>
        </div>
      </div>
      <!-- iOS 安全区域占位 -->
      <div class="safe-area-bottom"></div>
    </div>
  </div>
</template>
