import { Router } from "express";
import * as listingController from "../controllers/listing.controller.js";
import { validateBody } from "../middleware/validate.js";
import { createListingSchema, updateListingSchema } from "../validation/listing.schema.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Public list (anyone can browse)
router.get("/", listingController.listListings);

// Public get (anyone can view details)
router.get("/:id", listingController.getListing);

// Poster-only create
router.post(
  "/",
  requireAuth,
  requireRole("poster"),
  validateBody(createListingSchema),
  listingController.createListing
);

// Poster-only update
router.put(
  "/:id",
  requireAuth,
  requireRole("poster"),
  validateBody(updateListingSchema),
  listingController.updateListing
);

// Poster-only delete
router.delete("/:id", requireAuth, requireRole("poster"), listingController.deleteListing);

export default router;
