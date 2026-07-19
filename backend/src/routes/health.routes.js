import { Router } from "express";
import mongoose from "mongoose";
import { redis } from "../config/redis.js";

const router = Router();

// Liveness — "is the process up and able to respond at all." Deliberately checks nothing else:
// a liveness probe failing typically triggers a restart, and restarting the process wouldn't fix
// a downstream MongoDB/Redis outage — it would just cause unnecessary churn on top of it.
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Readiness — "is this instance actually able to serve real requests right now." Checks the
// dependencies a request would actually need. A load balancer/orchestrator should stop routing
// traffic to an instance that fails this, without necessarily restarting it.
router.get("/ready", async (req, res) => {
  const checks = { mongo: mongoose.connection.readyState === 1 };

  if (redis) {
    try {
      await redis.ping();
      checks.redis = true;
    } catch {
      checks.redis = false;
    }
  }

  const ready = Object.values(checks).every(Boolean);
  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not ready", checks });
});

export default router;
