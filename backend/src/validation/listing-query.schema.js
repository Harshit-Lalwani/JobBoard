import { z } from "zod";
import { LISTING_STATUSES } from "../models/Listing.js";

export const listingsQuerySchema = z.object({
  // Text search on title/description
  search: z.string().trim().optional(),

  // Filters
  tags: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (typeof v === "string" ? [v] : v))
    .optional(),
  location: z.string().trim().optional(),
  status: z
    .enum(LISTING_STATUSES)
    .optional()
    .default("open"),

  // Pagination
  cursor: z.string().trim().optional(),
  limit: z
    .string()
    .transform(Number)
    .refine((n) => n > 0 && n <= 100, "Limit must be between 1 and 100")
    .optional()
    .default("10"),
});
