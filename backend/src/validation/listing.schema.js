import { z } from "zod";
import { LISTING_STATUSES } from "../models/Listing.js";

export const createListingSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().min(1, "Description is required"),
  tags: z.array(z.string().trim()).default([]),
  location: z.string().trim().min(1, "Location is required"),
});

export const updateListingSchema = z.object({
  title: z.string().trim().min(1, "Title is required").optional(),
  description: z.string().trim().min(1, "Description is required").optional(),
  tags: z.array(z.string().trim()).optional(),
  location: z.string().trim().min(1, "Location is required").optional(),
  status: z.enum(LISTING_STATUSES).optional(),
});
