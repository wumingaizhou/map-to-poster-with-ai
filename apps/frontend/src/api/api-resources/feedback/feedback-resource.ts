import type { ApiClient } from "@/api/api-client/api-client";
import { ApiResource } from "../base/api-resource-base";
import type { ApiResponse } from "../_utils/api-response";
import { unwrapApiResponse } from "../_utils/api-response";
export interface SubmitFeedbackRequest {
  type: string;
  content: string;
  contact: string;
}
export class FeedbackResource extends ApiResource {
  private readonly basePath = "/feedback";
  constructor(apiClient: ApiClient) {
    super(apiClient);
  }
  async submitFeedback(request: SubmitFeedbackRequest): Promise<{ message: string }> {
    const res = await this.post<ApiResponse<{ message: string }>>(this.basePath, request);
    return unwrapApiResponse(res, { endpoint: "POST /feedback" });
  }
}
