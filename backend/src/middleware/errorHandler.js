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

  const statusCode = err.statusCode || 500;
  const body = {
    error: {
      message: err.message || "Internal server error",
      ...(err.details ? { details: err.details } : {}),
    },
  };

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(statusCode).json(body);
}
