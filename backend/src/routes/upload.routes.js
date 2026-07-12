import { Router } from "express";
import * as uploadController from "../controllers/upload.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadResume } from "../middleware/upload.js";

const router = Router();

router.post("/resume", requireAuth, uploadResume, uploadController.uploadResume);

export default router;
