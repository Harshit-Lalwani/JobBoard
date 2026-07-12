import { ApiError } from "./errorHandler.js";

/** Validates req.body against a zod schema, replacing it with the parsed (and coerced/trimmed) value. */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(
        new ApiError(400, "Validation failed", result.error.flatten().fieldErrors)
      );
    }
    req.body = result.data;
    next();
  };
}

/** Validates req.query against a zod schema, replacing it with the parsed value. */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(
        new ApiError(400, "Validation failed", result.error.flatten().fieldErrors)
      );
    }
    req.query = result.data;
    next();
  };
}
