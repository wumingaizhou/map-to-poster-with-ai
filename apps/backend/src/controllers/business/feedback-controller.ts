import type { Request, Response } from "express";
import { BaseController } from "../base/base-controller";
import { SubmitFeedbackUseCase } from "../../usecases/business/feedback/submit-feedback-usecase";
export class FeedbackController extends BaseController {
  constructor(private readonly submitFeedbackUseCase: SubmitFeedbackUseCase) {
    super("FeedbackController");
  }
  async submitFeedback(req: Request, res: Response): Promise<Response> {
    const { type, content, contact } = req.body as {
      type: "suggestion" | "bug" | "other";
      content: string;
      contact: string;
    };
    const result = await this.submitFeedbackUseCase.execute({ type, content, contact });
    return this.created(res, result);
  }
}
