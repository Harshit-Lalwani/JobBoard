// Regression test for the lost-update race documented in agent-comms/DECISIONS.md and
// BENCHMARKS.md (Finding 2): before the fix, two concurrent, individually-legal transitions from
// the same starting status both succeeded, and the final state could end up bypassing a supposedly
// terminal status ('rejected') entirely — a genuine data-integrity bug, not just a timing quirk.
// This test fails on the pre-fix commit and passes after (verified by stashing the fix).
import request from "supertest";
import { connect, closeDatabase, clearDatabase } from "../setupTestDB.js";
import { createApp } from "../../src/app.js";
import { Application } from "../../src/models/Application.js";

const app = createApp();

beforeAll(connect);
afterEach(clearDatabase);
afterAll(closeDatabase);

async function registerAndGetToken(data) {
  const res = await request(app).post("/api/auth/register").send(data);
  return res.body.accessToken;
}

describe("Concurrent conflicting status transitions", () => {
  it("exactly one of two racing transitions wins; the other gets a clean 409, not a silent overwrite", async () => {
    const posterToken = await registerAndGetToken({
      name: "Poster",
      email: "status-race-poster@example.com",
      password: "posterpass1",
      role: "poster",
    });
    const listingRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ title: "Status Race Listing", description: "test", location: "Remote" });
    const listingId = listingRes.body._id;

    const applicantToken = await registerAndGetToken({
      name: "Applicant",
      email: "status-race-applicant@example.com",
      password: "applicantpass1",
      role: "applicant",
    });
    const applyRes = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ resumeUrl: "/uploads/resume.pdf" });
    const applicationId = applyRes.body._id;

    // Both transitions are individually legal from "applied" (shortlisted and rejected are both
    // reachable from applied per statusMachine.js) - the bug isn't that either move is illegal on
    // its own, it's that both racing against the same stale read can both "succeed."
    const [r1, r2] = await Promise.all([
      request(app)
        .put(`/api/applications/${applicationId}/status`)
        .set("Authorization", `Bearer ${posterToken}`)
        .send({ status: "shortlisted" }),
      request(app)
        .put(`/api/applications/${applicationId}/status`)
        .set("Authorization", `Bearer ${posterToken}`)
        .send({ status: "rejected" }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    // The actual bug: before the fix, this was [200, 200] — both "succeeded". After the fix,
    // exactly one wins (200) and the loser gets a clean 409 (its guard status no longer matches).
    expect(statuses).toEqual([200, 409]);

    const final = await Application.findById(applicationId);
    // Whichever one won, the final statusHistory must end with the same status as `application.status`
    // - i.e. no entry got appended without actually taking effect, and vice versa. This is the
    // specific inconsistency the pre-fix race produced (status: shortlisted with rejected still
    // sitting earlier in statusHistory, silently bypassing rejected's terminal-state guarantee).
    const lastHistoryEntry = final.statusHistory[final.statusHistory.length - 1];
    expect(lastHistoryEntry.status).toBe(final.status);
    expect(["shortlisted", "rejected"]).toContain(final.status);
    expect(final.statusHistory).toHaveLength(2); // applied + exactly one winning transition
  });
});
