import { z } from "zod";
import { APPLICATION_STATUSES } from "../models/Application.js";

export const applySchema = z.object({
  resumeUrl: z.string().trim().min(1, "Resume URL is required"),
  coverNote: z.string().trim().default(""),
});

export const updateApplicationStatusSchema = z.object({
  status: z.enum(APPLICATION_STATUSES, {
    errorMap: () => ({ message: `Status must be one of: ${APPLICATION_STATUSES.join(", ")}` }),
  }),
});
