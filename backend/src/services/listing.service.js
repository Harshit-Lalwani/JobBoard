import { Listing } from "../models/Listing.js";
import { ApiError } from "../middleware/errorHandler.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";

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
export async function listMyListings(posterId) {
  const listings = await Listing.find({ posterId }).sort({ createdAt: -1 });
  return listings;
}

export async function listListings(query) {
  const { search, tags, location, status = "open", cursor, limit } = query;

  // Build MongoDB query
  const match = { status };

  // Text search: use the text index if a search string is provided
  if (search) {
    match.$text = { $search: search };
  }

  // Filter by tags (multikey $in since tags is an array)
  if (tags && tags.length > 0) {
    match.tags = { $in: tags };
  }

  // Filter by location (exact match)
  if (location) {
    match.location = location;
  }

  // Cursor pagination: if cursor is provided, only return items after this cursor
  if (cursor) {
    const decodedCursor = decodeCursor(cursor);
    if (decodedCursor) {
      match.$or = [
        { createdAt: { $lt: decodedCursor.createdAt } },
        {
          createdAt: decodedCursor.createdAt,
          _id: { $lt: decodedCursor._id },
        },
      ];
    }
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
