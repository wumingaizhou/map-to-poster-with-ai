import { BaseRouter } from "../base/base-router";
import { jwtAuth } from "../../middleware/jwt-auth";
import { validate } from "../../middleware/validation";
import {
  createPosterSessionSchema,
  deletePosterVersionSchema,
  downloadPosterPngSchema,
  downloadPosterPreviewSchema,
  listPosterVersionsSchema
} from "../../schemas/posters-schemas";
import { PostersController } from "../../controllers/business/posters-controller";
export class PostersRouter extends BaseRouter {
  constructor(private readonly controller: PostersController) {
    super("/posters");
  }
  protected initializeRoutes(): void {
    this.router.post("/sessions", jwtAuth(), validate(createPosterSessionSchema), (req, res) =>
      this.controller.createSession(req, res)
    );
    this.router.get("/sessions/:sessionId/versions", jwtAuth(), validate(listPosterVersionsSchema), (req, res) =>
      this.controller.listVersions(req, res)
    );
    this.router.get("/versions/:versionId/assets/png", jwtAuth(), validate(downloadPosterPngSchema), (req, res) =>
      this.controller.downloadPng(req, res)
    );
    this.router.get(
      "/versions/:versionId/assets/preview",
      jwtAuth(),
      validate(downloadPosterPreviewSchema),
      (req, res) => this.controller.downloadPreview(req, res)
    );
    this.router.delete(
      "/sessions/:sessionId/versions/:versionId",
      jwtAuth(),
      validate(deletePosterVersionSchema),
      (req, res) => this.controller.deleteVersion(req, res)
    );
  }
}
