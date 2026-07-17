// Runs before any test file's imports, so before config/env.js's dotenv.config() call. dotenv
// only fills in vars that don't already exist in process.env — pre-setting these to "" here means
// dotenv leaves them alone, so tests always exercise storage.service.js's local-disk fallback
// deterministically, regardless of what cloud storage credentials happen to be in a developer's
// real backend/.env. Without this, npm test would silently upload real files to whatever GCS
// bucket / Vercel Blob store the developer has configured locally.
process.env.GCS_BUCKET = "";
process.env.GOOGLE_APPLICATION_CREDENTIALS = "";
process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = "";
process.env.BLOB_READ_WRITE_TOKEN = "";
