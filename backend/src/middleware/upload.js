import multer from "multer";
import { ApiError } from "./errorHandler.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

// memoryStorage, not diskStorage: keeps multer's job to "parse the multipart request" only —
// actually persisting the file is storage.service.js's job, so swapping storage backends later
// doesn't touch this middleware.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new ApiError(400, "Only PDF files are accepted"));
    }
    cb(null, true);
  },
});

export const uploadResume = upload.single("resume");
