import { computed, ref } from "vue";
import { posterAlphaService } from "@/services/api-services";
import { handleError } from "@/shared/error-handler";
export type DownloadFileNameBuilder = () => string;
export function useDownloadManager() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  function parseContentDispositionFilename(contentDisposition: string | null): string | null {
    if (!contentDisposition) return null;
    const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      const decoded = decodeURIComponent(utf8Match[1].trim());
      return decoded || null;
    }
    const filenameMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"/i);
    if (filenameMatch?.[1]) return filenameMatch[1].trim() || null;
    const plainMatch = contentDisposition.match(/filename\s*=\s*([^;]+)/i);
    if (plainMatch?.[1]) return plainMatch[1].trim().replace(/^"|"$/g, "") || null;
    return null;
  }
  async function downloadPng(versionId: string, fallbackFileName: string): Promise<void> {
    if (!versionId || loading.value) return;
    loading.value = true;
    error.value = null;
    try {
      const { blob, contentDisposition } = await posterAlphaService.downloadPngBlob(versionId);
      const fileName = parseContentDispositionFilename(contentDisposition) ?? fallbackFileName;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      error.value = "下载失败，请重试";
      handleError(err, { customMessage: "下载 PNG 失败" });
    } finally {
      loading.value = false;
    }
  }
  function clearError(): void {
    error.value = null;
  }
  return {
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    downloadPng,
    clearError
  };
}
