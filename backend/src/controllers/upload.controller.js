import { ApiError } from "../middleware/errorHandler.js";
import { saveFile } from "../services/storage.service.js";

export async function uploadResume(req, res, next) {
  try {
    if (!req.file) {
      throw new ApiError(400, "No file uploaded (expected field name 'resume')");
    }
    const url = await saveFile(req.file);
    res.status(201).json({ url });
  } catch (err) {
    next(err);
  }
}
