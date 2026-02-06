import { BaseUseCase } from "../../../usecases/base/base-usecase";
import { AiChatService } from "../../../services/business/ai-chat-service";
import { StreamSessionEventsInputDTO, StreamSessionEventsSubscriptionDTO } from "../../../types/ai-chat/ai-chat-dto";
export class StreamSessionEventsUseCase extends BaseUseCase<
  StreamSessionEventsInputDTO,
  StreamSessionEventsSubscriptionDTO
> {
  constructor(private readonly aiChatService: AiChatService) {
    super("StreamSessionEvents");
  }
  async execute(input: StreamSessionEventsInputDTO): Promise<StreamSessionEventsSubscriptionDTO> {
    const options = input.lastEventId ? { lastEventId: input.lastEventId } : undefined;
    const { missedEvents, unsubscribe } = this.aiChatService.subscribeToSessionEventsWithReplay(
      input.sessionId,
      input.callback,
      options
    );
    this.log("Session events stream started", {
      sessionKey: input.sessionId,
      lastEventId: input.lastEventId,
      missedCount: missedEvents.length
    });
    return { missedEvents, unsubscribe };
  }
  async getEventsSince(sessionKey: string, lastEventId: string): Promise<Array<{ id: string; event: unknown }>> {
    this.log("Getting events since last ID", { sessionKey, lastEventId });
    return this.aiChatService.getEventsSince(sessionKey, lastEventId);
  }
}
