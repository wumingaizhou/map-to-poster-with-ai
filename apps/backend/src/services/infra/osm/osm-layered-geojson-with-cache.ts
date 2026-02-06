import { config } from "../../../config/env";
import { KeyedLock } from "../posters/keyed-lock";
import type { BBox } from "./bbox";
import type { OsmLayeredGeoJson } from "./geojson";
import { fetchOsmLayeredGeoJson } from "./osm-layered-geojson";
import { getSqliteOsmLayerCache } from "./sqlite-osm-layer-cache";
import { createHash } from "crypto";
const CACHE_SCHEMA_VERSION = "v5";
const lock = new KeyedLock();
export type GetOsmLayeredGeoJsonWithCacheParams = {
  placeKey: string;
  bbox: BBox;
  highwayAllowlist: readonly string[];
  includeBuildings?: boolean;
};
function normalizeAllowlist(values: readonly string[]): string {
  const uniq = new Set(values.map(v => String(v).trim()).filter(Boolean));
  return [...uniq].sort().join(",");
}
function hashShort(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 20);
}
function buildCacheKey(params: GetOsmLayeredGeoJsonWithCacheParams): string {
  const placeKey = params.placeKey.trim();
  const buildingsKey = params.includeBuildings ? "b1" : "b0";
  const allowlistKey = hashShort(normalizeAllowlist(params.highwayAllowlist));
  const bboxKey = hashShort(params.bbox.map(v => Number(v).toFixed(6)).join(","));
  return `${CACHE_SCHEMA_VERSION}:${placeKey}:${buildingsKey}:a=${allowlistKey}:bb=${bboxKey}`;
}
export async function getOsmLayeredGeoJsonWithCache(
  params: GetOsmLayeredGeoJsonWithCacheParams
): Promise<OsmLayeredGeoJson> {
  const includeBuildings = params.includeBuildings ?? true;
  if (config.osm.cache.maxBytes <= 0) {
    return fetchOsmLayeredGeoJson({ bbox: params.bbox, highwayAllowlist: params.highwayAllowlist, includeBuildings });
  }
  const cacheKey = buildCacheKey({ ...params, includeBuildings });
  return lock.runExclusive(cacheKey, async () => {
    const cache = getSqliteOsmLayerCache();
    if (!cache) {
      return fetchOsmLayeredGeoJson({ bbox: params.bbox, highwayAllowlist: params.highwayAllowlist, includeBuildings });
    }
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
    const fresh = await fetchOsmLayeredGeoJson({
      bbox: params.bbox,
      highwayAllowlist: params.highwayAllowlist,
      includeBuildings
    });
    await cache.set(cacheKey, fresh);
    await cache.evictIfNeeded();
    return fresh;
  });
}
