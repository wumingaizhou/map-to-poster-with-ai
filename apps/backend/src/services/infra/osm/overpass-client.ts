import { OverpassClientError } from "./errors";
export const DEFAULT_OVERPASS_ENDPOINT = "https://maps.mail.ru/osm/tools/overpass/api/interpreter";
export type OverpassRequestOptions = {
  query: string;
  timeoutMs: number;
  maxRetries: number;
  endpoint?: string;
};
export type OverpassRequestMeta = {
  endpoint: string;
  durationMs: number;
  attempts: number;
};
export type OverpassRequestResult<TData> = {
  data: TData;
  meta: OverpassRequestMeta;
};
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function computeBackoffMs(retryIndex: number): number {
  const baseMs = 250;
  const maxMs = 5000;
  const jitterMs = Math.floor(Math.random() * 250);
  const backoff = Math.min(maxMs, baseMs * 2 ** retryIndex);
  return backoff + jitterMs;
}
function parseRetryAfterMs(value: string | null): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }
  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return null;
}
function toHttpError(status: number, endpoint: string): OverpassClientError {
  if (status === 429) {
    return new OverpassClientError({
      code: "OVERPASS_RATE_LIMITED",
      message: `Overpass rate limited (HTTP ${status})`,
      retriable: true,
      endpoint,
      status
    });
  }
  return new OverpassClientError({
    code: "OVERPASS_HTTP_ERROR",
    message: `Overpass request failed (HTTP ${status})`,
    retriable: status >= 500,
    endpoint,
    status
  });
}
function toNetworkError(error: unknown, endpoint: string): OverpassClientError {
  const name = typeof error === "object" && error && "name" in error ? (error as any).name : undefined;
  if (name === "AbortError") {
    return new OverpassClientError({
      code: "OVERPASS_TIMEOUT",
      message: "Overpass request timed out",
      retriable: true,
      endpoint,
      cause: error
    });
  }
  return new OverpassClientError({
    code: "OVERPASS_NETWORK_ERROR",
    message: "Overpass network error",
    retriable: true,
    endpoint,
    cause: error
  });
}
function shouldRetry(error: unknown): error is OverpassClientError {
  return error instanceof OverpassClientError && error.retriable;
}
export async function overpassRequest<TData = unknown>(
  options: OverpassRequestOptions
): Promise<OverpassRequestResult<TData>> {
  const endpoint = options.endpoint ?? DEFAULT_OVERPASS_ENDPOINT;
  const timeoutMs = options.timeoutMs;
  const maxRetries = options.maxRetries;
  const query = options.query;
  if (typeof query !== "string" || !query.trim()) {
    throw new OverpassClientError({
      code: "OVERPASS_BAD_RESPONSE",
      message: "Overpass query must be a non-empty string",
      retriable: false,
      endpoint
    });
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new OverpassClientError({
      code: "OVERPASS_BAD_RESPONSE",
      message: "timeoutMs must be a finite number > 0",
      retriable: false,
      endpoint
    });
  }
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new OverpassClientError({
      code: "OVERPASS_BAD_RESPONSE",
      message: "maxRetries must be an integer >= 0",
      retriable: false,
      endpoint
    });
  }
  const maxAttempts = maxRetries + 1;
  const startTime = Date.now();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const body = new URLSearchParams({ data: query }).toString();
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            Accept: "application/json"
          },
          body,
          signal: controller.signal
        });
        if (res.status === 429 && attempt < maxAttempts) {
          const retryAfterMs = parseRetryAfterMs(res.headers.get("Retry-After"));
          const waitMs = Math.min(15_000, retryAfterMs ?? computeBackoffMs(attempt - 1));
          await res.arrayBuffer();
          await sleep(waitMs);
          continue;
        }
        if (!res.ok) {
          throw toHttpError(res.status, endpoint);
        }
        let data: unknown;
        try {
          data = await res.json();
        } catch (error) {
          const name = typeof error === "object" && error && "name" in error ? (error as any).name : undefined;
          const code = typeof error === "object" && error && "code" in error ? (error as any).code : undefined;
          if (name === "AbortError") {
            throw new OverpassClientError({
              code: "OVERPASS_TIMEOUT",
              message: "Overpass request timed out",
              retriable: true,
              endpoint,
              status: res.status,
              cause: error
            });
          }
          if (code === "ERR_STRING_TOO_LONG") {
            throw new OverpassClientError({
              code: "OVERPASS_BAD_RESPONSE",
              message: "Overpass response is too large to parse",
              retriable: false,
              endpoint,
              status: res.status,
              cause: error
            });
          }
          throw new OverpassClientError({
            code: "OVERPASS_BAD_RESPONSE",
            message: "Overpass response is not valid JSON",
            retriable: false,
            endpoint,
            status: res.status,
            cause: error
          });
        }
        return {
          data: data as TData,
          meta: {
            endpoint,
            attempts: attempt,
            durationMs: Date.now() - startTime
          }
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      const normalized = error instanceof OverpassClientError ? error : toNetworkError(error, endpoint);
      if (attempt < maxAttempts && shouldRetry(normalized)) {
        const retryIndex = attempt - 1;
        await sleep(computeBackoffMs(retryIndex));
        continue;
      }
      throw normalized;
    }
  }
  throw new OverpassClientError({
    code: "OVERPASS_NETWORK_ERROR",
    message: "Overpass request failed",
    retriable: false,
    endpoint
  });
}
