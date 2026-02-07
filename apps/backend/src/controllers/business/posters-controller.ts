import type { Request, Response } from "express";
import { createReadStream } from "fs";
import { pipeline } from "stream/promises";
import { BaseController } from "../base/base-controller";
import { CreatePosterSessionUseCase } from "../../usecases/business/posters/create-poster-session-usecase";
import { ListPosterVersionsUseCase } from "../../usecases/business/posters/list-poster-versions-usecase";
import { DownloadPosterPngUseCase } from "../../usecases/business/posters/download-poster-png-usecase";
import { DownloadPosterPreviewUseCase } from "../../usecases/business/posters/download-poster-preview-usecase";
import { DeletePosterVersionUseCase } from "../../usecases/business/posters/delete-poster-version-usecase";
import { NotFoundError } from "../../errors/app-error";
import type { PosterCategory } from "../../types/posters/poster-category";
import type { BBox } from "../../services/infra/osm/bbox";
function isErrnoLike(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}
function buildContentDisposition(fileName: string): string {
  const encoded = encodeURIComponent(fileName)
    .replaceAll("'", "%27")
    .replaceAll("(", "%28")
    .replaceAll(")", "%29")
    .replaceAll("*", "%2A");
  let fallback = fileName
    .replaceAll(/[\\/:*?"<>|]/g, "_")
    .replaceAll(/[\r\n]/g, " ")
    .replaceAll(/[^\x20-\x7E]/g, "_")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  if (!fallback) fallback = "poster.png";
  if (!fallback.toLowerCase().endsWith(".png")) fallback = `${fallback}.png`;
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
export class PostersController extends BaseController {
  constructor(
    private readonly createPosterSessionUseCase: CreatePosterSessionUseCase,
    private readonly listPosterVersionsUseCase: ListPosterVersionsUseCase,
    private readonly downloadPosterPngUseCase: DownloadPosterPngUseCase,
    private readonly downloadPosterPreviewUseCase: DownloadPosterPreviewUseCase,
    private readonly deletePosterVersionUseCase: DeletePosterVersionUseCase
  ) {
    super("PostersController");
  }
  async createSession(req: Request, res: Response): Promise<Response> {
    const resourceId = req.auth?.resourceId ?? "";
    const body = req.body as {
      locationQuery: string;
      displayName: string;
      bbox: BBox;
      placeId: string;
      osmType?: "node" | "way" | "relation";
      osmId?: string;
      category: PosterCategory;
      baseThemeId: string;
    };
    const result = await this.createPosterSessionUseCase.execute({ resourceId, request: body });
    res.setHeader("Cache-Control", "no-store");
    return this.success(res, result);
  }
  async listVersions(req: Request, res: Response): Promise<Response> {
    const resourceId = req.auth?.resourceId ?? "";
    const sessionId = (req.params as { sessionId: string }).sessionId;
    const result = await this.listPosterVersionsUseCase.execute({ resourceId, sessionId });
    res.setHeader("Cache-Control", "no-store");
    return this.success(res, result);
  }
  async downloadPng(req: Request, res: Response): Promise<void> {
    const resourceId = req.auth?.resourceId ?? "";
    const versionId = (req.params as { versionId: string }).versionId;
    const result = await this.downloadPosterPngUseCase.execute({ resourceId, versionId });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", buildContentDisposition(result.fileName));
    res.setHeader("Cache-Control", "private, max-age=86400, immutable");
    res.vary("Authorization");
    res.setHeader("Content-Length", result.fileSize);
    res.status(200);
    const stream = createReadStream(result.filePath);
    try {
      await pipeline(stream, res);
    } catch (error) {
      const code = isErrnoLike(error) ? error.code : undefined;
      if (req.aborted || res.destroyed || code === "ERR_STREAM_PREMATURE_CLOSE" || code === "ECONNRESET") {
        return;
      }
      this.logError("Failed to stream PNG asset", error);
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.removeHeader("Content-Disposition");
      res.removeHeader("Content-Length");
      res.removeHeader("Content-Type");
      res.removeHeader("Cache-Control");
      res.removeHeader("Vary");
      res.setHeader("Cache-Control", "no-store");
      if (code === "ENOENT") {
        throw new NotFoundError("PNG asset not found");
      }
      throw error instanceof Error ? error : new Error("Failed to stream PNG asset");
    }
  }
  async downloadPreview(req: Request, res: Response): Promise<Response> {
    const resourceId = req.auth?.resourceId ?? "";
    const versionId = (req.params as { versionId: string }).versionId;
    const result = await this.downloadPosterPreviewUseCase.execute({ resourceId, versionId });
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "private, max-age=86400, immutable");
    res.vary("Authorization");
    return res.status(200).send(result.preview);
  }
  async deleteVersion(req: Request, res: Response): Promise<Response> {
    const resourceId = req.auth?.resourceId ?? "";
    const sessionId = (req.params as { sessionId: string }).sessionId;
    const versionId = (req.params as { versionId: string }).versionId;
    await this.deletePosterVersionUseCase.execute({ resourceId, sessionId, versionId });
    return this.noContent(res);
  }
}
