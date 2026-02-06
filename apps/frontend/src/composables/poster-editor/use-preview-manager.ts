import { computed, onBeforeUnmount, ref } from "vue";
import { posterAlphaService } from "@/services/api-services";
import { handleError } from "@/shared/error-handler";
export function usePreviewManager() {
  const previewUrl = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let currentController: AbortController | null = null;
  async function loadPreview(versionId: string): Promise<void> {
    if (!versionId) return;
    currentController?.abort();
    const controller = new AbortController();
    currentController = controller;
    loading.value = true;
    error.value = null;
    try {
      const { blob } = await posterAlphaService.downloadPngBlob(versionId, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const nextUrl = URL.createObjectURL(blob);
      const prevUrl = previewUrl.value;
      previewUrl.value = nextUrl;
      if (prevUrl) URL.revokeObjectURL(prevUrl);
    } catch (err) {
      if (controller.signal.aborted) return;
      error.value = "预览加载失败";
      handleError(err, { customMessage: "加载 PNG 预览失败" });
    } finally {
      if (currentController === controller) {
        loading.value = false;
        currentController = null;
      }
    }
  }
  function cleanup(): void {
    currentController?.abort();
    currentController = null;
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = null;
    }
  }
  function clearError(): void {
    error.value = null;
  }
  onBeforeUnmount(cleanup);
  return {
    previewUrl: computed(() => previewUrl.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    loadPreview,
    cleanup,
    clearError
  };
}
