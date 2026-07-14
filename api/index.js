import { createApp } from "../backend/src/app.js";
import { connectDB } from "../backend/src/config/db.js";

// This file must live at the repo root under a literal `api/` directory — Vercel only
// auto-discovers Serverless Functions there (relative to the project's Root Directory). A
// nested path like `backend/api/index.js` is invisible to that discovery step even when
// referenced explicitly in vercel.json's `functions` key, which is what originally broke the
// deploy ("doesn't match any Serverless Functions inside the `api` directory").
const app = createApp();

// Connects once when this module is first loaded by a serverless instance (not once per
// request) — subsequent invocations on the same warm instance reuse the same connection.
const ready = connectDB();

export default async function handler(req, res) {
  await ready;
  return app(req, res);
}
