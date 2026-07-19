// Seeds the database at load-test scale (tens/hundreds of thousands of documents), directly via
// Mongoose bulk inserts — not through the HTTP API, which would be far too slow at this volume and
// would also hit the apply-endpoint rate limiter. This is a destructive, standalone script: it wipes
// Listing/Application/User collections before seeding, and refuses to run against anything that
// doesn't look like a local database (see the safety check below).
//
// Usage:
//   node scripts/seed-load.js --scale=small     (~1k listings   /   ~5k applications  - quick local runs)
//   node scripts/seed-load.js --scale=large     (~100k listings / ~800k applications  - the real benchmark)
//   node scripts/seed-load.js --scale=5000      (explicit listing count; applications scale with it)
import mongoose from "mongoose";
import { User } from "../src/models/User.js";
import { Listing } from "../src/models/Listing.js";
import { Application, APPLICATION_STATUSES } from "../src/models/Application.js";
import { env } from "../src/config/env.js";

// --- Safety check -----------------------------------------------------------------------------
// This script is destructive (wipes collections) and generates huge volumes of synthetic data.
// It must never run against Atlas / production by accident. Local Mongo only, unless the operator
// explicitly opts in.
const uri = env.mongoUri;
const looksLocal = /^mongodb:\/\/(127\.0\.0\.1|localhost)/.test(uri);
if (!looksLocal && !process.env.ALLOW_REMOTE_SEED) {
  console.error(
    `Refusing to run: MONGO_URI does not look like a local database (${uri.replace(/:[^:@]+@/, ":***@")}).\n` +
      "This script wipes Listing/Application/User collections and inserts large synthetic volumes.\n" +
      "Set ALLOW_REMOTE_SEED=1 to override if you really mean it."
  );
  process.exit(1);
}

// --- Scale presets ------------------------------------------------------------------------------
const SCALE_PRESETS = { small: 1_000, large: 100_000 };
const scaleArg = (process.argv.find((a) => a.startsWith("--scale=")) ?? "--scale=small").split("=")[1];
const listingCount = SCALE_PRESETS[scaleArg] ?? Number(scaleArg);
if (!Number.isFinite(listingCount) || listingCount <= 0) {
  console.error(`Invalid --scale value: ${scaleArg} (use "small", "large", or a positive integer)`);
  process.exit(1);
}
const applicationsPerListingAvg = 8; // tuned so --scale=large produces ~800k applications
const posterCount = Math.max(20, Math.round(listingCount / 500));
const applicantCount = Math.max(100, Math.round((listingCount * applicationsPerListingAvg) / 15));

const BATCH_SIZE = 5_000;

const ROLE_ADJ = ["Senior", "Staff", "Principal", "Junior", "Lead", "Remote", "Contract"];
const ROLE_NOUN = [
  "Machine Learning", "Backend", "Frontend", "Data", "Platform", "Security", "Mobile",
  "Site Reliability", "Full Stack", "DevOps", "QA Automation", "Growth",
];
const ROLE_KIND = ["Engineer", "Scientist", "Developer", "Architect", "Manager", "Analyst"];
const LOCATIONS = ["Remote", "New York", "San Francisco", "Austin", "Seattle", "Chicago", "Boston", "Denver"];
const TAG_POOL = ["node", "react", "python", "aws", "kubernetes", "mongodb", "sql", "go", "javascript", "ml"];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeListingTitle(i) {
  return `${randomFrom(ROLE_ADJ)} ${randomFrom(ROLE_NOUN)} ${randomFrom(ROLE_KIND)} #${i}`;
}

// Zipf-like weight: a small number of listings are "hot" (many applications), a long tail gets few.
// Rank-based 1/rank^s weighting, s=1.1 — realistic for "a few popular postings dominate applicant volume."
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

// Weighted-random index pick using precomputed cumulative weights (O(log n) via binary search).
function makePicker(weights) {
  const cumulative = new Array(weights.length);
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    cumulative[i] = sum;
  }
  return function pick() {
    const r = Math.random() * sum;
    let lo = 0, hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cumulative[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
}

async function insertInBatches(model, docs) {
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    await model.insertMany(docs.slice(i, i + BATCH_SIZE), { ordered: false });
    process.stdout.write(`\r  ${model.modelName}: ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length}`);
  }
  process.stdout.write("\n");
}

