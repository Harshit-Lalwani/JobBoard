// Unit tests for getListing()'s cache hit/miss/invalidation logic. tests/setupEnv.js blanks the
// Upstash env vars globally so config/redis.js's `redis` export is null in the rest of the suite
// (no cache, matching pre-Phase-4 behavior exactly); this file mocks config/redis.js directly to
// exercise the cache branch without a real network call.
import { jest } from "@jest/globals";

const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDel = jest.fn();

jest.unstable_mockModule("../../src/config/redis.js", () => ({
  redis: { get: mockGet, set: mockSet, del: mockDel },
}));

const { connect, closeDatabase, clearDatabase } = await import("../setupTestDB.js");
const { Listing } = await import("../../src/models/Listing.js");
const { User } = await import("../../src/models/User.js");
const { getListing, updateListing, deleteListing } = await import("../../src/services/listing.service.js");

beforeAll(connect);
afterEach(() => {
  jest.clearAllMocks();
});
afterEach(clearDatabase);
afterAll(closeDatabase);

async function makeListing() {
  const poster = await User.create({ name: "P", email: "cache-test@example.com", passwordHash: "x", role: "poster" });
  return Listing.create({ title: "Cache Test", description: "test", location: "Remote", posterId: poster._id });
}

describe("getListing — cache behavior", () => {
  it("on a cache miss, queries the DB and populates the cache with a TTL", async () => {
    mockGet.mockResolvedValue(null);
    const listing = await makeListing();

    const result = await getListing(listing._id.toString());

    expect(result.cacheHit).toBe(false);
    expect(result.listing.title).toBe("Cache Test");
    expect(mockSet).toHaveBeenCalledWith(
      `jobboard:listing:${listing._id}`,
      expect.objectContaining({ title: "Cache Test" }),
      { ex: 30 }
    );
  });

  it("on a cache hit, returns the cached value and never queries the DB", async () => {
    const listing = await makeListing();
    mockGet.mockResolvedValue({ _id: listing._id.toString(), title: "Stale Cached Title" });

    const result = await getListing(listing._id.toString());

    expect(result.cacheHit).toBe(true);
    expect(result.listing.title).toBe("Stale Cached Title");
  });

  it("fails open (falls through to the DB) if the cache read itself throws", async () => {
    mockGet.mockRejectedValue(new Error("upstash unreachable"));
    const listing = await makeListing();

    const result = await getListing(listing._id.toString());

    expect(result.cacheHit).toBe(false);
    expect(result.listing.title).toBe("Cache Test");
  });

  it("invalidates the cache entry on update", async () => {
    mockGet.mockResolvedValue(null);
    const listing = await makeListing();
    const poster = await User.findById(listing.posterId);

    await updateListing(listing._id.toString(), poster._id.toString(), { title: "Updated Title" });

    expect(mockDel).toHaveBeenCalledWith(`jobboard:listing:${listing._id}`);
  });

  it("invalidates the cache entry on delete", async () => {
    mockGet.mockResolvedValue(null);
    const listing = await makeListing();
    const poster = await User.findById(listing.posterId);

    await deleteListing(listing._id.toString(), poster._id.toString());

    expect(mockDel).toHaveBeenCalledWith(`jobboard:listing:${listing._id}`);
  });
});
