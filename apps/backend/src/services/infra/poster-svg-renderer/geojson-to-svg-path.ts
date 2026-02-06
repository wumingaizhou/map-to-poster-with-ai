import type { GeoJsonGeometry, GeoJsonFeature } from "../osm/geojson";
import type { Projector } from "./web-mercator";
type Position = readonly [lon: number, lat: number];
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function asPosition(value: unknown): Position | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = value[0];
  const lat = value[1];
  if (!isFiniteNumber(lon) || !isFiniteNumber(lat)) return null;
  return [lon, lat];
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function formatNum(n: number): string {
  const v = round2(n);
  return v
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}
function lineStringPath(coords: unknown, project: Projector): string | null {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const parts: string[] = [];
  let started = false;
  for (const c of coords) {
    const pos = asPosition(c);
    if (!pos) continue;
    const p = project(pos[0], pos[1]);
    const cmd = started ? "L" : "M";
    parts.push(`${cmd}${formatNum(p.x)} ${formatNum(p.y)}`);
    started = true;
  }
  return parts.length ? parts.join(" ") : null;
}
function multiLineStringPath(coords: unknown, project: Projector): string | null {
  if (!Array.isArray(coords) || coords.length === 0) return null;
  const parts: string[] = [];
  for (const line of coords) {
    const d = lineStringPath(line, project);
    if (d) parts.push(d);
  }
  return parts.length ? parts.join(" ") : null;
}
function ringPath(coords: unknown, project: Projector): string | null {
  if (!Array.isArray(coords) || coords.length < 3) return null;
  const parts: string[] = [];
  let started = false;
  for (const c of coords) {
    const pos = asPosition(c);
    if (!pos) continue;
    const p = project(pos[0], pos[1]);
    const cmd = started ? "L" : "M";
    parts.push(`${cmd}${formatNum(p.x)} ${formatNum(p.y)}`);
    started = true;
  }
  if (!parts.length) return null;
  parts.push("Z");
  return parts.join(" ");
}
function polygonPath(coords: unknown, project: Projector): string | null {
  if (!Array.isArray(coords) || coords.length === 0) return null;
  const parts: string[] = [];
  for (const ring of coords) {
    const d = ringPath(ring, project);
    if (d) parts.push(d);
  }
  return parts.length ? parts.join(" ") : null;
}
function multiPolygonPath(coords: unknown, project: Projector): string | null {
  if (!Array.isArray(coords) || coords.length === 0) return null;
  const parts: string[] = [];
  for (const poly of coords) {
    const d = polygonPath(poly, project);
    if (d) parts.push(d);
  }
  return parts.length ? parts.join(" ") : null;
}
export function geometryToSvgPath(geometry: GeoJsonGeometry | null | undefined, project: Projector): string | null {
  if (!geometry) return null;
  if (geometry.type === "LineString") return lineStringPath(geometry.coordinates, project);
  if (geometry.type === "MultiLineString") return multiLineStringPath(geometry.coordinates, project);
  if (geometry.type === "Polygon") return polygonPath(geometry.coordinates, project);
  if (geometry.type === "MultiPolygon") return multiPolygonPath(geometry.coordinates, project);
  return null;
}
export function featureToSvgPath(feature: GeoJsonFeature, project: Projector): string | null {
  return geometryToSvgPath(feature.geometry, project);
}
