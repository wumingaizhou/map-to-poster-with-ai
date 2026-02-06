import { AiChatService } from "@/api/data-services/ai-chat/ai-chat-service";
import { AiChatResource } from "@/api/api-resources/ai-chat/ai-chat-resource";
import type { ApiClient } from "@/api/api-client/api-client";
import { defaultApiClient } from "@/api/api-client/client-factory";
import { PosterAlphaService } from "@/api/data-services/posters/poster-alpha-service";
import { GeocodeResource } from "@/api/api-resources/geocode/geocode-resource";
import { ThemesResource } from "@/api/api-resources/themes/themes-resource";
import { PostersResource } from "@/api/api-resources/posters/posters-resource";
export function createAiChatService(client: ApiClient = defaultApiClient): AiChatService {
  const resource = new AiChatResource(client);
  return new AiChatService(resource);
}
export const aiChatService = createAiChatService();
export function createPosterAlphaService(client: ApiClient = defaultApiClient): PosterAlphaService {
  const geocodeResource = new GeocodeResource(client);
  const themesResource = new ThemesResource(client);
  const postersResource = new PostersResource(client);
  return new PosterAlphaService(geocodeResource, themesResource, postersResource);
}
export const posterAlphaService = createPosterAlphaService();
