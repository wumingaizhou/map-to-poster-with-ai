<script setup lang="ts">
import { AppLayout } from "@/components/layout";
</script>

<template>
  <div class="h-full w-full bg-white text-black font-sans overflow-hidden relative">
    <AppLayout :show-topbar="false">
      <div class="relative w-full h-full flex flex-col">
        <div class="flex-1 flex flex-col items-center justify-center w-full px-4 sm:px-6 pb-12 sm:pb-0">
          <slot name="form" />
        </div>

        <slot name="overlay" />
      </div>
    </AppLayout>
  </div>
</template>
