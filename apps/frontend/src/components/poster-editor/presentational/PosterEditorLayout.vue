<script setup lang="ts">
import { AppLayout } from "@/components/layout";
</script>

<template>
  <div class="page-root">
    <AppLayout :enable-right-panel="true">
      <template #right-panel>
        <slot name="right-panel" />
      </template>

      <template #topbar-actions>
        <slot name="topbar-actions" />
      </template>

      <!-- 主内容区 -->
      <slot />

      <!-- 浮动元素 -->
      <slot name="fab" />
    </AppLayout>
  </div>
</template>
