// Splits title+description into a deduplicated array of lowercase alphanumeric word tokens, stored
// alongside each Listing so search can use an anchored, case-sensitive-on-lowercase-data prefix
// regex against an indexed multikey field instead of an unanchored case-insensitive regex against
// raw text (see agent-comms/DECISIONS.md, Phase 3 — the "i" regex flag is what makes a query
// unindexable, not case itself; lowercasing both sides at write/query time removes the need for it).
export function computeSearchTerms(title, description) {
  const combined = `${title} ${description}`.toLowerCase();
  const words = combined.match(/[a-z0-9]+/g) ?? [];
  return [...new Set(words)];
}
