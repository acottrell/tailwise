import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

/**
 * Constant-time string comparison.
 *
 * Hashing both sides to a fixed-length digest before comparing avoids two
 * problems with a naive timingSafeEqual: it throws on length mismatch, and a
 * raw length check would leak the secret's length. SHA-256 digests are always
 * 32 bytes, so the comparison is always well-formed and timing-safe.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

/**
 * Site admin: approve / delete / seed routes. Bearer token only.
 */
export function isAuthorizedAdmin(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const token = bearerToken(request);
  if (!token) return false;
  return safeEqual(token, secret);
}

/**
 * LBRCC club admin: shared with ride leaders. Accepts either the
 * `lbrcc_admin` cookie or a Bearer token.
 */
export function isAuthorizedLbrcc(request: NextRequest): boolean {
  const secret = process.env.LBRCC_ADMIN_SECRET;
  if (!secret) return false;

  const cookie = request.cookies.get("lbrcc_admin")?.value;
  if (cookie && safeEqual(cookie, secret)) return true;

  const token = bearerToken(request);
  if (token && safeEqual(token, secret)) return true;

  return false;
}
