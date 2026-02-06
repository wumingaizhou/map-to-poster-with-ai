import { randomUUID } from "crypto";
import { SignJWT } from "jose";
import { config } from "../../config/env";
import { BaseService } from "../base/base-service";
export interface AnonymousSessionResultDTO {
  token: string;
  expiresAt: string;
}
export class AuthService extends BaseService {
  constructor() {
    super("AuthService");
  }
  async issueAnonymousSession(resourceId?: string): Promise<AnonymousSessionResultDTO> {
    const { ttlSeconds, secret } = config.auth.jwt;
    const resolvedResourceId = resourceId || `resource_${randomUUID()}`;
    const issuedAtSeconds = Math.floor(Date.now() / 1000);
    const expiresAtSeconds = issuedAtSeconds + ttlSeconds;
    const expiresAt = new Date(expiresAtSeconds * 1000).toISOString();
    const key = new TextEncoder().encode(secret);
    const token = await new SignJWT({ session_type: "anon" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(resolvedResourceId)
      .setIssuedAt(issuedAtSeconds)
      .setExpirationTime(expiresAtSeconds)
      .sign(key);
    this.log("Issued anonymous session", { resourceId: resolvedResourceId, expiresAtSeconds });
    return { token, expiresAt };
  }
}
