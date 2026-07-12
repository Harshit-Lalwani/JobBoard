import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { connect, closeDatabase, clearDatabase } from "../setupTestDB.js";
import { createApp } from "../../src/app.js";

const app = createApp();
const uploadDir = path.resolve(process.cwd(), "uploads");

beforeAll(connect);
afterEach(clearDatabase);
afterAll(async () => {
  await closeDatabase();
  // Clean up any files this suite wrote to the real uploads/ dir.
  if (fs.existsSync(uploadDir)) {
    fs.rmSync(uploadDir, { recursive: true, force: true });
  }
});

const applicantData = {
  name: "Uploader",
  email: "uploader@example.com",
  password: "uploaderpass1",
  role: "applicant",
};

async function registerAndGetToken(data) {
  const res = await request(app).post("/api/auth/register").send(data);
  return res.body.accessToken;
}

describe("POST /api/uploads/resume", () => {
  it("uploads a PDF and returns a fetchable URL", async () => {
    const token = await registerAndGetToken(applicantData);
    const res = await request(app)
      .post("/api/uploads/resume")
      .set("Authorization", `Bearer ${token}`)
      .attach("resume", Buffer.from("%PDF-1.4 fake pdf content"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/uploads\/.+\.pdf$/);

    const fetchRes = await request(app).get(res.body.url);
    expect(fetchRes.status).toBe(200);
  });

  it("rejects a non-PDF file with 400", async () => {
    const token = await registerAndGetToken(applicantData);
    const res = await request(app)
      .post("/api/uploads/resume")
      .set("Authorization", `Bearer ${token}`)
      .attach("resume", Buffer.from("not a pdf"), {
        filename: "resume.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
  });

  it("rejects a request with no file with 400", async () => {
    const token = await registerAndGetToken(applicantData);
    const res = await request(app)
      .post("/api/uploads/resume")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/uploads/resume")
      .attach("resume", Buffer.from("%PDF-1.4 fake pdf content"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(401);
  });
});
