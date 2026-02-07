import { z } from "zod";
import { POSTER_CATEGORIES } from "../types/posters/poster-category";
const bboxSchema = z.tuple([z.number().finite(), z.number().finite(), z.number().finite(), z.number().finite()]);
const positiveIntStringSchema = z.preprocess(
  val => {
    if (val === "" || val === undefined) return undefined;
    if (typeof val === "number") return Number.isFinite(val) ? String(Math.trunc(val)) : val;
    if (typeof val === "string") return val.trim();
    return val;
  },
  z
    .string()
    .regex(/^\d+$/)
    .transform(s => s.replace(/^0+/, ""))
    .refine(s => s.length > 0, { message: "Expected a positive integer string" })
);
export const createPosterSessionSchema = z.object({
  body: z.object({
    locationQuery: z.string().trim().min(1).max(100),
    displayName: z.string().trim().min(1).max(200),
    bbox: bboxSchema,
    placeId: positiveIntStringSchema,
    osmType: z.preprocess(val => (val === "" ? undefined : val), z.enum(["node", "way", "relation"]).optional()),
    osmId: z.preprocess(val => (val === "" ? undefined : val), positiveIntStringSchema.optional()),
    category: z.enum(POSTER_CATEGORIES),
    baseThemeId: z.string().trim().min(1).max(100)
  })
});
export const listPosterVersionsSchema = z.object({
  params: z.object({
    sessionId: z.string().min(1)
  })
});
export const downloadPosterPngSchema = z.object({
  params: z.object({
    versionId: z.string().min(1)
  })
});
export const downloadPosterPreviewSchema = z.object({
  params: z.object({
    versionId: z.string().min(1)
  })
});
export const deletePosterVersionSchema = z.object({
  params: z.object({
    sessionId: z.string().min(1),
    versionId: z.string().min(1)
  })
});
