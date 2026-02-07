import type { ApiClient } from "@/api/api-client/api-client";
import { ApiResource } from "../base/api-resource-base";
import type { ApiResponse } from "../_utils/api-response";
import { unwrapApiResponse } from "../_utils/api-response";
import type {
  CreatePosterSessionRequestDTO,
  CreatePosterSessionResponseDTO,
  ListPosterVersionsResponseDTO
} from "./posters-dto";
import { ApiAbortError, ApiHttpError, ApiNetworkError, ApiParseError } from "@/api/api-client/errors";
import { clearAuthToken, getAuthToken } from "@/services/auth/auth-session";
async function readJsonOrText(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  try {
    return await res.text();
  } catch {
    return undefined;
  }
}
function joinUrl(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return cleanBase + cleanPath;
}
export class PostersResource extends ApiResource {
  private readonly basePath = "/posters";
  constructor(apiClient: ApiClient) {
    super(apiClient);
  }
  async createSession(request: CreatePosterSessionRequestDTO): Promise<CreatePosterSessionResponseDTO> {
    const res = await this.post<ApiResponse<CreatePosterSessionResponseDTO>>(this.basePath + "/sessions", request);
    return unwrapApiResponse(res, { endpoint: "POST /posters/sessions" });
  }
  async listSessionVersions(sessionId: string): Promise<ListPosterVersionsResponseDTO> {
    const path = `${this.basePath}/sessions/${encodeURIComponent(sessionId)}/versions`;
    const res = await this.get<ApiResponse<ListPosterVersionsResponseDTO>>(path);
    return unwrapApiResponse(res, { endpoint: "GET /posters/sessions/:sessionId/versions" });
  }
  async downloadPngBlob(
    versionId: string,
    options?: { signal?: AbortSignal }
  ): Promise<{
    blob: Blob;
    contentDisposition: string | null;
  }> {
    const path = `${this.basePath}/versions/${encodeURIComponent(versionId)}/assets/png`;
    const url = joinUrl(this.getBaseUrl(), path);
    let retried401 = false;
    while (true) {
      try {
        const token = await getAuthToken();
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "image/png",
            Authorization: `Bearer ${token}`
          },
          signal: options?.signal,
          credentials: "same-origin"
        });
        if (res.status === 401 && !retried401 && !options?.signal?.aborted) {
          retried401 = true;
          clearAuthToken();
          continue;
        }
        if (!res.ok) {
          const body = await readJsonOrText(res);
          throw new ApiHttpError({ status: res.status, message: `HTTP error: ${res.status}`, responseBody: body });
        }
        let blob: Blob;
        try {
          blob = await res.blob();
        } catch (e) {
          throw new ApiParseError("Failed to read blob response body", e);
        }
        return {
          blob,
          contentDisposition: res.headers.get("content-disposition")
        };
      } catch (e) {
        if (e instanceof ApiHttpError || e instanceof ApiParseError) throw e;
        if (options?.signal?.aborted) throw new ApiAbortError("Request aborted", e);
        if (e instanceof Error && e.name === "AbortError") throw new ApiAbortError("Request aborted", e);
        throw new ApiNetworkError("Network error", e);
      }
    }
  }
  async downloadPreviewBlob(versionId: string, options?: { signal?: AbortSignal }): Promise<{ blob: Blob }> {
    const path = `${this.basePath}/versions/${encodeURIComponent(versionId)}/assets/preview`;
    const url = joinUrl(this.getBaseUrl(), path);
    let retried401 = false;
    while (true) {
      try {
        const token = await getAuthToken();
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "image/webp",
            Authorization: `Bearer ${token}`
          },
          signal: options?.signal,
          credentials: "same-origin"
        });
        if (res.status === 401 && !retried401 && !options?.signal?.aborted) {
          retried401 = true;
          clearAuthToken();
          continue;
        }
        if (!res.ok) {
          const body = await readJsonOrText(res);
          throw new ApiHttpError({ status: res.status, message: `HTTP error: ${res.status}`, responseBody: body });
        }
        let blob: Blob;
        try {
          blob = await res.blob();
        } catch (e) {
          throw new ApiParseError("Failed to read blob response body", e);
        }
        return { blob };
      } catch (e) {
        if (e instanceof ApiHttpError || e instanceof ApiParseError) throw e;
        if (options?.signal?.aborted) throw new ApiAbortError("Request aborted", e);
        if (e instanceof Error && e.name === "AbortError") throw new ApiAbortError("Request aborted", e);
        throw new ApiNetworkError("Network error", e);
      }
    }
  }
}
