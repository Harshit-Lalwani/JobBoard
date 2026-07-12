import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { validateBody } from "../middleware/validate.js";
import { registerSchema, loginSchema } from "../validation/auth.schema.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/register", validateBody(registerSchema), authController.register);
router.post("/login", validateBody(loginSchema), authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", requireAuth, authController.logout);

export default router;
