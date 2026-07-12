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
    expect(res.body.items).toEqual([]);
    expect(res.body.nextCursor).toBeNull();
  });

  it("returns open listings only with pagination", async () => {
    const posterToken = await registerAndGetToken(posterData);
    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send(listingData);

    const res = await request(app).get("/api/listings");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe(listingData.title);
    expect(res.body.nextCursor).toBeNull();
  });

  it("filters by tags", async () => {
    const posterToken = await registerAndGetToken(posterData);
    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ ...listingData, tags: ["node", "python"] });

    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ ...listingData, title: "Junior Python Dev", tags: ["python", "django"] });

    const res = await request(app).get("/api/listings?tags=node");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe(listingData.title);
  });

  it("filters by location", async () => {
    const posterToken = await registerAndGetToken(posterData);
    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send(listingData);

    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ ...listingData, title: "NYC Engineer", location: "New York" });

    const res = await request(app).get("/api/listings?location=Remote");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].location).toBe("Remote");
  });

  it("searches by text (title/description)", async () => {
    const posterToken = await registerAndGetToken(posterData);
    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send(listingData);

    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ ...listingData, title: "Frontend Designer", description: "Design UIs" });

    const res = await request(app).get("/api/listings?search=scalable");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].description).toContain("scalable");
  });

  it("excludes closed listings from the default browse", async () => {
    const posterToken = await registerAndGetToken(posterData);
    const createRes = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send(listingData);

    await request(app)
      .put(`/api/listings/${createRes.body._id}`)
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ status: "closed" });

    const res = await request(app).get("/api/listings");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it("combines tags, location, and status filters together", async () => {
    const posterToken = await registerAndGetToken(posterData);
    // Matches all filters
    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ ...listingData, tags: ["node"], location: "Remote" });

    // Right tag, wrong location
    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ ...listingData, title: "Wrong Location", tags: ["node"], location: "Onsite" });

    // Wrong tag, right location
    await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${posterToken}`)
      .send({ ...listingData, title: "Wrong Tag", tags: ["python"], location: "Remote" });

    const res = await request(app).get("/api/listings?tags=node&location=Remote&status=open");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe(listingData.title);
  });

  it("rejects an out-of-range limit with 400", async () => {
    const res = await request(app).get("/api/listings?limit=500");
    expect(res.status).toBe(400);
  });

  it("rejects an invalid status filter with 400", async () => {
    const res = await request(app).get("/api/listings?status=archived");
    expect(res.status).toBe(400);
  });

  it("paginates with cursor", async () => {
    const posterToken = await registerAndGetToken(posterData);

    // Create 3 listings
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post("/api/listings")
        .set("Authorization", `Bearer ${posterToken}`)
        .send({ ...listingData, title: `Listing ${i}` });
      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // First page (limit 2)
    const res1 = await request(app).get("/api/listings?limit=2");
    expect(res1.status).toBe(200);
    expect(res1.body.items).toHaveLength(2);
    expect(res1.body.nextCursor).toBeDefined();

    // Second page using cursor
    const res2 = await request(app).get(`/api/listings?limit=2&cursor=${res1.body.nextCursor}`);
    expect(res2.status).toBe(200);
    expect(res2.body.items).toHaveLength(1);
    expect(res2.body.nextCursor).toBeNull();
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

  it("returns 400 (not 500) for a malformed id", async () => {
    const res = await request(app).get("/api/listings/not-a-valid-id");
    expect(res.status).toBe(400);
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
