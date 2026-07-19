import mongoose from "mongoose";

const { Schema } = mongoose;

export const LISTING_STATUSES = ["open", "closed"];

const listingSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    tags: { type: [String], default: [], index: true },
    location: { type: String, required: true, trim: true },
    posterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: LISTING_STATUSES, default: "open" },
    // null = unlimited openings (the default — preserves existing behavior for every listing
    // created before this field existed, and for posters who don't care to cap applicants).
    // The slot-claim guard in application.service.js only activates when this is a number.
    openings: { type: Number, default: null, min: 1 },
    filledCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

// Text index powers full-text search on title/description (Phase 5).
// Title is weighted higher than description so title matches rank above body matches.
listingSchema.index(
  { title: "text", description: "text" },
  { weights: { title: 5, description: 1 }, name: "listing_text_search" }
);

// Compound index backs the common filter combo (tags + location + status) used by
// the browse/filter endpoint (Phase 5) so those queries can be served from the index
// instead of a collection scan.
listingSchema.index(
  { tags: 1, location: 1, status: 1 },
  { name: "listing_filter_compound" }
);

// Supports cursor-based pagination ordered by newest-first with a unique tiebreaker.
listingSchema.index({ createdAt: -1, _id: -1 }, { name: "listing_cursor_pagination" });

export const Listing = mongoose.model("Listing", listingSchema);
