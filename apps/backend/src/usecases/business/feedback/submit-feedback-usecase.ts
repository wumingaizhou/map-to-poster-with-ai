import { BaseUseCase } from "../../base/base-usecase";
import { FeedbackService, type FeedbackDTO } from "../../../services/business/feedback-service";

export class SubmitFeedbackUseCase extends BaseUseCase<FeedbackDTO, { message: string }> {
  constructor(private readonly feedbackService: FeedbackService) {
    super("SubmitFeedback");
  }

  async execute(input: FeedbackDTO): Promise<{ message: string }> {
    await this.feedbackService.submitFeedback(input);
    return { message: "反馈已提交" };
  }
}
