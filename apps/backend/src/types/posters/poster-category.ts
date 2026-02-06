export const POSTER_CATEGORIES = ["greenSpaces", "roadNetwork", "buildings", "water"] as const;
export type PosterCategory = (typeof POSTER_CATEGORIES)[number];
