import type { BBox } from "../osm/bbox";
import type { Projector, ViewBox } from "./web-mercator";
export function createLinearProjector(bbox: BBox, viewBox: ViewBox): Projector {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const dx = maxLon - minLon || 1;
  const dy = maxLat - minLat || 1;
  return (lon: number, lat: number) => {
    const safeLon = Number.isFinite(lon) ? lon : minLon;
    const safeLat = Number.isFinite(lat) ? lat : minLat;
    const xPct = (safeLon - minLon) / dx;
    const yPct = (maxLat - safeLat) / dy;
    return {
      x: viewBox.x + xPct * viewBox.width,
      y: viewBox.y + yPct * viewBox.height
    };
  };
}
