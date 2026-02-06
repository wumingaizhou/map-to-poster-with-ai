import type { BBox, PosterCategory } from "@/types/posters";
export type CreatePosterSessionRequestDTO = {
  locationQuery: string;
  displayName: string;
  bbox: BBox;
  placeId: string;
  osmType?: "node" | "way" | "relation";
  osmId?: string;
  category: PosterCategory;
  baseThemeId: string;
};
export type CreatePosterSessionResponseDTO = {
  sessionId: string;
  category: PosterCategory;
  baseThemeId: string;
  latestVersion: {
    versionId: string;
    versionNo: number;
    createdAt: string;
  };
};
export type PosterVersionMetaDTO = {
  versionId: string;
  versionNo: number;
  createdAt: string;
};
export type ListPosterVersionsResponseDTO = {
  sessionId: string;
  session: {
    category: PosterCategory;
    baseThemeId: string;
    displayName: string;
  };
  versions: PosterVersionMetaDTO[];
  latestVersionId: string;
};
