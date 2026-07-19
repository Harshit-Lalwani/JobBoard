import request from "supertest";
import { connect, closeDatabase, clearDatabase } from "../setupTestDB.js";
import { createApp } from "../../src/app.js";
import { Listing } from "../../src/models/Listing.js";
import { Application } from "../../src/models/Application.js";

const app = createApp();

beforeAll(async () => {
  await connect();
  // The concurrency test below relies on the unique (listingId, applicantId) index actually
  // existing before firing concurrent requests — Mongoose builds indexes lazily, and without this
  // the race could silently produce duplicate documents instead of the expected 409s (see
  // agent-comms/DECISIONS.md, Phase 2, for why this matters).
  await Application.init();
});
afterEach(clearDatabase);
afterAll(closeDatabase);

const posterData = { name: "Hiring Manager", email: "hiring@example.com", password: "hiring123", role: "poster" };

function applicantData(i) {
  return { name: `Applicant ${i}`, email: `applicant${i}@example.com`, password: "applicant123", role: "applicant" };
}

async function registerAndGetToken(data) {
  const res = await request(app).post("/api/auth/register").send(data);
  return { token: res.body.accessToken, id: res.body.user.id };
}

async function createListing(posterToken, overrides = {}) {
  const res = await request(app)
    .post("/api/listings")
    .set("Authorization", `Bearer ${posterToken}`)
    .send({ title: "Limited Role", description: "One seat", location: "Remote", ...overrides });
  return res.body._id;
}

describe("Limited openings — single-request behavior", () => {
  it("accepts an apply when under the openings cap and increments filledCount", async () => {
    const { token: posterToken } = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, { openings: 2 });
    const { token: applicantToken } = await registerAndGetToken(applicantData(1));

    const res = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ resumeUrl: "/uploads/r.pdf" });

    expect(res.status).toBe(201);
    const listing = await Listing.findById(listingId);
    expect(listing.filledCount).toBe(1);
    expect(listing.status).toBe("open");
  });

  it("auto-closes the listing when the last opening is filled", async () => {
    const { token: posterToken } = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, { openings: 1 });
    const { token: applicantToken } = await registerAndGetToken(applicantData(1));

    const res = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ resumeUrl: "/uploads/r.pdf" });

    expect(res.status).toBe(201);
    const listing = await Listing.findById(listingId);
    expect(listing.filledCount).toBe(1);
    expect(listing.status).toBe("closed");
  });

  it("returns a clean 409 (not 500) when applying to a full listing", async () => {
    const { token: posterToken } = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, { openings: 1 });
    const { token: firstToken } = await registerAndGetToken(applicantData(1));
    const { token: secondToken } = await registerAndGetToken(applicantData(2));

    await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${firstToken}`)
      .send({ resumeUrl: "/uploads/r.pdf" });

    const res = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ resumeUrl: "/uploads/r.pdf" });

    expect(res.status).toBe(409);
    const listing = await Listing.findById(listingId);
    expect(listing.filledCount).toBe(1); // the rejected attempt must not have incremented it
  });

  it("behaves exactly as before when openings is unset (unlimited) — no regression", async () => {
    const { token: posterToken } = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken); // no openings field at all
    const { token: firstToken } = await registerAndGetToken(applicantData(1));
    const { token: secondToken } = await registerAndGetToken(applicantData(2));

    const res1 = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${firstToken}`)
      .send({ resumeUrl: "/uploads/r.pdf" });
    const res2 = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({ resumeUrl: "/uploads/r.pdf" });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    const listing = await Listing.findById(listingId);
    expect(listing.status).toBe("open");
  });

  it("rejects applying to an already-closed listing", async () => {
    const { token: posterToken } = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken);
    await request(app)
      .put(`/api/listings/${listingId}`)
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ status: "closed" });
    const { token: applicantToken } = await registerAndGetToken(applicantData(1));

    const res = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ resumeUrl: "/uploads/r.pdf" });

    expect(res.status).toBe(409);
  });

  it("rejects lowering openings below the current filledCount", async () => {
    const { token: posterToken } = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, { openings: 2 });
    const { token: applicantToken } = await registerAndGetToken(applicantData(1));
    await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ resumeUrl: "/uploads/r.pdf" });

    const res = await request(app)
      .put(`/api/listings/${listingId}`)
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ openings: 0 });

    // openings: 0 also fails zod's .positive() — either way this must not be a 500 or a silent success
    expect(res.status).toBe(400);
  });
});

describe("Limited openings — concurrency (the actual point of this feature)", () => {
  it("exactly K of N concurrent applicants get accepted for K openings; filledCount ends at K", async () => {
    const K = 10;
    const N = 30;
    const { token: posterToken } = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, { openings: K });

    const applicants = await Promise.all(
      Array.from({ length: N }, (_, i) => registerAndGetToken(applicantData(i)))
    );

    const results = await Promise.all(
      applicants.map(({ token }) =>
        request(app)
          .post(`/api/applications/${listingId}/apply`)
          .set("Authorization", `Bearer ${token}`)
          .send({ resumeUrl: "/uploads/r.pdf" })
      )
    );

    const accepted = results.filter((r) => r.status === 201).length;
    const rejected = results.filter((r) => r.status === 409).length;

    expect(accepted).toBe(K);
    expect(rejected).toBe(N - K);

    const listing = await Listing.findById(listingId);
    expect(listing.filledCount).toBe(K);
    expect(listing.status).toBe("closed");

    const applicationCount = await Application.countDocuments({ listingId });
    expect(applicationCount).toBe(K); // no over-allocation, no phantom applications either
  }, 30000);
});
