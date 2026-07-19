# Job Board — MERN Application Pipeline

![CI](https://github.com/Harshit-Lalwani/JobBoard/actions/workflows/ci.yml/badge.svg)

A mini-ATS: **posters** create job/task listings, **applicants** browse and apply, and posters move
applicants through a pipeline — `applied → shortlisted → interview → offer` (or `rejected` from any
non-terminal stage). Built as a portfolio project to demonstrate REST API design, MongoDB schema/index
design, and a clean React frontend architecture.

Full original spec: [`Initial_prompt.md`](Initial_prompt.md).

## Stack

- **Backend:** Node.js + Express, MongoDB + Mongoose, JWT auth (access + refresh), bcrypt, multer,
  Google Cloud Storage (resume uploads), Redis (Upstash — distributed rate limiting + caching),
  structured logging (pino + pino-http, request-correlation IDs)
- **Frontend:** React (Vite), React Router, Tailwind CSS v4, Axios
- **Tests:** Jest + Supertest (backend only — 141 tests, see [Testing](#testing))
- **CI:** GitHub Actions — backend tests/lint + frontend build/lint on every push/PR (`.github/workflows/ci.yml`)

## Setup

Requires Node 18+ and a MongoDB instance (local `mongod`, Docker, or a free Atlas cluster — anything
reachable via a connection string).

**Backend**

```bash
cd backend
cp .env.example .env        # edit MONGO_URI if not using the default local mongod
npm install
npm run dev                 # http://localhost:4000 — GET /health should return {"status":"ok"}
```

Resume uploads work with zero extra setup — leave the storage vars in `.env` blank and uploads land on
local disk. Want them on Google Cloud Storage locally too (matching prod)? Set `GCS_BUCKET` and either
`GOOGLE_APPLICATION_CREDENTIALS` (path to a service-account key file) or `GOOGLE_APPLICATION_CREDENTIALS_JSON`
(the key file's contents, one line) in `.env` — see the comments in `.env.example` for both forms and
`DEPLOYMENT.md` for the one-time GCP setup (bucket, IAM, service account).

**Frontend** (separate terminal)

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173 — proxies /api and /uploads to the backend
```

Open `http://localhost:5173`, register as a poster in one browser tab and an applicant in another (or
log out/in between) to try the full flow: post a listing → browse/search for it → apply with a resume
PDF → move the application through the pipeline.

Deploying this (Vercel + Atlas + GCS)? See [`DEPLOYMENT.md`](DEPLOYMENT.md) — resume storage (GCS/Vercel
Blob) and the serverless entrypoint are already implemented, so most of what's left is account/environment
setup (GCP bucket + IAM, Atlas cluster, Vercel env vars), not code. The guide is explicit about which is
which, and about the one thing still a known, accepted limitation rather than fixed: the in-memory rate
limiter doesn't coordinate across serverless instances.

## Testing

```bash
cd backend
npm test        # Jest + Supertest, runs against an ephemeral in-memory MongoDB (mongodb-memory-server) —
                 # no real database needed to run the suite
npm run lint
```

`npm test` never touches real cloud storage either, even if your local `.env` has real GCS/Blob
credentials in it — `tests/setupEnv.js` blanks those vars out before dotenv loads, so every test run
deterministically exercises the local-disk fallback in `storage.service.js`. (This wasn't always true —
see [`agent-comms/DECISIONS.md`](agent-comms/DECISIONS.md) for the bug this fixed, and why.)

```bash
cd frontend
npm run build    # also serves as a compile-correctness check
npm run lint
```

## Project structure

```
backend/
  src/
    routes/        Express routers — thin, just wire middleware + call a controller
    controllers/    req/res handling only; calls a service, maps the result to a response
    services/       actual business logic; throws ApiError, never touches req/res
    models/         Mongoose schemas + indexes
    middleware/      auth (JWT/RBAC), validation (zod), rate limiting, upload (multer), error handling
    validation/     zod schemas
    utils/          status-transition state machine, cursor encode/decode, JWT helpers, etc.
  tests/            mirrors src/, one test file per route group + targeted unit tests

frontend/
  src/
    api/            one thin wrapper module per backend resource (axios calls only)
    context/        AuthContext — session state, silent-refresh-on-load
    components/     shared UI (Navbar, ProtectedRoute, PipelineBoard, forms, cards)
    pages/          one component per route
    utils/          frontend copy of the status-transition graph (UI-only, see below)

agent-comms/        the phase-wise build plan and its full decision/handoff history (see below)
```

## API overview

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/register` `/login` | — | issues access token + refresh cookie |
| POST | `/api/auth/refresh` | refresh cookie | new access token |
| POST | `/api/auth/logout` | required | revokes the refresh token |
| GET | `/api/auth/me` | required | current user (for session restore) |
| GET | `/api/listings` | — | search/filter/paginate, see below |
| GET | `/api/listings/mine` | poster | all of *your* listings, any status |
| GET/POST/PUT/DELETE | `/api/listings/:id` | poster for write | |
| POST | `/api/applications/:listingId/apply` | applicant | rate-limited |
| GET | `/api/applications/mine` | applicant | all of *your* applications |
| GET | `/api/applications/listing/:listingId` | poster | applicants for one of your listings |
| PUT | `/api/applications/:id/status` | poster | enforces the transition state machine |
| POST | `/api/uploads/resume` | required | multipart PDF upload |
| GET | `/health` | — | liveness — always 200 if the process is up, checks nothing else |
| GET | `/ready` | — | readiness — checks MongoDB connection state, and Redis if configured |

`GET /api/listings` query params: `search` (word-prefix match, see below), `tags`, `location`, `status`
(default `open`), `cursor`, `limit`. Responses include an `X-Cache: HIT`/`MISS` header on
`GET /api/listings/:id` (see the caching entry below) and an `X-Request-Id` header on every response
(structured request logging, see below).

## Architecture & design decisions (interview prep)

The full decision log with alternatives-considered is in
[`agent-comms/DECISIONS.md`](agent-comms/DECISIONS.md) — every entry below links back to a fuller writeup
there. This section is the condensed version for talking through in an interview.

**Cursor-based pagination, not `skip()`/`limit()`.** `GET /api/listings` takes an opaque
`cursor` (base64 of the last item's `{createdAt, _id}`) instead of a page number. `skip()` makes MongoDB
walk and discard every skipped document — cost grows linearly with page depth. A cursor turns "next page"
into an indexed range query (`createdAt < cursor.createdAt`, with `_id` as a tiebreaker for equal
timestamps), so it's O(page size) no matter how deep you've paged. The tradeoff: no "jump to page 7" UI —
the browse page reflects this honestly with a "Load more" button rather than numbered pages, since a
cursor genuinely can't support arbitrary jumps.

**Search: word-prefix match against a precomputed field, not a live substring scan.** `search` matches
against `searchTerms` — a deduplicated array of lowercase word tokens computed from `title + description`
on every save (`utils/searchTerms.js`, kept in sync via a `pre("validate")` hook so no call site can
forget it) — using an *anchored, case-sensitive-on-lowercase-data* regex, backed by a real compound index
(`{status: 1, searchTerms: 1, createdAt: -1, _id: -1}`). `tags` and `location` use the identical
technique (lowercased at write time, anchored prefix at query time). This replaced an earlier version
that used an unanchored, case-insensitive regex directly against the raw fields — measured at 100k
listings to cost **434ms and a full 100,000-document scan** for a realistic (rare, specific) search term,
because a case-insensitive regex can't use an index bound at all, anchored or not. The fix isn't free:
it narrows "substring anywhere" to "prefix of a word" (`"ma"` still matches `"Machine"`, `"chine"` no
longer does) — a deliberate, measured tradeoff, not an oversight. Full story, including why a text index
and a naive trigram index were both rejected, in [`agent-comms/DECISIONS.md`](agent-comms/DECISIONS.md)
(Phase 3) and the before/after numbers in [`BENCHMARKS.md`](BENCHMARKS.md).

**Status-transition state machine.** The legal pipeline graph
(`applied → shortlisted → interview → offer`, `rejected` reachable from any non-terminal state and
terminal itself) lives in one place — `backend/src/utils/statusMachine.js` — as an explicit adjacency
list, not scattered `if/else` checks in a controller. `PUT /applications/:id/status` calls
`isLegalTransition(from, to)` before writing anything, and every legal transition appends to
`statusHistory[]` for a full audit trail. Directly unit-tested in isolation (25 test cases covering every
legal edge, every illegal edge, no-op self-transitions, and unknown-status inputs) in addition to being
exercised through the real HTTP routes.

**Refresh tokens: signed JWT + server-side revocation, not stateless.** The refresh token in the
httpOnly cookie is itself a JWT (`sub: userId`, long TTL, separate secret from the access token) — but its
bcrypt hash is *also* stored on the `User` document. `/auth/refresh` verifies the JWT signature first
(cheap, no DB hit to identify the user), then compares the raw token against the stored hash before
issuing a new access token. This is what makes `/auth/logout` actually work: it clears the stored hash, so
a stolen-but-unexpired refresh token is rejected on its next use even though its signature still verifies.
Deliberately *not* rotating the refresh token on each use (simpler to reason about, at the cost of a
stolen token staying valid until logout/expiry rather than being invalidated on next legitimate use) — a
real tradeoff, not an oversight.

**Rate limiting and caching: Redis (Upstash) when configured, graceful fallback otherwise.**
`POST /applications/:listingId/apply` is limited to 5 requests/minute per authenticated user (not per IP
— IP-based limiting is trivially routed around and false-positives on shared/NAT'd IPs), via a
Redis-backed sliding window (`@upstash/ratelimit`) when `UPSTASH_REDIS_REST_URL`/`TOKEN` are set, falling
back to the original in-memory limiter otherwise (local dev/tests) — and **failing open** if Redis is
configured but momentarily unreachable, since a rate-limiter outage shouldn't take down the apply flow.
`GET /api/listings/:id` is cached the same way (cache-aside, 30s TTL, invalidated on
update/delete) — measured at a **73.2% hit rate** under a Zipf-skewed access pattern against a live
Upstash instance (see [`BENCHMARKS.md`](BENCHMARKS.md), Finding 5). Both closed a limitation this README
used to list as an accepted gap — see the Phase 4 entry in `DECISIONS.md` for why in-memory rate limiting
under serverless fan-out was a real problem (`limit × instance count`, not `limit`), not a hypothetical
one.

**Resume upload: storage isolated behind one function.** `multer.memoryStorage()` only parses the
multipart request into a buffer; a separate `storage.service.js` (`saveFile(file) -> url`) is the *only*
code that knows how files are actually persisted — the upload route/controller and `fileFilter`/size-limit
validation never change regardless of backend. Three are wired up today, tried in order: **Google Cloud
Storage** (`GCS_BUCKET` set — the primary target), **Vercel Blob** (`BLOB_READ_WRITE_TOKEN` set — the
fallback for a pure-Vercel deploy with no GCP project), then local disk (dev/tests, nothing configured).
Adding a fourth backend is still the same shape of change: replace this one function's body, nothing else
moves. See `DEPLOYMENT.md` for the GCS setup steps (bucket IAM, service-account credentials, and why
Vercel needs the credentials passed as a JSON env var rather than a file path).

**Known, explicit tradeoffs (not oversights):**
- **Frontend duplicates the status-transition graph.** `frontend/src/utils/statusMachine.js` is a second,
  hand-kept-in-sync copy of the backend's transition table, used only to decide which "move to X" buttons
  the pipeline board shows. The backend independently re-validates every transition regardless, so a
  drifted frontend copy would only ever cause a confusing UI (showing/hiding the wrong buttons), never a
  security or data-integrity issue — but it is a real duplication, called out explicitly in both files'
  comments rather than hidden.
- **Cache invalidation is explicit-on-write, not on every state change.** `apply()`'s slot-claim
  increments to a listing's `filledCount` don't invalidate its cache entry on every single application —
  only `updateListing`/`deleteListing` do. A 30s TTL bounds the staleness this can introduce. Deliberate:
  invalidating on every application would mean a popular, actively-applied-to listing rarely gets a cache
  hit, defeating the point. See the Phase 4 entry in `DECISIONS.md`.
- **Postgres, an async job queue/outbox, and multi-recruiter "hiring teams" were considered and
  deliberately not built** — see [`FUTURE_WORK.md`](FUTURE_WORK.md) for the reasoning behind each.

## Build process

This was built iteratively, phase by phase, with each phase's rationale and a full commit-by-commit
handoff log preserved in `agent-comms/`:
- [`PLAN.md`](agent-comms/PLAN.md) — the phase-wise roadmap
- [`HANDOFF.md`](agent-comms/HANDOFF.md) — what each phase actually did, verified, and found
- [`DECISIONS.md`](agent-comms/DECISIONS.md) — every design decision with alternatives considered
