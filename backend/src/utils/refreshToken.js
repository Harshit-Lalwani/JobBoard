import bcrypt from "bcrypt";

const HASH_ROUNDS = 10;

export function hashRefreshToken(token) {
  return bcrypt.hash(token, HASH_ROUNDS);
}

/** Revocation check: even a refresh token with a valid signature and unexpired claims is
 * rejected once its hash no longer matches what's stored (e.g. after logout). */
export function compareRefreshToken(token, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(token, hash);
}
