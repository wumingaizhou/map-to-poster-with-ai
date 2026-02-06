import type { PosterCategory } from "@/types/posters";
export type PosterThemeMetaDTO = {
  id: string;
  name: string;
  description: string;
  category: PosterCategory;
};
export type ListThemesByCategoryResultDTO = {
  category: PosterCategory;
  defaultThemeId: string;
  themes: PosterThemeMetaDTO[];
};
