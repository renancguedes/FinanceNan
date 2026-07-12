import crypto from "node:crypto";

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function parseTtl(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!m) {
    const n = Number(ttl);
    if (Number.isFinite(n)) return n; // seconds
    throw new Error(`Invalid TTL: ${ttl}`);
  }
  const value = Number(m[1]);
  const unit = m[2];
  const mult = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
  return value * mult;
}

export interface SignOptions { expiresIn: string; secret: string; }

export function signJwt(payload: Record<string, unknown>, opts: SignOptions): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + parseTtl(opts.expiresIn) };
  const encHeader = b64url(JSON.stringify(header));
  const encBody = b64url(JSON.stringify(body));
  const data = `${encHeader}.${encBody}`;
  const sig = crypto.createHmac("sha256", opts.secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export class JwtError extends Error {}

export function verifyJwt<T = Record<string, unknown>>(token: string, secret: string): T {
  const parts = token.split(".");
  if (parts.length !== 3) throw new JwtError("Malformed token");
  const [encHeader, encBody, sig] = parts as [string, string, string];
  const data = `${encHeader}.${encBody}`;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new JwtError("Invalid signature");
  const payload = JSON.parse(Buffer.from(encBody, "base64url").toString("utf8")) as T & { exp?: number };
  if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) throw new JwtError("Token expired");
  return payload;
}
