import { ThemeOverrideInvalidError } from "../../errors/app-error";
import {
  aiThemeOverrideSchema,
  aiThemePatchSchema,
  type AiThemeOverride,
  type AiThemePatch
} from "../../types/posters/ai-theme-override";
import type { PosterTheme } from "../../types/posters/poster-theme";
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function mergeOptionalObject<T extends Record<string, unknown>>(
  previous: T | undefined,
  patch: T | undefined
): T | undefined {
  if (!previous && !patch) return undefined;
  return { ...(previous ?? {}), ...(patch ?? {}) } as T;
}
function resolveTokenString(value: string, palette: Record<string, string>): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("$")) return value;
  const key = trimmed.slice(1);
  if (!key) throw new ThemeOverrideInvalidError("Theme token is empty");
  const resolved = palette[key];
  if (!resolved) {
    throw new ThemeOverrideInvalidError(`Theme token not found in palette: ${trimmed}`);
  }
  return resolved;
}
function resolveTokensDeep(value: unknown, palette: Record<string, string>): unknown {
  if (typeof value === "string") return resolveTokenString(value, palette);
  if (Array.isArray(value)) return value.map(v => resolveTokensDeep(v, palette));
  if (!isObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = resolveTokensDeep(v, palette);
  }
  return out;
}
export class ThemeOverrideService {
  parseAiThemeOverride(input: unknown): AiThemeOverride {
    const parsed = aiThemeOverrideSchema.safeParse(input);
    if (!parsed.success) {
      throw new ThemeOverrideInvalidError("Invalid aiThemeOverride schema");
    }
    return parsed.data;
  }
  parseAiThemePatch(input: unknown): AiThemePatch {
    const parsed = aiThemePatchSchema.safeParse(input);
    if (!parsed.success) {
      throw new ThemeOverrideInvalidError("Invalid aiThemePatch schema");
    }
    return parsed.data;
  }
  mergeAiThemePatch(params: {
    baseThemeId: string;
    patch: AiThemePatch;
    previousOverride?: AiThemeOverride;
  }): AiThemeOverride {
    const previous: AiThemeOverride = params.previousOverride ?? {
      kind: "aiThemeOverride",
      version: 1,
      baseThemeId: params.baseThemeId
    };
    if (previous.baseThemeId !== params.baseThemeId) {
      throw new ThemeOverrideInvalidError("baseThemeId mismatch");
    }
    const palette = mergeOptionalObject(previous.palette, params.patch.palette);
    const typography = mergeOptionalObject(previous.typography, params.patch.typography);
    const previousTuning = previous.tuning;
    const patchTuning = params.patch.tuning;
    const gradientFades = mergeOptionalObject(previousTuning?.gradientFades, patchTuning?.gradientFades);
    const layerOpacities = mergeOptionalObject(previousTuning?.layerOpacities, patchTuning?.layerOpacities);
    const previousRoads = previousTuning?.roads;
    const patchRoads = patchTuning?.roads;
    const casing = mergeOptionalObject(previousRoads?.casing, patchRoads?.casing);
    const major = mergeOptionalObject(previousRoads?.major, patchRoads?.major);
    const medium = mergeOptionalObject(previousRoads?.medium, patchRoads?.medium);
    const minor = mergeOptionalObject(previousRoads?.minor, patchRoads?.minor);
    const roads =
      casing || major || medium || minor
        ? {
            ...(casing ? { casing } : {}),
            ...(major ? { major } : {}),
            ...(medium ? { medium } : {}),
            ...(minor ? { minor } : {})
          }
        : undefined;
    const tuning =
      gradientFades || layerOpacities || roads
        ? {
            ...(gradientFades ? { gradientFades } : {}),
            ...(layerOpacities ? { layerOpacities } : {}),
            ...(roads ? { roads } : {})
          }
        : undefined;
    const next: AiThemeOverride = {
      kind: "aiThemeOverride",
      version: previous.version,
      baseThemeId: params.baseThemeId,
      ...(palette ? { palette } : {}),
      ...(tuning ? { tuning } : {}),
      ...(typography ? { typography } : {})
    };
    return this.parseAiThemeOverride(next);
  }
  applyOverride(baseTheme: PosterTheme, override: AiThemeOverride): PosterTheme {
    if (override.baseThemeId !== baseTheme.id) {
      throw new ThemeOverrideInvalidError("baseThemeId mismatch");
    }
    const mergedPalette = { ...baseTheme.palette, ...(override.palette ?? {}) };
    const next: PosterTheme = {
      ...baseTheme,
      palette: mergedPalette,
      typography: {
        ...baseTheme.typography,
        ...(override.typography?.fontFamily ? { fontFamily: override.typography.fontFamily } : {}),
        ...(override.typography?.preset ? { preset: override.typography.preset } : {}),
        blocks: {
          ...baseTheme.typography.blocks,
          title: {
            ...baseTheme.typography.blocks.title,
            ...(override.typography?.titleColor ? { color: override.typography.titleColor } : {})
          },
          subtitle: {
            ...baseTheme.typography.blocks.subtitle,
            ...(override.typography?.subtitleColor ? { color: override.typography.subtitleColor } : {})
          },
          coords: {
            ...baseTheme.typography.blocks.coords,
            ...(override.typography?.coordsColor ? { color: override.typography.coordsColor } : {})
          },
          attribution: { ...baseTheme.typography.blocks.attribution }
        }
      },
      layers: {
        ...baseTheme.layers,
        water: {
          ...baseTheme.layers.water,
          polygon: {
            ...baseTheme.layers.water.polygon,
            ...(override.tuning?.layerOpacities?.water !== undefined
              ? { fillOpacity: override.tuning.layerOpacities.water }
              : {})
          }
        },
        parks: {
          ...baseTheme.layers.parks,
          polygon: {
            ...baseTheme.layers.parks.polygon,
            ...(override.tuning?.layerOpacities?.parks !== undefined
              ? { fillOpacity: override.tuning.layerOpacities.parks }
              : {})
          }
        },
        buildings: {
          ...baseTheme.layers.buildings,
          polygon: {
            ...baseTheme.layers.buildings.polygon,
            ...(override.tuning?.layerOpacities?.buildings !== undefined
              ? { fillOpacity: override.tuning.layerOpacities.buildings }
              : {})
          }
        },
        roads: {
          ...baseTheme.layers.roads,
          casing: {
            ...baseTheme.layers.roads.casing,
            ...(override.tuning?.roads?.casing?.enabled !== undefined
              ? { enabled: override.tuning.roads.casing.enabled }
              : {}),
            ...(override.tuning?.roads?.casing?.strokeWidthAddPt !== undefined
              ? { strokeWidthAddPt: override.tuning.roads.casing.strokeWidthAddPt }
              : {}),
            ...(override.tuning?.roads?.casing?.opacity !== undefined
              ? { opacity: override.tuning.roads.casing.opacity }
              : {})
          },
          classes: {
            ...baseTheme.layers.roads.classes,
            major: {
              ...baseTheme.layers.roads.classes.major,
              ...(override.tuning?.roads?.major?.strokeWidthPt !== undefined
                ? { strokeWidthPt: override.tuning.roads.major.strokeWidthPt }
                : {}),
              ...(override.tuning?.roads?.major?.opacity !== undefined
                ? { opacity: override.tuning.roads.major.opacity }
                : {})
            },
            medium: {
              ...baseTheme.layers.roads.classes.medium,
              ...(override.tuning?.roads?.medium?.strokeWidthPt !== undefined
                ? { strokeWidthPt: override.tuning.roads.medium.strokeWidthPt }
                : {}),
              ...(override.tuning?.roads?.medium?.opacity !== undefined
                ? { opacity: override.tuning.roads.medium.opacity }
                : {})
            },
            minor: {
              ...baseTheme.layers.roads.classes.minor,
              ...(override.tuning?.roads?.minor?.strokeWidthPt !== undefined
                ? { strokeWidthPt: override.tuning.roads.minor.strokeWidthPt }
                : {}),
              ...(override.tuning?.roads?.minor?.opacity !== undefined
                ? { opacity: override.tuning.roads.minor.opacity }
                : {})
            }
          }
        }
      }
    };
    const hasGradient = Boolean(baseTheme.effects?.gradientFades);
    if (hasGradient) {
      const current = baseTheme.effects?.gradientFades;
      const tuning = override.tuning?.gradientFades;
      if (current && tuning) {
        next.effects = {
          ...(baseTheme.effects ?? {}),
          gradientFades: {
            ...current,
            ...(tuning.enabled !== undefined ? { enabled: tuning.enabled } : {}),
            ...(tuning.heightPct !== undefined
              ? {
                  top: { ...current.top, heightPct: tuning.heightPct },
                  bottom: { ...current.bottom, heightPct: tuning.heightPct }
                }
              : {})
          }
        };
      }
    }
    const resolved = resolveTokensDeep(next, mergedPalette) as PosterTheme;
    return resolved;
  }
  resolveSystemTheme(baseTheme: PosterTheme): PosterTheme {
    const resolved = resolveTokensDeep(baseTheme, baseTheme.palette) as PosterTheme;
    return resolved;
  }
}
