// Captures MongoDB's query plan for the exact queries listListings() builds, so BENCHMARKS.md has
// mechanism evidence (COLLSCAN vs IXSCAN), not just a latency number. Run directly against
// whatever database MONGO_URI points at (the seeded load-test database).
import mongoose from "mongoose";
import { Listing } from "../src/models/Listing.js";
import { env } from "../src/config/env.js";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function explainOne(label, filter) {
  const start = process.hrtime.bigint();
  const explanation = await Listing.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(10)
    .explain("executionStats");
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

  const stats = explanation.executionStats;
  const stage = explanation.queryPlanner.winningPlan.stage ?? explanation.queryPlanner.winningPlan.inputStage?.stage;
  console.log(`\n--- ${label} ---`);
  console.log(`filter: ${JSON.stringify(filter)}`);
  console.log(`winning plan stage: ${stage}`);
  console.log(`keys examined: ${stats.totalKeysExamined}  docs examined: ${stats.totalDocsExamined}  returned: ${stats.nReturned}`);
  console.log(`execution time (server-reported): ${stats.executionTimeMillis}ms  (wall: ${elapsedMs.toFixed(1)}ms)`);
}

async function main() {
  await mongoose.connect(env.mongoUri);

  // Post-fix (Phase 3): anchored, no-"i"-flag prefix match against the precomputed searchTerms
  // multikey field — see models/Listing.js / utils/searchTerms.js / DECISIONS.md Phase 3.
  await explainOne("Fixed: anchored prefix search=\"ma\" against searchTerms", {
    status: "open",
    searchTerms: new RegExp(`^${escapeRegExp("ma")}`),
  });

  await explainOne("Unfiltered browse (status only)", { status: "open" });

  await explainOne("Fixed: rare term search=\"99999\" against searchTerms (was the 434ms/100k-doc worst case)", {
    status: "open",
    searchTerms: new RegExp(`^${escapeRegExp("99999")}`),
  });

  await explainOne("Fixed: location filter, anchored prefix against locationLower", {
    status: "open",
    locationLower: new RegExp(`^${escapeRegExp("remote")}`),
  });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
