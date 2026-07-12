import { signJwt, verifyJwt } from "./jwt.js";
import { env } from "../config/env.js";

export interface AccessClaims { sub: string; email: string; type: "access"; }
export interface RefreshClaims { sub: string; type: "refresh"; }

export function issueTokens(user: { id: string; email: string }) {
  const accessToken = signJwt(
    { sub: user.id, email: user.email, type: "access" },
    { secret: env.JWT_ACCESS_SECRET, expiresIn: env.JWT_ACCESS_TTL },
  );
  const refreshToken = signJwt(
    { sub: user.id, type: "refresh" },
    { secret: env.JWT_REFRESH_SECRET, expiresIn: env.JWT_REFRESH_TTL },
  );
  return { accessToken, refreshToken, tokenType: "Bearer" as const };
}

export function verifyAccess(token: string): AccessClaims {
  return verifyJwt<AccessClaims>(token, env.JWT_ACCESS_SECRET);
}

export function verifyRefresh(token: string): RefreshClaims {
  return verifyJwt<RefreshClaims>(token, env.JWT_REFRESH_SECRET);
}
