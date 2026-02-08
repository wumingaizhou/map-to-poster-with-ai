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
  "toggle-chat": [];
  "menu-select": [key: string];
}>();
</script>

<template>
  <header class="h-12 bg-surface border-b border-border flex items-center justify-between px-3 shrink-0 safe-area-top">
    <div class="w-20"></div>

    <AppLogo size="sm">Poster</AppLogo>

    <div class="flex items-center gap-0.5">
      <slot name="actions" />
      <ChatToggleButton v-if="showChatToggle" size="sm" @click="emit('toggle-chat')" />
      <TopBarMenu size="sm" @select="(key: string) => emit('menu-select', key)" />
    </div>
  </header>
</template>
