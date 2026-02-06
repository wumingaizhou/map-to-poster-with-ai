import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { ThemeOverrideInvalidError } from "../../errors/app-error";
import { postersRuntime } from "../../runtime/posters-runtime";
import { aiThemePatchSchema } from "../../types/posters/ai-theme-override";
import { normalizePosterFontKey } from "../../services/infra/poster-svg-renderer/poster-fonts";
function toCamelCaseKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return trimmed;
  if (!trimmed.includes("_") && !trimmed.includes("-")) return trimmed;
  const parts = trimmed
    .split(/[_-]+/g)
    .map(p => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return trimmed;
  return `${parts[0]}${parts
    .slice(1)
    .map(p => (p.length > 0 ? p[0]!.toUpperCase() + p.slice(1) : ""))
    .join("")}`;
}
function resolvePaletteKey(rawKey: string, basePaletteKeys: string[]): string | undefined {
  const normalized = toCamelCaseKey(rawKey);
  if (!normalized) return undefined;
  if (basePaletteKeys.includes(normalized)) return normalized;
  const lower = normalized.toLowerCase();
  return basePaletteKeys.find(k => k.toLowerCase() === lower);
}
function normalizePalettePatch(
  palette: Record<string, string>,
  basePalette: Record<string, string>
): { normalized: Record<string, string>; appliedCount: number; unknownKeys: string[] } {
  const baseKeys = Object.keys(basePalette);
  const out: Record<string, string> = {};
  let appliedCount = 0;
  const unknownKeys: string[] = [];
  const aliasMap: Record<string, string[]> = {
    background: ["bg", "gradient"],
    water: ["waterFill", "waterStroke"],
    parks: ["parkFill", "parkStroke"],
    park: ["parkFill", "parkStroke"],
    buildings: ["buildingFill", "buildingStroke"],
    building: ["buildingFill", "buildingStroke"],
    roads: ["roadMajor", "roadMedium", "roadMinor"],
    road: ["roadMajor", "roadMedium", "roadMinor"]
  };
  for (const [rawKey, value] of Object.entries(palette)) {
    const direct = resolvePaletteKey(rawKey, baseKeys);
    if (direct) {
      out[direct] = value;
      appliedCount += 1;
      continue;
    }
    const aliasTargets = aliasMap[rawKey.trim().toLowerCase()];
    if (!aliasTargets) {
      unknownKeys.push(rawKey);
      continue;
    }
    let aliasApplied = false;
    for (const target of aliasTargets) {
      const resolved = resolvePaletteKey(target, baseKeys);
      if (!resolved) continue;
      out[resolved] = value;
      appliedCount += 1;
      aliasApplied = true;
    }
    if (!aliasApplied) unknownKeys.push(rawKey);
  }
  return { normalized: out, appliedCount, unknownKeys };
}
export const posterIterateStyle = createTool({
  id: "posterIterateStyle",
  description: "Iterate poster style by applying an AI theme patch and creating a new poster version",
  inputSchema: aiThemePatchSchema,
  outputSchema: z.object({
    newVersion: z.object({
      versionId: z.string().min(1),
      versionNo: z.number().int().positive(),
      createdAt: z.string().min(1)
    })
  }),
  execute: async (patch, context) => {
    const threadId = context.agent?.threadId;
    const resourceId = context.agent?.resourceId;
    if (!threadId || !resourceId) {
      throw new Error("Missing agent execution context: threadId/resourceId");
    }
    if (!patch.palette && !patch.tuning && !patch.typography) {
      throw new ThemeOverrideInvalidError("Empty aiThemePatch: no palette/tuning/typography changes");
    }
    const session = await postersRuntime.sessionStore.getSession(resourceId, threadId);
    const baseTheme = await postersRuntime.themeRepository.getThemeById(session.baseThemeId);
    const normalizedPalette = patch.palette ? normalizePalettePatch(patch.palette, baseTheme.palette) : undefined;
    const normalizedTypography = patch.typography
      ? {
          ...patch.typography,
          ...(patch.typography.fontFamily ? { fontFamily: normalizePosterFontKey(patch.typography.fontFamily) } : {})
        }
      : undefined;
    const normalizedPatch = {
      ...patch,
      ...(normalizedPalette?.normalized ? { palette: normalizedPalette.normalized } : {}),
      ...(normalizedTypography ? { typography: normalizedTypography } : {})
    };
    if (patch.palette && normalizedPalette?.unknownKeys && normalizedPalette.unknownKeys.length > 0) {
      const knownKeys = Object.keys(baseTheme.palette).sort();
      const unknownKeys = normalizedPalette.unknownKeys.map(k => k.trim()).filter(Boolean);
      throw new ThemeOverrideInvalidError(
        `Unknown palette key(s) in aiThemePatch.palette: ${unknownKeys.join(", ")}; known keys: ${knownKeys.join(", ")}`
      );
    }
    if (patch.palette && (!normalizedPalette?.normalized || Object.keys(normalizedPalette.normalized).length === 0)) {
      const knownKeys = Object.keys(baseTheme.palette).sort();
      throw new ThemeOverrideInvalidError(
        `Unknown palette key(s) in aiThemePatch.palette; known keys: ${knownKeys.join(", ")}`
      );
    }
    return postersRuntime.postersService.iterateStyle(resourceId, threadId, normalizedPatch);
  }
});
