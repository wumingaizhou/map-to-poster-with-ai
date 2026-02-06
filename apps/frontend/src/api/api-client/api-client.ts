import { ZodError } from "zod";
import type {
  ApiClientConfig,
  RequestOptions,
  Interceptors,
  RequestInterceptor,
  ResponseInterceptor,
  ErrorInterceptor,
  RequestInterceptorContext,
  ResponseInterceptorContext,
  RequestId,
  ActiveRequest
} from "./types";
import {
  ApiAbortError,
  ApiHttpError,
  ApiNetworkError,
  ApiParseError,
  ApiTimeoutError,
  ApiValidationError
} from "./errors";
import { setHeaderIfAbsent, mergeHeaders } from "./header-utils";
import { createTimeoutController } from "./timeout-utils";
import { apiConfig, httpStatus } from "@/config";
import { clearAuthToken } from "@/services/auth/auth-session";
export class ApiClient {
  protected readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly onInterceptorError?: (
    error: unknown,
    context: { interceptorType: "request" | "response" | "error" }
  ) => void;
  private readonly _interceptors: Interceptors = {
    request: [],
    response: [],
    error: []
  };
  private readonly activeRequests: Map<RequestId, ActiveRequest> = new Map();
  private requestCounter = 0;
  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = config.timeoutMs ?? apiConfig.timeoutMs;
    this.defaultHeaders = config.defaultHeaders ?? {};
    this.onInterceptorError = config.onInterceptorError;
  }
  public getBaseUrl(): string {
    return this.baseUrl;
  }
  public getDefaultHeaders(): Record<string, string> {
    return { ...this.defaultHeaders };
  }
  public getInterceptors(): Readonly<Interceptors> {
    return this._interceptors;
  }
  get interceptors(): {
    request: {
      use: (interceptor: RequestInterceptor) => () => void;
      clear: () => void;
    };
    response: {
      use: (interceptor: ResponseInterceptor) => () => void;
      clear: () => void;
    };
    error: {
      use: (interceptor: ErrorInterceptor) => () => void;
      clear: () => void;
    };
  } {
    return {
      request: {
        use: (interceptor: RequestInterceptor) => {
          this._interceptors.request.push(interceptor);
          return () => {
            const index = this._interceptors.request.indexOf(interceptor);
            if (index > -1) this._interceptors.request.splice(index, 1);
          };
        },
        clear: () => {
          this._interceptors.request.length = 0;
        }
      },
      response: {
        use: (interceptor: ResponseInterceptor) => {
          this._interceptors.response.push(interceptor);
          return () => {
            const index = this._interceptors.response.indexOf(interceptor);
            if (index > -1) this._interceptors.response.splice(index, 1);
          };
        },
        clear: () => {
          this._interceptors.response.length = 0;
        }
      },
      error: {
        use: (interceptor: ErrorInterceptor) => {
          this._interceptors.error.push(interceptor);
          return () => {
            const index = this._interceptors.error.indexOf(interceptor);
            if (index > -1) this._interceptors.error.splice(index, 1);
          };
        },
        clear: () => {
          this._interceptors.error.length = 0;
        }
      }
    };
  }
  async request<T>(options: RequestOptions<T>): Promise<T> {
    const normalizedPath = this.normalizePath(options.path);
    const url = this.baseUrl + normalizedPath;
    let retried401 = false;
    while (true) {
      const requestId = this.generateRequestId();
      options.onRequestId?.(requestId);
      const { signal, timeoutController, cleanup, isTimedOut } = createTimeoutController({
        timeoutMs: this.timeoutMs,
        parentSignal: options.signal
      });
      const activeRequest: ActiveRequest = {
        id: requestId,
        controller: timeoutController,
        url,
        startTime: Date.now()
      };
      this.activeRequests.set(requestId, activeRequest);
      const headers = mergeHeaders(this.defaultHeaders, options.headers);
      const init: RequestInit = {
        method: options.method,
        headers,
        signal,
        credentials: "same-origin"
      };
      if (options.body !== undefined) {
        init.body = JSON.stringify(options.body);
        setHeaderIfAbsent(headers, "Content-Type", "application/json");
      }
      setHeaderIfAbsent(headers, "Accept", "application/json");
      try {
        let requestContext: RequestInterceptorContext = { url, options, init };
        for (const interceptor of this._interceptors.request) {
          requestContext = await interceptor(requestContext);
        }
        const response = await fetch(requestContext.url, requestContext.init);
        const contentType = response.headers.get("content-type") ?? "";
        const hasJson = contentType.includes("application/json");
        let parsedBody: unknown;
        try {
          if (response.status !== httpStatus.NO_CONTENT) {
            parsedBody = hasJson ? await response.json() : await response.text();
          }
        } catch (e) {
          throw new ApiParseError("Failed to parse response body", e);
        }
        if (!response.ok) {
          throw new ApiHttpError({
            status: response.status,
            message: `HTTP error: ${response.status}`,
            responseBody: parsedBody
          });
        }
        let responseContext: ResponseInterceptorContext = {
          url: requestContext.url,
          options,
          response,
          body: parsedBody
        };
        for (const interceptor of this._interceptors.response) {
          responseContext = (await interceptor(responseContext)) as ResponseInterceptorContext;
        }
        if (options.schema) {
          try {
            return options.schema.parse(responseContext.body) as T;
          } catch (e) {
            if (e instanceof ZodError) {
              throw new ApiValidationError("Response validation failed", e.errors, responseContext.body);
            }
            throw e;
          }
        }
        return responseContext.body as T;
      } catch (error) {
        if (
          !retried401 &&
          error instanceof ApiHttpError &&
          error.status === 401 &&
          normalizedPath !== "/auth/session" &&
          !options.signal?.aborted
        ) {
          retried401 = true;
          clearAuthToken();
          continue;
        }
        for (const interceptor of this._interceptors.error) {
          try {
            await interceptor(error as Error, { url, options });
          } catch (interceptorError) {
            console.warn("[ApiClient] Error interceptor threw:", interceptorError);
            this.onInterceptorError?.(interceptorError, { interceptorType: "error" });
          }
        }
        if (
          error instanceof ApiAbortError ||
          error instanceof ApiTimeoutError ||
          error instanceof ApiHttpError ||
          error instanceof ApiParseError ||
          error instanceof ApiValidationError
        ) {
          throw error;
        }
        if (isTimedOut()) {
          throw new ApiTimeoutError(`Request timeout after ${this.timeoutMs}ms`, error);
        }
        if (signal.aborted) {
          throw new ApiAbortError("Request aborted", error);
        }
        throw new ApiNetworkError("Network error", error);
      } finally {
        cleanup();
        this.activeRequests.delete(requestId);
      }
    }
  }
  public cancelRequest(requestId: RequestId): boolean {
    const request = this.activeRequests.get(requestId);
    if (request) {
      request.controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }
  public cancelAllRequests(): void {
    for (const request of this.activeRequests.values()) {
      request.controller.abort();
    }
    this.activeRequests.clear();
  }
  public cancelRequestsByPath(pathPattern: RegExp): number {
    let safePattern = pathPattern;
    if (pathPattern.global) {
      safePattern = new RegExp(pathPattern.source, pathPattern.flags.replace("g", ""));
    }
    let cancelledCount = 0;
    for (const [id, request] of this.activeRequests) {
      if (safePattern.test(request.url)) {
        request.controller.abort();
        this.activeRequests.delete(id);
        cancelledCount++;
      }
    }
    return cancelledCount;
  }
  public getActiveRequestCount(): number {
    return this.activeRequests.size;
  }
  private generateRequestId(): RequestId {
    return `req_${++this.requestCounter}_${Date.now()}`;
  }
  private normalizePath(path: string): string {
    const trimmed = path.trim();
    if (!trimmed) return "/";
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) || trimmed.startsWith("//")) {
      throw new Error(`[api-client] Absolute URL is not allowed in request path: "${trimmed}"`);
    }
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }
}
