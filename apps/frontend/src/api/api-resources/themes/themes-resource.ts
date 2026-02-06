import type { ApiClient } from "@/api/api-client/api-client";
import { ApiResource } from "../base/api-resource-base";
import type { PosterCategory } from "@/types/posters";
import { toQueryString } from "../_utils/query-string";
import type { ListThemesByCategoryResultDTO } from "./themes-dto";
import type { ApiResponse } from "../_utils/api-response";
import { unwrapApiResponse } from "../_utils/api-response";
export class ThemesResource extends ApiResource {
  private readonly basePath = "/themes";
  constructor(apiClient: ApiClient) {
    super(apiClient);
  }
  async listThemesByCategory(category: PosterCategory): Promise<ListThemesByCategoryResultDTO> {
    const qs = toQueryString({ category });
    const res = await this.get<ApiResponse<ListThemesByCategoryResultDTO>>(this.basePath + qs);
    return unwrapApiResponse(res, { endpoint: "GET /themes" });
  }
}
