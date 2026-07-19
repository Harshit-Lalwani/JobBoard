// Throughput/percentile benchmark for GET /api/listings — run against a real listening server
// (not createApp() directly, since autocannon needs an actual port to hit).
//
// Usage:
//   node src/index.js &            # start the server first, separate terminal
//   node loadtest/browse-search.js [baseUrl]
import autocannon from "autocannon";

const baseUrl = process.argv[2] || "http://localhost:4000";

// Mix of query shapes matching real usage. Deliberately includes both a common search term
// ("ma" matches ~1/3 of the seeded corpus, so the sorted-index scan terminates early and looks
// fast) and a rare one (matches a single listing, so the scan must walk the full collection
// before satisfying limit(10) — this is the case that actually represents realistic search
// behavior, since most real searches are for a specific skill/role, not a common substring).
const requests = [
  { method: "GET", path: "/api/listings?limit=10" },
  { method: "GET", path: "/api/listings?search=ma&limit=10" },
  { method: "GET", path: "/api/listings?search=%2399999&limit=10" }, // rare — worst case
  { method: "GET", path: "/api/listings?search=%2312345&limit=10" }, // rare — worst case
  { method: "GET", path: "/api/listings?tags=node&limit=10" },
  { method: "GET", path: "/api/listings?location=Remote&limit=10" },
];

const instance = autocannon(
  {
    url: baseUrl,
    connections: 20,
    duration: 20,
    requests,
  },
  (err, result) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log("\n--- Summary (also see full JSON above) ---");
    console.log(
      `p50: ${result.latency.p50}ms  p97.5: ${result.latency.p97_5}ms  p99: ${result.latency.p99}ms`
    );
    console.log(`throughput: ${result.requests.average.toFixed(1)} req/sec`);
    console.log(`errors: ${result.errors}  timeouts: ${result.timeouts}  non2xx: ${result.non2xx}`);
  }
);

autocannon.track(instance, { renderProgressBar: true });
