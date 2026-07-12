import mongoose from "mongoose";
import { connect, closeDatabase, clearDatabase } from "../setupTestDB.js";
import { Application } from "../../src/models/Application.js";

beforeAll(async () => {
  await connect();
  await Application.init(); // ensure the unique (listingId, applicantId) index is built
});
afterEach(clearDatabase);
afterAll(closeDatabase);

const listingId = new mongoose.Types.ObjectId();
const applicantId = new mongoose.Types.ObjectId();

describe("Application model", () => {
  it("defaults to status 'applied' with a matching statusHistory entry", async () => {
    const application = await Application.create({
      listingId,
      applicantId,
      resumeUrl: "/uploads/resume.pdf",
    });

    expect(application.status).toBe("applied");
    expect(application.statusHistory).toHaveLength(1);
    expect(application.statusHistory[0].status).toBe("applied");
  });

  it("rejects a status outside the allowed enum", async () => {
    await expect(
      Application.create({
        listingId,
        applicantId,
        resumeUrl: "/uploads/resume.pdf",
        status: "hired",
      })
    ).rejects.toThrow();
  });

  it("rejects a missing required field", async () => {
    await expect(
      Application.create({
        listingId,
        applicantId,
      })
    ).rejects.toThrow(/resumeUrl/i);
  });

  it("enforces one application per (listing, applicant) pair", async () => {
    await Application.create({
      listingId,
      applicantId,
      resumeUrl: "/uploads/resume.pdf",
    });

    await expect(
      Application.create({
        listingId,
        applicantId,
        resumeUrl: "/uploads/resume-2.pdf",
      })
    ).rejects.toThrow();
  });
});
