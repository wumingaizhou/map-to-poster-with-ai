import { config } from "../../../config/env";
import { ServiceUnavailableError } from "../../../errors/app-error";
import { assertValidBBox, type BBox } from "../osm/bbox";
export type NominatimGeocodeCandidate = {
  displayName: string;
  bbox: BBox;
  placeId: string;
  osmType: "node" | "way" | "relation";
  osmId: string;
};
type NominatimSearchItem = {
  display_name?: unknown;
  boundingbox?: unknown;
  lat?: unknown;
  lon?: unknown;
  place_id?: unknown;
  osm_type?: unknown;
  osm_id?: unknown;
};
function parseBBoxFromBoundingBox(boundingbox: unknown): BBox | null {
  if (!Array.isArray(boundingbox) || boundingbox.length !== 4) return null;
  const [south, north, west, east] = boundingbox;
  const minLat = Number(south);
  const maxLat = Number(north);
  const minLon = Number(west);
  const maxLon = Number(east);
  const bbox: BBox = [minLon, minLat, maxLon, maxLat];
  try {
    assertValidBBox(bbox);
  } catch {
    return null;
  }
  return bbox;
}
const LON_MIN = -180;
const LON_MAX = 180;
const LAT_MIN = -90;
const LAT_MAX = 90;
const KM_PER_DEGREE_LAT = 111.32;
const EARTH_RADIUS_M = 6378137;
const WEB_MERCATOR_MAX_LAT = 85.05112878;
const WEB_MERCATOR_MAX_M = EARTH_RADIUS_M * Math.PI;
function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function parsePositiveIntString(value: unknown): string | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const n = Math.trunc(value);
    if (n <= 0) return null;
    return String(n);
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    if (!/^\d+$/.test(s)) return null;
    const normalized = s.replace(/^0+/, "");
    if (!normalized) return null;
    return normalized;
  }
  return null;
}
function parseOsmType(value: unknown): "node" | "way" | "relation" | null {
  const s = typeof value === "string" ? value.trim() : "";
  if (s === "node" || s === "way" || s === "relation") return s;
  return null;
}
function parseLon(value: unknown): number | null {
  const lon = parseFiniteNumber(value);
  if (lon === null) return null;
  if (lon < LON_MIN || lon > LON_MAX) return null;
  return lon;
}
function parseLat(value: unknown): number | null {
  const lat = parseFiniteNumber(value);
  if (lat === null) return null;
  if (lat < LAT_MIN || lat > LAT_MAX) return null;
  return lat;
}
function shiftRangeIntoBounds(options: {
  min: number;
  max: number;
  minAllowed: number;
  maxAllowed: number;
}): [number, number] {
  const { minAllowed, maxAllowed } = options;
  let { min, max } = options;
  const span = max - min;
  const maxSpan = maxAllowed - minAllowed;
  if (!Number.isFinite(span) || span <= 0 || span >= maxSpan) {
    return [minAllowed, maxAllowed];
  }
  if (min < minAllowed) {
    const delta = minAllowed - min;
    min += delta;
    max += delta;
  }
  if (max > maxAllowed) {
    const delta = maxAllowed - max;
    min += delta;
    max += delta;
  }
  min = Math.max(minAllowed, min);
  max = Math.min(maxAllowed, max);
  if (!(min < max)) {
    return [minAllowed, maxAllowed];
  }
  return [min, max];
}
function clampWebMercatorLatitude(lat: number): number {
  if (!Number.isFinite(lat)) return 0;
  return Math.max(-WEB_MERCATOR_MAX_LAT, Math.min(WEB_MERCATOR_MAX_LAT, lat));
}
function lonLatToWebMercatorMeters(lon: number, lat: number): { x: number; y: number } {
  const lonRad = (lon * Math.PI) / 180;
  const latRad = (clampWebMercatorLatitude(lat) * Math.PI) / 180;
  const x = EARTH_RADIUS_M * lonRad;
  const y = EARTH_RADIUS_M * Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  return { x, y };
}
function webMercatorMetersToLonLat(x: number, y: number): { lon: number; lat: number } {
  const lon = (x / EARTH_RADIUS_M) * (180 / Math.PI);
  const latRad = 2 * Math.atan(Math.exp(y / EARTH_RADIUS_M)) - Math.PI / 2;
  const lat = (latRad * 180) / Math.PI;
  return { lon, lat: clampWebMercatorLatitude(lat) };
}
function safeCosLatitude(latDeg: number): number {
  if (!Number.isFinite(latDeg)) return 1;
  const cos = Math.cos((latDeg * Math.PI) / 180);
  return Math.max(1e-6, Math.abs(cos));
}
function capSpanByMaxRadiusKmLinear(options: { centerLat: number; maxRadiusKm: number }): {
  maxLonSpanDeg: number;
  maxLatSpanDeg: number;
} {
  const cosLat = safeCosLatitude(options.centerLat);
  const maxLatSpanDeg = (2 * options.maxRadiusKm) / KM_PER_DEGREE_LAT;
  const maxLonSpanDeg = (2 * options.maxRadiusKm) / (KM_PER_DEGREE_LAT * cosLat);
  return { maxLonSpanDeg, maxLatSpanDeg };
}
function recenterScaleAndCapBBoxLinear(options: {
  bbox: BBox;
  centerLon: number;
  centerLat: number;
  scale: number;
  maxRadiusKm: number;
}): BBox | null {
  const { bbox, centerLon, centerLat, scale, maxRadiusKm } = options;
  if (!Number.isFinite(scale) || !(scale > 0) || !(scale <= 1)) return null;
  if (!Number.isFinite(maxRadiusKm) || !(maxRadiusKm > 0)) return null;
  if (!(centerLon >= LON_MIN && centerLon <= LON_MAX)) return null;
  if (!(centerLat >= LAT_MIN && centerLat <= LAT_MAX)) return null;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const scaledLonSpan = (maxLon - minLon) * scale;
  const scaledLatSpan = (maxLat - minLat) * scale;
  if (
    !Number.isFinite(scaledLonSpan) ||
    !Number.isFinite(scaledLatSpan) ||
    !(scaledLonSpan > 0) ||
    !(scaledLatSpan > 0)
  ) {
    return null;
  }
  const { maxLonSpanDeg, maxLatSpanDeg } = capSpanByMaxRadiusKmLinear({ centerLat, maxRadiusKm });
  const lonSpan = Math.min(scaledLonSpan, maxLonSpanDeg);
  const latSpan = Math.min(scaledLatSpan, maxLatSpanDeg);
  const halfLon = lonSpan / 2;
  const halfLat = latSpan / 2;
  let nextMinLon = centerLon - halfLon;
  let nextMaxLon = centerLon + halfLon;
  let nextMinLat = centerLat - halfLat;
  let nextMaxLat = centerLat + halfLat;
  [nextMinLon, nextMaxLon] = shiftRangeIntoBounds({
    min: nextMinLon,
    max: nextMaxLon,
    minAllowed: LON_MIN,
    maxAllowed: LON_MAX
  });
  [nextMinLat, nextMaxLat] = shiftRangeIntoBounds({
    min: nextMinLat,
    max: nextMaxLat,
    minAllowed: LAT_MIN,
    maxAllowed: LAT_MAX
  });
  const next: BBox = [nextMinLon, nextMinLat, nextMaxLon, nextMaxLat];
  try {
    assertValidBBox(next);
  } catch {
    return null;
  }
  return next;
}
function capSpanByMaxRadiusKmWebMercator(options: { centerLat: number; maxRadiusKm: number }): number {
  const radiusM = options.maxRadiusKm * 1000;
  const cosLat = safeCosLatitude(clampWebMercatorLatitude(options.centerLat));
  return (2 * radiusM) / cosLat;
}
function recenterScaleAndCapBBoxWebMercator(options: {
  bbox: BBox;
  centerLon: number;
  centerLat: number;
  scale: number;
  maxRadiusKm: number;
}): BBox | null {
  const { bbox, centerLon, centerLat, scale, maxRadiusKm } = options;
  if (!Number.isFinite(scale) || !(scale > 0) || !(scale <= 1)) return null;
  if (!Number.isFinite(maxRadiusKm) || !(maxRadiusKm > 0)) return null;
  if (!(centerLon >= LON_MIN && centerLon <= LON_MAX)) return null;
  if (!(centerLat >= LAT_MIN && centerLat <= LAT_MAX)) return null;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const sw = lonLatToWebMercatorMeters(minLon, minLat);
  const ne = lonLatToWebMercatorMeters(maxLon, maxLat);
  const minX0 = Math.min(sw.x, ne.x);
  const maxX0 = Math.max(sw.x, ne.x);
  const minY0 = Math.min(sw.y, ne.y);
  const maxY0 = Math.max(sw.y, ne.y);
  const dx0 = maxX0 - minX0;
  const dy0 = maxY0 - minY0;
  if (!Number.isFinite(dx0) || !Number.isFinite(dy0) || !(dx0 > 0) || !(dy0 > 0)) return null;
  const dx1 = dx0 * scale;
  const dy1 = dy0 * scale;
  if (!Number.isFinite(dx1) || !Number.isFinite(dy1) || !(dx1 > 0) || !(dy1 > 0)) return null;
  const maxSpanM = capSpanByMaxRadiusKmWebMercator({ centerLat, maxRadiusKm });
  const dx = Math.min(dx1, maxSpanM);
  const dy = Math.min(dy1, maxSpanM);
  const centerM = lonLatToWebMercatorMeters(centerLon, centerLat);
  let minX = centerM.x - dx / 2;
  let maxX = centerM.x + dx / 2;
  let minY = centerM.y - dy / 2;
  let maxY = centerM.y + dy / 2;
  [minX, maxX] = shiftRangeIntoBounds({
    min: minX,
    max: maxX,
    minAllowed: -WEB_MERCATOR_MAX_M,
    maxAllowed: WEB_MERCATOR_MAX_M
  });
  [minY, maxY] = shiftRangeIntoBounds({
    min: minY,
    max: maxY,
    minAllowed: -WEB_MERCATOR_MAX_M,
    maxAllowed: WEB_MERCATOR_MAX_M
  });
  const sw2 = webMercatorMetersToLonLat(minX, minY);
  const ne2 = webMercatorMetersToLonLat(maxX, maxY);
  const next: BBox = [sw2.lon, sw2.lat, ne2.lon, ne2.lat];
  try {
    assertValidBBox(next);
  } catch {
    return null;
  }
  return next;
}
function recenterScaleAndCapBBox(options: {
  bbox: BBox;
  centerLon: number;
  centerLat: number;
  scale: number;
  maxRadiusKm: number;
  projectionMode: "webmercator" | "linear";
}): BBox | null {
  if (options.projectionMode === "webmercator") {
    return recenterScaleAndCapBBoxWebMercator(options);
  }
  return recenterScaleAndCapBBoxLinear(options);
}
export class NominatimClient {
  async search(locationQuery: string): Promise<NominatimGeocodeCandidate[]> {
    const endpoint = config.geocoding.nominatim.endpoint;
    const timeoutMs = config.geocoding.nominatim.timeoutMs;
    const userAgent = config.geocoding.nominatim.userAgent;
    const bboxCenterScale = config.geocoding.bboxCenterScale;
    const bboxMaxRadiusKm = config.geocoding.bboxMaxRadiusKm;
    const projectionMode = config.posters.projectionMode;
    const url = new URL(endpoint);
    url.searchParams.set("q", locationQuery);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "10");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": userAgent
        },
        signal: controller.signal
      });
      if (!res.ok) {
        throw new ServiceUnavailableError(`Nominatim request failed (HTTP ${res.status})`);
      }
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        throw new ServiceUnavailableError("Nominatim response is not valid JSON");
      }
      if (!Array.isArray(data)) {
        throw new ServiceUnavailableError("Nominatim response schema invalid");
      }
      const candidates: NominatimGeocodeCandidate[] = [];
      for (const item of data as NominatimSearchItem[]) {
        const displayName = typeof item?.display_name === "string" ? item.display_name.trim() : "";
        if (!displayName) continue;
        const placeId = parsePositiveIntString(item?.place_id);
        if (!placeId) continue;
        const osmType = parseOsmType(item?.osm_type);
        const osmId = parsePositiveIntString(item?.osm_id);
        if (!osmType || !osmId) continue;
        const originalBbox = parseBBoxFromBoundingBox(item?.boundingbox);
        if (!originalBbox) continue;
        const centerLat = parseLat(item?.lat);
        const centerLon = parseLon(item?.lon);
        const bbox =
          centerLat !== null && centerLon !== null
            ? (recenterScaleAndCapBBox({
                bbox: originalBbox,
                centerLat,
                centerLon,
                scale: bboxCenterScale,
                maxRadiusKm: bboxMaxRadiusKm,
                projectionMode
              }) ?? originalBbox)
            : originalBbox;
        candidates.push({ displayName, bbox, placeId, osmType, osmId });
      }
      return candidates;
    } catch (error) {
      const name = typeof error === "object" && error && "name" in error ? (error as any).name : undefined;
      if (name === "AbortError") {
        throw new ServiceUnavailableError("Nominatim request timed out");
      }
      if (error instanceof ServiceUnavailableError) throw error;
      throw new ServiceUnavailableError("Nominatim request failed");
    } finally {
      clearTimeout(timeout);
    }
  }
}
