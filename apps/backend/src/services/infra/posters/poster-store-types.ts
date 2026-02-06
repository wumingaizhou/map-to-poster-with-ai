import type { BBox } from "../osm/bbox";
import type { PosterCategory } from "../../../types/posters/poster-category";
import type { AiThemeOverride } from "../../../types/posters/ai-theme-override";
export type PosterSessionRecord = {
  sessionId: string;
  resourceId: string;
  category: PosterCategory;
  baseThemeId: string;
  locationQuery: string;
  displayName: string;
  bbox: BBox;
  placeId: string;
  osmType?: "node" | "way" | "relation";
  osmId?: string;
  createdAt: string;
};
export type PosterVersionRecord = {
  versionId: string;
  sessionId: string;
  resourceId: string;
  versionNo: number;
  createdAt: string;
  aiThemeOverride: AiThemeOverride;
};
