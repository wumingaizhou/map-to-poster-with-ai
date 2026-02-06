import { z } from "zod";
import { POSTER_CATEGORIES } from "../types/posters/poster-category";
export const listThemesSchema = z.object({
  query: z.object({
    category: z.enum(POSTER_CATEGORIES)
  })
});
