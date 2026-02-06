import type { RequestHandler } from "express";
import { jwtVerify, errors } from "jose";
import { config } from "../config/env";
import { AuthTokenExpiredError, AuthTokenInvalidError, AuthTokenMissingError } from "../errors/app-error";
import type { AuthContext } from "../types/auth/auth-context";
import { setRequestResourceId } from "./request-context";
function getBearerToken(authorizationHeader: unknown): string | null {
  if (typeof authorizationHeader !== "string") return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1]?.trim();
  return token ? token : null;
}
function parseSessionType(session_type: unknown): string {
  return typeof session_type === "string" ? session_type : "";
}
export function jwtAuth(options?: { required?: boolean; mode?: "strict" | "try" }): RequestHandler {
  const required = options?.required ?? config.auth.required;
  const mode = options?.mode ?? "strict";
  return async (req, _res, next) => {
    if (req.auth?.resourceId) {
      setRequestResourceId(req.auth.resourceId);
      return next();
    }
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
      if (required) return next(new AuthTokenMissingError());
      return next();
    }
    try {
      const key = new TextEncoder().encode(config.auth.jwt.secret);
      const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
      const resourceId = typeof payload.sub === "string" ? payload.sub : "";
      if (!resourceId) return next(new AuthTokenInvalidError("Missing sub in token"));
      const sessionType = parseSessionType((payload as { session_type?: unknown }).session_type);
      if (sessionType !== "anon") return next(new AuthTokenInvalidError("Invalid session type"));
      const auth: AuthContext = { resourceId, claims: payload as AuthContext["claims"] };
      req.auth = auth;
      setRequestResourceId(resourceId);
      return next();
    } catch (err) {
      if (!required && mode === "try") {
        return next();
      }
      if (err instanceof errors.JWTExpired) {
        return next(new AuthTokenExpiredError());
      }
      return next(new AuthTokenInvalidError());
    }
  };
}
