import { Listing } from "../models/Listing.js";
import { ApiError } from "../middleware/errorHandler.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";

// Escapes regex metacharacters in user input before it's used to build a RegExp — without this,
// a search term like "a.b" or "(" would either match too broadly or throw a SyntaxError.
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function createListing(posterId, data) {
  const listing = await Listing.create({
    ...data,
    posterId,
  });
  return listing;
}

export async function getListing(id) {
  const listing = await Listing.findById(id).populate("posterId", "name email");
  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }
  return listing;
}

export async function updateListing(id, posterId, data) {
  const listing = await Listing.findById(id);
  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }
  if (listing.posterId.toString() !== posterId.toString()) {
    throw new ApiError(403, "You can only edit your own listings");
  }

  if (data.openings != null && data.openings < listing.filledCount) {
    throw new ApiError(
      400,
      `openings cannot be less than filledCount (${listing.filledCount} applicants already hold a slot)`
    );
  }

  Object.assign(listing, data);
  await listing.save();
  return listing;
}

export async function deleteListing(id, posterId) {
  const listing = await Listing.findById(id);
  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }
  if (listing.posterId.toString() !== posterId.toString()) {
    throw new ApiError(403, "You can only delete your own listings");
  }

  await Listing.deleteOne({ _id: id });
}

// Poster-scoped: unlike listListings, this returns every status (not just "open") since a
// poster managing their own listings needs to see closed ones too. No pagination — bounded to
// one poster's own listings, not the kind of unbounded public browse Phase 5's cursor is for.
// Backed by the listing_poster_listings index (posterId, createdAt) — previously an unindexed
// collection scan + in-memory sort.
export async function listMyListings(posterId) {
  const listings = await Listing.find({ posterId }).sort({ createdAt: -1 });
  return listings;
}

export async function listListings(query) {
  const { search, tags, location, status = "open", cursor, limit } = query;

  // Build MongoDB query. Two independent $or clauses (search, cursor) can't both live at
  // match.$or — collected into $and instead so neither overwrites the other.
  const match = { status };
  const andConditions = [];

  // Anchored (no "i" flag), lowercase-on-lowercase prefix match against the precomputed
  // searchTerms multikey field (see models/Listing.js / utils/searchTerms.js), instead of an
  // unanchored case-insensitive regex against raw title/description. An unanchored or
  // case-insensitive regex cannot use an index bound at all — confirmed by explain() at 100k-doc
  // scale to be a full collection scan (see BENCHMARKS.md, Finding 4 / agent-comms/DECISIONS.md
  // Phase 3). Lowercasing both the stored data and the query term removes the need for the "i"
  // flag, and anchoring to a per-word field (rather than the raw field) is what makes "ma" still
  // match "Machine" as a *word* prefix — the accepted narrowing versus the old behavior is that a
  // multi-word phrase query, or a mid-word match like "chine", is no longer supported; a
  // single-word prefix (the realistic "type and see results" case) is indexed and fast.
  if (search) {
    const pattern = new RegExp(`^${escapeRegExp(search.toLowerCase())}`);
    andConditions.push({ searchTerms: pattern });
  }

  // Anchored prefix match per tag against the already-lowercased `tags` field (schema-level
  // `lowercase: true`), same reasoning as search above.
  if (tags && tags.length > 0) {
    match.tags = { $in: tags.map((tag) => new RegExp(`^${escapeRegExp(tag.toLowerCase())}`)) };
  }

  // Anchored prefix match against `locationLower`, same reasoning as search above. Narrows
  // "substring anywhere" to "prefix of the location string" — covers the realistic case (typing
  // the start of a city/region name) and stays indexed; documented in DECISIONS.md.
  if (location) {
    match.locationLower = new RegExp(`^${escapeRegExp(location.toLowerCase())}`);
  }

  // Cursor pagination: if cursor is provided, only return items after this cursor
  if (cursor) {
    const decodedCursor = decodeCursor(cursor);
    if (decodedCursor) {
      andConditions.push({
        $or: [
          { createdAt: { $lt: decodedCursor.createdAt } },
          {
            createdAt: decodedCursor.createdAt,
            _id: { $lt: decodedCursor._id },
          },
        ],
      });
    }
  }

  if (andConditions.length > 0) {
    match.$and = andConditions;
  }

  // Query with the indexes backing the filters and sort
  const listings = await Listing.find(match)
    .populate("posterId", "name email")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1); // Fetch one extra to know if there's a next page

  // Determine if there's a next page and build the response
  const hasNextPage = listings.length > limit;
  const items = hasNextPage ? listings.slice(0, limit) : listings;
  const nextCursor = hasNextPage ? encodeCursor(items[items.length - 1]) : null;

  return { items, nextCursor };
}
