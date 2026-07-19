# Benchmarks

Committed baselines and before/after evidence for the stress-test-driven hardening work (see
`agent-comms/DECISIONS.md` for the full reasoning behind each fix). Every number here was produced by
running the documented command against a real, seeded local database — not estimated, not simulated.

**Environment for every run below:**
- Machine: 12 vCPU, 7.6 GiB RAM, Ubuntu 26.04 LTS, Node v22.22.1
- Database: local standalone MongoDB (via `mongodb-memory-server`, run as a persistent process, not the
  ephemeral per-test instance Jest uses)
- Measured against `git rev-parse HEAD` = `a9979e7` (before any hardening fixes in this round)
- **Caveat, stated honestly:** this is a single dev machine, not production-representative hardware. The
  absolute numbers won't match a real deployment. The *relative* deltas (before/after) and the
  *correctness* results (exact counts of accepted/rejected requests) are what's load-bearing here, and
  those hold regardless of hardware.
- **Narrative note:** every finding below was produced by deliberately seeding the database at scale and
  firing concurrent/adversarial requests at a local instance — none of this was observed in production or
  caused a live incident. The app has near-zero real traffic; these are latent defects surfaced by
  intentional stress testing, not outages.

## Seed data

```
node scripts/seed-load.js --scale=large
```
Produced: **100,000 listings**, **200 posters**, **53,333 applicants**, **800,000 applications**
(Zipf-skewed across listings — hottest listing received 516 applications, most received 1).

---

## Finding 1 — Duplicate-apply race returns HTTP 500, leaks the raw driver error

**Command:** 10 concurrent identical `POST /api/applications/:id/apply` requests from the same
authenticated applicant, fired via `Promise.all`.

**Before (commit `a9979e7`):**
```
status code distribution across 10 concurrent identical requests:
{ '201': 1, '429': 5, '500': 4 }

Sample 500 body:
{"error":{"message":"E11000 duplicate key error collection: jobboard.applications index:
listingId_1_applicantId_1 dup key: { listingId: ObjectId('...'), applicantId: ObjectId('...') }"}}
```

The unique index (`Application.js:44`) correctly prevents the duplicate at the storage layer — but
`errorHandler.js` has no branch for MongoDB's `E11000` duplicate-key error, so it falls through to
`err.statusCode || 500`, returning a raw internal driver error string to the client instead of a clean
409. (The 429s are the existing per-user apply rate limiter correctly doing its job — unrelated to this
bug, expected here since all 10 requests share one user.)

**After:** this exact path (`apply()`) ended up fixed as an incidental side effect of Phase 1's slot-claim
rewrite, which added local `E11000` handling while building the slot-release compensation logic — before
Phase 2 (the fix originally scoped for this finding) was even written. Re-verified as a regression test,
`tests/concurrency/duplicateApply.test.js`: 10 concurrent identical applies from one applicant now
reliably produce exactly one `201` and nine clean `409`s, never a `500`.

Phase 2's actual new contribution is the *global* `errorHandler.js` branch, demonstrated against a
still-genuinely-unprotected duplicate-key race: concurrent account registration with the same email
(`auth.service.js`'s `register()` has the identical unprotected shape `apply()` originally had).
Verified fail-before/pass-after by isolating just the `errorHandler.js` diff:
```
Before (errorHandler.js's E11000 branch stashed out): 10 concurrent identical registrations ->
  { '500': 9, '201': 1 }   — 9 raw HTTP 500s, driver error leaked in the response body

After (fix restored): 10 concurrent identical registrations ->
  { '409': 9, '201': 1 }   — exactly one account created, nine clean 409s
```
Getting this race to reproduce at all inside a Jest test needed real investigation — see the Phase 2
entry in `agent-comms/DECISIONS.md` for why a plain `Promise.all` wasn't enough (concurrent
`findOne`-then-`create()` sequences kept serializing in practice on this fast local database, and an
artificial delay had to be injected to force genuine interleaving).

---

## Finding 2 — Lost update on status transitions; terminal state is bypassable

**Command:** two concurrent `PUT /api/applications/:id/status` requests on the same application, both
individually legal from `applied` (`applied → shortlisted` and `applied → rejected`), fired together.

**Before (commit `a9979e7`):**
```
concurrent conflicting transitions: [ 200, 200 ]
final status: shortlisted
final statusHistory: [
  {"status":"applied",    "changedAt":"...:30.888Z"},
  {"status":"rejected",   "changedAt":"...:30.903Z"},
  {"status":"shortlisted","changedAt":"...:30.909Z"}
]
```

