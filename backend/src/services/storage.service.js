import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

/**
 * The one place that knows *how* files are persisted. Uses Vercel Blob when
 * BLOB_READ_WRITE_TOKEN is configured (production on Vercel — local disk isn't writable/durable
 * there); falls back to local disk otherwise (local dev, tests, or any non-Vercel host), with no
 * env var needed to opt in. The upload route/controller never know which one ran.
 */
export async function saveFile(file) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const filename = `${crypto.randomUUID()}${path.extname(file.originalname)}`;
    const blob = await put(filename, file.buffer, {
      access: "public",
      contentType: file.mimetype,
    });
    return blob.url;
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}${path.extname(file.originalname)}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);
  return `/uploads/${filename}`;
}
