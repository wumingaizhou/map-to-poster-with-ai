import { BaseRouter } from "../base/base-router";
import { AuthController } from "../../controllers/business/auth-controller";
import { jwtAuth } from "../../middleware/jwt-auth";
import { authSessionLimiter } from "../../middleware/rate-limit";
export class AuthRouter extends BaseRouter {
  constructor(private readonly controller: AuthController) {
    super("/auth");
  }
  protected initializeRoutes(): void {
    this.router.get("/session", authSessionLimiter, jwtAuth({ required: false, mode: "try" }), (req, res) =>
      this.controller.issueAnonymousSession(req, res)
    );
  }
}
