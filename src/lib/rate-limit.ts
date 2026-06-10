import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Durable rate limiting backed by Upstash Redis.
 *
 * The previous in-memory limiter did not work on Vercel: each serverless
 * instance had its own Map, so concurrent cold starts each got a fresh
 * budget. Redis is shared across all instances.
 *
 * If the Upstash env vars are absent (e.g. local dev) limiting is skipped
 * so the app still runs. Configure UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN in production.
 */

const hasRedis =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasRedis ? Redis.fromEnv() : null;

type Window = `${number} ${"s" | "m" | "h" | "d"}`;

const limiters = new Map<string, Ratelimit>();

function getLimiter(name: string, limit: number, window: Window): Ratelimit | null {
  if (!redis) return null;
  const key = `${name}:${limit}:${window}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `tailwise:rl:${name}`,
      analytics: false,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

/**
 * Resolve the client IP. On Vercel `x-real-ip` is set by the platform to the
 * actual connecting address and cannot be spoofed by the client; we prefer it
 * over `x-forwarded-for`, whose left-most entry IS attacker-controllable
 * (Vercel appends the real IP rather than replacing a client-supplied header).
 */
export function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  // Local dev fallback only — not trusted in production.
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

export interface RateLimitConfig {
  /** Logical bucket name, e.g. "submit" or "weather". */
  name: string;
  limit: number;
  window: Window;
}

/**
 * Returns a 429 NextResponse if the caller is over the limit, otherwise null.
 * Fails open (returns null) if Redis is unconfigured or errors, to preserve
 * availability — the durable limiter is the primary defence.
 */
export async function enforceRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const limiter = getLimiter(config.name, config.limit, config.window);
  if (!limiter) return null;

  const ip = getClientIp(request);
  try {
    const { success, reset } = await limiter.limit(`${config.name}:${ip}`);
    if (success) return null;
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  } catch {
    // Redis transient failure — don't take the app down over rate limiting.
    return null;
  }
}
