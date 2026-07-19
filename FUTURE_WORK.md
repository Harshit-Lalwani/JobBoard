# Future Work

Things considered during the stress-test-driven hardening round (see `BENCHMARKS.md` and
`agent-comms/DECISIONS.md`) and deliberately **not built**, with the actual reasoning — not because
they aren't real or interesting, but because building them here wouldn't have been justified, and a
half-built version reads worse than a documented decision not to. Not in the README on purpose: this
is the "here's what I chose not to do and why" record, not marketing copy.

## Postgres / polyglot persistence

The genuine use case identified was an **analytics read model**: funnel conversion (`applied →
shortlisted → interview → offer`) by listing and by month, time-to-hire percentiles, drop-off rates —
window functions and `GROUP BY ROLLUP` are real, measurable improvements in readability over the
equivalent MongoDB aggregation pipeline for this specific class of query.

**Why it wasn't built:** it was cut for two concrete, technical reasons, not a vague "keep it simple":

1. **Serverless connection pooling.** Every warm Vercel function instance would hold its own Postgres
   connection. That's the textbook serverless/relational-database friction point — Mongoose on Atlas
   sidesteps it because MongoDB's driver handles pooling differently, but a naive `pg` connection per
   instance would exhaust a small Postgres plan's connection limit under any real concurrency.
2. **Testing.** The existing test suite runs against `mongodb-memory-server` — a real, ephemeral,
   zero-setup database for every test file. The equivalent for Postgres is testcontainers, which needs
   Docker in CI, a heavier test harness, and a second migration story (schema + seed data) alongside
   the one MongoDB already has.

If SQL experience is the actual goal, the honest recommendation is a SQL-native project, not a second
datastore bolted onto a working MongoDB app for the sake of having one on the resume — that reads as
unjustified complexity to anyone who opens the repo, not judgment.

**If this got built anyway:** Postgres would be a **read-only projection**, synced from MongoDB via a
batch script on a schedule — not a second source of truth, no dual writes, no transactional outbox
needed (see below for why the outbox specifically doesn't apply here: analytics is allowed to be
stale, so eventual consistency via periodic batch refresh is the *correct* design, not a shortcut).

## Async job queue + transactional outbox

Genuinely the most differentiating pattern of everything considered — "an at-least-once job pipeline
with a transactional outbox, exponential backoff, and a dead-letter queue" is a real, valuable thing to
be able to describe and defend in an interview.

**Why it wasn't built:** two blockers, both structural, not effort-based:

1. **Nowhere to run a worker.** Vercel serverless has no persistent process — `backend/src/index.js`
   (the `npm start` long-lived server) is never what actually runs in production; `api/index.js` wraps
   the same Express app as a single request-scoped function instead. A queue-draining worker needs
   something to keep running between invocations, which this deployment target doesn't have. The
   realistic paths are Vercel Cron (polling a queue on a schedule — a materially weaker demo than a real
   worker) or moving the backend off Vercel to something with a persistent process (Railway, Fly, a VM).
2. **No real side effect to move.** An outbox is worth building around *something* — a notification
   email on status change, resume text extraction for search. Neither exists in this app yet (no email
   provider is wired up), so building the outbox first would mean demonstrating it against fake,
   purpose-built work, which is a weaker and less honest story than building it to solve a problem that
   was already there.

**If this got built anyway:** the natural trigger is an email to the applicant on status change. The
outbox table would live in the same MongoDB transaction as the status write (a single-document
update already, per Phase 2's compare-and-swap — extending it to also write an outbox document is a
small addition, not a redesign), and a worker (wherever it lives) polls that collection, sends the
email, and marks the record processed, with retry/backoff and a dead-letter state after N failures.

## Hiring teams (multiple recruiters per listing)

The other genuinely real relational candidate — a many-to-many join between listings and recruiter
users, with roles, is the textbook relational shape and would also introduce a second natural source of
write contention (two recruiters acting on the same application concurrently — the same class of
problem Phase 2's compare-and-swap already solves for the single-poster case, just with a real
authorization dimension added on top).

**Why it wasn't built:** scope, not merit. Everything in this hardening round was chosen because it
either fixed a real, demonstrated bug (Phases 1-3) or closed a limitation this project had already
self-documented as accepted scope (Phase 4's rate limiter/cache). Hiring teams is a legitimate feature,
but it's *new* scope rather than hardening existing scope, and adding it here would have diluted the
"found real bugs under stress, fixed them, proved it" narrative with a feature-shaped detour.

**If this got built anyway:** a `ListingMember` join collection (`listingId`, `userId`, `role`), RBAC
checks extended from "is this the listing's single `posterId`" to "is this user a member of this
listing's team with sufficient role," and the same compare-and-swap discipline from Phase 2 applied to
any concurrent-edit path the new multi-recruiter access pattern introduces.
