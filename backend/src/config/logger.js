import pino from "pino";
import { env } from "./env.js";

// Structured (JSON) logging so log lines are machine-parseable — greppable/filterable by field in
// any log aggregator, rather than free-text lines. Pretty-printed in development only; production
// (and CI) get raw JSON, which is what you actually want shipped somewhere. Silent under Jest
// (JEST_WORKER_ID is set by Jest itself, not something this project sets) — per-request log dumps
// for every one of hundreds of test requests would bury actual test failures in noise; the point
// of structured logging is observability in a running system, not test output.
export const logger = pino({
  level: process.env.JEST_WORKER_ID !== undefined ? "silent" : env.nodeEnv === "production" ? "info" : "debug",
  transport:
    env.nodeEnv === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" } },
});
