import dotenv from "dotenv";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import { randomUUID } from "crypto";
dotenv.config();
function intFromEnv(
  defaultValue: number,
  options?: {
    min?: number;
    max?: number;
  }
) {
  let schema = z.coerce.number().int().finite();
  if (options?.min !== undefined) schema = schema.min(options.min);
  if (options?.max !== undefined) schema = schema.max(options.max);
  return z.preprocess(val => (val === "" ? undefined : val), schema.default(defaultValue));
}
function floatFromEnv(
  defaultValue: number,
  options?: {
    gt?: number;
    gte?: number;
    lt?: number;
    lte?: number;
  }
) {
  let schema = z.coerce.number().finite();
  if (options?.gt !== undefined) schema = schema.gt(options.gt);
  if (options?.gte !== undefined) schema = schema.gte(options.gte);
  if (options?.lt !== undefined) schema = schema.lt(options.lt);
  if (options?.lte !== undefined) schema = schema.lte(options.lte);
  return z.preprocess(val => (val === "" ? undefined : val), schema.default(defaultValue));
}
function boolFromEnv(defaultValue: boolean) {
  return z.preprocess(val => {
    if (val === "" || val === undefined) return undefined;
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val !== 0;
    if (typeof val === "string") {
      const normalized = val.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(normalized)) return true;
      if (["false", "0", "no", "n"].includes(normalized)) return false;
    }
    return val;
  }, z.boolean().default(defaultValue));
}
const envSchema = z.object({
  PORT: intFromEnv(3000, { min: 1, max: 65535 }),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  TRUST_PROXY: intFromEnv(1, { min: 0 }),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform(s =>
      s
        .split(",")
        .map(v => v.trim())
        .filter(Boolean)
    ),
  CORS_MAX_AGE: intFromEnv(86400, { min: 0 }),
  AI_EXAMPLE_AGENT_PROVIDER_ID: z.string().default("deepseek"),
  AI_EXAMPLE_AGENT_MODEL_NAME: z.string().default("deepseek-chat"),
  AI_EXAMPLE_AGENT_API_URL: z.string().url().default("https://api.deepseek.com/v1"),
  AI_EXAMPLE_AGENT_API_KEY: z.string().optional(),
  AI_EXAMPLE_AGENT_MEMORY_LAST_MESSAGES: intFromEnv(20, { min: 1 }),
  MASTRA_SERVER_PORT: intFromEnv(3002, { min: 1, max: 65535 }),
  MASTRA_HOST: z.string().default("0.0.0.0"),
  MASTRA_STUDIO_BASE: z.string().default("/my-mastra-studio"),
  MASTRA_STORAGE_PATH: z.string().optional(),
  MASTRA_STORAGE_TOKEN: z.string().optional(),
  RATE_LIMIT_SSE_WINDOW_MS: intFromEnv(60000, { min: 1 }),
  RATE_LIMIT_SSE_MAX_PRODUCTION: intFromEnv(5, { min: 1 }),
  RATE_LIMIT_SSE_MAX_DEVELOPMENT: intFromEnv(50, { min: 1 }),
  RATE_LIMIT_AI_CHAT_WINDOW_MS: intFromEnv(60000, { min: 1 }),
  RATE_LIMIT_AI_CHAT_MAX_PRODUCTION: intFromEnv(10, { min: 1 }),
  RATE_LIMIT_AI_CHAT_MAX_DEVELOPMENT: intFromEnv(100, { min: 1 }),
  RATE_LIMIT_AUTH_WINDOW_MS: intFromEnv(60000, { min: 1 }),
  RATE_LIMIT_AUTH_MAX_PRODUCTION: intFromEnv(30, { min: 1 }),
  RATE_LIMIT_AUTH_MAX_DEVELOPMENT: intFromEnv(100, { min: 1 }),
  HTTP_BODY_LIMIT: z.string().default("10mb"),
  HTTP_COMPRESSION_THRESHOLD: intFromEnv(1024, { min: 0 }),
  OSM_OVERPASS_ENDPOINT: z.string().url().default("https://maps.mail.ru/osm/tools/overpass/api/interpreter"),
  OSM_OVERPASS_TIMEOUT_MS: intFromEnv(20000, { min: 1000 }),
  OSM_OVERPASS_MAX_RETRIES: intFromEnv(2, { min: 0, max: 10 }),
  OSM_CACHE_DB_PATH: z.preprocess(val => (val === "" ? undefined : val), z.string().min(1).optional()),
  OSM_CACHE_MAX_BYTES: intFromEnv(1024 * 1024 * 1024, { min: 0 }),
  OSM_CACHE_TTL_DAYS: floatFromEnv(30, { gte: 0 }),
  RUNTIME_ASSETS_DIR: z.preprocess(val => (val === "" ? undefined : val), z.string().min(1).optional()),
  POSTER_ASSETS_DIR: z.preprocess(val => (val === "" ? undefined : val), z.string().min(1).optional()),
  POSTER_PNG_DPI: intFromEnv(300, { min: 1 }),
  POSTER_PROJECTION_MODE: z.preprocess(
    val => (val === "" ? undefined : val),
    z.enum(["webmercator", "linear"]).default("webmercator")
  ),
  NOMINATIM_ENDPOINT: z.string().url().default("https://nominatim.openstreetmap.org/search"),
  NOMINATIM_TIMEOUT_MS: intFromEnv(10000, { min: 1000 }),
  NOMINATIM_USER_AGENT: z.string().default("map-to-poster-with-ai/1.0"),
  GEOCODE_BBOX_CENTER_SCALE: floatFromEnv(0.5, { gt: 0, lte: 1 }),
  GEOCODE_BBOX_MAX_RADIUS_KM: floatFromEnv(50, { gt: 0 }),
  SSE_RETRY_TIME: intFromEnv(3000, { min: 0 }),
  SSE_HEARTBEAT_INTERVAL: intFromEnv(30000, { min: 1 }),
  SSE_MAX_CONNECTIONS_TOTAL: intFromEnv(1000, { min: 1 }),
  SSE_MAX_CONNECTIONS_PER_IP: intFromEnv(50, { min: 1 }),
  SSE_MAX_CONNECTIONS_PER_SESSION: intFromEnv(5, { min: 1 }),
  EVENT_HISTORY_LIMIT: intFromEnv(100, { min: 0 }),
  EVENT_STORE_MAX_SESSIONS: intFromEnv(1000, { min: 1 }),
  EVENT_STORE_SESSION_TTL: intFromEnv(1800000, { min: 1 }),
  EVENT_STORE_CLEANUP_INTERVAL: intFromEnv(60000, { min: 1 }),
  AUTH_REQUIRED: boolFromEnv(true),
  AUTH_JWT_SECRET: z.string().optional(),
  AUTH_JWT_TTL_SECONDS: intFromEnv(3600, { min: 60 }),
  APP_FORCE_EXIT_TIMEOUT: intFromEnv(10000, { min: 0 })
});
function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}
const env = validateEnv();
const isProduction = env.NODE_ENV === "production";
const isDevelopment = env.NODE_ENV === "development";
if (isProduction && !env.AUTH_JWT_SECRET) {
  console.error("❌ Missing required environment variable: AUTH_JWT_SECRET (required in production)");
  process.exit(1);
}
const jwtSecret = env.AUTH_JWT_SECRET || (isProduction ? "" : `dev-${randomUUID()}`);
export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  trustProxy: env.TRUST_PROXY,
  isDevelopment,
  isProduction,
  runtimeAssets: {
    dir: env.RUNTIME_ASSETS_DIR || path.join(process.cwd(), "runtime-assets")
  },
  posters: {
    assetsDir: env.POSTER_ASSETS_DIR || path.join(process.cwd(), "poster-assets"),
    png: {
      dpi: env.POSTER_PNG_DPI
    },
    projectionMode: env.POSTER_PROJECTION_MODE
  },
  cors: {
    origins: env.CORS_ORIGINS,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "X-Request-ID", "Last-Event-ID"],
    exposedHeaders: ["X-Request-ID", "X-Session-ID", "X-Thread-ID"],
    maxAge: env.CORS_MAX_AGE
  },
  ai: {
    exampleAgent: {
      providerId: env.AI_EXAMPLE_AGENT_PROVIDER_ID,
      modelName: env.AI_EXAMPLE_AGENT_MODEL_NAME,
      apiUrl: env.AI_EXAMPLE_AGENT_API_URL,
      apiKey: env.AI_EXAMPLE_AGENT_API_KEY ?? "",
      memory: {
        lastMessages: env.AI_EXAMPLE_AGENT_MEMORY_LAST_MESSAGES
      }
    },
    mastra: {
      serverPort: env.MASTRA_SERVER_PORT,
      host: env.MASTRA_HOST,
      studioBase: env.MASTRA_STUDIO_BASE,
      storage: resolveMastraStorageTarget(env.MASTRA_STORAGE_PATH),
      storageToken: env.MASTRA_STORAGE_TOKEN || undefined
    }
  },
  rateLimit: {
    sse: {
      windowMs: env.RATE_LIMIT_SSE_WINDOW_MS,
      max: isProduction ? env.RATE_LIMIT_SSE_MAX_PRODUCTION : env.RATE_LIMIT_SSE_MAX_DEVELOPMENT
    },
    aiChat: {
      windowMs: env.RATE_LIMIT_AI_CHAT_WINDOW_MS,
      max: isProduction ? env.RATE_LIMIT_AI_CHAT_MAX_PRODUCTION : env.RATE_LIMIT_AI_CHAT_MAX_DEVELOPMENT
    },
    auth: {
      windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
      max: isProduction ? env.RATE_LIMIT_AUTH_MAX_PRODUCTION : env.RATE_LIMIT_AUTH_MAX_DEVELOPMENT
    }
  },
  http: {
    bodyLimit: env.HTTP_BODY_LIMIT,
    compressionThreshold: env.HTTP_COMPRESSION_THRESHOLD
  },
  osm: {
    overpass: {
      endpoint: env.OSM_OVERPASS_ENDPOINT,
      timeoutMs: env.OSM_OVERPASS_TIMEOUT_MS,
      maxRetries: env.OSM_OVERPASS_MAX_RETRIES
    },
    cache: {
      dbPath: path.resolve(env.OSM_CACHE_DB_PATH || path.join(process.cwd(), "osm-cache.db")),
      maxBytes: env.OSM_CACHE_MAX_BYTES,
      ttlDays: env.OSM_CACHE_TTL_DAYS
    }
  },
  geocoding: {
    bboxCenterScale: env.GEOCODE_BBOX_CENTER_SCALE,
    bboxMaxRadiusKm: env.GEOCODE_BBOX_MAX_RADIUS_KM,
    nominatim: {
      endpoint: env.NOMINATIM_ENDPOINT,
      timeoutMs: env.NOMINATIM_TIMEOUT_MS,
      userAgent: env.NOMINATIM_USER_AGENT
    }
  },
  sse: {
    retryTime: env.SSE_RETRY_TIME,
    heartbeatInterval: env.SSE_HEARTBEAT_INTERVAL,
    maxConnectionsTotal: env.SSE_MAX_CONNECTIONS_TOTAL,
    maxConnectionsPerIp: env.SSE_MAX_CONNECTIONS_PER_IP,
    maxConnectionsPerSession: env.SSE_MAX_CONNECTIONS_PER_SESSION
  },
  eventStore: {
    historyLimit: env.EVENT_HISTORY_LIMIT,
    maxSessions: env.EVENT_STORE_MAX_SESSIONS,
    sessionTtl: env.EVENT_STORE_SESSION_TTL,
    cleanupInterval: env.EVENT_STORE_CLEANUP_INTERVAL
  },
  auth: {
    required: env.AUTH_REQUIRED,
    jwt: {
      secret: jwtSecret,
      ttlSeconds: env.AUTH_JWT_TTL_SECONDS
    }
  },
  app: {
    forceExitTimeout: env.APP_FORCE_EXIT_TIMEOUT
  }
};
const apiKeyEnvNameMap = {
  exampleAgent: "AI_EXAMPLE_AGENT_API_KEY"
} as const;
export function requireApiKey(keyName: "exampleAgent"): string {
  const key = config.ai[keyName].apiKey;
  if (!key) {
    throw new Error(`Missing required API key: ${apiKeyEnvNameMap[keyName]}`);
  }
  return key;
}
type MastraStorageTarget =
  | {
      mode: "path";
      path: string;
    }
  | {
      mode: "url";
      url: string;
    };
function resolveMastraStorageTarget(raw: string | undefined): MastraStorageTarget {
  const defaultPath = path.join(process.cwd(), "mastra-memory");
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { mode: "path", path: defaultPath };
  const lower = trimmed.toLowerCase();
  const looksLikeUrl =
    lower.startsWith("libsql://") ||
    lower.startsWith("https://") ||
    lower.startsWith("http://") ||
    lower.startsWith("file:");
  return looksLikeUrl ? { mode: "url", url: trimmed } : { mode: "path", path: trimmed };
}
export function getMastraStoragePath(): string {
  if (config.ai.mastra.storage.mode !== "path") {
    throw new Error("Mastra storage is configured with a URL; storage path is unavailable");
  }
  const storagePath = config.ai.mastra.storage.path;
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }
  return storagePath;
}
export function getMastraDbUrl(dbName: string): string {
  if (config.ai.mastra.storage.mode === "url") {
    return config.ai.mastra.storage.url;
  }
  const storagePath = getMastraStoragePath();
  const dbPath = path.join(storagePath, dbName);
  return pathToFileURL(dbPath).href;
}
