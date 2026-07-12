import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import listingRoutes from "./routes/listing.routes.js";
import applicationRoutes from "./routes/application.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

  app.use(healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/listings", listingRoutes);
  app.use("/api/applications", applicationRoutes);

  // All API routes are mounted.

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
