import request from "supertest";
import { connect, closeDatabase, clearDatabase } from "../setupTestDB.js";
import { createApp } from "../../src/app.js";

const app = createApp();

beforeAll(connect);
afterEach(clearDatabase);
afterAll(closeDatabase);

const posterData = {
  name: "Bob Builder",
  email: "bob@example.com",
  password: "contractor1",
  role: "poster",
};

const applicantData = {
  name: "Alice",
  email: "alice@example.com",
  password: "applicant1",
  role: "applicant",
};

const listingData = {
  title: "Senior Backend Engineer",
  description: "Build scalable APIs",
  tags: ["node", "mongodb"],
  location: "Remote",
};

async function registerAndGetToken(data) {
  const res = await request(app).post("/api/auth/register").send(data);
  return res.body.accessToken;
}

describe("GET /api/listings", () => {
  it("returns an empty list initially", async () => {
    const res = await request(app).get("/api/listings");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns open listings only", async () => {
    const posterToken = await registerAndGetToken(posterData);
    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send(listingData);

    const res = await request(app).get("/api/listings");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe(listingData.title);
  });
});

describe("POST /api/listings", () => {
  it("creates a listing (poster only)", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const res = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send(listingData);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject(listingData);
    expect(res.body.status).toBe("open");
    expect(res.body._id).toBeDefined();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).post("/api/listings").send(listingData);
    expect(res.status).toBe(401);
  });

  it("rejects applicants with 403", async () => {
    const applicantToken = await registerAndGetToken(applicantData);
    const res = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send(listingData);

    expect(res.status).toBe(403);
  });

  it("rejects invalid data with 400", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const res = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ title: "No description or location" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/listings/:id", () => {
  it("returns a specific listing", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send(listingData);

    const id = createRes.body._id;
    const res = await request(app).get(`/api/listings/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe(listingData.title);
  });

  it("returns 404 for nonexistent listing", async () => {
    const res = await request(app).get("/api/listings/507f1f77bcf86cd799439011");
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/listings/:id", () => {
  it("updates a listing (poster only)", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send(listingData);

    const id = createRes.body._id;
    const updateData = { title: "Updated Title" };
    const res = await request(app)
      .put(`/api/listings/${id}`)
      .set("Authorization", `Bearer ${posterToken}`)
      .send(updateData);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated Title");
    expect(res.body.description).toBe(listingData.description);
  });

  it("rejects updates by a different poster with 403", async () => {
    const poster1Token = await registerAndGetToken(posterData);
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${poster1Token}`)
      .send(listingData);

    const id = createRes.body._id;

    const poster2 = {
      name: "Alice Builder",
      email: "alice@example.com",
      password: "contractor2",
      role: "poster",
    };
    const poster2Token = await registerAndGetToken(poster2);

    const res = await request(app)
      .put(`/api/listings/${id}`)
      .set("Authorization", `Bearer ${poster2Token}`)
      .send({ title: "Hacked!" });

    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent listing", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const res = await request(app)
      .put("/api/listings/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ title: "New Title" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/listings/:id", () => {
  it("deletes a listing (poster only)", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send(listingData);

    const id = createRes.body._id;
    const res = await request(app)
      .delete(`/api/listings/${id}`)
      .set("Authorization", `Bearer ${posterToken}`);

    expect(res.status).toBe(204);

    const getRes = await request(app).get(`/api/listings/${id}`);
    expect(getRes.status).toBe(404);
  });

  it("rejects deletion by a different poster with 403", async () => {
    const poster1Token = await registerAndGetToken(posterData);
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${poster1Token}`)
      .send(listingData);

    const id = createRes.body._id;

    const poster2 = {
      name: "Charlie Builder",
      email: "charlie@example.com",
      password: "contractor3",
      role: "poster",
    };
    const poster2Token = await registerAndGetToken(poster2);

    const res = await request(app)
      .delete(`/api/listings/${id}`)
      .set("Authorization", `Bearer ${poster2Token}`);

    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent listing", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const res = await request(app)
      .delete("/api/listings/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${posterToken}`);

    expect(res.status).toBe(404);
  });
});
