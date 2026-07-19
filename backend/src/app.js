import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";

import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
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
  // Structured (JSON) request logging with a correlation id per request: reuses an incoming
  // X-Request-Id header if the client/a proxy already set one, otherwise generates a fresh one —
  // set back on the response so a client can report "X-Request-Id: ..." when filing a bug, and
  // attached to req.log so every log line from errorHandler.js during this request carries it.
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const existing = req.headers["x-request-id"];
        const id = existing || crypto.randomUUID();
        res.setHeader("X-Request-Id", id);
        return id;
      },
    })
  );

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
