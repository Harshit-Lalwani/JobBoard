import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

/**
 * Local-disk file storage. This is the one place that knows *how* files are persisted — swapping
 * to S3 later means changing only this function's body (write to a bucket, return the S3 URL
 * instead of a local path) with the same signature, not touching the upload route/controller.
 */
export function saveFile(file) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const ext = path.extname(file.originalname);
  const filename = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);

  return `/uploads/${filename}`;
}
