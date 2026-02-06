import type { ZodType } from "zod";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export interface ApiClientConfig {
  baseUrl: string;
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
  onInterceptorError?: (error: unknown, context: { interceptorType: "request" | "response" | "error" }) => void;
}
export interface RequestOptions<T = unknown> {
  method: HttpMethod;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  onRequestId?: (requestId: RequestId) => void;
  schema?: ZodType<T>;
}
export interface ApiResponseMeta {
  status: number;
  headers: Headers;
}
export interface RequestInterceptorContext {
  url: string;
  options: RequestOptions;
  init: RequestInit;
}
export interface ResponseInterceptorContext {
  url: string;
  options: RequestOptions;
  response: Response;
  body: unknown;
}
export interface StreamResponseInterceptorContext {
  url: string;
  options: RequestOptions;
  response: Response;
  isStream: true;
}
export type RequestInterceptor = (
  context: RequestInterceptorContext
) => RequestInterceptorContext | Promise<RequestInterceptorContext>;
export type ResponseInterceptor = (
  context: ResponseInterceptorContext | StreamResponseInterceptorContext
) =>
  | ResponseInterceptorContext
  | StreamResponseInterceptorContext
  | Promise<ResponseInterceptorContext | StreamResponseInterceptorContext>;
export type ErrorInterceptor = (
  error: Error,
  context: { url: string; options: RequestOptions }
) => void | Promise<void>;
export interface Interceptors {
  request: RequestInterceptor[];
  response: ResponseInterceptor[];
  error: ErrorInterceptor[];
}
export type RequestId = string | symbol;
export interface ActiveRequest {
  id: RequestId;
  controller: AbortController;
  url: string;
  startTime: number;
}
