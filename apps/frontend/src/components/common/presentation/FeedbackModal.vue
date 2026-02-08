<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    isSubmitting?: boolean;
  }>(),
  {
    isSubmitting: false
  }
);

const emit = defineEmits<{
  close: [];
  submit: [data: { type: string; content: string; contact: string }];
}>();

const feedbackType = ref("suggestion");
const feedbackContent = ref("");
const contactInfo = ref("");

const feedbackTypes = [
  { value: "suggestion", label: "功能建议" },
  { value: "bug", label: "问题反馈" },
  { value: "other", label: "其他" }
];

function handleSubmit() {
  if (!feedbackContent.value.trim()) return;
  emit("submit", {
    type: feedbackType.value,
    content: feedbackContent.value.trim(),
    contact: contactInfo.value.trim()
  });
}

function resetForm() {
  feedbackContent.value = "";
  contactInfo.value = "";
  feedbackType.value = "suggestion";
}

function handleClose() {
  if (props.isSubmitting) return;
  emit("close");
}

defineExpose({ resetForm });
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="isOpen" class="fixed inset-0 z-modal flex items-center justify-center">
        <!-- 遮罩层 -->
        <div class="absolute inset-0 bg-black/50" @click="handleClose" />

        <!-- 弹窗内容 -->
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="isOpen"
            class="relative bg-surface rounded-none md:rounded shadow-lg w-full h-full md:h-auto md:max-w-lg md:mx-4 overflow-hidden flex flex-col safe-area-y"
          >
            <!-- 头部 -->
            <div class="px-4 py-3.5 md:px-6 md:py-4 border-b border-border shrink-0">
              <div class="flex items-center justify-between">
                <h2 class="text-base md:text-lg font-medium text-fg">意见反馈</h2>
                <button
                  type="button"
                  @click="handleClose"
                  :disabled="props.isSubmitting"
                  class="p-1.5 -mr-1.5 hover:bg-surface-muted active:bg-surface-subtle rounded transition-colors group touch-target flex items-center justify-center"
                  :class="{ 'opacity-50 cursor-not-allowed': props.isSubmitting }"
                  title="关闭"
                  aria-label="关闭弹窗"
                >
                  <svg
                    class="w-5 h-5 text-muted-subtle group-hover:text-fg transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- 表单内容 -->
            <div class="px-4 py-4 md:px-6 md:py-5 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
              <!-- 反馈类型 -->
              <div>
                <label class="text-sm text-muted-strong mb-2 block">反馈类型</label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="ft in feedbackTypes"
                    :key="ft.value"
                    type="button"
                    @click="feedbackType = ft.value"
                    class="px-3 py-1.5 text-sm rounded-sm transition-colors"
                    :class="
                      feedbackType === ft.value
                        ? 'bg-fg text-surface'
                        : 'bg-surface-subtle text-fg hover:bg-surface-muted'
                    "
                  >
                    {{ ft.label }}
                  </button>
                </div>
              </div>

              <!-- 反馈内容 -->
              <div>
                <label class="text-sm text-muted-strong mb-2 block">详细描述</label>
                <textarea
                  v-model="feedbackContent"
                  rows="4"
                  maxlength="2000"
                  placeholder="请描述你的建议或遇到的问题…"
                  class="w-full px-3 py-2.5 text-sm text-fg bg-surface-muted/50 border border-border rounded resize-none focus:outline-none focus:border-border-strong focus:bg-surface transition-colors placeholder:text-muted-subtle"
                />
              </div>

              <!-- 联系方式（可选） -->
              <div>
                <label class="text-sm text-muted-strong mb-2 block">
                  联系方式
                  <span class="text-muted-subtle ml-1">（选填）</span>
                </label>
                <input
                  v-model="contactInfo"
                  type="text"
                  placeholder="邮箱或其他联系方式"
                  class="w-full px-3 py-2.5 text-sm text-fg bg-surface-muted/50 border border-border rounded focus:outline-none focus:border-border-strong focus:bg-surface transition-colors placeholder:text-muted-subtle"
                />
              </div>
            </div>

            <!-- 底部操作栏 -->
            <div class="px-4 py-4 md:px-6 md:py-4 border-t border-border shrink-0 mb-1 safe-area-bottom">
              <div class="flex items-center justify-end gap-2 py-4">
                <button
                  type="button"
                  @click="handleClose"
                  :disabled="props.isSubmitting"
                  class="px-3.5 py-1.5 text-sm text-muted hover:text-fg transition-colors"
                  :class="{ 'opacity-50 cursor-not-allowed': props.isSubmitting }"
                >
                  取消
                </button>
                <button
                  type="button"
                  @click="handleSubmit"
                  :disabled="!feedbackContent.trim() || props.isSubmitting"
                  class="px-4 py-1.5 text-sm text-surface bg-fg rounded-sm hover:bg-primary-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {{ props.isSubmitting ? "提交中..." : "提交" }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
