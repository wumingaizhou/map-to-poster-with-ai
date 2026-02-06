import type { BBox } from "@/types/posters";

export type OsmType = "node" | "way" | "relation";

export type GeocodeCandidateDTO = {
  displayName: string;
  bbox: BBox;
  placeId: string;
  osmType: OsmType;
  osmId: string;
};

export type GeocodeRequestDTO = {
  locationQuery: string;
};

export type GeocodeResultDTO = {
  candidates: GeocodeCandidateDTO[];
};
