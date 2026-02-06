import { BusinessError } from "../base/business-error-base";
export class AiChatServiceError extends BusinessError {
  constructor(message: string, cause?: unknown) {
    super(message, "AI_CHAT_SERVICE_ERROR", true, { module: "ai-chat" }, cause);
  }
}
