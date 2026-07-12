import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";

const app = createApp();

connectDB()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log("Connected to MongoDB");
    app.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`API listening on http://localhost:${env.port}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
