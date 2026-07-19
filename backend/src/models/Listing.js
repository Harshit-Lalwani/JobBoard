import mongoose from "mongoose";
import { computeSearchTerms } from "../utils/searchTerms.js";

const { Schema } = mongoose;

export const LISTING_STATUSES = ["open", "closed"];

const listingSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    // Lowercased at the schema level so tag filtering can use a case-sensitive (and therefore
    // indexable) anchored regex without a separate normalized field — tags are short keywords
    // where display casing doesn't carry the meaning a location or title's does.
    tags: { type: [{ type: String, lowercase: true, trim: true }], default: [] },
    location: { type: String, required: true, trim: true },
    // Lowercased copy of `location`, used only for indexed filtering — `location` itself keeps its
    // original casing for display ("New York", not "new york").
    locationLower: { type: String },
    // Deduplicated lowercase word tokens from title+description — see utils/searchTerms.js. Backs
    // the search filter with an indexable anchored prefix match instead of an unanchored
    // case-insensitive regex scan (see Phase 3 in agent-comms/DECISIONS.md for the full story).
    searchTerms: { type: [String] },
    posterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: LISTING_STATUSES, default: "open" },
    // null = unlimited openings (the default — preserves existing behavior for every listing
    // created before this field existed, and for posters who don't care to cap applicants).
    // The slot-claim guard in application.service.js only activates when this is a number.
    openings: { type: Number, default: null, min: 1 },
    filledCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
    // Guards updateListing()'s load-then-.save() against lost updates: a stale .save() (the
    // in-memory document's __v no longer matches what's in the database) throws VersionError
    // instead of silently overwriting a concurrent edit. Scoped to this schema only — it has no
    // effect on the findOneAndUpdate slot-claim in application.service.js's apply(), which never
    // loads a document via .save() and doesn't touch __v at all.
    optimisticConcurrency: true,
  }
);

// Keeps searchTerms/locationLower in sync with title/description/location on every save
// (create and updateListing's load-then-.save() both go through this), so no call site can forget
// to recompute them — a manually-maintained derived field is exactly the kind of thing that
// silently drifts out of sync otherwise.
listingSchema.pre("validate", function computeDerivedSearchFields() {
  if (this.isModified("title") || this.isModified("description")) {
    this.searchTerms = computeSearchTerms(this.title, this.description);
  }
  if (this.isModified("location")) {
    this.locationLower = this.location.toLowerCase();
  }
});

// Backs GET /api/listings with no search/filter term — pure status + newest-first.
listingSchema.index({ createdAt: -1, _id: -1 }, { name: "listing_cursor_pagination" });

// Backs the `search` query param: status equality + an anchored (no "i" flag — see searchTerms.js)
// prefix match against the searchTerms multikey field, sorted newest-first.
listingSchema.index(
  { status: 1, searchTerms: 1, createdAt: -1, _id: -1 },
  { name: "listing_search_terms" }
);

// Backs the `tags` filter. Separate from the search-terms index above because MongoDB compound
// indexes allow at most one multikey (array) field — tags and searchTerms can't share one index.
listingSchema.index({ status: 1, tags: 1, createdAt: -1, _id: -1 }, { name: "listing_tags_filter" });

// Backs the `location` filter, against the lowercased copy so the same anchored-without-"i"
// technique applies here too.
listingSchema.index(
  { status: 1, locationLower: 1, createdAt: -1, _id: -1 },
  { name: "listing_location_filter" }
);

// Backs listMyListings (a poster's own listings, all statuses) — previously an unindexed
// collection scan + in-memory sort.
listingSchema.index({ posterId: 1, createdAt: -1 }, { name: "listing_poster_listings" });

export const Listing = mongoose.model("Listing", listingSchema);
