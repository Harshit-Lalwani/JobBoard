import { ApiError } from "./errorHandler.js";
import { verifyAccessToken } from "../utils/jwt.js";

/** Requires a valid `Authorization: Bearer <accessToken>` header; attaches { id, role } to req.user. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    return next(new ApiError(401, "Missing or malformed Authorization header"));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new ApiError(401, "Invalid or expired access token"));
  }
}

/** Must run after requireAuth. Rejects with 403 if req.user.role isn't one of the allowed roles. */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have permission to perform this action"));
    }
    next();
  };
}
