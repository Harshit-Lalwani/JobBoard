import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "../config/redis.js";
import { ApiError } from "./errorHandler.js";

/** In-memory fallback — used when Redis isn't configured (local dev, tests). Documented,
 * accepted limitation: this store is per-process, so it doesn't coordinate across multiple
 * serverless instances (see agent-comms/DECISIONS.md, original Phase 0 entry). The Redis-backed
 * limiter below is what actually fixes that, when configured. */
const inMemoryLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip),
  handler: (req, res, next) => {
    next(new ApiError(429, "Too many applications submitted — please wait a moment and try again"));
  },
});

/** Distributed limiter, only constructed when UPSTASH_REDIS_REST_URL/TOKEN are set. A sliding
 * window (not fixed) so it doesn't allow a burst of 2x the limit right at a window boundary —
 * fixed windows let a client send `limit` requests at 0:59 and another `limit` at 1:01, i.e.
 * 2x the intended rate in 2 seconds. */
const distributedLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      prefix: "jobboard:apply-ratelimit",
    })
  : null;

/** Scoped to the apply endpoint since it's the one write path most exposed to abuse (scripted
 * mass-applying). Keyed by authenticated user id, not IP — requireAuth runs before this and
 * IP-based limiting would be easy to route around/would collide legitimate users behind the same
 * NAT. Tries the distributed (Redis) limiter first; falls back to the in-memory one when Redis
 * isn't configured, and fails OPEN (lets the request through) if Redis is configured but
 * unreachable — a rate-limiter outage taking down the whole apply flow would be a worse failure
 * than temporarily not rate-limiting. */
export async function applyRateLimiter(req, res, next) {
  if (!distributedLimiter) {
    return inMemoryLimiter(req, res, next);
  }

  const key = req.user?.id ?? req.ip;
  try {
    const { success } = await distributedLimiter.limit(key);
    if (!success) {
      return next(new ApiError(429, "Too many applications submitted — please wait a moment and try again"));
    }
    return next();
  } catch {
    return next();
  }
}
