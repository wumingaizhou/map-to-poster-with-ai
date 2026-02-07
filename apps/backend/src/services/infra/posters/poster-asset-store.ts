import path from "path";
import fs from "fs/promises";
import { NotFoundError, ServiceUnavailableError, ValidationError } from "../../../errors/app-error";
import { config } from "../../../config/env";
function sanitizePathSegment(value: string): string {
  const trimmed = value.trim();
  const sanitized = trimmed.replaceAll(/[\\/:*?"<>|]/g, "_");
  if (!sanitized || sanitized === "." || sanitized === "..") {
    throw new ValidationError("Invalid asset path segment");
  }
  return sanitized;
}
function assertPathUnderRoot(rootDir: string, filePath: string): void {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(filePath);
  const relative = path.relative(root, resolved);
  const upPrefix = `..${path.sep}`;
  if (relative === "" || relative === ".." || relative.startsWith(upPrefix) || path.isAbsolute(relative)) {
    throw new ValidationError("Invalid asset path");
  }
}
export interface PngStat {
  filePath: string;
  size: number;
}
export interface PosterAssetStore {
  writePng(params: { resourceId: string; sessionId: string; versionId: string; png: Buffer }): Promise<void>;
  statPng(params: { resourceId: string; sessionId: string; versionId: string }): Promise<PngStat>;
  deletePng(params: { resourceId: string; sessionId: string; versionId: string }): Promise<void>;
  writePreview(params: { resourceId: string; sessionId: string; versionId: string; preview: Buffer }): Promise<void>;
  readPreview(params: { resourceId: string; sessionId: string; versionId: string }): Promise<Buffer>;
  deletePreview(params: { resourceId: string; sessionId: string; versionId: string }): Promise<void>;
}
export class LocalFilePosterAssetStore implements PosterAssetStore {
  private readonly rootDir: string;
  constructor(rootDir: string = config.posters.assetsDir) {
    this.rootDir = rootDir;
  }
  private getPngPath(resourceId: string, sessionId: string, versionId: string): string {
    const filePath = path.join(
      this.rootDir,
      sanitizePathSegment(resourceId),
      sanitizePathSegment(sessionId),
      `${sanitizePathSegment(versionId)}.png`
    );
    assertPathUnderRoot(this.rootDir, filePath);
    return filePath;
  }
  private getPreviewPath(resourceId: string, sessionId: string, versionId: string): string {
    const filePath = path.join(
      this.rootDir,
      sanitizePathSegment(resourceId),
      sanitizePathSegment(sessionId),
      `${sanitizePathSegment(versionId)}_preview.webp`
    );
    assertPathUnderRoot(this.rootDir, filePath);
    return filePath;
  }
  async writePng(params: { resourceId: string; sessionId: string; versionId: string; png: Buffer }): Promise<void> {
    const filePath = this.getPngPath(params.resourceId, params.sessionId, params.versionId);
    const dir = path.dirname(filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, params.png);
    } catch (error) {
      throw new ServiceUnavailableError("Failed to write PNG asset");
    }
  }
  async statPng(params: { resourceId: string; sessionId: string; versionId: string }): Promise<PngStat> {
    const filePath = this.getPngPath(params.resourceId, params.sessionId, params.versionId);
    try {
      const stat = await fs.stat(filePath);
      return { filePath, size: stat.size };
    } catch (error) {
      throw new NotFoundError("PNG asset not found");
    }
  }
  async deletePng(params: { resourceId: string; sessionId: string; versionId: string }): Promise<void> {
    const filePath = this.getPngPath(params.resourceId, params.sessionId, params.versionId);
    await fs.unlink(filePath);
  }
  async writePreview(params: {
    resourceId: string;
    sessionId: string;
    versionId: string;
    preview: Buffer;
  }): Promise<void> {
    const filePath = this.getPreviewPath(params.resourceId, params.sessionId, params.versionId);
    const dir = path.dirname(filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, params.preview);
    } catch (error) {
      throw new ServiceUnavailableError("Failed to write preview asset");
    }
  }
  async readPreview(params: { resourceId: string; sessionId: string; versionId: string }): Promise<Buffer> {
    const filePath = this.getPreviewPath(params.resourceId, params.sessionId, params.versionId);
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      throw new NotFoundError("Preview asset not found");
    }
  }
  async deletePreview(params: { resourceId: string; sessionId: string; versionId: string }): Promise<void> {
    const filePath = this.getPreviewPath(params.resourceId, params.sessionId, params.versionId);
    await fs.unlink(filePath);
  }
}
