<script setup lang="ts" generic="T extends string">
import { ref, computed, toRef } from "vue";
import { useClickOutside } from "@/composables/common/use-click-outside";
import { useEscapeKey } from "@/composables/layout/use-escape-key";

interface SelectOption<V> {
  value: V;
  label: string;
}

const props = defineProps<{
  modelValue: T;
  options: SelectOption<T>[];
  disabled?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: T];
}>();

const isOpen = ref(false);
const isShaking = ref(false);
const selectRef = ref<HTMLDivElement | null>(null);

const selectedLabel = computed(() => {
  const option = props.options.find(o => o.value === props.modelValue);
  return option?.label ?? props.placeholder ?? "请选择";
});

useClickOutside(selectRef, () => {
  isOpen.value = false;
});

// ESC 键关闭下拉菜单
useEscapeKey(toRef(isOpen), () => {
  isOpen.value = false;
});

function toggle() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
}

function select(value: T) {
  if (value === props.modelValue) {
    isOpen.value = false;
    return;
  }

  emit("update:modelValue", value);
  isOpen.value = false;

  // 触发抖动效果
  triggerShake();
}

function triggerShake() {
  isShaking.value = true;
  setTimeout(() => {
    isShaking.value = false;
  }, 400);
}
</script>

<template>
  <div ref="selectRef" class="relative w-full">
    <!-- Trigger Button -->
    <button
      type="button"
      @click="toggle"
      :disabled="disabled"
      class="w-full h-12 px-4 flex items-center justify-between bg-white border border-zinc-200 rounded-xl text-[15px] text-left transition-all duration-200 focus:outline-none focus:border-black focus:ring-4 focus:ring-black/5 disabled:bg-zinc-50 disabled:text-zinc-400 disabled:cursor-not-allowed"
      :class="[
        isOpen ? 'border-black ring-4 ring-black/5' : 'hover:border-zinc-400',
        isShaking ? 'animate-shake border-black' : ''
      ]"
    >
      <span class="truncate" :class="modelValue ? 'text-black' : 'text-zinc-400'">
        {{ selectedLabel }}
      </span>

      <span
        class="ml-2 flex items-center justify-center text-zinc-400 transition-transform duration-300"
        :class="{ 'rotate-180 text-black': isOpen }"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </button>

    <!-- Dropdown Options -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 -translate-y-2 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-1 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute top-[calc(100%+8px)] left-0 w-full bg-white border border-zinc-200 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] overflow-hidden z-50 p-1.5"
      >
        <div class="max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-0.5">
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            @click="select(option.value)"
            class="flex items-center justify-between w-full px-3 py-2.5 text-[14px] text-left rounded-lg transition-all duration-150"
            :class="[
              option.value === modelValue ? 'bg-black text-white font-medium' : 'text-zinc-700 hover:bg-zinc-100'
            ]"
          >
            <span>{{ option.label }}</span>
            <span v-if="option.value === modelValue">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M11.5 4L5.5 10L2.5 7"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 定义抖动动画 - 使用 CSS Keyframes */
@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}

/* 关联到 utility class 名称 */
.animate-shake {
  animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

/* 简单的滚动条 */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e4e4e7;
  border-radius: 4px;
}
</style>
