import request from "supertest";
import { connect, closeDatabase } from "../setupTestDB.js";
import { createApp } from "../../src/app.js";

const app = createApp();

beforeAll(connect);
afterAll(closeDatabase);

describe("GET /health", () => {
  it("always returns 200 regardless of dependency state (liveness, not readiness)", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /ready", () => {
  it("returns 200 with mongo: true when connected (redis check depends on env, both cases valid)", async () => {
    const res = await request(app).get("/ready");
    expect(res.body.checks.mongo).toBe(true);
    // tests/setupEnv.js blanks UPSTASH_REDIS_REST_URL/TOKEN, so redis is never configured here —
    // the check is simply absent, not false, matching config/redis.js's null-when-unconfigured shape.
    expect(res.body.checks.redis).toBeUndefined();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
  });
});
