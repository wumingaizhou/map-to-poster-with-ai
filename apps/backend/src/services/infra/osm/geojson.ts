export type GeoJsonGeometryType =
  | "Point"
  | "MultiPoint"
  | "LineString"
  | "MultiLineString"
  | "Polygon"
  | "MultiPolygon"
  | "GeometryCollection";
export type GeoJsonGeometry =
  | { type: Exclude<GeoJsonGeometryType, "GeometryCollection">; coordinates: unknown }
  | { type: "GeometryCollection"; geometries: GeoJsonGeometry[] };
export type GeoJsonFeature = {
  type: "Feature";
  id?: string | number;
  geometry: GeoJsonGeometry | null;
  properties?: Record<string, unknown> & {
    id?: string | number;
    "@id"?: string;
    tags?: Record<string, string>;
  };
};
export type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};
export type OsmLayeredGeoJson = {
  water: GeoJsonFeatureCollection;
  parks: GeoJsonFeatureCollection;
  buildings: GeoJsonFeatureCollection;
  roads: GeoJsonFeatureCollection;
};
