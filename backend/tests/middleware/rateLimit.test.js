import request from "supertest";
import { connect, closeDatabase, clearDatabase } from "../setupTestDB.js";
import { createApp } from "../../src/app.js";

const app = createApp();

beforeAll(connect);
afterEach(clearDatabase);
afterAll(closeDatabase);

const posterData = {
  name: "Hiring Manager",
  email: "hiring@example.com",
  password: "hiring123",
  role: "poster",
};

const applicantData = {
  name: "Job Seeker",
  email: "seeker@example.com",
  password: "seeker123",
  role: "applicant",
};

async function registerAndGetToken(data) {
  const res = await request(app).post("/api/auth/register").send(data);
  return res.body.accessToken;
}

async function createListing(posterToken, title) {
  const res = await request(app)
    .post("/api/listings")
    .set("Authorization", `Bearer ${posterToken}`)
    .send({ title, description: "desc", location: "Remote" });
  return res.body._id;
}

describe("apply endpoint rate limiting", () => {
  it("returns 429 after exceeding the burst limit (5 requests/minute)", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const applicantToken = await registerAndGetToken(applicantData);

    // Create 6 distinct listings so each apply call is a distinct, otherwise-legal request —
    // isolates the rate limit as the only thing that can reject request #6.
    const listingIds = await Promise.all(
      Array.from({ length: 6 }, (_, i) => createListing(posterToken, `Listing ${i}`))
    );

    const results = [];
    for (const listingId of listingIds) {
      const res = await request(app)
        .post(`/api/applications/${listingId}/apply`)
        .set("Authorization", `Bearer ${applicantToken}`)
        .send({ resumeUrl: "/uploads/resume.pdf" });
      results.push(res.status);
    }

    expect(results.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(results[5]).toBe(429);
  });
});
