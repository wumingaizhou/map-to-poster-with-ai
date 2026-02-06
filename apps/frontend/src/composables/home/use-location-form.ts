import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { posterAlphaService } from "@/services/api-services";
import { handleError } from "@/shared/error-handler";
import { ApiHttpError } from "@/api/api-client/errors";
import { BaseError } from "@/shared/errors";
import type { PosterCategory } from "@/types/posters";
import type { PosterThemeMetaDTO } from "@/api/api-resources/themes/themes-dto";
import type { GeocodeCandidateDTO } from "@/api/api-resources/geocode/geocode-dto";
export function useLocationForm() {
  const router = useRouter();
  const locationQuery = ref("");
  const category = ref<PosterCategory>("greenSpaces");
  const themes = ref<PosterThemeMetaDTO[]>([]);
  const baseThemeId = ref<string>("");
  const themesLoading = ref(false);
  const themesError = ref<string | null>(null);
  const geocodeLoading = ref(false);
  const geocodeError = ref<string | null>(null);
  const candidates = ref<GeocodeCandidateDTO[]>([]);
  const createSessionLoading = ref(false);
  const createSessionError = ref<string | null>(null);
  const canStart = computed(() => {
    return (
      !!locationQuery.value.trim() &&
      !!baseThemeId.value &&
      !themesLoading.value &&
      !geocodeLoading.value &&
      !createSessionLoading.value
    );
  });
  function getBackendErrorCode(error: unknown): string | undefined {
    const httpError =
      error instanceof ApiHttpError
        ? error
        : error instanceof BaseError && error.cause instanceof ApiHttpError
          ? error.cause
          : null;
    if (!httpError) return undefined;
    const body = httpError.responseBody;
    if (!body || typeof body !== "object") return undefined;
    const err = "error" in body ? (body as any).error : undefined;
    if (!err || typeof err !== "object") return undefined;
    const code = (err as any).code;
    return typeof code === "string" && code ? code : undefined;
  }
  function resetCandidates(): void {
    candidates.value = [];
    geocodeError.value = null;
    createSessionError.value = null;
  }
  async function loadThemesByCategory(target: PosterCategory): Promise<void> {
    themesLoading.value = true;
    themesError.value = null;
    try {
      const result = await posterAlphaService.listThemesByCategory(target);
      if (category.value !== target) return;
      themes.value = result.themes;
      baseThemeId.value = result.defaultThemeId;
    } catch (error) {
      if (category.value !== target) return;
      themesError.value = "主题列表加载失败，请重试";
      handleError(error, { customMessage: "加载主题列表失败" });
    } finally {
      if (category.value === target) {
        themesLoading.value = false;
      }
    }
  }
  async function createSessionFromCandidate(candidate: GeocodeCandidateDTO): Promise<void> {
    if (createSessionLoading.value) return;
    const query = locationQuery.value.trim();
    if (!query) {
      createSessionError.value = "请输入地名后再继续";
      return;
    }
    if (!baseThemeId.value) {
      createSessionError.value = "请先选择基础主题";
      return;
    }
    createSessionLoading.value = true;
    createSessionError.value = null;
    try {
      const result = await posterAlphaService.createSession({
        locationQuery: query,
        candidate,
        category: category.value,
        baseThemeId: baseThemeId.value
      });
      await router.push({ name: "editor", params: { sessionId: result.sessionId } });
    } catch (error) {
      createSessionError.value = "首版生成失败，请重试";
      handleError(error, { customMessage: "首版生成失败" });
    } finally {
      createSessionLoading.value = false;
    }
  }
  async function startGeocode(): Promise<void> {
    if (geocodeLoading.value || createSessionLoading.value) return;
    const query = locationQuery.value.trim();
    if (!query) {
      geocodeError.value = "请输入地名（例如：New York / 西湖）";
      return;
    }
    if (!baseThemeId.value) {
      geocodeError.value = "主题列表尚未就绪，请稍后再试";
      return;
    }
    geocodeLoading.value = true;
    geocodeError.value = null;
    candidates.value = [];
    createSessionError.value = null;
    let autoCandidate: GeocodeCandidateDTO | null = null;
    try {
      const result = await posterAlphaService.geocode(query);
      candidates.value = result;
      if (result.length === 1) {
        autoCandidate = result[0] ?? null;
      }
    } catch (error) {
      const code = getBackendErrorCode(error);
      if (code === "GEOCODE_NO_RESULT") {
        geocodeError.value = "未找到匹配地点，请尝试更具体的关键词（可重试）";
      } else {
        geocodeError.value = "地点解析失败，请稍后重试";
      }
      handleError(error, { customMessage: "地点解析失败" });
    } finally {
      geocodeLoading.value = false;
    }
    if (autoCandidate) {
      await createSessionFromCandidate(autoCandidate);
    }
  }
  return {
    locationQuery,
    category,
    themes: computed(() => themes.value),
    baseThemeId,
    themesLoading: computed(() => themesLoading.value),
    themesError: computed(() => themesError.value),
    geocodeLoading: computed(() => geocodeLoading.value),
    geocodeError: computed(() => geocodeError.value),
    candidates: computed(() => candidates.value),
    createSessionLoading: computed(() => createSessionLoading.value),
    createSessionError: computed(() => createSessionError.value),
    canStart,
    loadThemesByCategory,
    startGeocode,
    createSessionFromCandidate,
    resetCandidates
  };
}
