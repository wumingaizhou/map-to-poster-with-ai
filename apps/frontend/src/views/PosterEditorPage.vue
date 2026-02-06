<script setup lang="ts">
import { PosterEditorLayout, PosterCanvas, DownloadFab } from "@/components/poster-editor";
import BackToHomeButton from "@/components/common/atoms/BackToHomeButton.vue";
import AiChatPanelContainer from "@/components/ai-chat/containers/AiChatPanelContainer.vue";

import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";

import type { SSEEvent } from "@/types/ai-chat/sse-types";
import {
  useVersionManager,
  useDownloadManager,
  useMultiPreviewManager,
  watchVersionsForPreview,
  usePosterContext
} from "@/composables/poster-editor";

const props = defineProps<{
  sessionId: string;
}>();

const router = useRouter();

// ==================== Composables ====================
const versionManager = useVersionManager();
const downloadManager = useDownloadManager();
const previewManager = useMultiPreviewManager();

const selectedPosterId = ref<string | null>(null);

const posterContext = usePosterContext({
  sessionMeta: versionManager.sessionMeta,
  versions: versionManager.versions,
  latestVersionId: versionManager.latestVersionId,
  selectedPosterId
});

const canDownload = computed(() => !!selectedPosterId.value && !downloadManager.loading.value);

// ==================== Event Handlers ====================

function handleSelectPoster(versionId: string): void {
  selectedPosterId.value = selectedPosterId.value === versionId ? null : versionId;
}

function handleDeselectPoster(): void {
  selectedPosterId.value = null;
}

function handleRetry(): void {
  void versionManager.loadVersions(props.sessionId);
}

async function handleDownload(): Promise<void> {
  if (!selectedPosterId.value) return;
  await downloadManager.downloadPng(selectedPosterId.value, posterContext.buildFallbackFileName());
}

function backToHome(): void {
  void router.push({ name: "home" });
}

const handleAiSseEvent = (event: SSEEvent) => {
  if (event.type !== "tool-result") return;

  const payload = event.payload;
  const toolName =
    payload && typeof payload === "object" && "toolName" in payload ? (payload as any).toolName : undefined;
  if (toolName && toolName !== "posterIterateStyle") return;

  void versionManager.loadVersions(props.sessionId);
};

// ==================== Watchers ====================

watch(
  () => props.sessionId,
  () => {
    previewManager.cleanup();
    selectedPosterId.value = null;
    versionManager.reset();
    void versionManager.loadVersions(props.sessionId);
  },
  { immediate: true }
);

watchVersionsForPreview(
  computed(() => versionManager.versions.value),
  previewManager
);

// ==================== Cleanup ====================
onBeforeUnmount(() => {
  previewManager.cleanup();
});
</script>

<template>
  <PosterEditorLayout>
    <template #right-panel>
      <AiChatPanelContainer
        title="地图海报设计助手"
        :thread-id="props.sessionId"
        :build-user-message="posterContext.buildAiUserMessage"
        :on-sse-event="handleAiSseEvent"
      />
    </template>

    <template #topbar-actions>
      <BackToHomeButton
        :is-disabled="versionManager.loading.value || downloadManager.loading.value"
        @click="backToHome"
      />
    </template>

    <PosterCanvas
      :versions="versionManager.versions.value"
      :has-versions="versionManager.hasVersions.value"
      :is-loading="versionManager.loading.value"
      :error="versionManager.error.value"
      :selected-poster-id="selectedPosterId"
      :latest-version-id="versionManager.latestVersionId.value"
      :is-preview-loading="previewManager.loading.value"
      :preview-urls="previewManager.previews.value"
      @select-poster="handleSelectPoster"
      @deselect-poster="handleDeselectPoster"
      @retry="handleRetry"
    />

    <template #fab>
      <DownloadFab
        :can-download="canDownload"
        :is-loading="downloadManager.loading.value"
        :error="downloadManager.error.value"
        @download="handleDownload"
      />
    </template>
  </PosterEditorLayout>
</template>
