import { z } from "zod";
import { USER_ROLES } from "../models/User.js";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(USER_ROLES, {
    errorMap: () => ({ message: `Role must be one of: ${USER_ROLES.join(", ")}` }),
  }),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
