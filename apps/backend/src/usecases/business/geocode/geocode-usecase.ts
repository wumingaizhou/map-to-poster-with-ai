import { BaseUseCase } from "../../base/base-usecase";
import { GeocodingService, type GeocodeResultDTO } from "../../../services/business/geocoding-service";
export class GeocodeUseCase extends BaseUseCase<{ locationQuery: string }, GeocodeResultDTO> {
  constructor(private readonly geocodingService: GeocodingService) {
    super("Geocode");
  }
  async execute(input: { locationQuery: string }): Promise<GeocodeResultDTO> {
    return this.geocodingService.geocode(input.locationQuery);
  }
}
