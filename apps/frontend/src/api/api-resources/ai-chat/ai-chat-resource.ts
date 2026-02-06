import type { AiChatRequestDTO } from "./ai-chat-dto";
import type { ApiClient } from "../../api-client/api-client";
import { ApiResource, type StreamRequestOptions } from "../base/api-resource-base";
export class AiChatResource extends ApiResource {
  private readonly basePath = "/ai-chat";
  constructor(apiClient: ApiClient) {
    super(apiClient);
  }
  async chatStream(request: AiChatRequestDTO, options?: StreamRequestOptions): Promise<ReadableStream<Uint8Array>> {
    return this.postStream(this.basePath + "/stream", request, undefined, options);
  }
}
