export type ApiSuccess<T> = {
  success: true;
  data: T;
  timestamp: string;
};
export type ApiFailure = {
  success: false;
  error: { message: string; code?: string };
  timestamp: string;
};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
export function unwrapApiResponse<T>(res: ApiResponse<T>, options?: { endpoint?: string }): T {
  if (res && typeof res === "object" && res.success === true) {
    return res.data;
  }
  const endpoint = options?.endpoint ? ` ${options.endpoint}` : "";
  const code = res && typeof res === "object" && "error" in res && res.error?.code ? ` (${res.error.code})` : "";
  const message =
    res && typeof res === "object" && "error" in res && typeof res.error?.message === "string" && res.error.message
      ? res.error.message
      : "Unknown API error";
  throw new Error(`[api]${endpoint} failed: ${message}${code}`);
}
