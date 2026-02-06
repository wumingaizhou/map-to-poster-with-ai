import { apiConfig } from "@/config";
type ApiSuccess<T> = {
  success: true;
  data: T;
  timestamp: string;
};
type ApiFailure = {
  success: false;
  error: { message: string; code?: string };
  timestamp: string;
};
type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
type SessionData = {
  token: string;
  expiresAt: string;
};
let cachedToken: { token: string; expiresAtMs: number } | null = null;
let inflight: Promise<string> | null = null;
function joinUrl(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return cleanBase + cleanPath;
}
function shouldRefresh(expiresAtMs: number): boolean {
  return Date.now() >= expiresAtMs - 30_000;
}
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
async function fetchAnonymousSession(options?: { token?: string }): Promise<{ token: string; expiresAtMs: number }> {
  const url = joinUrl(apiConfig.baseUrl, "/auth/session");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  const res = await fetch(url, { method: "GET", headers });
  const body = (await readJsonOrText(res)) as unknown;
  if (!res.ok) {
    const detail =
      body && typeof body === "object" && "error" in body ? JSON.stringify((body as any).error) : JSON.stringify(body);
    throw new Error(`[auth] Failed to get session (${res.status}): ${detail}`);
  }
  const parsed = body as ApiResponse<SessionData>;
  if (!parsed || typeof parsed !== "object" || parsed.success !== true) {
    throw new Error("[auth] Invalid session response");
  }
  const token = parsed.data.token;
  const expiresAt = parsed.data.expiresAt;
  if (typeof token !== "string" || !token) {
    throw new Error("[auth] Missing token in session response");
  }
  if (typeof expiresAt !== "string" || !expiresAt) {
    throw new Error("[auth] Missing expiresAt in session response");
  }
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    throw new Error("[auth] Invalid expiresAt in session response");
  }
  cachedToken = { token, expiresAtMs };
  return { token, expiresAtMs };
}
export function clearAuthToken(): void {
  cachedToken = null;
  inflight = null;
}
export async function getAuthToken(): Promise<string> {
  if (cachedToken && !shouldRefresh(cachedToken.expiresAtMs)) {
    return cachedToken.token;
  }
  if (inflight) return inflight;
  const existingToken = cachedToken?.token;
  inflight = (async () => {
    const { token } = await fetchAnonymousSession(existingToken ? { token: existingToken } : undefined);
    return token;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
export function prefetchAuthToken(): void {
  void getAuthToken().catch(() => {});
}
