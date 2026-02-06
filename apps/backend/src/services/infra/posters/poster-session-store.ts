import { randomUUID } from "crypto";
import { ForbiddenError, NotFoundError } from "../../../errors/app-error";
import type { BBox } from "../osm/bbox";
import type { PosterCategory } from "../../../types/posters/poster-category";
import type { PosterSessionRecord, PosterVersionRecord } from "./poster-store-types";
import type { AiThemeOverride } from "../../../types/posters/ai-theme-override";
export type CreatePosterSessionParams = {
  resourceId: string;
  category: PosterCategory;
  baseThemeId: string;
  locationQuery: string;
  displayName: string;
  bbox: BBox;
  placeId: string;
  osmType?: "node" | "way" | "relation";
  osmId?: string;
};
export type CreatePosterSessionResult = {
  session: PosterSessionRecord;
  latestVersion: PosterVersionRecord;
};
export type ListPosterVersionsResult = {
  sessionId: string;
  session: Pick<PosterSessionRecord, "category" | "baseThemeId" | "displayName">;
  versions: Array<Pick<PosterVersionRecord, "versionId" | "versionNo" | "createdAt">>;
  latestVersionId: string;
};
export type GetPosterVersionResult = {
  session: PosterSessionRecord;
  version: PosterVersionRecord;
};
export interface PosterSessionStore {
  createSessionWithFirstVersion(params: CreatePosterSessionParams): Promise<CreatePosterSessionResult>;
  getSession(resourceId: string, sessionId: string): Promise<PosterSessionRecord>;
  getLatestVersion(resourceId: string, sessionId: string): Promise<PosterVersionRecord>;
  appendVersion(
    resourceId: string,
    sessionId: string,
    params: { versionId: string; aiThemeOverride: AiThemeOverride }
  ): Promise<PosterVersionRecord>;
  listSessionVersions(resourceId: string, sessionId: string): Promise<ListPosterVersionsResult>;
  getVersion(resourceId: string, versionId: string): Promise<GetPosterVersionResult>;
  deleteVersion(resourceId: string, sessionId: string, versionId: string): Promise<void>;
  deleteSession(resourceId: string, sessionId: string): Promise<void>;
}
export class InMemoryPosterSessionStore implements PosterSessionStore {
  private readonly sessionsById = new Map<string, PosterSessionRecord>();
  private readonly versionsBySessionId = new Map<string, PosterVersionRecord[]>();
  private readonly versionById = new Map<string, PosterVersionRecord>();
  async createSessionWithFirstVersion(params: CreatePosterSessionParams): Promise<CreatePosterSessionResult> {
    const now = new Date().toISOString();
    const sessionId = `sess_${randomUUID()}`;
    const versionId = `ver_${randomUUID()}`;
    const session: PosterSessionRecord = {
      sessionId,
      resourceId: params.resourceId,
      category: params.category,
      baseThemeId: params.baseThemeId,
      locationQuery: params.locationQuery,
      displayName: params.displayName,
      bbox: params.bbox,
      placeId: params.placeId,
      createdAt: now
    };
    if (params.osmType) session.osmType = params.osmType;
    if (params.osmId) session.osmId = params.osmId;
    const aiThemeOverride: AiThemeOverride = {
      kind: "aiThemeOverride",
      version: 1,
      baseThemeId: params.baseThemeId
    };
    const latestVersion: PosterVersionRecord = {
      versionId,
      sessionId,
      resourceId: params.resourceId,
      versionNo: 1,
      createdAt: now,
      aiThemeOverride
    };
    this.sessionsById.set(sessionId, session);
    this.versionsBySessionId.set(sessionId, [latestVersion]);
    this.versionById.set(versionId, latestVersion);
    return { session, latestVersion };
  }
  private requireSession(resourceId: string, sessionId: string): PosterSessionRecord {
    const session = this.sessionsById.get(sessionId);
    if (!session) throw new NotFoundError("Session not found");
    if (session.resourceId !== resourceId) throw new ForbiddenError("Cross-resource access forbidden");
    return session;
  }
  async getSession(resourceId: string, sessionId: string): Promise<PosterSessionRecord> {
    return this.requireSession(resourceId, sessionId);
  }
  async getLatestVersion(resourceId: string, sessionId: string): Promise<PosterVersionRecord> {
    this.requireSession(resourceId, sessionId);
    const versions = this.versionsBySessionId.get(sessionId) ?? [];
    if (versions.length === 0) throw new NotFoundError("No versions found");
    return versions[versions.length - 1]!;
  }
  async appendVersion(
    resourceId: string,
    sessionId: string,
    params: { versionId: string; aiThemeOverride: AiThemeOverride }
  ): Promise<PosterVersionRecord> {
    this.requireSession(resourceId, sessionId);
    const versions = this.versionsBySessionId.get(sessionId) ?? [];
    if (versions.length === 0) throw new NotFoundError("No versions found");
    const now = new Date().toISOString();
    const latest = versions[versions.length - 1]!;
    const next: PosterVersionRecord = {
      versionId: params.versionId,
      sessionId,
      resourceId,
      versionNo: latest.versionNo + 1,
      createdAt: now,
      aiThemeOverride: params.aiThemeOverride
    };
    versions.push(next);
    this.versionsBySessionId.set(sessionId, versions);
    this.versionById.set(next.versionId, next);
    return next;
  }
  async listSessionVersions(resourceId: string, sessionId: string): Promise<ListPosterVersionsResult> {
    const session = this.requireSession(resourceId, sessionId);
    const versions = this.versionsBySessionId.get(sessionId) ?? [];
    if (versions.length === 0) throw new NotFoundError("No versions found");
    const latestVersionId = versions[versions.length - 1]!.versionId;
    return {
      sessionId,
      session: {
        category: session.category,
        baseThemeId: session.baseThemeId,
        displayName: session.displayName
      },
      versions: versions.map(v => ({ versionId: v.versionId, versionNo: v.versionNo, createdAt: v.createdAt })),
      latestVersionId
    };
  }
  async getVersion(resourceId: string, versionId: string): Promise<GetPosterVersionResult> {
    const version = this.versionById.get(versionId);
    if (!version) throw new NotFoundError("Version not found");
    if (version.resourceId !== resourceId) throw new ForbiddenError("Cross-resource access forbidden");
    const session = this.sessionsById.get(version.sessionId);
    if (!session) throw new NotFoundError("Session not found");
    if (session.resourceId !== resourceId) throw new ForbiddenError("Cross-resource access forbidden");
    return { session, version };
  }
  async deleteVersion(resourceId: string, sessionId: string, versionId: string): Promise<void> {
    const session = this.requireSession(resourceId, sessionId);
    const versions = this.versionsBySessionId.get(session.sessionId) ?? [];
    if (versions.length === 0) throw new NotFoundError("No versions found");
    const index = versions.findIndex(v => v.versionId === versionId);
    if (index === -1) throw new NotFoundError("Version not found");
    const [removed] = versions.splice(index, 1);
    if (removed) {
      this.versionById.delete(removed.versionId);
    }
    this.versionsBySessionId.set(session.sessionId, versions);
  }
  async deleteSession(resourceId: string, sessionId: string): Promise<void> {
    const session = this.requireSession(resourceId, sessionId);
    const versions = this.versionsBySessionId.get(session.sessionId) ?? [];
    for (const v of versions) {
      this.versionById.delete(v.versionId);
    }
    this.versionsBySessionId.delete(session.sessionId);
    this.sessionsById.delete(session.sessionId);
  }
}
