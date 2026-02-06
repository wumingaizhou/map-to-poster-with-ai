/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;

  readonly VITE_API_TIMEOUT_MS: string;

  readonly VITE_API_CONNECTION_TIMEOUT_MS: string;

  readonly VITE_SSE_EVENT_HISTORY_MAX: string;

  readonly VITE_SSE_EVENT_HISTORY_SLICE: string;

  readonly VITE_SSE_AUTO_RECONNECT?: string;

  readonly VITE_DEV_API_PROXY_TARGET?: string;

  readonly VITE_BUILD_COMPRESSION_THRESHOLD_BYTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
