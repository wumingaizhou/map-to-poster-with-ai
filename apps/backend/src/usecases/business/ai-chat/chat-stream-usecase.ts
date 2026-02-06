import { BaseUseCase } from "../../../usecases/base/base-usecase";
import { AiChatService } from "../../../services/business/ai-chat-service";
import type { AiChatRequestDTO, ChatStreamResultDTO } from "../../../types/ai-chat/ai-chat-dto";
export class ChatStreamUseCase extends BaseUseCase<AiChatRequestDTO, ChatStreamResultDTO> {
  constructor(private readonly aiChatService: AiChatService) {
    super("ChatStream");
  }
  async execute(request: AiChatRequestDTO): Promise<ChatStreamResultDTO> {
    this.log("Starting chat stream", { userMessageLength: request.userMessage.length });
    const result = await this.aiChatService.chatStream(request);
    this.log("Chat stream created", { threadId: result.threadId, resourceId: result.resourceId });
    return result;
  }
}
