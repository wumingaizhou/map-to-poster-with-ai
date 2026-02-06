import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";
import { posterAlphaService } from "@/services/api-services";
import { handleError } from "@/shared/error-handler";
import type { PosterVersionMetaDTO } from "@/api/api-resources/posters/posters-dto";
export interface UseMultiPreviewManagerReturn {
  previews: Ref<Map<string, string>>;
  loading: Ref<boolean>;
  loadAllPreviews: (versions: PosterVersionMetaDTO[]) => Promise<void>;
  cleanup: () => void;
  getPreviewUrl: (versionId: string) => string | undefined;
}
export function useMultiPreviewManager(): UseMultiPreviewManagerReturn {
  const previews = ref<Map<string, string>>(new Map());
  const loading = ref(false);
  async function loadAllPreviews(versions: PosterVersionMetaDTO[]): Promise<void> {
    if (!versions.length) return;
    const toLoad = versions.filter(v => !previews.value.has(v.versionId));
    if (!toLoad.length) return;
    loading.value = true;
    try {
      await Promise.all(
        toLoad.map(async v => {
          try {
            const { blob } = await posterAlphaService.downloadPngBlob(v.versionId);
            const url = URL.createObjectURL(blob);
            previews.value.set(v.versionId, url);
          } catch (err) {
            handleError(err, { customMessage: `加载版本 v${v.versionNo} 预览失败` });
          }
        })
      );
    } finally {
      loading.value = false;
    }
  }
  function cleanup(): void {
    previews.value.forEach(url => URL.revokeObjectURL(url));
    previews.value.clear();
  }
  function getPreviewUrl(versionId: string): string | undefined {
    return previews.value.get(versionId);
  }
  onBeforeUnmount(cleanup);
  return {
    previews: computed(() => previews.value) as unknown as Ref<Map<string, string>>,
    loading: computed(() => loading.value) as unknown as Ref<boolean>,
    loadAllPreviews,
    cleanup,
    getPreviewUrl
  };
}
export function watchVersionsForPreview(
  versions: Ref<PosterVersionMetaDTO[]>,
  previewManager: UseMultiPreviewManagerReturn
): void {
  watch(
    () => versions.value,
    newVersions => {
      void previewManager.loadAllPreviews(newVersions);
    },
    { immediate: true }
  );
}
