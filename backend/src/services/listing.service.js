import { Listing } from "../models/Listing.js";
import { ApiError } from "../middleware/errorHandler.js";

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

export async function listListings() {
  const listings = await Listing.find({ status: "open" }).populate(
    "posterId",
    "name email"
  );
  return listings;
}
