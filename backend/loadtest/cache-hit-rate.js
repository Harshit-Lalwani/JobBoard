// Measures the actual cache hit rate for GET /api/listings/:id under a Zipf-skewed access pattern
// (a few listings get most of the traffic, a long tail gets little — the realistic shape for
// "popular postings get viewed a lot more than obscure ones"), against a live Upstash Redis
// instance. Run against a real listening server (UPSTASH_REDIS_REST_URL/TOKEN must be set).
import mongoose from "mongoose";
import { Listing } from "../src/models/Listing.js";
import { env } from "../src/config/env.js";

const baseUrl = process.argv[2] || "http://localhost:4000";
const REQUEST_COUNT = 2000;

function zipfWeights(n, s = 1.1) {
  const weights = new Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    weights[i] = 1 / Math.pow(i + 1, s);
    total += weights[i];
  }
  for (let i = 0; i < n; i++) weights[i] /= total;
  return weights;
}

function makePicker(weights) {
  const cumulative = [];
  let sum = 0;
  for (const w of weights) {
    sum += w;
    cumulative.push(sum);
  }
  return () => {
    const r = Math.random() * sum;
    let lo = 0,
      hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cumulative[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
}

async function main() {
  await mongoose.connect(env.mongoUri);
  const listingIds = (await Listing.find({}, { _id: 1 }).limit(500)).map((l) => l._id.toString());
  await mongoose.disconnect();

  if (listingIds.length === 0) {
    console.error("No listings found — run scripts/seed-load.js first.");
    process.exit(1);
  }

  const weights = zipfWeights(listingIds.length);
  const pick = makePicker(weights);

  let hits = 0;
  let misses = 0;
  const errors = [];

  for (let i = 0; i < REQUEST_COUNT; i++) {
    const id = listingIds[pick()];
    const res = await fetch(`${baseUrl}/api/listings/${id}`);
    const cacheStatus = res.headers.get("x-cache");
    if (cacheStatus === "HIT") hits++;
    else if (cacheStatus === "MISS") misses++;
    else errors.push(res.status);
  }

  console.log(`Requests: ${REQUEST_COUNT}, unique listings in pool: ${listingIds.length}`);
  console.log(`Hits: ${hits}  Misses: ${misses}  Unlabeled/errors: ${errors.length}`);
  console.log(`Hit rate: ${((hits / REQUEST_COUNT) * 100).toFixed(1)}%`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
