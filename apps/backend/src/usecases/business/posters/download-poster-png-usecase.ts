import { BaseUseCase } from "../../base/base-usecase";
import { PostersService, type DownloadPosterPngResult } from "../../../services/business/posters-service";
export class DownloadPosterPngUseCase extends BaseUseCase<
  { resourceId: string; versionId: string },
  DownloadPosterPngResult
> {
  constructor(private readonly postersService: PostersService) {
    super("DownloadPosterPng");
  }
  async execute(input: { resourceId: string; versionId: string }): Promise<DownloadPosterPngResult> {
    return this.postersService.downloadPng(input.resourceId, input.versionId);
  }
}
