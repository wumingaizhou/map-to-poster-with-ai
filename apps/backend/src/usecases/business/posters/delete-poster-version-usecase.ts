import { BaseUseCase } from "../../base/base-usecase";
import { PostersService } from "../../../services/business/posters-service";
export class DeletePosterVersionUseCase extends BaseUseCase<
  { resourceId: string; sessionId: string; versionId: string },
  void
> {
  constructor(private readonly postersService: PostersService) {
    super("DeletePosterVersion");
  }
  async execute(input: { resourceId: string; sessionId: string; versionId: string }): Promise<void> {
    await this.postersService.deleteVersion(input.resourceId, input.sessionId, input.versionId);
  }
}
