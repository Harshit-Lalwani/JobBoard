import { Redis } from "@upstash/redis";

// Same tiered-fallback shape as storage.service.js's saveFile(): the app must keep working with
// zero Redis configured (local dev, tests) — nothing here should be a hard dependency. Returns
// null when UPSTASH_REDIS_REST_URL/TOKEN aren't set; callers are responsible for falling back to
// their non-Redis behavior in that case (see middleware/rateLimit.js and services/listing.service.js).
export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;
