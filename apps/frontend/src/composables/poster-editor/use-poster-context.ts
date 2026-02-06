import { computed, type Ref, type ComputedRef } from "vue";
import type { SessionMeta } from "./use-version-manager";
import type { PosterVersionMetaDTO } from "@/api/api-resources/posters/posters-dto";
export interface UsePosterContextOptions {
  sessionMeta: Ref<SessionMeta | null> | ComputedRef<SessionMeta | null>;
  versions: Ref<PosterVersionMetaDTO[]> | ComputedRef<PosterVersionMetaDTO[]>;
  latestVersionId: Ref<string> | ComputedRef<string>;
  selectedPosterId: Ref<string | null>;
}
export interface UsePosterContextReturn {
  buildFallbackFileName: () => string;
  buildPosterContext: () => string | null;
  buildAiUserMessage: (visibleText: string) => string;
}
export function usePosterContext(options: UsePosterContextOptions): UsePosterContextReturn {
  const { sessionMeta, versions, latestVersionId, selectedPosterId } = options;
  const latestVersionNo = computed(
    () => versions.value.find(v => v.versionId === latestVersionId.value)?.versionNo ?? null
  );
  function buildFallbackFileName(): string {
    const version = versions.value.find(v => v.versionId === selectedPosterId.value);
    const versionNo = version?.versionNo;
    return typeof versionNo === "number"
      ? `poster_v${versionNo}.png`
      : `poster_${selectedPosterId.value || "latest"}.png`;
  }
  function buildPosterContext(): string | null {
    const meta = sessionMeta.value;
    if (!meta) return null;
    const latestNo = latestVersionNo.value;
    if (typeof latestNo !== "number") return null;
    const payload = {
      category: meta.category,
      displayName: meta.displayName,
      baseThemeId: meta.baseThemeId,
      latestVersionNo: latestNo
    };
    return `\n\n【POSTER_CONTEXT】${JSON.stringify(payload)}【/POSTER_CONTEXT】`;
  }
  function buildAiUserMessage(visibleText: string): string {
    const block = buildPosterContext();
    return block ? visibleText + block : visibleText;
  }
  return {
    buildFallbackFileName,
    buildPosterContext,
    buildAiUserMessage
  };
}
