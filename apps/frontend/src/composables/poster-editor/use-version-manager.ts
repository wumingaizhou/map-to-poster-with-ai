import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { posterAlphaService } from "@/services/api-services";
import { handleError } from "@/shared/error-handler";
import { ApiHttpError } from "@/api/api-client/errors";
import type { PosterVersionMetaDTO } from "@/api/api-resources/posters/posters-dto";
import type { PosterCategory } from "@/types/posters";
export type SessionMeta = {
  category: PosterCategory;
  baseThemeId: string;
  displayName: string;
};
export function useVersionManager() {
  const router = useRouter();
  const versions = ref<PosterVersionMetaDTO[]>([]);
  const latestVersionId = ref<string>("");
  const selectedVersionId = ref<string>("");
  const sessionMeta = ref<SessionMeta | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedVersion = computed(() => versions.value.find(v => v.versionId === selectedVersionId.value) ?? null);
  const latestVersionNo = computed(
    () => versions.value.find(v => v.versionId === latestVersionId.value)?.versionNo ?? null
  );
  const hasVersions = computed(() => versions.value.length > 0);
  async function loadVersions(sessionId: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const result = await posterAlphaService.listSessionVersions(sessionId);
      versions.value = result.versions;
      latestVersionId.value = result.latestVersionId;
      selectedVersionId.value = result.latestVersionId;
      sessionMeta.value = result.session;
    } catch (err) {
      const apiError =
        err instanceof ApiHttpError
          ? err
          : err instanceof Error && "cause" in err && (err as any).cause instanceof ApiHttpError
            ? (err as any).cause
            : null;
      if (apiError?.status === 403) {
        void router.push({ name: "home" });
        return;
      }
      error.value = "版本列表加载失败";
      handleError(err, { customMessage: "加载版本列表失败" });
    } finally {
      loading.value = false;
    }
  }
  function selectVersion(versionId: string): void {
    selectedVersionId.value = versionId;
  }
  function reset(): void {
    versions.value = [];
    latestVersionId.value = "";
    selectedVersionId.value = "";
    sessionMeta.value = null;
    error.value = null;
  }
  return {
    versions: computed(() => versions.value),
    latestVersionId: computed(() => latestVersionId.value),
    selectedVersionId: computed(() => selectedVersionId.value),
    sessionMeta: computed(() => sessionMeta.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    selectedVersion,
    latestVersionNo,
    hasVersions,
    loadVersions,
    selectVersion,
    reset
  };
}
