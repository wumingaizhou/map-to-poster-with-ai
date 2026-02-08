<script setup lang="ts">
import AppLogo from "../atoms/AppLogo.vue";
import ChatToggleButton from "../atoms/ChatToggleButton.vue";
import TopBarMenu from "./TopBarMenu.vue";

withDefaults(
  defineProps<{
    showChatToggle?: boolean;
  }>(),
  {
    showChatToggle: true
  }
);

const emit = defineEmits<{
  "toggle-right-panel": [];
  "menu-select": [key: string];
}>();
</script>

<template>
  <header class="h-14 bg-surface border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0">
    <!-- 左侧区域 -->
    <div class="flex items-center gap-3 lg:gap-4">
      <!-- Logo/标题 -->
      <AppLogo size="md" :show-subtitle="true" />

      <!-- 分隔线 -->
      <div class="h-5 w-px bg-border hidden lg:block"></div>

      <!-- 工具栏按钮 -->
      <div class="flex items-center gap-1">
        <!-- AI 助手切换按钮 -->
        <ChatToggleButton v-if="showChatToggle" size="md" @click="emit('toggle-right-panel')" />
      </div>
    </div>

    <!-- 右侧区域 -->
    <div class="flex items-center gap-2">
      <slot name="actions" />
      <TopBarMenu size="md" @select="(key: string) => emit('menu-select', key)" />
    </div>
  </header>
</template>
