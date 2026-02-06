import { BaseUseCase } from "../../base/base-usecase";
import {
  PostersService,
  type CreatePosterSessionRequestDTO,
  type CreatePosterSessionResponseDTO
} from "../../../services/business/posters-service";
export class CreatePosterSessionUseCase extends BaseUseCase<
  { resourceId: string; request: CreatePosterSessionRequestDTO },
  CreatePosterSessionResponseDTO
> {
  constructor(private readonly postersService: PostersService) {
    super("CreatePosterSession");
  }
  async execute(input: {
    resourceId: string;
    request: CreatePosterSessionRequestDTO;
  }): Promise<CreatePosterSessionResponseDTO> {
    return this.postersService.createSession(input.resourceId, input.request);
  }
}
