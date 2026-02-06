import { z } from "zod";
import { POSTER_CATEGORIES } from "./poster-category";
const zHexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const zTokenRef = z.string().regex(/^\$[A-Za-z0-9_]+$/);
const zMaybeTokenOrHex = z.union([zHexColor, zTokenRef]);
const zPageViewBox = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive()
});
const zPosterPage = z.object({
  widthIn: z.number().finite().positive(),
  heightIn: z.number().finite().positive(),
  unit: z.literal("pt"),
  viewBox: zPageViewBox
});
const zPolygonStyle = z.object({
  fill: zMaybeTokenOrHex,
  fillOpacity: z.number().finite().min(0).max(1),
  stroke: zMaybeTokenOrHex.nullable(),
  strokeOpacity: z.number().finite().min(0).max(1),
  strokeWidthPt: z.number().finite().min(0)
});
const zRoadClassStyle = z.object({
  stroke: zMaybeTokenOrHex,
  strokeWidthPt: z.number().finite().positive(),
  opacity: z.number().finite().min(0).max(1)
});
const zRoadClass = z.enum(["major", "medium", "minor"]);
const zRoadsLayer = z.object({
  enabled: z.boolean(),
  zIndex: z.number().finite(),
  lineCap: z.enum(["butt", "round", "square"]),
  lineJoin: z.enum(["miter", "round", "bevel"]),
  casing: z.object({
    enabled: z.boolean(),
    stroke: zMaybeTokenOrHex,
    strokeWidthAddPt: z.number().finite().min(0),
    opacity: z.number().finite().min(0).max(1)
  }),
  classes: z.object({
    major: zRoadClassStyle,
    medium: zRoadClassStyle,
    minor: zRoadClassStyle
  }),
  mapping: z.record(zRoadClass),
  defaultClass: zRoadClass
});
const zGradientFades = z.object({
  enabled: z.boolean(),
  zIndex: z.number().finite(),
  color: zMaybeTokenOrHex,
  top: z.object({
    heightPct: z.number().finite().min(0).max(0.1),
    fromOpacity: z.number().finite().min(0).max(1),
    toOpacity: z.number().finite().min(0).max(1)
  }),
  bottom: z.object({
    heightPct: z.number().finite().min(0).max(0.1),
    fromOpacity: z.number().finite().min(0).max(1),
    toOpacity: z.number().finite().min(0).max(1)
  })
});
const zTypographyPreset = z.enum(["top", "bottom"]);
const zTypographyBlock = z.object({
  enabled: z.boolean(),
  fontWeight: z.number().int().finite(),
  fontSizePt: z.number().finite().positive(),
  letterSpacingPt: z.number().finite().optional(),
  transform: z.enum(["uppercase", "none"]),
  color: zMaybeTokenOrHex,
  opacity: z.number().finite().min(0).max(1)
});
const zTypographyLayout = z.object({
  xPct: z.number().finite().min(0).max(1),
  yPct: z.number().finite().min(0).max(1),
  anchor: z.enum(["start", "middle", "end"])
});
const zTypographyLayouts = z.object({
  title: zTypographyLayout.optional(),
  subtitle: zTypographyLayout.optional(),
  coords: zTypographyLayout.optional(),
  attribution: zTypographyLayout.optional()
});
const zTypography = z.object({
  fontFamily: z.string().min(1),
  preset: zTypographyPreset,
  blocks: z.object({
    title: zTypographyBlock,
    subtitle: zTypographyBlock,
    coords: zTypographyBlock,
    attribution: zTypographyBlock
  }),
  layouts: z.object({
    top: zTypographyLayouts,
    bottom: zTypographyLayouts
  })
});
const zDividerDecoration = z.object({
  enabled: z.boolean(),
  zIndex: z.number().finite(),
  stroke: zMaybeTokenOrHex,
  strokeOpacity: z.number().finite().min(0).max(1),
  strokeWidthPt: z.number().finite().positive(),
  layouts: z.object({
    top: z.object({
      x1Pct: z.number().finite().min(0).max(1),
      x2Pct: z.number().finite().min(0).max(1),
      yPct: z.number().finite().min(0).max(1)
    }),
    bottom: z.object({
      x1Pct: z.number().finite().min(0).max(1),
      x2Pct: z.number().finite().min(0).max(1),
      yPct: z.number().finite().min(0).max(1)
    })
  })
});
export const posterThemeSchema = z
  .object({
    kind: z.literal("posterTheme"),
    version: z.number().int().finite(),
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    category: z.enum(POSTER_CATEGORIES),
    page: zPosterPage,
    palette: z.record(zHexColor),
    background: z.object({
      fill: zMaybeTokenOrHex
    }),
    effects: z
      .object({
        gradientFades: zGradientFades.optional()
      })
      .optional(),
    layers: z.object({
      water: z.object({
        enabled: z.boolean(),
        zIndex: z.number().finite(),
        polygon: zPolygonStyle
      }),
      parks: z.object({
        enabled: z.boolean(),
        zIndex: z.number().finite(),
        polygon: zPolygonStyle
      }),
      buildings: z.object({
        enabled: z.boolean(),
        zIndex: z.number().finite(),
        polygon: zPolygonStyle
      }),
      roads: zRoadsLayer
    }),
    typography: zTypography,
    decorations: z
      .object({
        divider: zDividerDecoration.optional()
      })
      .optional()
  })
  .passthrough();
export type PosterTheme = z.infer<typeof posterThemeSchema>;
export type PosterThemeMeta = Pick<PosterTheme, "id" | "name" | "description" | "category">;
