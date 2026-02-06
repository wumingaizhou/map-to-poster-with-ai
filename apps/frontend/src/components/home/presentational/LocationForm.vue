<script setup lang="ts">
import CustomSelect from "@/components/common/atoms/CustomSelect.vue";
import LoadingSpinner from "@/components/common/atoms/LoadingSpinner.vue";
import type { PosterCategory } from "@/types/posters";

interface CategoryOption {
  value: PosterCategory;
  label: string;
}

defineProps<{
  locationQuery: string;
  category: PosterCategory;
  categoryOptions: CategoryOption[];
  isThemesLoading: boolean;
  isGeocodeLoading: boolean;
  isCreateSessionLoading: boolean;
  canStart: boolean;
  themesError: string | null;
  geocodeError: string | null;
  createSessionError: string | null;
}>();

const emit = defineEmits<{
  "update:locationQuery": [value: string];
  "update:category": [value: PosterCategory];
  retryLoadThemes: [];
  submit: [];
}>();
</script>

<template>
  <div class="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-700">
    <div class="text-center mb-8 sm:mb-12">
      <h1 class="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tighter text-black mb-2 sm:mb-3 font-serif">
        MapToPosterWithAI
      </h1>
      <p class="text-zinc-500 text-base sm:text-lg tracking-wide">让地图海报设计更简单</p>
    </div>

    <div class="flex flex-col gap-4 sm:gap-6">
      <div class="space-y-2">
        <div class="flex items-center gap-2 ml-1">
          <label class="text-xs font-bold uppercase tracking-wider text-zinc-400"> 地名名称 </label>
          <span class="relative inline-flex items-center group">
            <button
              type="button"
              class="inline-flex items-center justify-center w-5 h-5 -m-0.5 rounded-full text-zinc-400 hover:text-black hover:bg-zinc-100 active:bg-zinc-200 transition-colors focus:outline-none touch-target"
              aria-describedby="location-name-tooltip"
              aria-label="地名名称推荐说明"
              @mousedown.prevent
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            <span
              id="location-name-tooltip"
              role="tooltip"
              class="pointer-events-none absolute left-0 bottom-full mb-2 z-20 w-56 sm:w-64 select-none rounded-xl border border-zinc-200/80 bg-white/95 px-3 py-2 text-[11px] leading-relaxed text-zinc-600 shadow-xl ring-1 ring-black/5 backdrop-blur transition-all duration-150 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0"
            >
              地名名称推荐使用 <span class="font-medium text-zinc-900">"中国长沙"</span>
              这种表述，并且推荐城市级别的地名。
            </span>
          </span>
        </div>
        <input
          :value="locationQuery"
          :disabled="isCreateSessionLoading"
          type="text"
          placeholder="西湖、New York、Tokyo..."
          class="w-full h-12 px-4 bg-white border border-zinc-200 rounded-xl text-[15px] placeholder:text-zinc-300 transition-all duration-200 hover:border-zinc-400 focus:outline-none focus:border-black focus:ring-4 focus:ring-black/5 disabled:bg-zinc-50 disabled:text-zinc-400 disabled:cursor-not-allowed"
          @input="emit('update:locationQuery', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="space-y-2">
        <label class="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1"> 地图主题 </label>
        <CustomSelect
          :model-value="category"
          :options="categoryOptions"
          :disabled="isThemesLoading || isCreateSessionLoading"
          placeholder="选择设计风格"
          @update:model-value="emit('update:category', $event)"
        />
      </div>

      <div class="min-h-6 flex items-center justify-center sm:justify-start text-sm">
        <div v-if="isThemesLoading" class="flex items-center gap-2 text-zinc-400">
          <span class="w-1.5 h-1.5 rounded-full bg-black animate-pulse"></span>
          <span>正在准备设计资源...</span>
        </div>

        <div v-else-if="themesError" class="flex items-center gap-2 text-red-600">
          <span>准备失败</span>
          <button
            type="button"
            class="font-medium underline underline-offset-2 hover:text-red-800 disabled:opacity-50"
            :disabled="isCreateSessionLoading"
            @click="emit('retryLoadThemes')"
          >
            重试
          </button>
        </div>

        <p v-if="geocodeError" class="text-red-600">{{ geocodeError }}</p>
        <p v-if="createSessionError" class="text-red-600">{{ createSessionError }}</p>
      </div>

      <div class="pt-1 sm:pt-2">
        <button
          type="button"
          :disabled="!canStart"
          @click="emit('submit')"
          class="group w-full h-12 sm:h-12 bg-black text-white rounded-xl font-medium text-[15px] transition-all duration-200 hover:bg-zinc-800 active:scale-[0.98] disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed disabled:active:scale-100 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_25px_-6px_rgba(0,0,0,0.3)] disabled:shadow-none flex items-center justify-center gap-2"
        >
          <LoadingSpinner v-if="isGeocodeLoading" size="xs" class="text-white/80" />
          <span>{{ isGeocodeLoading ? "地点解析中..." : "开始生成" }}</span>
        </button>

        <div
          v-if="isCreateSessionLoading"
          class="flex items-center justify-center gap-2 text-sm text-zinc-500 mt-3 animate-pulse"
        >
          <LoadingSpinner size="xs" class="text-zinc-500" />
          <span>正在生成首版设计...</span>
        </div>
      </div>
    </div>
  </div>
</template>
