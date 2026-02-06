import type { ApiClient } from "../../api-client/api-client";
import type { ZodType } from "zod";
import type {
  RequestInterceptorContext,
  RequestOptions,
  StreamResponseInterceptorContext
} from "../../api-client/types";
import { ApiAbortError, ApiHttpError, ApiNetworkError, ApiTimeoutError } from "../../api-client/errors";
import { mergeHeaders } from "../../api-client/header-utils";
import { createTimeoutController } from "../../api-client/timeout-utils";
import { apiConfig } from "@/config";
export interface StreamRequestOptions {
  connectionTimeoutMs?: number;
  signal?: AbortSignal;
}
interface RequestWithSchemaOptions<T> {
  headers?: Record<string, string>;
  schema?: ZodType<T>;
}
export abstract class ApiResource {
  protected readonly apiClient: ApiClient;
  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }
  public getBaseUrl(): string {
    return this.apiClient.getBaseUrl();
  }
  protected get<T>(path: string, options?: RequestWithSchemaOptions<T>): Promise<T> {
    return this.apiClient.request<T>({
      method: "GET",
      path,
      headers: options?.headers,
      schema: options?.schema
    });
  }
  protected post<T>(path: string, body: unknown, options?: RequestWithSchemaOptions<T>): Promise<T> {
    return this.apiClient.request<T>({
      method: "POST",
      path,
      body,
      headers: options?.headers,
      schema: options?.schema
    });
  }
  protected put<T>(path: string, body: unknown, options?: RequestWithSchemaOptions<T>): Promise<T> {
    return this.apiClient.request<T>({
      method: "PUT",
      path,
      body,
      headers: options?.headers,
      schema: options?.schema
    });
  }
  protected patch<T>(path: string, body: unknown, options?: RequestWithSchemaOptions<T>): Promise<T> {
    return this.apiClient.request<T>({
      method: "PATCH",
      path,
      body,
      headers: options?.headers,
      schema: options?.schema
    });
  }
  protected delete<T>(path: string, options?: RequestWithSchemaOptions<T>): Promise<T> {
    return this.apiClient.request<T>({
      method: "DELETE",
      path,
      headers: options?.headers,
      schema: options?.schema
    });
  }
  protected async postStream(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
    options?: StreamRequestOptions
  ): Promise<ReadableStream<Uint8Array>> {
    const url = this.apiClient.getBaseUrl() + path;
    const connectionTimeoutMs = options?.connectionTimeoutMs ?? apiConfig.connectionTimeoutMs;
    const { signal, clearTimeoutTimer, cleanup, isTimedOut } = createTimeoutController({
      timeoutMs: connectionTimeoutMs,
      parentSignal: options?.signal
    });
    const mergedHeaders = mergeHeaders(this.apiClient.getDefaultHeaders(), headers, {
      "Content-Type": "application/json",
      Accept: "text/event-stream"
    });
    const init: RequestInit = {
      method: "POST",
      headers: mergedHeaders,
      body: JSON.stringify(body),
      signal
    };
    const requestOptions: RequestOptions = {
      method: "POST",
      path,
      headers: mergedHeaders,
      body
    };
    let requestContext: RequestInterceptorContext = { url, options: requestOptions, init };
    const interceptors = this.apiClient.getInterceptors();
    for (const interceptor of interceptors.request) {
      requestContext = await interceptor(requestContext);
    }
    try {
      const response = await fetch(requestContext.url, requestContext.init);
      if (!response.ok) {
        const responseBody = await response.text().catch(() => undefined);
        throw new ApiHttpError({
          status: response.status,
          message: `HTTP error: ${response.status}`,
          responseBody
        });
      }
      if (!response.body) {
        throw new ApiHttpError({
          status: response.status,
          message: "Response body is null"
        });
      }
      clearTimeoutTimer();
      const streamResponseContext: StreamResponseInterceptorContext = {
        url: requestContext.url,
        options: requestOptions,
        response,
        isStream: true
      };
      for (const interceptor of interceptors.response) {
        await interceptor(streamResponseContext);
      }
      const responseBody = response.body;
      const reader = responseBody.getReader();
      let cleanedUp = false;
      const cleanupOnce = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        cleanup();
      };
      return new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              cleanupOnce();
              controller.close();
              return;
            }
            if (value) {
              controller.enqueue(value);
            }
          } catch (err) {
            cleanupOnce();
            controller.error(err);
          }
        },
        cancel(reason) {
          cleanupOnce();
          return reader.cancel(reason);
        }
      });
    } catch (e) {
      cleanup();
      for (const errorInterceptor of interceptors.error) {
        try {
          await errorInterceptor(e as Error, { url: requestContext.url, options: requestOptions });
        } catch (interceptorError) {
          console.warn("[ApiResource] Error interceptor threw:", interceptorError);
        }
      }
      if (e instanceof ApiAbortError || e instanceof ApiTimeoutError || e instanceof ApiHttpError) {
        throw e;
      }
      if (isTimedOut()) {
        throw new ApiTimeoutError(`Connection timeout after ${connectionTimeoutMs}ms`, e);
      }
      if (options?.signal?.aborted) {
        throw new ApiAbortError("Stream request aborted", e);
      }
      throw new ApiNetworkError("Network error during stream request", e);
    }
  }
  protected getEventSource(path: string, lastEventId?: string): EventSource {
    const safePath = this.normalizePath(path);
    const fullUrl = `${this.apiClient.getBaseUrl().replace(/\/+$/, "")}${safePath}`;
    const url = new URL(fullUrl, window.location.origin);
    if (lastEventId) {
      url.searchParams.append("lastEventId", lastEventId);
    }
    return new EventSource(url.toString());
  }
  private normalizePath(path: string): string {
    const trimmed = path.trim();
    if (!trimmed) return "/";
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) || trimmed.startsWith("//")) {
      throw new Error(`[api-resource] Absolute URL is not allowed in path: "${trimmed}"`);
    }
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }
}
