import { BaseRouter } from "../base/base-router";
import { AiChatController } from "../../controllers/business/ai-chat-controller";
import { aiChatLimiter, sseLimiter } from "../../middleware/rate-limit";
import { sseConnectionLimit } from "../../middleware/sse-connection-limit";
import { jwtAuth } from "../../middleware/jwt-auth";
import { validate } from "../../middleware/validation";
import { chatStreamSchema, streamSessionEventsSchema } from "../../schemas/ai-chat-schemas";
export class AiChatRouter extends BaseRouter {
  constructor(private readonly controller: AiChatController) {
    super("/ai-chat");
  }
  protected initializeRoutes(): void {
    this.router.post("/stream", aiChatLimiter, jwtAuth(), validate(chatStreamSchema), (req, res) =>
      this.controller.chatStream(req, res)
    );
    this.router.get(
      "/events/:threadId/stream",
      sseLimiter,
      jwtAuth(),
      validate(streamSessionEventsSchema),
      sseConnectionLimit(),
      (req, res) => this.controller.streamSessionEvents(req, res)
    );
  }
}
