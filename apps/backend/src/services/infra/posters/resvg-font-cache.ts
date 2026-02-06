import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import { config } from "../../../config/env";
import { createLogger } from "../../../utils/logger";
const log = createLogger("ResvgFontRuntime");
const REQUIRED_TTF_RELATIVE_PATHS = ["ma-shan-zheng/MaShanZheng-Regular.ttf"] as const;
type ResvgFontRuntime = {
  loadSystemFonts: boolean;
  fontFiles?: string[];
  defaultFontFamily?: string;
  sansSerifFamily?: string;
};
let cachedPromise: Promise<ResvgFontRuntime> | null = null;
export async function getResvgFontRuntime(): Promise<ResvgFontRuntime> {
  if (!cachedPromise) cachedPromise = buildResvgFontRuntime();
  return cachedPromise;
}
async function canReadFile(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}
async function listTtfFilesRecursively(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listTtfFilesRecursively(entryPath)));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".ttf")) {
      results.push(entryPath);
    }
  }
  return results;
}
async function buildResvgFontRuntime(): Promise<ResvgFontRuntime> {
  const runtimeAssetsDir = path.resolve(config.runtimeAssets.dir);
  const fontsDir = path.join(runtimeAssetsDir, "fonts");
  const missingRequired: string[] = [];
  for (const relativePath of REQUIRED_TTF_RELATIVE_PATHS) {
    const absPath = path.join(fontsDir, ...relativePath.split("/"));
    if (!(await canReadFile(absPath))) missingRequired.push(relativePath);
  }
  if (missingRequired.length > 0) {
    log.warn({ fontsDir, missingRequired }, "Required poster fonts missing, fallback to system fonts");
    return { loadSystemFonts: true };
  }
  try {
    const allTtfFiles = await listTtfFilesRecursively(fontsDir);
    const readableTtfFiles: string[] = [];
    for (const filePath of allTtfFiles) {
      if (await canReadFile(filePath)) readableTtfFiles.push(filePath);
    }
    readableTtfFiles.sort((a, b) => a.localeCompare(b));
    if (readableTtfFiles.length === 0) {
      log.warn({ fontsDir }, "No readable poster .ttf files found, fallback to system fonts");
      return { loadSystemFonts: true };
    }
    return {
      loadSystemFonts: false,
      fontFiles: readableTtfFiles,
      defaultFontFamily: "Ma Shan Zheng",
      sansSerifFamily: "Ma Shan Zheng"
    };
  } catch (error) {
    log.warn({ fontsDir, error }, "Runtime fonts dir is not readable, fallback to system fonts");
    return { loadSystemFonts: true };
  }
}
