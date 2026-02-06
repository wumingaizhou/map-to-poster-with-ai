import { BBoxValidationError } from "./errors";
export type BBox = readonly [minLon: number, minLat: number, maxLon: number, maxLat: number];
const LON_MIN = -180;
const LON_MAX = 180;
const LAT_MIN = -90;
const LAT_MAX = 90;
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
export function assertValidBBox(bbox: unknown): asserts bbox is BBox {
  if (!Array.isArray(bbox) || bbox.length !== 4) {
    throw new BBoxValidationError("Invalid bbox: expected [minLon,minLat,maxLon,maxLat]", { bbox });
  }
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const values = { minLon, minLat, maxLon, maxLat };
  for (const [key, value] of Object.entries(values)) {
    if (!isFiniteNumber(value)) {
      throw new BBoxValidationError(`Invalid bbox: ${key} must be a finite number`, { bbox });
    }
  }
  if (minLon < LON_MIN || minLon > LON_MAX || maxLon < LON_MIN || maxLon > LON_MAX) {
    throw new BBoxValidationError(`Invalid bbox: lon must be within [${LON_MIN},${LON_MAX}]`, { bbox });
  }
  if (minLat < LAT_MIN || minLat > LAT_MAX || maxLat < LAT_MIN || maxLat > LAT_MAX) {
    throw new BBoxValidationError(`Invalid bbox: lat must be within [${LAT_MIN},${LAT_MAX}]`, { bbox });
  }
  if (!(minLon < maxLon)) {
    throw new BBoxValidationError("Invalid bbox: minLon must be < maxLon", { bbox });
  }
  if (!(minLat < maxLat)) {
    throw new BBoxValidationError("Invalid bbox: minLat must be < maxLat", { bbox });
  }
}
function clampAxis(options: {
  min: number;
  max: number;
  minAllowed: number;
  maxAllowed: number;
  maxSpan: number;
}): [number, number] {
  const { min, max, minAllowed, maxAllowed, maxSpan } = options;
  const span = max - min;
  if (span <= maxSpan) return [min, max];
  const center = (min + max) / 2;
  const half = maxSpan / 2;
  let nextMin = center - half;
  let nextMax = center + half;
  if (nextMin < minAllowed) {
    nextMin = minAllowed;
    nextMax = Math.min(maxAllowed, nextMin + maxSpan);
  }
  if (nextMax > maxAllowed) {
    nextMax = maxAllowed;
    nextMin = Math.max(minAllowed, nextMax - maxSpan);
  }
  return [nextMin, nextMax];
}
export function clampBboxToMaxSpan(bbox: BBox, maxSpanDeg: number = 15): BBox {
  assertValidBBox(bbox);
  if (!Number.isFinite(maxSpanDeg) || maxSpanDeg <= 0) {
    throw new BBoxValidationError("Invalid maxSpanDeg: must be a finite number > 0", { bbox });
  }
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const [clampedMinLon, clampedMaxLon] = clampAxis({
    min: minLon,
    max: maxLon,
    minAllowed: LON_MIN,
    maxAllowed: LON_MAX,
    maxSpan: maxSpanDeg
  });
  const [clampedMinLat, clampedMaxLat] = clampAxis({
    min: minLat,
    max: maxLat,
    minAllowed: LAT_MIN,
    maxAllowed: LAT_MAX,
    maxSpan: maxSpanDeg
  });
  return [clampedMinLon, clampedMinLat, clampedMaxLon, clampedMaxLat];
}
export function bboxToOverpassQLBbox(bbox: BBox): string {
  assertValidBBox(bbox);
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return `(${minLat},${minLon},${maxLat},${maxLon})`;
}
