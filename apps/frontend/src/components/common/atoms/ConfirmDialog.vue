<script setup lang="ts">
withDefaults(
  defineProps<{
    isOpen: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmType?: "danger" | "primary";
  }>(),
  {
    title: "",
    confirmText: "确认",
    cancelText: "取消",
    confirmType: "primary"
  }
);

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
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
      <div v-if="isOpen" class="fixed inset-0 z-modal flex items-end sm:items-center justify-center p-0 sm:p-4">
        <!-- 遮罩层 -->
        <div class="absolute inset-0 bg-black/50" @click="emit('cancel')" />

        <!-- 对话框内容 -->
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          enter-to-class="opacity-100 translate-y-0 sm:scale-100"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 translate-y-0 sm:scale-100"
          leave-to-class="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
        >
          <div
            v-if="isOpen"
            class="relative bg-surface rounded-t-xl sm:rounded shadow-lg w-full sm:max-w-md overflow-hidden safe-area-bottom"
            @click.stop
          >
            <!-- 头部 -->
            <div v-if="title" class="px-5 pt-5 pb-3">
              <h3 class="text-base font-medium text-fg">{{ title }}</h3>
            </div>

            <!-- 内容 -->
            <div class="px-5 pb-5" :class="{ 'pt-5': !title }">
              <p class="text-sm text-fg leading-relaxed">{{ message }}</p>
            </div>

            <!-- 底部按钮 -->
            <div class="bg-surface-muted px-5 py-3 sm:py-3 flex items-center justify-end gap-3">
              <button
                type="button"
                @click="emit('cancel')"
                class="px-5 py-2.5 sm:px-4 sm:py-2 text-sm font-medium text-fg bg-surface hover:bg-surface-muted active:bg-surface-subtle rounded transition-colors border border-border touch-target"
              >
                {{ cancelText }}
              </button>
              <button
                type="button"
                @click="emit('confirm')"
                class="px-5 py-2.5 sm:px-4 sm:py-2 text-sm font-medium text-white rounded transition-colors touch-target"
                :class="
                  confirmType === 'danger'
                    ? 'bg-primary hover:bg-primary-hover active:scale-98'
                    : 'bg-info hover:bg-info-hover active:scale-98'
                "
              >
                {{ confirmText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
