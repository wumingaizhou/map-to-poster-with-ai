import type { PosterCategory } from "../../types/posters/poster-category";
import type { PosterThemeMeta } from "../../types/posters/poster-theme";
import { PosterThemeRepository, type ListThemesByCategoryResult } from "../infra/theme/poster-theme-repository";
export class ThemesService {
  constructor(private readonly posterThemeRepository: PosterThemeRepository) {}
  async listThemesByCategory(category: PosterCategory): Promise<ListThemesByCategoryResult> {
    return this.posterThemeRepository.listThemesByCategory(category);
  }
  async getThemeMeta(themeId: string): Promise<PosterThemeMeta> {
    const theme = await this.posterThemeRepository.getThemeById(themeId);
    return { id: theme.id, name: theme.name, description: theme.description, category: theme.category };
  }
}
