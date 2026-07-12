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