Both requests report success. The final state is `shortlisted`, even though `rejected` — which the
transition graph (`statusMachine.js`) defines as **terminal**, with no legal outgoing transitions — was
written first. The read-modify-write in `updateApplicationStatus()` (`application.service.js:41-62`)
validates each transition against a value read *before* either write lands, so both pass validation
independently and the second write silently clobbers the first. This is a genuine data-integrity bug: an
applicant correctly rejected can end up back in the active pipeline with no record of ever being rejected
except a `statusHistory` entry that contradicts the current `status`.

**After:** `updateApplicationStatus()` rewritten as a compare-and-swap (`findOneAndUpdate({ _id, status:
fromStatus }, ...)` — a `null` result means someone else changed the status first). Same command, same
race, verified via `tests/concurrency/statusTransitionRace.test.js`:
```
concurrent conflicting transitions: [ 200, 409 ]
final status: one of "shortlisted" or "rejected" (whichever won), consistently matching statusHistory
statusHistory length: 2 (applied + exactly one winning transition — no phantom entries, no
                          bypassed terminal state)
```
Exactly one request wins; the other gets a clean 409 instead of silently corrupting the record.
Re-verified fail-before by stashing the fix and re-running: reproduces the original `[200, 200]` /
`shortlisted`-despite-`rejected` result exactly.

---

## Finding 3 — Listing search: full collection scan, data-dependent cost

**Command:** `node loadtest/explain-search.js` (captures `explain("executionStats")` for the exact query
`listListings()` builds) and `node loadtest/browse-search.js` (autocannon throughput/percentiles against
a live server, mixed common/rare search terms).

**`explain()` — the mechanism, not just the number:**

| Search term | Match rate | Keys examined | Docs examined | Returned | Server time |
|---|---|---|---|---|---|
| `"ma"` (common — matches ~1/3 of corpus) | high | 30 | 30 | 10 | 25 ms |
| `"#99999"` (rare — matches 1 of 100,000) | low | **100,000** | **100,000** | 1 | **434 ms** |
| `"#12345"` (rare — matches 1 of 100,000) | low | 100,000 | 100,000 | 1 | 107 ms |

**This is a more precise finding than "always a collection scan," and it matters:** the query's cost is
*data-dependent*. Because the sort (`createdAt: -1, _id: -1`) is served by an existing index
(`listing_cursor_pagination`), MongoDB walks that index in sorted order and evaluates the unanchored
regex per document, terminating early once `limit(10)` matches are found. A common substring finds 10
matches almost immediately and looks fast. A specific, realistic search (a rare skill, an exact role
title, a typo) has to walk the *entire* collection before satisfying the limit — functionally identical
in cost to a full collection scan, and this is the realistic case: most real searches are for something
specific, not a common two-letter substring.

**Throughput (mixed query mix — unfiltered browse, common search, two rare searches, tag filter,
location filter; 20 connections, 20s):**
```
p50: 41ms   p97.5: 608ms   p99: 654ms
throughput: 112.0 req/sec
errors: 0  timeouts: 0  non2xx: 0
```
The wide gap between p50 and p97.5 is exactly the common/rare split above — roughly a third of the mixed
request set are rare-term searches paying the full-scan cost.

**After:** _(to be filled in once the Phase 3 index fix lands — same seed, same commands)_

---

## How to reproduce

1. Start a local MongoDB (standalone is fine — no replica set needed for anything in this round).
2. `MONGO_URI=mongodb://127.0.0.1:27017/jobboard node scripts/seed-load.js --scale=large`
3. `node src/index.js` (separate terminal/process)
4. `node loadtest/explain-search.js` for query-plan evidence
5. `node loadtest/browse-search.js` for throughput/percentiles
6. Concurrency-race commands are currently ad hoc `Promise.all` scripts (see Findings 1 & 2 above for the
   exact request shape); these get formalized as committed regression tests in `tests/concurrency/` as
   part of the Phase 2 fix, per the fail-before/pass-after discipline.

⚠️ **`scripts/seed-load.js` is destructive** — it wipes `Listing`/`Application`/`User` collections and
refuses to run against anything that isn't a local database unless `ALLOW_REMOTE_SEED=1` is explicitly
set. Never point it at a shared or production database.
