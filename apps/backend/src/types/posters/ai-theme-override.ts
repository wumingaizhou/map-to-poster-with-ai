import { z } from "zod";
const zHexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const zOpacity = z.number().finite().min(0).max(1);
const zHeightPct = z.number().finite().min(0).max(0.1);
const zStrokeWidthPt = z.number().finite().positive();
const zGradientFadesTuning = z
  .object({
    enabled: z.boolean().optional(),
    heightPct: zHeightPct.optional()
  })
  .strict();
const zLayerOpacitiesTuning = z
  .object({
    water: zOpacity.optional(),
    parks: zOpacity.optional(),
    buildings: zOpacity.optional()
  })
  .strict();
const zRoadCasingTuning = z
  .object({
    enabled: z.boolean().optional(),
    strokeWidthAddPt: zStrokeWidthPt.optional(),
    opacity: zOpacity.optional()
  })
  .strict();
const zRoadClassTuning = z
  .object({
    strokeWidthPt: zStrokeWidthPt.optional(),
    opacity: zOpacity.optional()
  })
  .strict();
const zRoadsTuning = z
  .object({
    casing: zRoadCasingTuning.optional(),
    major: zRoadClassTuning.optional(),
    medium: zRoadClassTuning.optional(),
    minor: zRoadClassTuning.optional()
  })
  .strict();
const zTypographyOverride = z
  .object({
    fontFamily: z.string().min(1).optional(),
    preset: z.enum(["top", "bottom"]).optional(),
    titleColor: zHexColor.optional(),
    subtitleColor: zHexColor.optional(),
    coordsColor: zHexColor.optional()
  })
  .strict();
export const aiThemeOverrideSchema = z
  .object({
    kind: z.literal("aiThemeOverride"),
    version: z.number().int().finite(),
    baseThemeId: z.string().min(1),
    palette: z.record(zHexColor).optional(),
    tuning: z
      .object({
        gradientFades: zGradientFadesTuning.optional(),
        layerOpacities: zLayerOpacitiesTuning.optional(),
        roads: zRoadsTuning.optional()
      })
      .strict()
      .optional(),
    typography: zTypographyOverride.optional()
  })
  .strict();
export type AiThemeOverride = z.infer<typeof aiThemeOverrideSchema>;
export const aiThemePatchSchema = z
  .object({
    palette: z.record(zHexColor).optional(),
    tuning: z
      .object({
        gradientFades: zGradientFadesTuning.optional(),
        layerOpacities: zLayerOpacitiesTuning.optional(),
        roads: zRoadsTuning.optional()
      })
      .strict()
      .optional(),
    typography: zTypographyOverride.optional()
  })
  .strict();
export type AiThemePatch = z.infer<typeof aiThemePatchSchema>;
