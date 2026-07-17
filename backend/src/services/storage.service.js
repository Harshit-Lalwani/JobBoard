import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

/**
 * The one place that knows *how* files are persisted. Tries, in order: Google Cloud Storage
 * (GCS_BUCKET set — the primary target), Vercel Blob (BLOB_READ_WRITE_TOKEN set), then local disk
 * (dev/tests, or any host with neither configured). GCS is checked first so it wins if both
 * happen to be configured — it's the intended primary backend; Vercel Blob is the fallback for a
 * pure-Vercel deploy with no GCP project. The upload route/controller never know which one ran.
 */
export async function saveFile(file) {
  if (process.env.GCS_BUCKET) {
    return saveToGCS(file);
  }

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

// GOOGLE_APPLICATION_CREDENTIALS (a file path) is the standard way the client library picks up
// service-account credentials automatically — fine for local dev or a GCP-hosted runtime, but a
// serverless platform like Vercel has nowhere durable to put that file. GOOGLE_APPLICATION_CREDENTIALS_JSON
// (the key file's contents, pasted as a single env var) covers that case; when set, it takes
// precedence and is passed to the Storage client directly instead of relying on file-path lookup.
//
// No .makePublic() call: this deliberately targets buckets with Uniform Bucket-Level Access (GCS's
// default and recommended setting for new buckets), which disables the legacy per-object ACL API
// .makePublic() depends on — calling it would throw on such a bucket. Public read is granted once,
// at the bucket level, via IAM (roles/storage.objectViewer for allUsers) as a one-time setup step
// instead — see DEPLOYMENT.md.
async function saveToGCS(file) {
  const { Storage } = await import("@google-cloud/storage");
  const storage = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    ? new Storage({ credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) })
    : new Storage();

  const bucket = storage.bucket(process.env.GCS_BUCKET);
  const filename = `${crypto.randomUUID()}${path.extname(file.originalname)}`;
  await bucket.file(filename).save(file.buffer, { contentType: file.mimetype });

  return `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${filename}`;
}
