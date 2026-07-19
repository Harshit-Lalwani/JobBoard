// Unit tests for the distributed (Redis-backed) branch of applyRateLimiter — the branch that
// only activates when UPSTASH_REDIS_REST_URL/TOKEN are configured. tests/setupEnv.js blanks those
// vars globally so the rest of the suite always exercises the in-memory fallback (see
// rateLimit.test.js); this file explicitly mocks config/redis.js and @upstash/ratelimit to
// exercise the distributed branch's logic without ever making a real network call.
import { jest } from "@jest/globals";

const mockLimit = jest.fn();

jest.unstable_mockModule("../../src/config/redis.js", () => ({ redis: {} }));
jest.unstable_mockModule("@upstash/ratelimit", () => ({
  Ratelimit: class {
    constructor() {
      this.limit = mockLimit;
    }
    static slidingWindow() {
      return {};
    }
  },
}));

const { applyRateLimiter } = await import("../../src/middleware/rateLimit.js");

function mockReqRes(userId = "user-1") {
  const req = { user: { id: userId }, ip: "127.0.0.1" };
  const res = {};
  const next = jest.fn();
  return { req, res, next };
}

describe("applyRateLimiter — distributed (Redis) branch", () => {
  beforeEach(() => {
    mockLimit.mockReset();
  });

  it("calls next() with no error when Upstash reports success", async () => {
    mockLimit.mockResolvedValue({ success: true });
    const { req, res, next } = mockReqRes();

    await applyRateLimiter(req, res, next);

    expect(mockLimit).toHaveBeenCalledWith("user-1");
    expect(next).toHaveBeenCalledWith();
  });

  it("calls next() with a 429 ApiError when Upstash reports the limit was exceeded", async () => {
    mockLimit.mockResolvedValue({ success: false });
    const { req, res, next } = mockReqRes();

    await applyRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(429);
  });

  it("fails open (calls next() with no error) if the Redis call itself throws", async () => {
    mockLimit.mockRejectedValue(new Error("upstash unreachable"));
    const { req, res, next } = mockReqRes();

    await applyRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
