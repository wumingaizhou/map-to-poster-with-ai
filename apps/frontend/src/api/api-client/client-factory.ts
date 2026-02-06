import type { ApiClientConfig } from "./types";
import { ApiClient } from "./api-client";
import { apiConfig } from "@/config";
import { getAuthToken } from "@/services/auth/auth-session";
const DEFAULT_CONFIG: Required<Pick<ApiClientConfig, "baseUrl" | "timeoutMs" | "defaultHeaders">> = {
  baseUrl: apiConfig.baseUrl,
  timeoutMs: apiConfig.timeoutMs,
  defaultHeaders: {}
};
let _defaultApiClient: ApiClient | null = null;
export function getDefaultApiClient(): ApiClient {
  if (!_defaultApiClient) {
    _defaultApiClient = createApiClient();
  }
  return _defaultApiClient;
}
export function setDefaultApiClient(client: ApiClient | null): void {
  _defaultApiClient = client;
}
export const defaultApiClient: ApiClient = new Proxy({} as ApiClient, {
  get(_target, prop) {
    return Reflect.get(getDefaultApiClient(), prop);
  }
});
export function createApiClient(config?: Partial<ApiClientConfig>): ApiClient {
  const client = new ApiClient({
    ...DEFAULT_CONFIG,
    ...config
  });
  client.interceptors.request.use(async ctx => {
    const token = await getAuthToken();
    const headers = ctx.init.headers;
    if (headers instanceof Headers) {
      headers.set("Authorization", `Bearer ${token}`);
    } else {
      (ctx.init.headers as Record<string, string> | undefined) ??= {};
      (ctx.init.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
    return ctx;
  });
  return client;
}
export function createApiClientWithInterceptors(
  config: Partial<ApiClientConfig> | undefined,
  setupInterceptors: (client: ApiClient) => void
): ApiClient {
  const client = createApiClient(config);
  setupInterceptors(client);
  return client;
}
