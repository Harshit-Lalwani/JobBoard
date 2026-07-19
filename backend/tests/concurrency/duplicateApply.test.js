// Regression tests for duplicate-key races returning a clean 409 instead of a raw 500.
//
// Two distinct races are covered here, and it matters which one demonstrates which fix:
//
// 1. Concurrent registration with the same email (registerRace below) exercises the actual Phase 2
//    fix: errorHandler.js's new global E11000 -> 409 branch. auth.service.js's register() has the
//    exact same findOne-then-create shape apply() originally had, and — unlike apply() — has no
//    local try/catch for it, so this is a clean, honest demonstration of the global fallback.
//    Verified to fail before the fix and pass after (see agent-comms/DECISIONS.md).
//
// 2. Concurrent applies from the same applicant (applyRace below) is a regression test, not a
//    fail-before/pass-after demonstration — the local E11000 handling in apply() (see
//    application.service.js) landed as an incidental side effect of Phase 1's atomic slot-claim
//    rewrite, before Phase 2 existed. It's kept here to guard against that protection regressing,
//    with the caveat stated honestly rather than implying it disproves anything about Phase 2.
//
// Both need an artificial delay injected into the DB write to force genuine interleaving — see the
// long comment in this file's history / DECISIONS.md: a fast local in-memory MongoDB combined with
// Node's single-threaded scheduling means concurrent findOne-then-create sequences reliably
// serialize in practice without this, and the race never actually reaches MongoDB's unique index.
import { jest } from "@jest/globals";
import request from "supertest";
import { connect, closeDatabase, clearDatabase } from "../setupTestDB.js";
import { createApp } from "../../src/app.js";
import { User } from "../../src/models/User.js";
import { Listing } from "../../src/models/Listing.js";
import { Application } from "../../src/models/Application.js";
import { apply } from "../../src/services/application.service.js";

const app = createApp();

beforeAll(async () => {
  await connect();
  await Promise.all([User.init(), Application.init()]);
});
afterEach(() => {
  jest.restoreAllMocks();
});
afterEach(clearDatabase);
afterAll(closeDatabase);

describe("Concurrent duplicate registration (same email)", () => {
  it("never returns 500; exactly one 201, the rest are clean 409s (not a leaked driver error)", async () => {
    // Hits the real HTTP endpoint, not the service function directly — the fix under test here is
    // errorHandler.js's global E11000 branch, which only runs when an error reaches Express's
    // error-handling middleware. auth.service.js's register() has no local try/catch of its own
    // (unlike apply()), so this is a clean, honest exercise of the global fallback specifically.
    const realCreate = User.create.bind(User);
    jest.spyOn(User, "create").mockImplementation(async (...args) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return realCreate(...args);
    });

    const N = 10;
    const results = await Promise.allSettled(
      Array.from({ length: N }, () =>
        request(app)
          .post("/api/auth/register")
          .send({ name: "Dup", email: "dup-race@example.com", password: "password123", role: "applicant" })
      )
    );

    const responses = results.map((r) => (r.status === "fulfilled" ? r.value : r.reason));
    const statusCounts = {};
    for (const res of responses) statusCounts[res.status] = (statusCounts[res.status] ?? 0) + 1;

    // The actual bug: before the fix, losing requests came back 500 with the raw MongoDB driver
    // error string leaked in the body. After the fix: exactly one 201, the rest clean 409s.
    expect(statusCounts[500]).toBeUndefined();
    expect(statusCounts[201]).toBe(1);
    expect(statusCounts[409]).toBe(N - 1);
    for (const res of responses) {
      if (res.status === 409) {
        expect(res.body.error.message).not.toMatch(/E11000|MongoServerError/);
      }
    }

    const userCount = await User.countDocuments({ email: "dup-race@example.com" });
    expect(userCount).toBe(1);
  });
});

describe("Concurrent duplicate applies (regression guard, not a fail-before/pass-after demo)", () => {
  it("never throws a raw duplicate-key error; exactly one application is created, the rest are clean 409 ApiErrors", async () => {
    const poster = await User.create({ name: "Poster", email: "apply-race-poster@example.com", passwordHash: "x", role: "poster" });
    const applicant = await User.create({ name: "Applicant", email: "apply-race-applicant@example.com", passwordHash: "x", role: "applicant" });
    const listing = await Listing.create({ title: "Race Listing", description: "test", location: "Remote", posterId: poster._id });

    const realCreate = Application.create.bind(Application);
    jest.spyOn(Application, "create").mockImplementation(async (...args) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return realCreate(...args);
    });

    const N = 10;
    const results = await Promise.allSettled(
      Array.from({ length: N }, () => apply(listing._id, applicant._id, { resumeUrl: "/uploads/resume.pdf" }))
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    for (const r of rejected) {
      expect(r.reason.statusCode).toBe(409);
      expect(r.reason.message).not.toMatch(/E11000|MongoServerError/);
    }
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(N - 1);

    const applicationCount = await Application.countDocuments({ listingId: listing._id });
    expect(applicationCount).toBe(1);
  });
});
