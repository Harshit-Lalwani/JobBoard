import path from "node:path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import listingRoutes from "./routes/listing.routes.js";
import applicationRoutes from "./routes/application.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

  // Serves files saved by storage.service.js — only meaningful for the local-disk backend;
  // an S3 swap would drop this line and return real S3 URLs from saveFile() instead.
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  app.use(healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/listings", listingRoutes);
  app.use("/api/applications", applicationRoutes);
  app.use("/api/uploads", uploadRoutes);

  // All API routes are mounted.

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
