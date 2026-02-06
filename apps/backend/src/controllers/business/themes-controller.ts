import type { Request, Response } from "express";
import { BaseController } from "../base/base-controller";
import { ListThemesUseCase } from "../../usecases/business/themes/list-themes-usecase";
import type { PosterCategory } from "../../types/posters/poster-category";
export class ThemesController extends BaseController {
  constructor(private readonly listThemesUseCase: ListThemesUseCase) {
    super("ThemesController");
  }
  async listThemes(req: Request, res: Response): Promise<Response> {
    const category = (req.query as { category: PosterCategory }).category;
    const result = await this.listThemesUseCase.execute({ category });
    res.setHeader("Cache-Control", "no-store");
    return this.success(res, result);
  }
}
