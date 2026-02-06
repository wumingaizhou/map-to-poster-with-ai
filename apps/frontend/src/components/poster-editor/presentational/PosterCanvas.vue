<script setup lang="ts">
import { nextTick, watch, ref } from "vue";
import PosterCard from "./PosterCard.vue";
import LoadingSpinner from "@/components/common/atoms/LoadingSpinner.vue";
import { usePanzoom } from "@/composables/poster-editor";
import type { PosterVersionMetaDTO } from "@/api/api-resources/posters/posters-dto";

const props = defineProps<{
  versions: PosterVersionMetaDTO[];
  hasVersions: boolean;
  isLoading: boolean;
  error: string | null;
  selectedPosterId: string | null;
  latestVersionId: string;
  isPreviewLoading: boolean;
  previewUrls: Map<string, string>;
}>();

const emit = defineEmits<{
  selectPoster: [versionId: string];
  deselectPoster: [];
  retry: [];
}>();

// ==================== Panzoom ====================
const { canvasEl, panzoomEl, ensurePanzoom, resetView, teardown: teardownPanzoom } = usePanzoom();

// 预览加载完成后初始化 Panzoom
watch(
  () => [props.previewUrls.size > 0, canvasEl.value, panzoomEl.value] as const,
  async ([hasPreviews, nextCanvasEl, nextPanzoomEl]) => {
    if (!hasPreviews || !nextCanvasEl || !nextPanzoomEl) {
      teardownPanzoom();
      return;
    }

    await nextTick();
    await ensurePanzoom();
    resetView();
  },
  { immediate: true }
);

// ==================== Event Handlers ====================

function handleCanvasClick(event: MouseEvent): void {
  if (event.target === canvasEl.value) {
    emit("deselectPoster");
  }
}

function getPreviewUrl(versionId: string): string | undefined {
  return props.previewUrls.get(versionId);
}
</script>

<template>
  <div class="relative w-full h-full flex flex-col bg-bg-accent">
    <!-- 加载态 -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center p-6">
      <div class="text-center">
        <LoadingSpinner size="md" class="mx-auto text-muted" />
        <p class="mt-2 text-xs text-muted">加载中…</p>
      </div>
    </div>

    <!-- 错误态 -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center p-4 sm:p-6">
      <div class="max-w-md w-full rounded border border-border bg-surface p-4">
        <h2 class="text-sm font-semibold text-fg">加载失败</h2>
        <p class="mt-1 text-xs text-muted">{{ error }}</p>
        <div class="mt-3 flex items-center gap-2">
          <button
            type="button"
            class="px-4 py-2.5 rounded bg-primary text-white text-xs font-medium hover:bg-primary-hover active:scale-95 transition touch-target"
            @click="emit('retry')"
          >
            重试
          </button>
        </div>
      </div>
    </div>

    <!-- 画布区域：展示所有海报 -->
    <div v-else class="flex-1 min-h-0 overflow-hidden">
      <div class="relative h-full bg-canvas">
        <div ref="canvasEl" class="h-full w-full overflow-hidden p-3 sm:p-4 md:p-6" @click="handleCanvasClick">
          <div v-if="hasVersions" ref="panzoomEl" class="inline-flex items-start gap-3 sm:gap-4 md:gap-6">
            <!-- 海报卡片 -->
            <PosterCard
              v-for="version in versions"
              :key="version.versionId"
              :version-no="version.versionNo"
              :preview-url="getPreviewUrl(version.versionId)"
              :is-selected="selectedPosterId === version.versionId"
              :is-latest="version.versionId === latestVersionId"
              @select="emit('selectPoster', version.versionId)"
            />
          </div>

          <!-- 暂无海报 -->
          <div v-else class="h-full flex items-center justify-center">
            <p class="text-xs text-muted">暂无海报</p>
          </div>

          <!-- 预览加载遮罩 -->
          <div
            v-if="isPreviewLoading"
            class="panzoom-exclude absolute inset-0 bg-surface/40 backdrop-blur-sm flex items-center justify-center pointer-events-none"
          >
            <div class="text-center">
              <LoadingSpinner size="md" class="mx-auto text-muted" />
              <p class="mt-2 text-xs text-muted">加载海报中…</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
