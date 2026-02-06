import type { ApiClient } from "@/api/api-client/api-client";
import { ApiResource } from "../base/api-resource-base";
import type { GeocodeRequestDTO, GeocodeResultDTO } from "./geocode-dto";
import type { ApiResponse } from "../_utils/api-response";
import { unwrapApiResponse } from "../_utils/api-response";
export class GeocodeResource extends ApiResource {
  private readonly basePath = "/geocode";
  constructor(apiClient: ApiClient) {
    super(apiClient);
  }
  async geocode(request: GeocodeRequestDTO): Promise<GeocodeResultDTO> {
    const res = await this.post<ApiResponse<GeocodeResultDTO>>(this.basePath, request);
    return unwrapApiResponse(res, { endpoint: "POST /geocode" });
  }
}
