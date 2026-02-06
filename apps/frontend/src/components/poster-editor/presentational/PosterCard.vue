<script setup lang="ts">
import LoadingSpinner from "@/components/common/atoms/LoadingSpinner.vue";

defineProps<{
  versionNo: number;
  previewUrl?: string;
  isSelected: boolean;
  isLatest: boolean;
}>();

const emit = defineEmits<{
  select: [];
}>();

function handleClick(event: MouseEvent): void {
  event.stopPropagation();
  emit("select");
}
</script>

<template>
  <div
    class="relative shrink-0 cursor-pointer transition-all duration-200 rounded-lg active:scale-[0.97]"
    :class="[
      isSelected
        ? 'ring-2 ring-primary ring-offset-2 ring-offset-canvas'
        : 'hover:ring-1 hover:ring-border hover:ring-offset-1 hover:ring-offset-canvas'
    ]"
    @click="handleClick"
  >
    <!-- 海报图片容器 -->
    <div class="relative h-72 sm:h-100 md:h-125 aspect-3/4 bg-surface rounded-lg overflow-hidden shadow-sm">
      <!-- 预览图 -->
      <img
        v-if="previewUrl"
        :src="previewUrl"
        :alt="`Poster v${versionNo}`"
        class="w-full h-full object-contain select-none"
        draggable="false"
      />

      <!-- 加载态 -->
      <div v-else class="w-full h-full flex items-center justify-center">
        <LoadingSpinner size="sm" class="text-muted" />
      </div>

      <!-- 版本标签 -->
      <div class="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
        v{{ versionNo }}
        <span v-if="isLatest" class="ml-1 text-primary-light">最新</span>
      </div>

      <!-- 选中指示器 -->
      <div
        v-if="isSelected"
        class="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
      >
        <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </div>
  </div>
</template>
