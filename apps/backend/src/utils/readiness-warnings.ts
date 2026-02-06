import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import { config } from "../config/env";
const REQUIRED_POSTER_TTF_FILES = ["ma-shan-zheng/MaShanZheng-Regular.ttf"] as const;
const OPTIONAL_POSTER_TTF_FILES = [
  "zcool-kuaile/ZCOOLKuaiLe-Regular.ttf",
  "zhi-mang-xing/ZhiMangXing-Regular.ttf"
] as const;
function formatWarning(code: string, message: string): string {
  return `${code}: ${message}`;
}
async function listJsonFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter(e => e.isFile() && e.name.toLowerCase().endsWith(".json")).map(e => e.name);
}
async function getThemeWarnings(warnings: string[]): Promise<void> {
  const dir = path.join(config.runtimeAssets.dir, "themes-v1", "system");
  try {
    await fs.access(dir, fsConstants.R_OK);
    const jsonFiles = await listJsonFiles(dir);
    if (jsonFiles.length === 0) {
      warnings.push(formatWarning("THEME_ASSETS_UNAVAILABLE", "No system theme *.json found under themes-v1/system"));
    }
  } catch {
    warnings.push(formatWarning("THEME_ASSETS_UNAVAILABLE", "System theme assets are missing or not readable"));
  }
}
async function getRequiredFontsWarnings(warnings: string[]): Promise<void> {
  const baseDir = path.join(config.runtimeAssets.dir, "fonts");
  const missing: string[] = [];
  for (const relativePath of REQUIRED_POSTER_TTF_FILES) {
    try {
      await fs.access(path.join(baseDir, ...relativePath.split("/")), fsConstants.R_OK);
    } catch {
      missing.push(relativePath);
    }
  }
  if (missing.length > 0) {
    warnings.push(formatWarning("REQUIRED_FONTS_MISSING", `Missing required poster .ttf files: ${missing.join(", ")}`));
  }
}
async function getOptionalFontsWarnings(warnings: string[]): Promise<void> {
  const baseDir = path.join(config.runtimeAssets.dir, "fonts");
  const missing: string[] = [];
  for (const relativePath of OPTIONAL_POSTER_TTF_FILES) {
    try {
      await fs.access(path.join(baseDir, ...relativePath.split("/")), fsConstants.R_OK);
    } catch {
      missing.push(relativePath);
    }
  }
  if (missing.length > 0) {
    warnings.push(
      formatWarning("POSTER_FONTS_MISSING", `Missing optional poster font .ttf files: ${missing.join(", ")}`)
    );
  }
}
async function getPosterAssetsWarnings(warnings: string[]): Promise<void> {
  const dir = config.posters.assetsDir;
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.access(dir, fsConstants.W_OK);
  } catch {
    warnings.push(formatWarning("POSTER_ASSETS_DIR_UNWRITABLE", "Poster assets directory is not writable"));
  }
}
export async function getReadinessWarnings(): Promise<string[]> {
  const warnings: string[] = [];
  await Promise.all([
    getThemeWarnings(warnings),
    getRequiredFontsWarnings(warnings),
    getOptionalFontsWarnings(warnings),
    getPosterAssetsWarnings(warnings)
  ]);
  return warnings.filter(w => /^[A-Z0-9_]+: .+/.test(w));
}
