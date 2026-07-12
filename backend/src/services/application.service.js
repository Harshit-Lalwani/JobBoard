import { Application } from "../models/Application.js";
import { Listing } from "../models/Listing.js";
import { ApiError } from "../middleware/errorHandler.js";
import { isLegalTransition } from "../utils/statusMachine.js";

export async function apply(listingId, applicantId, data) {
  // Check if already applied (db unique constraint is the guard; this is defense-in-depth)
  const existing = await Application.findOne({ listingId, applicantId });
  if (existing) {
    throw new ApiError(409, "You have already applied to this listing");
  }

  const application = await Application.create({
    listingId,
    applicantId,
    resumeUrl: data.resumeUrl,
    coverNote: data.coverNote,
  });

  return application;
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

  // Enforce the legal-transition state machine
  if (!isLegalTransition(application.status, data.status)) {
    throw new ApiError(400, `Cannot transition from '${application.status}' to '${data.status}'`);
  }

  application.status = data.status;
  application.statusHistory.push({ status: data.status });
  await application.save();

  return application;
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
