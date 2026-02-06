<script setup lang="ts">
import AppLogo from "../atoms/AppLogo.vue";
import ChatToggleButton from "../atoms/ChatToggleButton.vue";
import AboutButton from "@/components/common/atoms/AboutButton.vue";

withDefaults(
  defineProps<{
    showChatToggle?: boolean;
  }>(),
  {
    showChatToggle: true
  }
);

const emit = defineEmits<{
  "toggle-chat": [];
  "open-about": [];
}>();
</script>

<template>
  <header class="h-12 bg-surface border-b border-border flex items-center justify-between px-3 shrink-0 safe-area-top">
    <!-- 左侧占位：保持中间 Logo 居中对齐 -->
    <div class="w-10"></div>

    <!-- 中间：Logo -->
    <AppLogo size="sm">Spatial AI</AppLogo>

    <!-- 右侧：AI 聊天按钮 + 关于按钮 -->
    <div class="flex items-center gap-0.5">
      <slot name="actions" />
      <ChatToggleButton v-if="showChatToggle" size="sm" @click="emit('toggle-chat')" />
      <AboutButton @click="emit('open-about')" />
    </div>
  </header>
</template>
