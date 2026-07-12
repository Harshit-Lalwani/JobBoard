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

const listingData = {
  title: "Senior Engineer",
  description: "Build systems",
  tags: ["backend"],
  location: "Remote",
};

const applicationData = {
  resumeUrl: "/uploads/resume.pdf",
  coverNote: "I love this job!",
};

async function registerAndGetToken(data) {
  const res = await request(app).post("/api/auth/register").send(data);
  return res.body.accessToken;
}

async function createListing(posterToken, listing) {
  const res = await request(app)
    .post("/api/listings")
    .set("Authorization", `Bearer ${posterToken}`)
    .send(listing);
  return res.body._id;
}

describe("POST /api/applications/:listingId/apply", () => {
  it("allows an applicant to apply to a listing", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, listingData);

    const applicantToken = await registerAndGetToken(applicantData);
    const res = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send(applicationData);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("applied");
    expect(res.body.statusHistory).toHaveLength(1);
    expect(res.body.statusHistory[0].status).toBe("applied");
  });

  it("prevents duplicate applications from the same applicant", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, listingData);
    const applicantToken = await registerAndGetToken(applicantData);

    await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send(applicationData);

    const res = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send(applicationData);

    expect(res.status).toBe(409);
  });

  it("requires authentication", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, listingData);

    const res = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .send(applicationData);

    expect(res.status).toBe(401);
  });

  it("rejects posters trying to apply", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, listingData);

    const res = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${posterToken}`)
      .send(applicationData);

    expect(res.status).toBe(403);
  });

  it("rejects invalid data with 400", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, listingData);
    const applicantToken = await registerAndGetToken(applicantData);

    const res = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ coverNote: "No resume URL" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/applications/listing/:listingId", () => {
  it("allows a poster to view applications for their listing", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, listingData);

    const applicant1 = {
      name: "Alice",
      email: "alice@example.com",
      password: "alice123",
      role: "applicant",
    };
    const applicant1Token = await registerAndGetToken(applicant1);
    const apply1Res = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicant1Token}`)
      .send(applicationData);

    expect(apply1Res.status).toBe(201);
    expect(apply1Res.body._id).toBeDefined();

    const applicant2 = {
      name: "Bob",
      email: "bob@example.com",
      password: "bob12345",
      role: "applicant",
    };
    const applicant2Token = await registerAndGetToken(applicant2);
    const apply2Res = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicant2Token}`)
      .send(applicationData);

    expect(apply2Res.status).toBe(201);
    expect(apply2Res.body._id).toBeDefined();

    const res = await request(app)
      .get(`/api/applications/listing/${listingId}`)
      .set("Authorization", `Bearer ${posterToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].applicantId.name).toBeDefined();
  });

  it("rejects non-posters with 403", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, listingData);

    const otherPosterToken = await registerAndGetToken({
      name: "Other Poster",
      email: "other@example.com",
      password: "other123",
      role: "poster",
    });

    const res = await request(app)
      .get(`/api/applications/listing/${listingId}`)
      .set("Authorization", `Bearer ${otherPosterToken}`);

    expect(res.status).toBe(403);
  });

  it("rejects applicants viewing listings with 403", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, listingData);
    const applicantToken = await registerAndGetToken(applicantData);

    const res = await request(app)
      .get(`/api/applications/listing/${listingId}`)
      .set("Authorization", `Bearer ${applicantToken}`);

    expect(res.status).toBe(403);
  });
});

describe("PUT /api/applications/:applicationId/status", () => {
  it("allows valid status transitions", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, listingData);
    const applicantToken = await registerAndGetToken(applicantData);

    const applyRes = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send(applicationData);

    const appId = applyRes.body._id;

    // applied → shortlisted
    const res1 = await request(app)
      .put(`/api/applications/${appId}/status`)
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ status: "shortlisted" });

    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe("shortlisted");
    expect(res1.body.statusHistory).toHaveLength(2);

    // shortlisted → interview
    const res2 = await request(app)
      .put(`/api/applications/${appId}/status`)
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ status: "interview" });

    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe("interview");
    expect(res2.body.statusHistory).toHaveLength(3);

    // interview → offer
    const res3 = await request(app)
      .put(`/api/applications/${appId}/status`)
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ status: "offer" });

    expect(res3.status).toBe(200);
    expect(res3.body.status).toBe("offer");
  });

  it("rejects invalid status transitions", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, listingData);
    const applicantToken = await registerAndGetToken(applicantData);

    const applyRes = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send(applicationData);

    const appId = applyRes.body._id;

    // applied → offer (should be rejected, must go through shortlisted and interview)
    const res = await request(app)
      .put(`/api/applications/${appId}/status`)
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ status: "offer" });

    expect(res.status).toBe(400);
  });

  it("allows rejection from any non-terminal state", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, listingData);

    // Test rejection from 'applied'
    const applicant1Data = {
      name: "Applicant 1",
      email: "app1@example.com",
      password: "app1pass",
      role: "applicant",
    };
    const applicant1Token = await registerAndGetToken(applicant1Data);
    const apply1Res = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicant1Token}`)
      .send(applicationData);

    expect(apply1Res.status).toBe(201);
    expect(apply1Res.body._id).toBeDefined();

    const res1 = await request(app)
      .put(`/api/applications/${apply1Res.body._id}/status`)
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ status: "rejected" });

    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe("rejected");
  });

  it("prevents transitions from rejected (terminal state)", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, listingData);
    const applicantToken = await registerAndGetToken(applicantData);

    const applyRes = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send(applicationData);

    const appId = applyRes.body._id;

    // Move to rejected
    await request(app)
      .put(`/api/applications/${appId}/status`)
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ status: "rejected" });

    // Try to transition out of rejected
    const res = await request(app)
      .put(`/api/applications/${appId}/status`)
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ status: "applied" });

    expect(res.status).toBe(400);
  });

  it("rejects status updates by non-poster with 403", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, listingData);
    const applicantToken = await registerAndGetToken(applicantData);

    const applyRes = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send(applicationData);

    const appId = applyRes.body._id;

    const res = await request(app)
      .put(`/api/applications/${appId}/status`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ status: "shortlisted" });

    expect(res.status).toBe(403);
  });
});

describe("GET /api/applications/:applicationId", () => {
  it("returns application details with populated references", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const listingId = await createListing(posterToken, listingData);
    const applicantToken = await registerAndGetToken(applicantData);

    const applyRes = await request(app)
      .post(`/api/applications/${listingId}/apply`)
      .set("Authorization", `Bearer ${applicantToken}`)
      .send(applicationData);

    const appId = applyRes.body._id;

    const res = await request(app)
      .get(`/api/applications/${appId}`)
      .set("Authorization", `Bearer ${posterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.applicantId.name).toBeDefined();
    expect(res.body.listingId.title).toBeDefined();
  });

  it("returns 404 for nonexistent application", async () => {
    const token = await registerAndGetToken(posterData);
    const res = await request(app)
      .get("/api/applications/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 400 (not 500) for a malformed id", async () => {
    const token = await registerAndGetToken(posterData);
    const res = await request(app)
      .get("/api/applications/not-a-valid-id")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});
