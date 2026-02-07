import osmtogeojson from "osmtogeojson";
import { config } from "../../../config/env";
import { assertValidBBox, clampBboxToMaxSpan, type BBox } from "./bbox";
import { type GeoJsonFeature, type GeoJsonFeatureCollection, type OsmLayeredGeoJson } from "./geojson";
import { overpassRequest } from "./overpass-client";
import { buildLayeredOverpassQL } from "./overpass-ql";
export type OverpassConfig = {
  endpoint: string;
  timeoutMs: number;
  maxRetries: number;
};
export type FetchOsmLayeredGeoJsonParams = {
  bbox: BBox;
  highwayAllowlist: readonly string[];
  includeBuildings?: boolean | undefined;
  maxFeaturesPerLayer?: number | undefined;
  overpassConfig?: Partial<OverpassConfig> | undefined;
};
function emptyFeatureCollection(): GeoJsonFeatureCollection {
  return { type: "FeatureCollection", features: [] };
}
function getTags(feature: GeoJsonFeature): Record<string, string> {
  const props = feature.properties;
  if (!props || typeof props !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    if (k === "id" || k === "type" || k === "tags") continue;
    if (typeof v === "string") out[k] = v;
  }
  return out;
}
function getOsmId(feature: GeoJsonFeature): string | undefined {
  if (typeof feature.id === "string" || typeof feature.id === "number") return String(feature.id);
  const props = feature.properties;
  if (!props) return undefined;
  const propId = (props as any).id;
  if (typeof propId === "string" || typeof propId === "number") return String(propId);
  const atId = (props as any)["@id"];
  if (typeof atId === "string") return atId;
  return undefined;
}
function isPolygonGeometry(feature: GeoJsonFeature): boolean {
  const type = feature.geometry?.type;
  return type === "Polygon" || type === "MultiPolygon";
}
function isLineGeometry(feature: GeoJsonFeature): boolean {
  const type = feature.geometry?.type;
  return type === "LineString" || type === "MultiLineString";
}
export function layerGeoJsonByOsmLayers(geojson: unknown, highwayAllowlist: readonly string[]): OsmLayeredGeoJson {
  const water = emptyFeatureCollection();
  const parks = emptyFeatureCollection();
  const buildings = emptyFeatureCollection();
  const roads = emptyFeatureCollection();
  const layers: OsmLayeredGeoJson = { water, parks, buildings, roads };
  const features =
    (geojson as any)?.type === "FeatureCollection" && Array.isArray((geojson as any)?.features)
      ? ((geojson as any).features as GeoJsonFeature[])
      : [];
  const roadAllow = new Set(highwayAllowlist.map(v => String(v).trim()).filter(Boolean));
  const seenIds = {
    water: new Set<string>(),
    parks: new Set<string>(),
    buildings: new Set<string>(),
    roads: new Set<string>()
  };
  function pushUnique(layerKey: keyof OsmLayeredGeoJson, feature: GeoJsonFeature) {
    const id = getOsmId(feature);
    if (id) {
      const set = seenIds[layerKey as keyof typeof seenIds];
      if (set.has(id)) return;
      set.add(id);
    }
    layers[layerKey].features.push(feature);
  }
  for (const feature of features) {
    if (!feature || feature.type !== "Feature") continue;
    const tags = getTags(feature);
    if (isPolygonGeometry(feature)) {
      const isCoastline = tags.natural === "coastline";
      const isWater = tags.natural === "water" || tags.waterway === "riverbank" || tags.landuse === "reservoir";
      if (!isCoastline && isWater) {
        pushUnique("water", feature);
      }
    }
    if (isPolygonGeometry(feature)) {
      const isPark =
        tags.leisure === "park" ||
        tags.leisure === "garden" ||
        tags.natural === "wood" ||
        tags.landuse === "grass" ||
        tags.landuse === "forest" ||
        tags.landuse === "meadow";
      if (isPark) {
        pushUnique("parks", feature);
      }
    }
    if (isPolygonGeometry(feature)) {
      const hasBuilding = typeof tags.building === "string" && tags.building.length > 0;
      if (hasBuilding) {
        pushUnique("buildings", feature);
      }
    }
    if (isLineGeometry(feature)) {
      const highway = tags.highway;
      if (typeof highway === "string" && roadAllow.has(highway)) {
        pushUnique("roads", feature);
      }
    }
  }
  return layers;
}
function resolveOverpassConfig(override?: Partial<OverpassConfig>): OverpassConfig {
  return {
    endpoint: override?.endpoint ?? config.osm.overpass.endpoint,
    timeoutMs: override?.timeoutMs ?? config.osm.overpass.timeoutMs,
    maxRetries: override?.maxRetries ?? config.osm.overpass.maxRetries
  };
}
export async function fetchOsmLayeredGeoJson(params: FetchOsmLayeredGeoJsonParams): Promise<OsmLayeredGeoJson> {
  assertValidBBox(params.bbox);
  const clampedBbox = clampBboxToMaxSpan(params.bbox, 15);
  const overpass = resolveOverpassConfig(params.overpassConfig);
  const timeoutSeconds = Math.max(1, Math.ceil(overpass.timeoutMs / 1000));
  const includeBuildings = params.includeBuildings ?? true;
  const ql = buildLayeredOverpassQL({
    bbox: clampedBbox,
    highwayAllowlist: params.highwayAllowlist,
    timeoutSeconds,
    includeBuildings,
    maxFeaturesPerLayer: params.maxFeaturesPerLayer
  });
  const { data: overpassJson } = await overpassRequest({
    endpoint: overpass.endpoint,
    query: ql,
    timeoutMs: overpass.timeoutMs,
    maxRetries: overpass.maxRetries
  });
  const geojson = osmtogeojson(overpassJson) as unknown;
  return layerGeoJsonByOsmLayers(geojson, params.highwayAllowlist);
}
