<script setup lang="ts">
defineProps<{
  isCollapsed?: boolean;
}>();
</script>

<template>
  <aside
    class="flex flex-col shrink-0 overflow-hidden"
    :class="
      isCollapsed
        ? 'w-0 opacity-0 invisible'
        : 'panel-glass-flat w-(--app-layout-right-panel-width) lg:w-(--app-layout-right-panel-width-lg) xl:w-(--app-layout-right-panel-width-xl)'
    "
    :aria-hidden="isCollapsed"
  >
    <div class="w-full h-full overflow-hidden flex flex-col">
      <slot />
    </div>
  </aside>
</template>
