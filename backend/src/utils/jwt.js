import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtl,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

/** The refresh token is itself a signed JWT (so its userId is self-contained and it needs no
 * DB lookup to verify authenticity), but its bcrypt hash is also stored on the User so it can be
 * revoked server-side on logout even before the JWT's own expiry — see
 * agent-comms/DECISIONS.md for the static-refresh-token rationale. */
export function signRefreshToken(user) {
  return jwt.sign({ sub: user._id.toString() }, env.jwtRefreshSecret, {
    expiresIn: env.refreshTokenTtl,
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}
