import mongoose from "mongoose";
import { connect, closeDatabase, clearDatabase } from "../setupTestDB.js";
import { Listing } from "../../src/models/Listing.js";

beforeAll(async () => {
  await connect();
  await Listing.init(); // ensure indexes are built before we assert on them
});
afterEach(clearDatabase);
afterAll(closeDatabase);

const posterId = new mongoose.Types.ObjectId();

describe("Listing model", () => {
  it("saves a valid listing with default status", async () => {
    const listing = await Listing.create({
      title: "Backend Engineer",
      description: "Build APIs",
      tags: ["node", "mongodb"],
      location: "Remote",
      posterId,
    });

    expect(listing.status).toBe("open");
    expect(listing.createdAt).toBeInstanceOf(Date);
  });

  it("rejects a missing required field", async () => {
    await expect(
      Listing.create({
        description: "No title",
        location: "Remote",
        posterId,
      })
    ).rejects.toThrow(/title/i);
  });

  it("rejects a status outside the allowed enum", async () => {
    await expect(
      Listing.create({
        title: "Bad Status",
        description: "desc",
        location: "Remote",
        posterId,
        status: "archived",
      })
    ).rejects.toThrow();
  });

  it("exposes the indexes backing search/filter/pagination (Phase 3 — see DECISIONS.md for why the original text/compound indexes were replaced)", async () => {
    const indexes = await Listing.collection.indexes();
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain("listing_cursor_pagination");
    expect(indexNames).toContain("listing_search_terms");
    expect(indexNames).toContain("listing_tags_filter");
    expect(indexNames).toContain("listing_location_filter");
    expect(indexNames).toContain("listing_poster_listings");
  });

  it("derives searchTerms and locationLower automatically, and lowercases tags", async () => {
    const listing = await Listing.create({
      title: "Machine Learning Engineer",
      description: "Build scalable systems",
      tags: ["Node", "MongoDB"],
      location: "New York",
      posterId,
    });

    expect(listing.searchTerms).toEqual(
      expect.arrayContaining(["machine", "learning", "engineer", "build", "scalable", "systems"])
    );
    expect(listing.locationLower).toBe("new york");
    expect(listing.tags).toEqual(["node", "mongodb"]);
  });
});
