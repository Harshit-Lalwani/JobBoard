import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { ApiError } from "./errorHandler.js";

/** In-memory rate limiter (Redis was ruled out in Phase 0 for scope reasons — see
 * agent-comms/DECISIONS.md). Scoped to the apply endpoint since it's the one write path most
 * exposed to abuse (scripted mass-applying). Keyed by authenticated user id, not IP, since
 * requireAuth runs before this and IP-based limiting would be easy to route around/would
 * collide legitimate users behind the same NAT. */
export const applyRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip),
  handler: (req, res, next) => {
    next(new ApiError(429, "Too many applications submitted — please wait a moment and try again"));
  },
});
