import { BaseRouter } from "../base/base-router";
import { jwtAuth } from "../../middleware/jwt-auth";
import { validate } from "../../middleware/validation";
import { geocodeSchema } from "../../schemas/geocode-schemas";
import { GeocodeController } from "../../controllers/business/geocode-controller";
export class GeocodeRouter extends BaseRouter {
  constructor(private readonly controller: GeocodeController) {
    super("/geocode");
  }
  protected initializeRoutes(): void {
    this.router.post("/", jwtAuth(), validate(geocodeSchema), (req, res) => this.controller.geocode(req, res));
  }
}
