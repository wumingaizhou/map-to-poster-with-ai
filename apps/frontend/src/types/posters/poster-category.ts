export const POSTER_CATEGORIES = ["greenSpaces", "roadNetwork", "buildings", "water"] as const;

export type PosterCategory = (typeof POSTER_CATEGORIES)[number];

export const POSTER_CATEGORY_LABELS: Record<PosterCategory, string> = {
  greenSpaces: "绿地",
  roadNetwork: "道路",
  buildings: "建筑",
  water: "水系"
};
