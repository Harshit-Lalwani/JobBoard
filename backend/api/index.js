import { createApp } from "../src/app.js";
import { connectDB } from "../src/config/db.js";

const app = createApp();

// Connects once when this module is first loaded by a serverless instance (not once per
// request) — subsequent invocations on the same warm instance reuse the same connection.
const ready = connectDB();

export default async function handler(req, res) {
  await ready;
  return app(req, res);
}
