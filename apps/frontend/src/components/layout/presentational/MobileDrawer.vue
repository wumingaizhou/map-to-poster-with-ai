<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean;
  position: "left" | "right";
  width?: string;
  title?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="isOpen" class="drawer-overlay" @click="emit('close')" aria-hidden="true" />
    </Transition>

    <!-- 抽屉面板 -->
    <Transition
      :enter-active-class="`transition-transform duration-250 ease-out`"
      :enter-from-class="position === 'left' ? '-translate-x-full' : 'translate-x-full'"
      :enter-to-class="'translate-x-0'"
      :leave-active-class="`transition-transform duration-200 ease-in`"
      :leave-from-class="'translate-x-0'"
      :leave-to-class="position === 'left' ? '-translate-x-full' : 'translate-x-full'"
    >
      <aside
        v-if="isOpen"
        class="drawer-panel flex flex-col safe-area-y"
        :class="[position === 'left' ? 'drawer-panel-left safe-area-left' : 'drawer-panel-right safe-area-right']"
        :style="width ? { width } : undefined"
        role="dialog"
        :aria-label="title"
        aria-modal="true"
      >
        <!-- 关闭按钮 -->
        <button
          type="button"
          @click="emit('close')"
          class="absolute top-2 z-10 p-3 hover:bg-surface-muted active:bg-surface-subtle rounded-lg transition-colors touch-target flex items-center justify-center"
          :class="position === 'left' ? 'right-2' : 'left-2'"
          aria-label="关闭抽屉"
        >
          <svg class="w-5 h-5 text-muted-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- 抽屉内容 -->
        <div class="flex-1 overflow-hidden pt-14 overscroll-contain">
          <slot />
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>
