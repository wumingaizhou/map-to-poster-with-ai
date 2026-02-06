import path from "path";
import fs from "fs/promises";
import { config } from "../../../config/env";
import { ServiceUnavailableError, ThemeNotFoundError } from "../../../errors/app-error";
import type { PosterCategory } from "../../../types/posters/poster-category";
import { posterThemeSchema, type PosterTheme, type PosterThemeMeta } from "../../../types/posters/poster-theme";
const DEFAULT_THEME_ID_BY_CATEGORY: Record<PosterCategory, string> = {
  greenSpaces: "system-greenSpaces-v1",
  roadNetwork: "system-roadNetwork-v1",
  buildings: "system-buildings-v1",
  water: "system-water-v1"
};
export type ListThemesByCategoryResult = {
  category: PosterCategory;
  defaultThemeId: string;
  themes: PosterThemeMeta[];
};
export class PosterThemeRepository {
  private loaded = false;
  private readonly themesById = new Map<string, PosterTheme>();
  private readonly metasByCategory = new Map<PosterCategory, PosterThemeMeta[]>();
  private getSystemThemesDir(): string {
    return path.join(config.runtimeAssets.dir, "themes-v1", "system");
  }
  private async loadIfNeeded(): Promise<void> {
    if (this.loaded) return;
    const dir = this.getSystemThemesDir();
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch (error) {
      throw new ServiceUnavailableError(`Theme assets directory not available: ${dir}`);
    }
    const jsonFiles = entries.filter(name => name.toLowerCase().endsWith(".json"));
    if (jsonFiles.length === 0) {
      throw new ServiceUnavailableError(`No system theme json found under: ${dir}`);
    }
    for (const file of jsonFiles) {
      const fullPath = path.join(dir, file);
      let raw: string;
      try {
        raw = await fs.readFile(fullPath, "utf-8");
      } catch (error) {
        throw new ServiceUnavailableError(`Failed to read theme file: ${fullPath}`);
      }
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch (error) {
        throw new ServiceUnavailableError(`Theme file is not valid JSON: ${fullPath}`);
      }
      const parsed = posterThemeSchema.safeParse(json);
      if (!parsed.success) {
        throw new ServiceUnavailableError(`Theme file schema invalid: ${fullPath}`);
      }
      const theme = parsed.data;
      this.themesById.set(theme.id, theme);
      const metas = this.metasByCategory.get(theme.category) ?? [];
      metas.push({ id: theme.id, name: theme.name, description: theme.description, category: theme.category });
      this.metasByCategory.set(theme.category, metas);
    }
    for (const [category, metas] of this.metasByCategory.entries()) {
      metas.sort((a, b) => a.id.localeCompare(b.id));
      this.metasByCategory.set(category, metas);
    }
    this.loaded = true;
  }
  async getThemeById(themeId: string): Promise<PosterTheme> {
    await this.loadIfNeeded();
    const theme = this.themesById.get(themeId);
    if (!theme) throw new ThemeNotFoundError(`Theme not found: ${themeId}`);
    return theme;
  }
  async getDefaultThemeId(category: PosterCategory): Promise<string> {
    await this.loadIfNeeded();
    const defaultThemeId = DEFAULT_THEME_ID_BY_CATEGORY[category];
    const theme = this.themesById.get(defaultThemeId);
    if (!theme || theme.category !== category) {
      throw new ThemeNotFoundError(`Default theme not found or category mismatch for: ${category}`);
    }
    return defaultThemeId;
  }
  async listThemesByCategory(category: PosterCategory): Promise<ListThemesByCategoryResult> {
    await this.loadIfNeeded();
    const themes = this.metasByCategory.get(category) ?? [];
    if (themes.length === 0) {
      throw new ThemeNotFoundError(`No themes found for category: ${category}`);
    }
    const defaultThemeId = await this.getDefaultThemeId(category);
    return { category, defaultThemeId, themes };
  }
}
