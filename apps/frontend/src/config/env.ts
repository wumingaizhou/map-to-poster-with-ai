function getEnvBoolean(key: keyof ImportMetaEnv, defaultValue: boolean): boolean {
  const value = import.meta.env[key];
  if (value === undefined || value === "") {
    return defaultValue;
  }
  return value === "true" || value === "1";
}
function getEnvNumber(key: keyof ImportMetaEnv, defaultValue: number): number {
  const value = import.meta.env[key];
  if (value === undefined || value === "") {
    return defaultValue;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}
function getEnvString(key: keyof ImportMetaEnv, defaultValue: string): string {
  const value = import.meta.env[key];
  return value !== undefined && value !== "" ? value : defaultValue;
}
export const apiConfig = {
  baseUrl: getEnvString("VITE_API_BASE_URL", "/api"),
  timeoutMs: getEnvNumber("VITE_API_TIMEOUT_MS", 10_000),
  connectionTimeoutMs: getEnvNumber("VITE_API_CONNECTION_TIMEOUT_MS", 30_000)
} as const;
export const httpStatus = {
  NO_CONTENT: 204,
  REQUEST_TIMEOUT: 408,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR_MIN: 500
} as const;
export const sseConfig = {
  maxRetries: getEnvNumber("VITE_SSE_MAX_RETRIES", 10),
  retryDelayBase: getEnvNumber("VITE_SSE_RETRY_DELAY_BASE", 1_000),
  maxReconnectDelay: getEnvNumber("VITE_SSE_MAX_RECONNECT_DELAY", 30_000),
  autoReconnect: getEnvBoolean("VITE_SSE_AUTO_RECONNECT", true)
} as const;
export const reconnectStrategyDefaults = {
  baseDelay: 1_000,
  maxDelay: 30_000,
  maxAttempts: 0,
  jitterFactor: 0.5
} as const;
export const uiConfig = {
  sseEventHistoryMax: getEnvNumber("VITE_SSE_EVENT_HISTORY_MAX", 1_000),
  sseEventHistorySlice: getEnvNumber("VITE_SSE_EVENT_HISTORY_SLICE", 500)
} as const;
export const breakpointsConfig = {
  mobile: 0,
  tablet: 768,
  desktop: 1_024,
  wide: 1_440
} as const;
export const toastConfig = {
  defaultDurationMs: 3_000
} as const;
export const idleTaskConfig = {
  markdownPrefetchIdleTimeoutMs: 1_200,
  markdownPrefetchFallbackDelayMs: 200
} as const;
export const aiChatConfig = {
  autoTitleMaxLength: 20
} as const;
export const runtimeEnv = {
  isDev: import.meta.env.DEV,
  baseUrl: import.meta.env.BASE_URL
} as const;
