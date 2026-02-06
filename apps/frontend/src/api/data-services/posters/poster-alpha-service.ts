import { DataService, type ErrorContext } from "../base/data-service-base";
import type { BusinessError } from "../base/business-error-base";
import type { PosterCategory } from "@/types/posters";
import type { GeocodeCandidateDTO } from "@/api/api-resources/geocode/geocode-dto";
import type { GeocodeResource } from "@/api/api-resources/geocode/geocode-resource";
import type { ThemesResource } from "@/api/api-resources/themes/themes-resource";
import type { PostersResource } from "@/api/api-resources/posters/posters-resource";
import type { ListThemesByCategoryResultDTO } from "@/api/api-resources/themes/themes-dto";
import type { CreatePosterSessionResponseDTO } from "@/api/api-resources/posters/posters-dto";
import type { ListPosterVersionsResponseDTO } from "@/api/api-resources/posters/posters-dto";
export class PosterAlphaService extends DataService {
  constructor(
    private readonly geocodeResource: GeocodeResource,
    private readonly themesResource: ThemesResource,
    private readonly postersResource: PostersResource
  ) {
    super({ logToConsole: false });
  }
  async listThemesByCategory(category: PosterCategory): Promise<ListThemesByCategoryResultDTO> {
    try {
      return await this.themesResource.listThemesByCategory(category);
    } catch (error) {
      throw this.toBusinessError(error, { operation: "listThemesByCategory", metadata: { category } });
    }
  }
  async geocode(locationQuery: string): Promise<GeocodeCandidateDTO[]> {
    try {
      const result = await this.geocodeResource.geocode({ locationQuery });
      return result.candidates;
    } catch (error) {
      throw this.toBusinessError(error, { operation: "geocode", metadata: { locationQuery } });
    }
  }
  async createSession(options: {
    locationQuery: string;
    candidate: GeocodeCandidateDTO;
    category: PosterCategory;
    baseThemeId: string;
  }): Promise<CreatePosterSessionResponseDTO> {
    const { locationQuery, candidate, category, baseThemeId } = options;
    try {
      return await this.postersResource.createSession({
        locationQuery,
        displayName: candidate.displayName,
        bbox: candidate.bbox,
        placeId: candidate.placeId,
        osmType: candidate.osmType,
        osmId: candidate.osmId,
        category,
        baseThemeId
      });
    } catch (error) {
      throw this.toBusinessError(error, {
        operation: "createSession",
        metadata: { category, baseThemeId, placeId: candidate.placeId }
      });
    }
  }
  async listSessionVersions(sessionId: string): Promise<ListPosterVersionsResponseDTO> {
    try {
      return await this.postersResource.listSessionVersions(sessionId);
    } catch (error) {
      throw this.toBusinessError(error, { operation: "listSessionVersions", metadata: { sessionId } });
    }
  }
  async downloadPngBlob(
    versionId: string,
    options?: { signal?: AbortSignal }
  ): Promise<{ blob: Blob; contentDisposition: string | null }> {
    try {
      return await this.postersResource.downloadPngBlob(versionId, options);
    } catch (error) {
      throw this.toBusinessError(error, { operation: "downloadPngBlob", metadata: { versionId } });
    }
  }
  protected override mapToDomainError(error: unknown, context?: ErrorContext): BusinessError | null {
    if (error instanceof Error) {
      return this.unexpected(`[posters] ${context?.operation ?? "operation"} failed: ${error.message}`, error);
    }
    return null;
  }
}
