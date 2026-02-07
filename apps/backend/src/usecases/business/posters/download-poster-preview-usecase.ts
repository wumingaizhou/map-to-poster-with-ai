import { BaseUseCase } from "../../base/base-usecase";
import { PostersService, type DownloadPosterPreviewResult } from "../../../services/business/posters-service";
export class DownloadPosterPreviewUseCase extends BaseUseCase<
  { resourceId: string; versionId: string },
  DownloadPosterPreviewResult
> {
  constructor(private readonly postersService: PostersService) {
    super("DownloadPosterPreview");
  }
  async execute(input: { resourceId: string; versionId: string }): Promise<DownloadPosterPreviewResult> {
    return this.postersService.downloadPreview(input.resourceId, input.versionId);
  }
}
