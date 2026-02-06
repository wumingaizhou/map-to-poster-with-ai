import { BaseUseCase } from "../../base/base-usecase";
import type { PosterCategory } from "../../../types/posters/poster-category";
import { ThemesService } from "../../../services/business/themes-service";
import type { ListThemesByCategoryResult } from "../../../services/infra/theme/poster-theme-repository";
export class ListThemesUseCase extends BaseUseCase<{ category: PosterCategory }, ListThemesByCategoryResult> {
  constructor(private readonly themesService: ThemesService) {
    super("ListThemes");
  }
  async execute(input: { category: PosterCategory }): Promise<ListThemesByCategoryResult> {
    return this.themesService.listThemesByCategory(input.category);
  }
}
