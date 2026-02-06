import { z } from "zod";
import { POSTER_CATEGORIES } from "./poster-category";
export const posterContextSchema = z
  .object({
    category: z.enum(POSTER_CATEGORIES),
    displayName: z.string().trim().min(1).max(200),
    baseThemeId: z.string().trim().min(1).max(100),
    selectedVersionNo: z.number().int().positive(),
    latestVersionNo: z.number().int().positive()
  })
  .strict();
export type PosterContext = z.infer<typeof posterContextSchema>;
