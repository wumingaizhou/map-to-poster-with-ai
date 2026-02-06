import type { BBox } from "../osm/bbox";
export type ViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type Projector = (lon: number, lat: number) => { x: number; y: number };
const EARTH_RADIUS_M = 6378137;
const MAX_LAT = 85.05112878;
export function clampLatitude(lat: number): number {
  if (!Number.isFinite(lat)) return 0;
  return Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
}
function lonLatToMercatorMeters(lon: number, lat: number): { x: number; y: number } {
  const lonRad = (lon * Math.PI) / 180;
  const latRad = (clampLatitude(lat) * Math.PI) / 180;
  const x = EARTH_RADIUS_M * lonRad;
  const y = EARTH_RADIUS_M * Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  return { x, y };
}
export function createWebMercatorProjector(bbox: BBox, viewBox: ViewBox): Projector {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const sw = lonLatToMercatorMeters(minLon, minLat);
  const ne = lonLatToMercatorMeters(maxLon, maxLat);
  const mxMin = Math.min(sw.x, ne.x);
  const mxMax = Math.max(sw.x, ne.x);
  const myMin = Math.min(sw.y, ne.y);
  const myMax = Math.max(sw.y, ne.y);
  const dx = mxMax - mxMin || 1;
  const dy = myMax - myMin || 1;
  return (lon: number, lat: number) => {
    const m = lonLatToMercatorMeters(lon, lat);
    const xPct = (m.x - mxMin) / dx;
    const yPct = (myMax - m.y) / dy;
    return {
      x: viewBox.x + xPct * viewBox.width,
      y: viewBox.y + yPct * viewBox.height
    };
  };
}
