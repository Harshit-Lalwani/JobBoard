import { Application } from "../models/Application.js";
import { Listing } from "../models/Listing.js";
import { ApiError } from "../middleware/errorHandler.js";
import { isLegalTransition } from "../utils/statusMachine.js";

// Reverses the atomic claim in apply() when a slot was claimed but no application was ultimately
// created (duplicate applicant — see below). Deliberately does NOT reopen an auto-closed listing:
// that would be ambiguous against a poster manually closing the listing at the same moment, and a
// slot freed by this specific edge case (duplicate-key collision on the very last slot) is rare
// enough that requiring the poster to manually reopen is an acceptable, safe default.
async function releaseSlot(listingId) {
  await Listing.updateOne({ _id: listingId }, { $inc: { filledCount: -1 } });
}

export async function apply(listingId, applicantId, data) {
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }

  const isLimited = listing.openings != null;

  if (isLimited) {
    // Atomic slot claim: a plain query operator can't compare filledCount against another field
    // in the same document (filledCount: { $lt: "$openings" } silently matches nothing — it treats
    // "$openings" as a literal string, not a field reference; see DECISIONS.md). $expr is required.
    // The pipeline-form update also auto-closes the listing in the same atomic operation once the
    // increment fills the last slot, so "claim" and "auto-close" can never observably race each
    // other. No transaction needed - it's a single document.
    const claimed = await Listing.findOneAndUpdate(
      { _id: listingId, status: "open", $expr: { $lt: ["$filledCount", "$openings"] } },
      [
        {
          $set: {
            filledCount: { $add: ["$filledCount", 1] },
            status: {
              $cond: [{ $gte: [{ $add: ["$filledCount", 1] }, "$openings"] }, "closed", "$status"],
            },
          },
        },
      ],
      { new: true }
    );
    if (!claimed) {
      // The claim's own filter already made the correctness decision atomically; this re-read is
      // only to report *which* reason applies, not to re-decide.
      const current = await Listing.findById(listingId);
      if (!current || current.status !== "open") {
        throw new ApiError(409, "This listing is closed");
      }
      throw new ApiError(409, "This listing has no openings remaining");
    }
  } else if (listing.status !== "open") {
    throw new ApiError(409, "This listing is closed");
  }

  try {
    // Check if already applied (db unique constraint is the guard; this is defense-in-depth).
    const existing = await Application.findOne({ listingId, applicantId });
    if (existing) {
      if (isLimited) await releaseSlot(listingId);
      throw new ApiError(409, "You have already applied to this listing");
    }

    return await Application.create({
      listingId,
      applicantId,
      resumeUrl: data.resumeUrl,
      coverNote: data.coverNote,
    });
  } catch (err) {
    // Duplicate-key race: two concurrent first-time applies from the same applicant can both pass
    // the findOne check above and both reach create() - the unique index (Application.js) catches
    // the loser here. Same compensation either way this is detected.
    if (err.code === 11000) {
      if (isLimited) await releaseSlot(listingId);
      throw new ApiError(409, "You have already applied to this listing");
    }
    throw err;
  }
}

export async function getApplicationsForListing(listingId, posterId) {
  // Verify the poster owns this listing (basic authz check)
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }
  if (listing.posterId.toString() !== posterId.toString()) {
    throw new ApiError(403, "You can only view applications for your own listings");
  }

  const applications = await Application.find({ listingId })
    .populate("applicantId", "name email")
    .sort({ createdAt: -1 });

  return applications;
}

export async function updateApplicationStatus(applicationId, posterId, data) {
  const application = await Application.findById(applicationId);
  if (!application) {
    throw new ApiError(404, "Application not found");
  }

  // Verify the poster owns the listing this application is for
  const listing = await Listing.findById(application.listingId);
  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }
  if (listing.posterId.toString() !== posterId.toString()) {
    throw new ApiError(403, "You can only update applications for your own listings");
  }

  // Enforce the legal-transition state machine against the status we just read.
  const fromStatus = application.status;
  if (!isLegalTransition(fromStatus, data.status)) {
    throw new ApiError(400, `Cannot transition from '${fromStatus}' to '${data.status}'`);
  }

  // Compare-and-swap: the write is guarded by the exact status this request validated the
  // transition against, not just "the current status, whatever it now is." A plain
  // read-modify-write here (read status, validate, then blindly write) lets two concurrent
  // requests both read the same stale status, both pass validation independently, and the second
  // write silently clobbers the first — including bypassing a terminal state like 'rejected' (see
  // agent-comms/DECISIONS.md for a live-reproduced example). If another request changed the status
  // in between our read and this write, `updated` comes back null and we report a clean 409
  // instead of corrupting statusHistory.
  const updated = await Application.findOneAndUpdate(
    { _id: applicationId, status: fromStatus },
    { $set: { status: data.status }, $push: { statusHistory: { status: data.status } } },
    { new: true }
  );
  if (!updated) {
    throw new ApiError(
      409,
      "This application's status was changed by someone else — please refresh and try again"
    );
  }

  return updated;
}

// Applicant-scoped: all of the current applicant's own applications across every listing they've
// applied to, newest first, with the listing title populated so the UI can show what each row is
// for without a second round trip per row.
export async function getApplicationsForApplicant(applicantId) {
  const applications = await Application.find({ applicantId })
    .populate("listingId", "title location status")
    .sort({ createdAt: -1 });

  return applications;
}

export async function getApplicationById(applicationId) {
  const application = await Application.findById(applicationId)
    .populate("applicantId", "name email")
    .populate("listingId", "title");

  if (!application) {
    throw new ApiError(404, "Application not found");
  }

  return application;
}
