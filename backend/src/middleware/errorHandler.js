import { MulterError } from "multer";

/** Centralized error-handling middleware. Routes/services throw or call next(err); this is the single place that shapes the HTTP error response. */
export class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFoundHandler(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Mongoose throws a CastError (not an ApiError) when a route param like :id isn't a valid
  // ObjectId — e.g. GET /api/listings/not-a-real-id. Without this, it would fall through to the
  // generic 500 branch below, which is wrong: it's a malformed client request, not a server fault.
  if (err.name === "CastError") {
    return res.status(400).json({ error: { message: `Invalid id: ${err.value}` } });
  }

  // multer throws MulterError (e.g. LIMIT_FILE_SIZE) for upload problems — also a client error,
  // not a server fault, same reasoning as CastError above.
  if (err instanceof MulterError) {
    return res.status(400).json({ error: { message: err.message } });
  }

  // MongoDB's duplicate-key error (E11000) has no statusCode, so without this it fell through to
  // the generic 500 branch below — a client error (someone raced a unique constraint) reported as
  // a server fault, with the raw driver error string leaked in the response body. Most call sites
  // that can hit this (e.g. apply()) already catch it locally for a more specific message; this is
  // the generic fallback for any write that doesn't.
  if (err.code === 11000) {
    return res.status(409).json({ error: { message: "This record already exists or conflicts with an existing one" } });
  }

  // Mongoose's optimistic-concurrency error (see Listing's optimisticConcurrency schema option) -
  // a .save() lost a race against a concurrent write to the same document. Also a client-retryable
  // conflict, not a server fault.
  if (err.name === "VersionError") {
    return res.status(409).json({ error: { message: "This record was modified by someone else - please reload and try again" } });
  }

  const statusCode = err.statusCode || 500;
  const body = {
    error: {
      message: err.message || "Internal server error",
      ...(err.details ? { details: err.details } : {}),
    },
  };

  if (statusCode >= 500) {
    // req.log is pino-http's per-request logger (see app.js) — bound with this request's
    // correlation id, so this line and the request-summary line pino-http logs automatically
    // share the same id and can be correlated in any log aggregator. Falls back to console.error
    // if req.log isn't present (e.g. a unit test that constructs errorHandler's args directly
    // without going through the real pinoHttp middleware).
    if (req.log) {
      req.log.error({ err }, err.message);
    } else {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }

  res.status(statusCode).json(body);
}
