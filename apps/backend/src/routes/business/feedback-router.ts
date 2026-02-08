import { BaseRouter } from "../base/base-router";
import { jwtAuth } from "../../middleware/jwt-auth";
import { validate } from "../../middleware/validation";
import { submitFeedbackSchema } from "../../schemas/feedback-schemas";
import { FeedbackController } from "../../controllers/business/feedback-controller";
export class FeedbackRouter extends BaseRouter {
  constructor(private readonly controller: FeedbackController) {
    super("/feedback");
  }
  protected initializeRoutes(): void {
    this.router.post("/", jwtAuth(), validate(submitFeedbackSchema), (req, res) =>
      this.controller.submitFeedback(req, res)
    );
  }
}
