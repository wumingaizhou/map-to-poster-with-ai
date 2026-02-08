<script setup lang="ts">
import { ref } from "vue";

export type FAQItem = {
  question: string;
  answer: string;
};

defineProps<{
  isOpen: boolean;
  items: FAQItem[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const expandedIndex = ref<number | null>(null);

function toggleItem(index: number) {
  expandedIndex.value = expandedIndex.value === index ? null : index;
}
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
        <div class="absolute inset-0 bg-black/50" @click="emit('close')" />

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
            class="relative bg-surface rounded-none md:rounded shadow-lg w-full h-full md:h-auto md:max-w-lg md:max-h-[85vh] md:mx-4 overflow-hidden flex flex-col safe-area-y"
          >
            <!-- 头部 -->
            <div class="px-4 py-3.5 md:px-6 md:py-4 border-b border-border shrink-0">
              <div class="flex items-center justify-between">
                <h2 class="text-base md:text-lg font-medium text-fg">常见问题</h2>
                <button
                  type="button"
                  @click="emit('close')"
                  class="p-1.5 -mr-1.5 hover:bg-surface-muted active:bg-surface-subtle rounded transition-colors group touch-target flex items-center justify-center"
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

            <!-- FAQ 列表 -->
            <div class="flex-1 overflow-y-auto custom-scrollbar">
              <!-- 空状态 -->
              <div v-if="items.length === 0" class="px-4 py-12 md:px-6 text-center">
                <p class="text-muted-subtle text-sm">暂无常见问题</p>
              </div>

              <!-- 手风琴列表 -->
              <div v-else class="px-4 py-3 md:px-6 md:py-4 space-y-2">
                <div
                  v-for="(item, index) in items"
                  :key="index"
                  class="rounded border border-border overflow-hidden"
                  :class="expandedIndex === index ? 'bg-surface-muted/50' : 'bg-surface'"
                >
                  <!-- 问题（可点击展开） -->
                  <button
                    type="button"
                    @click="toggleItem(index)"
                    class="w-full px-3.5 py-3 md:px-4 text-left flex items-start gap-3 hover:bg-surface-muted/60 transition-colors"
                  >
                    <span
                      class="text-xs font-medium text-muted-subtle bg-surface-subtle rounded px-1.5 py-0.5 shrink-0 mt-px"
                    >
                      Q{{ index + 1 }}
                    </span>
                    <span class="text-fg text-sm md:text-[15px] font-medium leading-relaxed flex-1">
                      {{ item.question }}
                    </span>
                    <svg
                      class="w-4 h-4 text-muted-subtle shrink-0 mt-0.5 transition-transform duration-200"
                      :class="{ 'rotate-180': expandedIndex === index }"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <!-- 答案（展开内容） -->
                  <Transition
                    enter-active-class="transition-all duration-200 ease-out"
                    enter-from-class="max-h-0 opacity-0"
                    enter-to-class="max-h-96 opacity-100"
                    leave-active-class="transition-all duration-150 ease-in"
                    leave-from-class="max-h-96 opacity-100"
                    leave-to-class="max-h-0 opacity-0"
                  >
                    <div v-if="expandedIndex === index" class="overflow-hidden">
                      <div class="px-3.5 pb-3 md:px-4 md:pb-3.5">
                        <div class="border-l-2 border-border-strong pl-3 ml-4.5">
                          <p class="text-muted-strong text-sm leading-relaxed">
                            {{ item.answer }}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