async function main() {
  console.log(`Connecting to ${uri.replace(/:[^:@]+@/, ":***@")} ...`);
  await mongoose.connect(uri);
  await Promise.all([Listing.init(), Application.init(), User.init()]);

  console.log("Wiping Listing / Application / User collections...");
  await Promise.all([Listing.deleteMany({}), Application.deleteMany({}), User.deleteMany({})]);

  console.log(`Seeding ${posterCount} posters, ${applicantCount} applicants...`);
  const fakePasswordHash = "$2b$10$" + "a".repeat(53); // never logged in with, hash shape only matters for schema validity
  const posterDocs = Array.from({ length: posterCount }, (_, i) => ({
    name: `Load Poster ${i}`,
    email: `load-poster-${i}@loadtest.local`,
    passwordHash: fakePasswordHash,
    role: "poster",
  }));
  const applicantDocs = Array.from({ length: applicantCount }, (_, i) => ({
    name: `Load Applicant ${i}`,
    email: `load-applicant-${i}@loadtest.local`,
    passwordHash: fakePasswordHash,
    role: "applicant",
  }));
  await insertInBatches(User, posterDocs);
  await insertInBatches(User, applicantDocs);
  const posterIds = (await User.find({ role: "poster" }, { _id: 1 })).map((u) => u._id);
  const applicantIds = (await User.find({ role: "applicant" }, { _id: 1 })).map((u) => u._id);

  console.log(`Seeding ${listingCount} listings...`);
  const now = Date.now();
  const listingDocs = Array.from({ length: listingCount }, (_, i) => {
    const title = makeListingTitle(i);
    return {
      title,
      description: `We are hiring a ${title} to help build and scale our systems. Listing ${i}.`,
      tags: [randomFrom(TAG_POOL), randomFrom(TAG_POOL), randomFrom(TAG_POOL)],
      location: randomFrom(LOCATIONS),
      posterId: randomFrom(posterIds),
      status: "open",
      createdAt: new Date(now - i * 1000),
    };
  });
  await insertInBatches(Listing, listingDocs);
  const listings = await Listing.find({}, { _id: 1 }).sort({ createdAt: -1 });
  const listingIds = listings.map((l) => l._id);

  const totalApplications = Math.round(listingCount * applicationsPerListingAvg);
  console.log(`Seeding ~${totalApplications} applications (Zipf-skewed across listings)...`);
  const weights = zipfWeights(listingIds.length);
  const pickListing = makePicker(weights);

  // Track which (listing, applicant) pairs are already used per listing to respect the unique
  // index without hitting duplicate-key errors mid-batch (checking a Set is cheap; the index
  // itself is still the real guarantee).
  const usedPairs = new Set();
  const applicationDocs = [];
  let attempts = 0;
  const maxAttempts = totalApplications * 4;
  while (applicationDocs.length < totalApplications && attempts < maxAttempts) {
    attempts++;
    const listingIdx = pickListing();
    const listingId = listingIds[listingIdx];
    const applicantId = randomFrom(applicantIds);
    const pairKey = `${listingId}:${applicantId}`;
    if (usedPairs.has(pairKey)) continue;
    usedPairs.add(pairKey);

    const status = randomFrom(APPLICATION_STATUSES);
    applicationDocs.push({
      listingId,
      applicantId,
      resumeUrl: "/uploads/load-test-placeholder.pdf",
      coverNote: "",
      status,
      statusHistory: [{ status: "applied" }],
      createdAt: new Date(now - Math.floor(Math.random() * 30 * 24 * 3600 * 1000)),
    });
  }
  await insertInBatches(Application, applicationDocs);

  console.log("\nDone.");
  console.log({
    posters: posterIds.length,
    applicants: applicantIds.length,
    listings: listingIds.length,
    applications: applicationDocs.length,
  });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("SEED FAILED:", err);
  process.exit(1);
});
