import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";
import { createClient, type Client, type InStatement, type ResultSet, type Transaction } from "@libsql/client";
import { config } from "../../../config/env";
import { createLogger } from "../../../utils/logger";
import type { OsmLayeredGeoJson } from "./geojson";
type SqliteOsmLayerCacheOptions = {
  dbPath: string;
  maxBytes: number;
  ttlDays: number;
};
type CacheRow = {
  payload: Uint8Array;
  size_bytes: number;
  expires_at: string;
};
const logger = createLogger("Infra:SqliteOsmLayerCache");
const SQLITE_BUSY_MAX_RETRIES = 3;
const SQLITE_BUSY_RETRY_BASE_DELAY_MS = 25;
const SQLITE_BUSY_RETRY_MAX_DELAY_MS = 250;
function toIsoNow(): string {
  return new Date().toISOString();
}
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function isSqliteBusyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? (error as any).code : undefined;
  if (typeof code === "string" && code.toUpperCase().startsWith("SQLITE_BUSY")) return true;
  const message = "message" in error ? (error as any).message : undefined;
  if (typeof message !== "string") return false;
  const m = message.toLowerCase();
  return m.includes("database is locked") || m.includes("sqlite_busy");
}
async function withSqliteBusyRetry<T>(fn: () => Promise<T>): Promise<T> {
  let delayMs = SQLITE_BUSY_RETRY_BASE_DELAY_MS;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (!isSqliteBusyError(error) || attempt >= SQLITE_BUSY_MAX_RETRIES) {
        throw error;
      }
      const jitterMs = Math.floor(Math.random() * 10);
      await sleep(Math.min(SQLITE_BUSY_RETRY_MAX_DELAY_MS, delayMs) + jitterMs);
      delayMs = Math.min(SQLITE_BUSY_RETRY_MAX_DELAY_MS, delayMs * 2);
    }
  }
}
function toMsOrNaN(value: unknown): number {
  if (typeof value !== "string") return Number.NaN;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : Number.NaN;
}
function gzipJson(value: unknown): Buffer {
  const json = JSON.stringify(value);
  return zlib.gzipSync(Buffer.from(json, "utf8"));
}
function gunzipJson<T>(payload: Uint8Array): T {
  const buf = zlib.gunzipSync(Buffer.from(payload));
  return JSON.parse(buf.toString("utf8")) as T;
}
function getFirstRow<T extends Record<string, unknown>>(result: ResultSet): T | null {
  const row = result.rows?.[0];
  return row && typeof row === "object" ? (row as unknown as T) : null;
}
type Executor = {
  execute: (stmt: InStatement) => Promise<ResultSet>;
};
export class SqliteOsmLayerCache {
  private readonly dbPath: string;
  private readonly maxBytes: number;
  private readonly ttlDays: number;
  private readonly client: Client;
  private initPromise: Promise<void> | null = null;
  constructor(options: SqliteOsmLayerCacheOptions) {
    this.dbPath = options.dbPath;
    this.maxBytes = options.maxBytes;
    this.ttlDays = options.ttlDays;
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    const url = pathToFileURL(this.dbPath).href;
    this.client = createClient({ url });
  }
  private ensureInitialized(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initialize();
    return this.initPromise;
  }
  private async executeWithRetry(stmt: InStatement, executor: Executor = this.client): Promise<ResultSet> {
    return withSqliteBusyRetry(() => executor.execute(stmt));
  }
  private async runWriteTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    const tx = await withSqliteBusyRetry(() => this.client.transaction("write"));
    try {
      const result = await fn(tx);
      await withSqliteBusyRetry(() => tx.commit());
      return result;
    } catch (error) {
      await withSqliteBusyRetry(() => tx.rollback());
      throw error;
    } finally {
      tx.close();
    }
  }
  private async initialize(): Promise<void> {
    await withSqliteBusyRetry(() =>
      this.client.executeMultiple(`
        CREATE TABLE IF NOT EXISTS osm_layer_cache (
          key TEXT PRIMARY KEY,
          payload BLOB NOT NULL,
          size_bytes INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          last_accessed_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_osm_layer_cache_expires_at ON osm_layer_cache(expires_at);
        CREATE INDEX IF NOT EXISTS idx_osm_layer_cache_last_accessed_at ON osm_layer_cache(last_accessed_at);
        CREATE TABLE IF NOT EXISTS osm_layer_cache_meta (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          total_size_bytes INTEGER NOT NULL
        );
        INSERT OR IGNORE INTO osm_layer_cache_meta (id, total_size_bytes) VALUES (1, 0);
      `)
    );
  }
  private async getTotalSizeBytes(executor: Executor = this.client): Promise<number> {
    const rs = await this.executeWithRetry(`SELECT total_size_bytes FROM osm_layer_cache_meta WHERE id = 1`, executor);
    const row = getFirstRow<{ total_size_bytes: unknown }>(rs);
    const n = typeof row?.total_size_bytes === "number" ? row.total_size_bytes : Number(row?.total_size_bytes);
    return Number.isFinite(n) ? n : 0;
  }
  private async bumpTotalSizeBytes(tx: Transaction, delta: number): Promise<void> {
    if (!Number.isFinite(delta) || delta === 0) return;
    await this.executeWithRetry(
      {
        sql: `UPDATE osm_layer_cache_meta SET total_size_bytes = MAX(0, total_size_bytes + ?) WHERE id = 1`,
        args: [delta]
      },
      tx
    );
  }
  async get(cacheKey: string): Promise<OsmLayeredGeoJson | null> {
    if (this.maxBytes <= 0) return null;
    try {
      await this.ensureInitialized();
      const rs = await this.executeWithRetry({
        sql: `SELECT payload, size_bytes, expires_at FROM osm_layer_cache WHERE key = ? LIMIT 1`,
        args: [cacheKey]
      });
      const row = getFirstRow<CacheRow>(rs);
      if (!row) {
        logger.info({ cacheKey, event: "miss" }, "OSM layer cache miss");
        return null;
      }
      const expiresAtMs = toMsOrNaN(row.expires_at);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
        await this.runWriteTransaction(async tx => {
          await this.executeWithRetry({ sql: `DELETE FROM osm_layer_cache WHERE key = ?`, args: [cacheKey] }, tx);
          await this.bumpTotalSizeBytes(tx, -Number(row.size_bytes ?? 0));
        });
        logger.info({ cacheKey, event: "expired" }, "OSM layer cache expired");
        return null;
      }
      await this.executeWithRetry({
        sql: `UPDATE osm_layer_cache SET last_accessed_at = ? WHERE key = ?`,
        args: [toIsoNow(), cacheKey]
      });
      const parsed = gunzipJson<OsmLayeredGeoJson>(row.payload);
      logger.info({ cacheKey, event: "hit" }, "OSM layer cache hit");
      return parsed;
    } catch (error) {
      logger.error({ cacheKey, event: "error", error }, "OSM layer cache get failed");
      return null;
    }
  }
  async set(cacheKey: string, value: OsmLayeredGeoJson): Promise<void> {
    if (this.maxBytes <= 0) return;
    try {
      await this.ensureInitialized();
      const payload = gzipJson(value);
      const sizeBytes = payload.byteLength;
      const now = Date.now();
      const ttlMs = Math.max(0, this.ttlDays) * 24 * 60 * 60 * 1000;
      const createdAt = new Date(now).toISOString();
      const expiresAt = new Date(now + ttlMs).toISOString();
      await this.runWriteTransaction(async tx => {
        const existing = await this.executeWithRetry(
          {
            sql: `SELECT size_bytes FROM osm_layer_cache WHERE key = ? LIMIT 1`,
            args: [cacheKey]
          },
          tx
        );
        const existingRow = getFirstRow<{ size_bytes: unknown }>(existing);
        const prevSize = Number(existingRow?.size_bytes ?? 0);
        await this.executeWithRetry(
          {
            sql: `
            INSERT INTO osm_layer_cache (key, payload, size_bytes, created_at, expires_at, last_accessed_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
              payload = excluded.payload,
              size_bytes = excluded.size_bytes,
              created_at = excluded.created_at,
              expires_at = excluded.expires_at,
              last_accessed_at = excluded.last_accessed_at
          `,
            args: [cacheKey, payload, sizeBytes, createdAt, expiresAt, createdAt]
          },
          tx
        );
        await this.bumpTotalSizeBytes(tx, sizeBytes - (Number.isFinite(prevSize) ? prevSize : 0));
      });
      logger.info({ cacheKey, event: "store", sizeBytes }, "OSM layer cache stored");
    } catch (error) {
      logger.error({ cacheKey, event: "error", error }, "OSM layer cache set failed");
    }
  }
  async evictIfNeeded(): Promise<void> {
    if (this.maxBytes <= 0) return;
    try {
      await this.ensureInitialized();
      const nowIso = toIsoNow();
      const expiredBytes = await this.runWriteTransaction(async tx => {
        const expiredBytesRs = await this.executeWithRetry(
          {
            sql: `SELECT COALESCE(SUM(size_bytes), 0) AS bytes FROM osm_layer_cache WHERE expires_at <= ?`,
            args: [nowIso]
          },
          tx
        );
        const expiredBytesRow = getFirstRow<{ bytes: unknown }>(expiredBytesRs);
        const expiredBytes = Number(expiredBytesRow?.bytes ?? 0);
        if (!Number.isFinite(expiredBytes) || expiredBytes <= 0) return 0;
        await this.executeWithRetry({ sql: `DELETE FROM osm_layer_cache WHERE expires_at <= ?`, args: [nowIso] }, tx);
        await this.bumpTotalSizeBytes(tx, -expiredBytes);
        return expiredBytes;
      });
      if (expiredBytes > 0) {
        logger.info(
          { cacheKey: "__bulk__", event: "expired", bytes: expiredBytes },
          "OSM layer cache expired entries deleted"
        );
      }
      let total = await this.getTotalSizeBytes();
      if (total <= this.maxBytes) return;
      while (total > this.maxBytes) {
        const { evictedKeys, totalSizeBytes } = await this.runWriteTransaction(async tx => {
          const totalBefore = await this.getTotalSizeBytes(tx);
          if (totalBefore <= this.maxBytes) {
            return { evictedKeys: [] as string[], totalSizeBytes: totalBefore };
          }
          const rs = await this.executeWithRetry(
            { sql: `SELECT key, size_bytes FROM osm_layer_cache ORDER BY last_accessed_at ASC LIMIT 100` },
            tx
          );
          const rows = Array.isArray(rs.rows)
            ? (rs.rows as unknown as Array<{ key: unknown; size_bytes: unknown }>)
            : [];
          if (rows.length === 0) {
            return { evictedKeys: [] as string[], totalSizeBytes: totalBefore };
          }
          let batchBytes = 0;
          const evictedKeys: string[] = [];
          for (const row of rows) {
            const key = typeof row.key === "string" ? row.key : String(row.key ?? "");
            if (!key) continue;
            const sizeBytes = Number(row.size_bytes ?? 0);
            await this.executeWithRetry({ sql: `DELETE FROM osm_layer_cache WHERE key = ?`, args: [key] }, tx);
            batchBytes += Number.isFinite(sizeBytes) ? sizeBytes : 0;
            evictedKeys.push(key);
          }
          await this.bumpTotalSizeBytes(tx, -batchBytes);
          const totalAfter = await this.getTotalSizeBytes(tx);
          return { evictedKeys, totalSizeBytes: totalAfter };
        });
        for (const key of evictedKeys) {
          logger.info({ cacheKey: key, event: "evict" }, "OSM layer cache evicted");
        }
        total = totalSizeBytes;
        if (evictedKeys.length === 0) break;
      }
      logger.info(
        { cacheKey: "__bulk__", event: "evict", totalSizeBytes: total, maxBytes: this.maxBytes },
        "OSM layer cache eviction finished"
      );
    } catch (error) {
      logger.error({ cacheKey: "__bulk__", event: "error", error }, "OSM layer cache eviction failed");
    }
  }
}
let singleton: SqliteOsmLayerCache | null = null;
let singletonInitAttempted = false;
export function getSqliteOsmLayerCache(): SqliteOsmLayerCache | null {
  if (singleton) return singleton;
  if (singletonInitAttempted) return null;
  singletonInitAttempted = true;
  try {
    singleton = new SqliteOsmLayerCache({
      dbPath: config.osm.cache.dbPath,
      maxBytes: config.osm.cache.maxBytes,
      ttlDays: config.osm.cache.ttlDays
    });
    return singleton;
  } catch (error) {
    logger.error(
      { event: "init_error", error, dbPath: config.osm.cache.dbPath },
      "OSM layer cache initialization failed; cache disabled for this process"
    );
    return null;
  }
}
