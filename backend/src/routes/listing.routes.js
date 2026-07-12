import { Router } from "express";
import * as listingController from "../controllers/listing.controller.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { createListingSchema, updateListingSchema } from "../validation/listing.schema.js";
import { listingsQuerySchema } from "../validation/listing-query.schema.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Public list with search/filter/pagination (anyone can browse)
router.get("/", validateQuery(listingsQuerySchema), listingController.listListings);

// Poster-only: all of the current poster's own listings, any status. Must be registered
// before "/:id" — otherwise Express would match "mine" as an :id param.
router.get("/mine", requireAuth, requireRole("poster"), listingController.listMyListings);

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
