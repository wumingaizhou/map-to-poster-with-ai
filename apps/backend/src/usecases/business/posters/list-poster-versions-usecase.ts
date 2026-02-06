import { BaseUseCase } from "../../base/base-usecase";
import { PostersService, type ListPosterVersionsResponseDTO } from "../../../services/business/posters-service";
export class ListPosterVersionsUseCase extends BaseUseCase<
  { resourceId: string; sessionId: string },
  ListPosterVersionsResponseDTO
> {
  constructor(private readonly postersService: PostersService) {
    super("ListPosterVersions");
  }
  async execute(input: { resourceId: string; sessionId: string }): Promise<ListPosterVersionsResponseDTO> {
    return this.postersService.listVersions(input.resourceId, input.sessionId);
  }
}
