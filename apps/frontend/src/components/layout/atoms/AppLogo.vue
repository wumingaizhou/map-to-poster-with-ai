<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: "sm" | "md";
    showSubtitle?: boolean;
  }>(),
  {
    size: "md",
    showSubtitle: false
  }
);
</script>

<template>
  <div class="flex items-center gap-2.5">
    <div class="rounded bg-primary flex items-center justify-center" :class="size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'">
      <svg
        class="text-white"
        :class="size === 'sm' ? 'w-4 h-4' : 'w-4.5 h-4.5'"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
        />
      </svg>
    </div>

    <div class="flex flex-col">
      <h1
        :class="
          size === 'sm'
            ? 'text-lg font-medium text-fg font-serif'
            : 'text-base lg:text-lg font-medium font-serif text-fg'
        "
      >
        <slot>MapToPosterWithAI</slot>
      </h1>
      <span v-if="showSubtitle" class="text-[10px] text-muted-subtle -mt-0.5 hidden lg:block"> 地图海报 </span>
    </div>
  </div>
</template>
