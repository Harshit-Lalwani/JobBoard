const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Parses simple durations like "15m", "30d" into milliseconds. Matches the subset of formats we
 * actually use in env vars (ACCESS_TOKEN_TTL / REFRESH_TOKEN_TTL) — not a general-purpose parser. */
export function parseDurationMs(value) {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  if (!match) {
    throw new Error(`Unsupported duration format: "${value}"`);
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_MS[unit];
}
