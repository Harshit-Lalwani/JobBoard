import { connect, closeDatabase, clearDatabase } from "../setupTestDB.js";
import { User } from "../../src/models/User.js";

beforeAll(async () => {
  await connect();
  await User.init(); // ensure the unique-email index is built before we test it
});
afterEach(clearDatabase);
afterAll(closeDatabase);

describe("User model", () => {
  it("saves a valid user", async () => {
    const user = await User.create({
      name: "Ada Lovelace",
      email: "ada@example.com",
      passwordHash: "hashed",
      role: "applicant",
    });

    expect(user._id).toBeDefined();
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it("rejects a missing required field", async () => {
    await expect(
      User.create({
        name: "No Email",
        passwordHash: "hashed",
        role: "applicant",
      })
    ).rejects.toThrow(/email/i);
  });

  it("rejects a role outside the allowed enum", async () => {
    await expect(
      User.create({
        name: "Bad Role",
        email: "bad-role@example.com",
        passwordHash: "hashed",
        role: "admin",
      })
    ).rejects.toThrow();
  });

  it("enforces unique email", async () => {
    await User.create({
      name: "First",
      email: "dup@example.com",
      passwordHash: "hashed",
      role: "poster",
    });

    await expect(
      User.create({
        name: "Second",
        email: "dup@example.com",
        passwordHash: "hashed",
        role: "poster",
      })
    ).rejects.toThrow();
  });
});
