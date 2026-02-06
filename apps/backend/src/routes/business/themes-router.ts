import { BaseRouter } from "../base/base-router";
import { jwtAuth } from "../../middleware/jwt-auth";
import { validate } from "../../middleware/validation";
import { listThemesSchema } from "../../schemas/themes-schemas";
import { ThemesController } from "../../controllers/business/themes-controller";
export class ThemesRouter extends BaseRouter {
  constructor(private readonly controller: ThemesController) {
    super("/themes");
  }
  protected initializeRoutes(): void {
    this.router.get("/", jwtAuth(), validate(listThemesSchema), (req, res) => this.controller.listThemes(req, res));
  }
}
