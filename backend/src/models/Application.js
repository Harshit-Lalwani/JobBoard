import mongoose from "mongoose";

const { Schema } = mongoose;

export const APPLICATION_STATUSES = [
  "applied",
  "shortlisted",
  "interview",
  "offer",
  "rejected",
];

// One entry per status change, oldest first — the audit trail for the pipeline.
// The legal-transition state machine itself lives in Phase 4 (services layer), not here;
// this schema only records history, it doesn't enforce transitions.
const statusHistoryEntrySchema = new Schema(
  {
    status: { type: String, enum: APPLICATION_STATUSES, required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const applicationSchema = new Schema(
  {
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    applicantId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    resumeUrl: { type: String, required: true },
    coverNote: { type: String, default: "" },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: "applied",
    },
    statusHistory: {
      type: [statusHistoryEntrySchema],
      default: () => [{ status: "applied" }],
    },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

// One application per (listing, applicant) pair — an applicant can't apply twice to the same listing.
applicationSchema.index({ listingId: 1, applicantId: 1 }, { unique: true });

// Poster-only "list applicants for a listing" endpoint (Phase 4) filters/sorts by these fields.
applicationSchema.index({ listingId: 1, status: 1 });

export const Application = mongoose.model("Application", applicationSchema);
