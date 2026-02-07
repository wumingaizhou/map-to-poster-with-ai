import { randomUUID } from "crypto";
import { BusinessError, ValidationError } from "../../errors/app-error";
import type { PosterCategory } from "../../types/posters/poster-category";
import { clampBboxToMaxSpan, assertValidBBox, type BBox } from "../infra/osm/bbox";
import type { PosterAssetStore } from "../infra/posters/poster-asset-store";
import type { CreatePosterSessionParams, PosterSessionStore } from "../infra/posters/poster-session-store";
import { KeyedLock } from "../infra/posters/keyed-lock";
import type { PosterWorkerPool } from "../infra/posters/poster-worker-pool";
import { generatePreviewWebp } from "../infra/posters/png-to-preview";
import { ThemeOverrideService } from "./theme-override-service";
export type CreatePosterSessionRequestDTO = {
  locationQuery: string;
  displayName: string;
  bbox: BBox;
  placeId: string;
  osmType?: "node" | "way" | "relation";
  osmId?: string;
  category: PosterCategory;
  baseThemeId: string;
};
export type CreatePosterSessionResponseDTO = {
  sessionId: string;
  category: PosterCategory;
  baseThemeId: string;
  latestVersion: {
    versionId: string;
    versionNo: number;
    createdAt: string;
  };
};
export type ListPosterVersionsResponseDTO = {
  sessionId: string;
  session: {
    category: PosterCategory;
    baseThemeId: string;
    displayName: string;
  };
  versions: Array<{ versionId: string; versionNo: number; createdAt: string }>;
  latestVersionId: string;
};
export type DownloadPosterPngResult = {
  filePath: string;
  fileSize: number;
  fileName: string;
};
export type DownloadPosterPreviewResult = {
  preview: Buffer;
};
export type IteratePosterStyleResponseDTO = {
  newVersion: {
    versionId: string;
    versionNo: number;
    createdAt: string;
  };
};
function validateBBoxOrThrow(bbox: unknown): BBox {
  try {
    assertValidBBox(bbox);
    return bbox;
  } catch (error) {
    throw new ValidationError("Invalid bbox");
  }
}
function toEpochMsOrNow(isoString: string): number {
  const ms = Date.parse(isoString);
  return Number.isFinite(ms) ? ms : Date.now();
}
function buildPlaceKey(input: { placeId: string; osmType?: string; osmId?: string }): string {
  const osmType = String(input.osmType ?? "").trim();
  const osmId = String(input.osmId ?? "").trim();
  if (osmType && osmId) {
    return `osm:${osmType}:${osmId}`;
  }
  return `place:${String(input.placeId).trim()}`;
}
export class PostersService {
  private readonly lock = new KeyedLock();
  constructor(
    private readonly themeOverrideService: ThemeOverrideService,
    private readonly workerPool: PosterWorkerPool,
    private readonly sessionStore: PosterSessionStore,
    private readonly assetStore: PosterAssetStore,
    private readonly pngDpi: number
  ) {}
  async createSession(resourceId: string, req: CreatePosterSessionRequestDTO): Promise<CreatePosterSessionResponseDTO> {
    const bboxValidated = validateBBoxOrThrow(req.bbox);
    const bboxClamped = clampBboxToMaxSpan(bboxValidated, 15);
    const placeKey = buildPlaceKey(req);
    return this.lock.runExclusive(`${resourceId}:${req.category}:${placeKey}`, async () => {
      const png = await this.workerPool.execute({
        taskType: "createSession",
        bbox: bboxClamped,
        placeKey,
        baseThemeId: req.baseThemeId,
        category: req.category,
        displayName: req.displayName,
        pngDpi: this.pngDpi
      });
      const createParams: CreatePosterSessionParams = {
        resourceId,
        category: req.category,
        baseThemeId: req.baseThemeId,
        locationQuery: req.locationQuery,
        displayName: req.displayName,
        bbox: bboxClamped,
        placeId: req.placeId
      };
      if (req.osmType) createParams.osmType = req.osmType;
      if (req.osmId) createParams.osmId = req.osmId;
      const { session, latestVersion } = await this.sessionStore.createSessionWithFirstVersion(createParams);
      try {
        await this.assetStore.writePng({
          resourceId,
          sessionId: session.sessionId,
          versionId: latestVersion.versionId,
          png
        });
        const preview = await generatePreviewWebp(png);
        await this.assetStore.writePreview({
          resourceId,
          sessionId: session.sessionId,
          versionId: latestVersion.versionId,
          preview
        });
      } catch (error) {
        await this.assetStore.deletePng({
          resourceId,
          sessionId: session.sessionId,
          versionId: latestVersion.versionId
        });
        await this.assetStore.deletePreview({
          resourceId,
          sessionId: session.sessionId,
          versionId: latestVersion.versionId
        });
        await this.sessionStore.deleteSession(resourceId, session.sessionId);
        throw error;
      }
      return {
        sessionId: session.sessionId,
        category: session.category,
        baseThemeId: session.baseThemeId,
        latestVersion: {
          versionId: latestVersion.versionId,
          versionNo: latestVersion.versionNo,
          createdAt: latestVersion.createdAt
        }
      };
    });
  }
  async listVersions(resourceId: string, sessionId: string): Promise<ListPosterVersionsResponseDTO> {
    return this.sessionStore.listSessionVersions(resourceId, sessionId);
  }
  async iterateStyle(
    resourceId: string,
    sessionId: string,
    patchInput: unknown
  ): Promise<IteratePosterStyleResponseDTO> {
    const patch = this.themeOverrideService.parseAiThemePatch(patchInput);
    return this.lock.runExclusive(`${resourceId}:${sessionId}`, async () => {
      const session = await this.sessionStore.getSession(resourceId, sessionId);
      const latestVersion = await this.sessionStore.getLatestVersion(resourceId, sessionId);
      const nextOverride = this.themeOverrideService.mergeAiThemePatch({
        baseThemeId: session.baseThemeId,
        patch,
        previousOverride: latestVersion.aiThemeOverride
      });
      const placeKey = buildPlaceKey(session);
      const png = await this.workerPool.execute({
        taskType: "iterateStyle",
        bbox: session.bbox,
        placeKey,
        baseThemeId: session.baseThemeId,
        category: session.category,
        displayName: session.displayName,
        aiThemeOverride: nextOverride,
        pngDpi: this.pngDpi
      });
      const versionId = `ver_${randomUUID()}`;
      try {
        await this.assetStore.writePng({
          resourceId,
          sessionId: session.sessionId,
          versionId,
          png
        });
        const preview = await generatePreviewWebp(png);
        await this.assetStore.writePreview({
          resourceId,
          sessionId: session.sessionId,
          versionId,
          preview
        });
      } catch (error) {
        await this.assetStore.deletePng({ resourceId, sessionId: session.sessionId, versionId });
        await this.assetStore.deletePreview({ resourceId, sessionId: session.sessionId, versionId });
        throw error;
      }
      try {
        const newVersion = await this.sessionStore.appendVersion(resourceId, session.sessionId, {
          versionId,
          aiThemeOverride: nextOverride
        });
        return {
          newVersion: {
            versionId: newVersion.versionId,
            versionNo: newVersion.versionNo,
            createdAt: newVersion.createdAt
          }
        };
      } catch (error) {
        await this.assetStore.deletePng({ resourceId, sessionId: session.sessionId, versionId });
        await this.assetStore.deletePreview({ resourceId, sessionId: session.sessionId, versionId });
        throw error;
      }
    });
  }
  async downloadPng(resourceId: string, versionId: string): Promise<DownloadPosterPngResult> {
    const { session, version } = await this.sessionStore.getVersion(resourceId, versionId);
    const pngStat = await this.assetStore.statPng({
      resourceId,
      sessionId: session.sessionId,
      versionId: version.versionId
    });
    const fileName = `${session.category}_${toEpochMsOrNow(version.createdAt)}.png`;
    return { filePath: pngStat.filePath, fileSize: pngStat.size, fileName };
  }
  async downloadPreview(resourceId: string, versionId: string): Promise<DownloadPosterPreviewResult> {
    const { session, version } = await this.sessionStore.getVersion(resourceId, versionId);
    const preview = await this.assetStore.readPreview({
      resourceId,
      sessionId: session.sessionId,
      versionId: version.versionId
    });
    return { preview };
  }
  async deleteVersion(resourceId: string, sessionId: string, versionId: string): Promise<void> {
    const list = await this.sessionStore.listSessionVersions(resourceId, sessionId);
    const versions = list.versions;
    if (versions.length <= 1) {
      throw new BusinessError("Cannot delete the only remaining version", "VERSION_DELETE_NOT_ALLOWED");
    }
    if (list.latestVersionId === versionId) {
      throw new BusinessError("Cannot delete latest version", "VERSION_DELETE_NOT_ALLOWED");
    }
    const target = versions.find(v => v.versionId === versionId);
    if (!target) {
      throw new BusinessError("Version not found", "VERSION_DELETE_NOT_ALLOWED");
    }
    await this.sessionStore.deleteVersion(resourceId, sessionId, versionId);
    await this.assetStore.deletePng({ resourceId, sessionId, versionId });
    await this.assetStore.deletePreview({ resourceId, sessionId, versionId });
  }
}
