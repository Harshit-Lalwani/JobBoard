import request from "supertest";
import { connect, closeDatabase, clearDatabase } from "../setupTestDB.js";
import { createApp } from "../../src/app.js";

const app = createApp();

beforeAll(connect);
afterEach(clearDatabase);
afterAll(closeDatabase);

const applicant = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: "correct-horse-battery",
  role: "applicant",
};

function getRefreshCookie(res) {
  const setCookie = res.headers["set-cookie"] ?? [];
  const raw = setCookie.find((c) => c.startsWith("refreshToken="));
  return raw?.split(";")[0];
}

describe("POST /api/auth/register", () => {
  it("creates a user and returns an access token + refresh cookie", async () => {
    const res = await request(app).post("/api/auth/register").send(applicant);

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: applicant.email, role: "applicant" });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(getRefreshCookie(res)).toBeDefined();
  });

  it("rejects a duplicate email with 409", async () => {
    await request(app).post("/api/auth/register").send(applicant);
    const res = await request(app).post("/api/auth/register").send(applicant);

    expect(res.status).toBe(409);
  });

  it("rejects an invalid payload with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...applicant, email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.error.details.email).toBeDefined();
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    await request(app).post("/api/auth/register").send(applicant);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: applicant.email, password: applicant.password });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it("rejects wrong password with 401", async () => {
    await request(app).post("/api/auth/register").send(applicant);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: applicant.email, password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("rejects an unknown email with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever123" });

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  it("issues a new access token given a valid refresh cookie", async () => {
    const registerRes = await request(app).post("/api/auth/register").send(applicant);
    const refreshCookie = getRefreshCookie(registerRes);

    const res = await request(app).post("/api/auth/refresh").set("Cookie", refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it("rejects with 401 when no refresh cookie is sent", async () => {
    const res = await request(app).post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("rejects with 401 after logout revokes the refresh token", async () => {
    const registerRes = await request(app).post("/api/auth/register").send(applicant);
    const refreshCookie = getRefreshCookie(registerRes);
    const accessToken = registerRes.body.accessToken;

    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", refreshCookie);

    const res = await request(app).post("/api/auth/refresh").set("Cookie", refreshCookie);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("requires authentication", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user for a valid access token", async () => {
    const registerRes = await request(app).post("/api/auth/register").send(applicant);
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${registerRes.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: applicant.email, role: "applicant" });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
