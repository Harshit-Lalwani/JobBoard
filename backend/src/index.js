import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { logger } from "./config/logger.js";

const app = createApp();

connectDB()
  .then(() => {
    logger.info("Connected to MongoDB");
    app.listen(env.port, () => {
      logger.info(`API listening on http://localhost:${env.port}`);
    });
  })
  .catch((err) => {
    logger.error(err, "Failed to connect to MongoDB");
    process.exit(1);
  });
