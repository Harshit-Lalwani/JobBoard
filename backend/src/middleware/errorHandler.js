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
