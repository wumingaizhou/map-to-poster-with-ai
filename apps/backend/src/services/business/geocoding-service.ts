import { BusinessError } from "../../errors/app-error";
import { NominatimClient, type NominatimGeocodeCandidate } from "../infra/geocoding/nominatim-client";
export type GeocodeResultDTO = {
  candidates: NominatimGeocodeCandidate[];
};
export class GeocodingService {
  constructor(private readonly nominatimClient: NominatimClient) {}
  async geocode(locationQuery: string): Promise<GeocodeResultDTO> {
    const candidates = await this.nominatimClient.search(locationQuery);
    if (candidates.length === 0) {
      throw new BusinessError("No geocode candidates found", "GEOCODE_NO_RESULT");
    }
    return { candidates };
  }
}
