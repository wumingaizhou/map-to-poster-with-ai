<script setup lang="ts">
import type { GeocodeCandidateDTO } from "@/api/api-resources/geocode/geocode-dto";

defineProps<{
  candidates: GeocodeCandidateDTO[];
  isDisabled: boolean;
}>();

const emit = defineEmits<{
  select: [candidate: GeocodeCandidateDTO];
  close: [];
}>();
</script>

<template>
  <Transition
    enter-active-class="transition ease-out duration-300"
    enter-from-class="opacity-0 translate-y-4 sm:translate-y-0 sm:translate-x-4"
    enter-to-class="opacity-100 translate-y-0 sm:translate-x-0"
    leave-active-class="transition ease-in duration-200"
    leave-from-class="opacity-100 translate-y-0 sm:translate-x-0"
    leave-to-class="opacity-0 translate-y-4 sm:translate-y-0 sm:translate-x-4"
  >
    <div
      v-if="candidates.length > 0"
      class="absolute inset-x-3 sm:inset-x-4 bottom-3 top-auto sm:top-6 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96 z-50"
    >
      <div
        class="flex flex-col h-full max-h-[70vh] sm:max-h-full bg-white/95 backdrop-blur-xl border border-zinc-200/80 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-black/5"
      >
        <!-- Header -->
        <div class="flex items-start justify-between p-4 sm:p-5 border-b border-zinc-100">
          <div>
            <h2 class="font-semibold text-black">选择地点</h2>
            <p class="text-xs text-zinc-500 mt-1 leading-relaxed">
              <span v-if="candidates.length === 1">已自动选中唯一候选...</span>
              <span v-else>找到 {{ candidates.length }} 个相关地点</span>
            </p>
          </div>
          <button
            type="button"
            class="p-2.5 -mr-2 text-zinc-400 hover:text-black hover:bg-zinc-100 active:bg-zinc-200 rounded-lg transition-colors touch-target flex items-center justify-center"
            :disabled="isDisabled"
            @click="emit('close')"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor" stroke-width="1.5" fill="none">
              <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1 custom-scrollbar overscroll-contain">
          <div
            v-for="c in candidates"
            :key="c.placeId"
            class="group flex items-center justify-between p-3 sm:p-3 rounded-xl border border-transparent hover:bg-zinc-50 hover:border-zinc-200 active:bg-zinc-100 transition-all duration-200"
            :class="{ 'opacity-50 pointer-events-none': isDisabled }"
          >
            <span class="text-sm text-zinc-700 font-medium truncate pr-3 sm:pr-4 group-hover:text-black">
              {{ c.displayName }}
            </span>
            <button
              type="button"
              class="shrink-0 px-4 py-2 bg-white text-black text-xs font-semibold border border-zinc-200 rounded-lg shadow-sm group-hover:bg-black group-hover:text-white group-hover:border-black active:scale-95 transition-all"
              :disabled="isDisabled"
              @click="emit('select', c)"
            >
              选择
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e4e4e7;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #d4d4d8;
}
</style>
