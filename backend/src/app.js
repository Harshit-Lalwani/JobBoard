import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

  app.use(healthRoutes);

  // Phase 2+ will mount /api/auth, /api/listings, /api/applications here.

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
