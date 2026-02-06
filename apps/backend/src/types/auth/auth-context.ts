import type { JWTPayload } from "jose";
export interface AuthContext {
  resourceId: string;
  claims: JWTPayload & { session_type?: unknown };
}
