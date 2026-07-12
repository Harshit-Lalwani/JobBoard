import { Router } from "express";
import * as applicationController from "../controllers/application.controller.js";
import { validateBody } from "../middleware/validate.js";
import {
  applySchema,
  updateApplicationStatusSchema,
} from "../validation/application.schema.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { applyRateLimiter } from "../middleware/rateLimit.js";

const router = Router();

// Applicant applies to a listing
router.post(
  "/:listingId/apply",
  requireAuth,
  requireRole("applicant"),
  applyRateLimiter,
  validateBody(applySchema),
  applicationController.apply
);

// Poster views applications for one of their listings
router.get(
  "/listing/:listingId",
  requireAuth,
  requireRole("poster"),
  applicationController.getApplicationsForListing
);

// Applicant-only: all of the current applicant's own applications, across every listing. Must be
// registered before "/:applicationId" — otherwise Express would match "mine" as that param.
router.get(
  "/mine",
  requireAuth,
  requireRole("applicant"),
  applicationController.getApplicationsForApplicant
);

// Get details of a single application (for now, no auth — could restrict to applicant or poster)
router.get("/:applicationId", requireAuth, applicationController.getApplicationById);

// Poster moves an applicant through the pipeline
router.put(
  "/:applicationId/status",
  requireAuth,
  requireRole("poster"),
  validateBody(updateApplicationStatusSchema),
  applicationController.updateApplicationStatus
);

export default router;
