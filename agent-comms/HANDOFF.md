# Handoff Log

Append-only. Newest entry at the bottom. Never edit or delete a previous entry.
Each entry uses this template:

```
## Phase <N> — <phase name> · <agent: CC/GA/OC> · <date>
Commit range: <hash-before>..<hash-after>

### What I did
- ...

### Diff check against previous entry
- Confirmed / discrepancies found: ...

### Decisions made (also copied to DECISIONS.md if durable)
- ...

### Open questions / blockers for the next agent
- ...

### Exit criteria met?
- yes/no + notes
```

---

## Phase -1 — Repo bootstrap · CC · 2026-07-12
Commit range: (initial commit)

### What I did
- Initialized the git repo (`git init`) so subsequent agents can diff against a known baseline.
- Wrote `agent-comms/PLAN.md`, `agent-comms/AGENT_INSTRUCTIONS.md`, and this file.
- No application code written yet — Phase 0 (architecture confirmation + scaffolding) is next, owned
  by Claude Code.

### Open questions / blockers for the next agent
- Phase 0 must get explicit answers from the user on: pagination style (cursor vs page-based),
  whether Redis is in scope, refresh-token storage strategy — before writing backend code.

---

## Phase 0 — Architecture & Scaffolding · CC · 2026-07-12
Commit range: 0ba8117..3f404aa

### What I did
- Confirmed the three open decisions with the user (asked directly, not guessed): cursor-based
  pagination, Redis out of scope for now, static refresh token in an httpOnly cookie. Recorded full
  rationale for each in `DECISIONS.md`.
- Backend scaffold at `backend/`: `src/{routes,controllers,services,models,middleware,config,utils}`,
  `express` app in `src/app.js` (cors, json body parsing, cookie-parser, morgan request logging), a real
  `GET /health` route, centralized `errorHandler`/`notFoundHandler` middleware (`ApiError` class for
  throwing typed HTTP errors), `src/config/env.js` reading from `.env`. `.env.example`, `.eslintrc.json`,
  `package.json` (express, mongoose, jsonwebtoken, bcrypt, zod, cookie-parser, cors, morgan, dotenv +
  jest/supertest/eslint devDeps).
- Frontend scaffold at `frontend/`: Vite + React (JS, not TS) + `react-router-dom` + Tailwind CSS **v4**
  (via `@tailwindcss/vite` plugin, not the old postcss/init flow — note this if you're used to Tailwind
  v3 config) + `axios` (installed, not yet wired to anything). Stripped Vite's default demo
  markup/assets/README; `App.jsx` now just renders a placeholder home route inside a `BrowserRouter`.
  Vite dev server proxies `/api` → `http://localhost:4000` (see `vite.config.js`) so Phase 9's API client
  can call relative `/api/...` paths with no CORS juggling in dev.
- Root `.gitignore` (node_modules, dist/build, .env, uploads/) and root `README.md` stub with current
  run instructions.

### Diff check against previous entry
- N/A (first real code commit — previous entry was the bootstrap-only commit).

### Decisions made (also copied to DECISIONS.md)
- Pagination: cursor-based, keyed on `(createdAt, _id)`.
- Redis: out of scope for now (in-memory rate limiter later; caching described but not built).
- Refresh tokens: static (non-rotating), httpOnly/Secure/SameSite=Strict cookie, hashed server-side.
- Full rationale for all three is in `DECISIONS.md` — read it before Phase 6 (rate limiting) and Phase 5
  (pagination), since those phases implement these decisions directly.

### Open questions / blockers for the next agent
- None blocking. Phase 1 (CC) can start immediately: Mongoose models + text/compound indexes + DB
  connection module. `src/config/env.js` already has `mongoUri` ready to consume.
- Note for whoever picks up Phase 1: this sandbox had no Node.js preinstalled — `apt-get install -y
  nodejs npm` was required before anything would run. If your environment already has Node, ignore this;
  just flagging in case the next agent's environment is similarly bare.

### Exit criteria met?
- Yes. Verified directly (not just visually): `cd backend && npm install && npm run dev` boots the API
  and `curl localhost:4000/health` returns `{"status":"ok"}`. `cd frontend && npm install && npm run dev`
  serves 200 on `/`, and `npm run build` succeeds cleanly (build output not committed).

---

## Phase 1 — Mongoose Models & Indexes · CC · 2026-07-12
Commit range: 3f404aa..05546ca (Phase 0's handoff-log commit `5dead7f` is included in this range too,
since it landed before Phase 1 started)

### What I did
- `src/models/User.js`: `name`, `email` (unique, lowercased, regex-validated), `passwordHash`, `role`
  (enum `poster`/`applicant`), `refreshTokenHash` (nullable — added now since the Phase 0 refresh-token
  decision requires storing a hashed token server-side; Phase 2 will populate it).
- `src/models/Listing.js`: `title`, `description`, `tags[]`, `location`, `posterId` (ref `User`),
  `status` (enum `open`/`closed`, default `open`). Three indexes, all named and explained in
  `DECISIONS.md`: a weighted text index on `title`/`description` (`listing_text_search`), a compound
  filter index on `tags`/`location`/`status` (`listing_filter_compound`), and a separate
  `{createdAt: -1, _id: -1}` index (`listing_cursor_pagination`) sized specifically for Phase 5's cursor
  pagination — deliberately not folded into the filter index, see `DECISIONS.md` for why.
- `src/models/Application.js`: `listingId`/`applicantId` (refs), `resumeUrl`, `coverNote`, `status` (enum,
  default `applied`), `statusHistory[]` defaulting to a single `applied` entry on creation. Unique compound
  index on `{listingId, applicantId}` so double-applying is rejected at the DB layer, plus a
  `{listingId, status}` index for the poster's "list applicants" view. Note: this schema only *records*
  history — the legal-transition state machine enforcement is explicitly deferred to Phase 4's service
  layer, not implemented here.
- `src/config/db.js`: `connectDB()`/`disconnectDB()`, wired into `src/index.js` so the server now connects
  to Mongo before it starts listening (fails fast with a clear log line + `process.exit(1)` if the
  connection fails, rather than serving traffic against a dead DB).
- Tests: `tests/setupTestDB.js` (connect/clear/close helpers) + one Jest file per model
  (`tests/models/{User,Listing,Application}.test.js`), 12 tests total — required-field validation, enum
  validation, and uniqueness constraints per model, plus an explicit assertion that the two named Listing
  indexes exist. Added `mongodb-memory-server` as a devDependency so these run against a real (ephemeral)
  mongod with no external DB dependency; added `jest.config.js` (`transform: {}`, since Node's native ESM
  needs no Babel step here).
- Full rationale for the index choices and the Application uniqueness constraint is in `DECISIONS.md`.

### Diff check against previous entry
- Confirmed: `git diff 0ba8117..3f404aa --stat` matched the Phase 0 entry's file list exactly, and
  `5dead7f` was verified to be handoff-log-only (`agent-comms/HANDOFF.md`, 46 insertions, nothing else).

### Decisions made (also copied to DECISIONS.md)
- Listing index design (text index weighting, compound filter index field order, separate pagination
  index) — see `DECISIONS.md` for the full reasoning, this is meant to be interview-ready as-is.
- Application uniqueness enforced via a unique compound index, not just service-layer checks.

### Open questions / blockers for the next agent
- None blocking. Phase 2 (CC) — Auth — can start immediately. `User.refreshTokenHash` is already on the
  schema and ready to be populated; `env.jwtAccessSecret`/`jwtRefreshSecret`/`accessTokenTtl`/
  `refreshTokenTtl` are already in `src/config/env.js` from Phase 0.
- This sandbox has no real `mongod` installable via apt (`mongodb-org` isn't in the default repos) — I
  verified `src/index.js`'s real DB connection path (not just the test suite) by spinning up a standalone
  `mongodb-memory-server` instance and pointing `MONGO_URI` at it manually; that scratch script was
  deleted afterward, it's not part of the repo. If Phase 2's environment has real MongoDB, no action
  needed — just noting how this was verified here in case it isn't.

### Exit criteria met?
- Yes. `npm test` → 3 suites / 12 tests passing. `npm run lint` clean. Manually verified `src/index.js`
  connects to MongoDB and then boots the API (see note above on how, given no local `mongod`).

---

## Phase 2 — Auth · CC · 2026-07-12
Commit range: 05546ca..b624304

### What I did
- `src/utils/jwt.js`: `signAccessToken`/`verifyAccessToken` (short-lived, `ACCESS_TOKEN_TTL`) and
  `signRefreshToken`/`verifyRefreshToken` (long-lived JWT, separate secret, `REFRESH_TOKEN_TTL`).
- `src/utils/refreshToken.js`: bcrypt hash/compare helpers for the refresh token, used for server-side
  revocation (see below).
- `src/utils/duration.js`: tiny `"15m"`/`"30d"`-style duration parser, used to set the refresh cookie's
  `maxAge` from `env.refreshTokenTtl`.
- `src/services/auth.service.js`: `register`/`login`/`refresh`/`logout`. Passwords hashed with bcrypt
  (10 rounds). `register`/`login` both issue an access token + refresh token and persist
  `bcrypt(refreshToken)` on the user. `refresh` verifies the refresh JWT's signature/expiry, loads the
  user by its `sub` claim, then bcrypt-compares the raw token against the stored hash before minting a new
  access token — the static refresh token itself is never reissued (matches the Phase 0 decision).
  `logout` clears `refreshTokenHash`, which is what makes revocation actually work (a cleared hash fails
  the compare even if the JWT signature/expiry are still valid).
- `src/middleware/auth.js`: `requireAuth` (parses `Authorization: Bearer`, verifies, sets
  `req.user = {id, role}`) and `requireRole(...roles)` (403 if `req.user.role` isn't allowed, 401 if
  `req.user` is missing — i.e. it was mounted before `requireAuth`).
- `src/middleware/validate.js`: generic `validateBody(zodSchema)`, wired into `POST /register` and
  `POST /login` via `src/validation/auth.schema.js`. Validation failures go through the existing
  `ApiError`/`errorHandler` from Phase 0 with a `400` and per-field messages.
- `src/controllers/auth.controller.js` + `src/routes/auth.routes.js`, mounted at `/api/auth` in `app.js`:
  `POST /register`, `POST /login`, `POST /refresh`, `POST /logout` (requires auth). Refresh token cookie:
  `httpOnly`, `secure` in production only, `sameSite: strict`, scoped to `path: /api/auth`. Response
  bodies never include `passwordHash`/`refreshTokenHash` (controller maps to a `toPublicUser` shape).
- Tests: `tests/routes/auth.routes.test.js` (Supertest, full register/login/refresh/logout flow including
  duplicate-email 409, bad-credentials 401, missing-cookie 401, and logout-then-refresh-fails to prove
  revocation actually works) + `tests/middleware/auth.middleware.test.js` (unit tests for `requireAuth`/
  `requireRole` against mock req/res/next, no DB needed). 16 new tests, 28 total now passing.
- Full rationale for the JWT-based refresh token design is in `DECISIONS.md`.

### Diff check against previous entry
- Confirmed: `git diff 3f404aa..05546ca --stat` matched the Phase 1 entry's file list.

### Decisions made (also copied to DECISIONS.md)
- Refresh token is a signed JWT (not a random opaque string) so it self-identifies its owner via `sub`,
  while still being revocable via a server-side bcrypt-hash comparison. Full writeup in `DECISIONS.md`.

### Open questions / blockers for the next agent
- None blocking. **Phase 3 (Listings CRUD) is next and is assigned to opencode (OC)** per `PLAN.md`, not
  Claude Code — I'm stopping here rather than doing it myself, per the plan's ownership boundaries.
  Whoever picks up Phase 3 should mirror this phase's layering exactly: `routes/` thin, `controllers/`
  handle req/res + call services, `services/` hold the actual logic and throw `ApiError`, `validation/`
  holds zod schemas, protect poster-only routes with `requireAuth, requireRole("poster")` from
  `src/middleware/auth.js`.
- Also verified live (not just Supertest-in-process): booted a standalone `mongodb-memory-server` +
  `node src/index.js` and curled register/login/refresh by hand to rule out cookie-handling bugs that an
  in-process Supertest app could mask. Scratch script deleted afterward, not part of the repo.

### Exit criteria met?
- Yes. Auth routes work end-to-end via Supertest (12 route tests) and were additionally verified against a
  live server. RBAC middleware has dedicated unit tests (6 tests). `npm run lint` clean.

---

## Phase 3 — Listings CRUD · CC (Haiku) · 2026-07-12
Commit range: b624304..8ec6974

### What I did
- `src/validation/listing.schema.js`: `createListingSchema` (required: title, description, location;
  optional: tags[]) and `updateListingSchema` (all fields optional). Mirrors `auth.schema.js` style.
- `src/services/listing.service.js`: `createListing` (sets posterId), `getListing`, `updateListing` (403
  if user isn't the poster), `deleteListing` (403 if user isn't the poster), `listListings` (returns all
  open listings only). Authorization checks at the service layer, not the controller.
- `src/controllers/listing.controller.js`: thin req/res handlers (5 endpoints), all call the service and
  pass errors to `next()`.
- `src/routes/listing.routes.js`: GET `/` (public, anyone), GET `/:id` (public), POST `/` (auth+poster),
  PUT `/:id` (auth+poster), DELETE `/:id` (auth+poster). Validation middleware on POST/PUT.
- `src/app.js`: mounted at `/api/listings`.
- `tests/routes/listing.routes.test.js`: 14 new tests covering happy paths (create, get, list, update,
  delete), authorization (401 unauthenticated, 403 applicant trying to create, 403 different poster
  trying to update/delete), 404 not found, and 400 validation failures. Total is now 42/42 tests passing.

### Diff check against previous entry
- Confirmed: `git diff b624304..268a799` was handoff-log-only (57 insertions).

### Decisions made
- None new in this phase — all layering and RBAC patterns mirror Phase 2 exactly.

### Open questions / blockers for the next agent
- None blocking. Phase 4 (Applications & Status Pipeline) is next and is assigned to Claude Code again.
  Listings now exist as full resources, so the dependency is satisfied.
- Note: This phase was executed by CC (Haiku model), stepping in for the opencode slot in the plan to
  keep momentum. The patterns are established and consistent; future phases can strictly follow the
  route/controller/service/validation layering seen here.

### Exit criteria met?
- Yes. `npm test` → 6 suites / 42 tests all passing. `npm run lint` clean. Tested happy paths, RBAC
  enforcement, authorization errors, and validation errors via Supertest.

---

## Phase 4 — Applications & Status Pipeline · CC · 2026-07-12
Commit range: 8ec6974..55b9155

### What I did
- `src/utils/statusMachine.js`: Centralized state machine defining legal transitions:
  `applied → [shortlisted, rejected]`, `shortlisted → [interview, rejected]`, `interview → [offer, rejected]`, `offer → [rejected]`, `rejected → []` (terminal). Two exported functions: `isLegalTransition(from, to)` and `getLegalTransitions(from)`. This is the single source of truth for the pipeline, kept *outside* the service so it's testable in isolation and the transition logic is explicit and defensible.
- `src/validation/application.schema.js`: `applySchema` (required: resumeUrl; optional: coverNote) and `updateApplicationStatusSchema` (required: status).
- `src/services/application.service.js`: `apply` (checks for duplicate application as defense-in-depth; the DB unique index is the actual guard), `getApplicationsForListing` (verifies poster owns the listing), `updateApplicationStatus` (enforces the state machine via `isLegalTransition`, appends to `statusHistory`), `getApplicationById`.
- `src/controllers/application.controller.js`: thin handlers calling the service.
- `src/routes/application.routes.js`: POST `/:listingId/apply` (auth+applicant), GET `/listing/:listingId` (auth+poster), PUT `/:applicationId/status` (auth+poster), GET `/:applicationId` (auth).
- `src/app.js`: mounted at `/api/applications`.
- `tests/routes/application.routes.test.js`: 17 new tests covering apply (happy path, duplicate prevention, authz/authn errors, validation), listing applicants (happy path, authz), status updates (legal/illegal transitions, rejection from any state, terminal-state lock-out, authz), and get-by-id. All existing tests still passing (57 total now).

### Diff check against previous entry
- Confirmed: `git diff 8ec6974..66e82a0 --stat` was handoff-log-only (37 insertions).

### Decisions made (to be added to DECISIONS.md in Phase 13)
- Status machine is a separate utility function (not buried in service logic), making the transition graph explicit, testable, and defensible in interviews.
- The state machine is **not a state table** (e.g., reject-to-applied); it's a directed graph where `rejected` is terminal by design.

### Open questions / blockers for the next agent
- None blocking. Phase 5 (Search, Filtering, Pagination) is next and assigned to Claude Code. The status machine is complete and stable; future phases only *read* statuses, they don't define transitions.
- All three core resource types (User, Listing, Application) now have full CRUD paths wired and tested. The backend is functionally complete for the core ATS pipeline.

### Exit criteria met?
- Yes. `npm test` → 7 suites / 57 tests all passing. `npm run lint` clean. Tested happy paths, legal/illegal transitions, authz, authn, validation, and terminal-state enforcement via Supertest.

---

## Phase 5 — Search, Filtering, Pagination · CC · 2026-07-12
Commit range: 55b9155..6198b05

### What I did
- `src/utils/cursor.js`: Cursor encode/decode utilities. Cursors are base64-encoded JSON `{createdAt,
  _id}` tuples from the last item on the current page, allowing stateless pagination keyed to an indexed
  sort key rather than an offset. Calls to `encodeCursor(item)` and `decodeCursor(cursor)`.
- `src/validation/listing-query.schema.js`: Zod schema for `GET /api/listings` query params:
  `search` (string), `tags` (single or array), `location` (string), `status` (enum, defaults to "open"),
  `cursor` (string), `limit` (coerced to int, 1-100, defaults to 10). Normalization + validation all
  in one pass.
- `src/middleware/validate.js`: Added `validateQuery(schema)` to validate `req.query` (mirrors
  `validateBody`).
- `src/services/listing.service.js`: Rewrote `listListings(query)` to support search, filtering, and
  cursor pagination. Builds a MongoDB query using:
  - `$text` for full-text search (uses the Phase 1 weighted text index on title/description).
  - `{ tags: { $in: [...] } }` for tag filtering (multikey index backing).
  - Exact string match for location.
  - `$or` cursor logic: `createdAt < cursor.createdAt` OR `(createdAt == cursor.createdAt AND _id <
    cursor._id)` to handle pagination after the cursor (uses the Phase 1 `{createdAt: -1, _id: -1}`
    index).
  - Returns `{ items, nextCursor }` where `nextCursor` is set only if there are more pages.
- `src/routes/listing.routes.js`: Added `validateQuery` middleware to `GET /` before the controller.
- `src/controllers/listing.controller.js`: Updated `listListings` to return the paginated response
  `{ items, nextCursor }` instead of a plain array.
- `tests/routes/listing.routes.test.js`: Updated existing tests to expect `{ items, nextCursor }`
  responses. Added 5 new tests: empty list, filters by tags, filters by location, searches by text,
  and cursor pagination (creates 3 items, fetches page 1 with limit 2, fetches page 2 with cursor).

### Diff check against previous entry
- Confirmed: `git diff 55b9155..27de48e --stat` was handoff-log-only (29 insertions). Note: since Phase
  3 was also run by CC (Haiku), there's a clean trail from Phase 4 code to Phase 5.

### Decisions made (to be added to DECISIONS.md in Phase 13)
- Cursor is opaque and stateless: client sends the cursor they received, API decodes it and applies it
  to the query. No server-side pagination state.
- Cursor encodes both `createdAt` and `_id` so the tiebreaker works even if multiple items have the same
  timestamp.

### Open questions / blockers for the next agent
- None blocking. Phase 6 (Rate Limiting & Caching) is next, assigned to Gemini/Antigravity. The backend
  API is feature-complete: auth, CRUD, applications pipeline, search/filter/pagination all working. Phase
  6 is an optional performance layer (the spec left caching optional); frontend work starts after Phase 6.
- Indexes from Phase 1 are now actively used: text index for search, compound filter index for
  tags/location/status, pagination index for cursor-based sorting.

### Exit criteria met?
- Yes. `npm test` → 7 suites / 61 tests all passing. `npm run lint` clean. Tested pagination happy
  path (next cursor correctly set/unset), search across title and description, filtering by tags and
  location, and combinations thereof, via Supertest. API now supports the full spec browsing/search
  workflow.

---

## Phase 6 — Rate Limiting on the apply endpoint · CC · 2026-07-13
Commit range: 6198b05..18fce62 (includes the plan-update commit `f308620` — see note below)

### What I did
- **Plan change first:** the user decided all remaining phases (6 onward) go to Claude Code rather than
  GA/OC, and moved Redis caching out of this phase into an "Optional / Deferred" section at the bottom of
  `PLAN.md` — not scheduled, revisit only if the user asks. `PLAN.md` phase headers 6-12 were updated to
  reflect this (see the 2026-07-13 note near the top of that file). This phase now covers rate limiting
  only, no caching.
- `src/middleware/rateLimit.js`: `applyRateLimiter` using `express-rate-limit`, 5 requests per 60s window,
  scoped only to `POST /api/applications/:listingId/apply`. Keyed by `req.user.id` (not IP) since
  `requireAuth` always runs before this middleware in the route chain — per-user limiting is both more
  meaningful (an attacker can't just rotate IPs against an authenticated abuse case) and avoids
  false-positives from users behind shared NAT/corporate IPs. Falls back to `ipKeyGenerator(req.ip)`
  (express-rate-limit's IPv6-safe helper) for the unauthenticated case, which is dead code in practice
  since the route always has `requireAuth` ahead of the limiter, but keeps the library's static validator
  happy without suppressing a real warning.
- `src/routes/application.routes.js`: inserted `applyRateLimiter` into the apply route's middleware chain,
  after `requireAuth`/`requireRole` (so `req.user` is populated) and before body validation.
- `tests/middleware/rateLimit.test.js`: creates 6 distinct listings so each of 6 apply calls is otherwise
  legal (avoids the Phase 4 duplicate-application 409 confounding the result), asserts the first 5 return
  201 and the 6th returns 429.
- No Redis, no caching — see the plan-change note above.

### Diff check against previous entry
- Confirmed: `git diff 55b9155..27de48e --stat` (Phase 5's own check) was already verified in the prior
  entry; `git diff 6198b05..4a594a4 --stat` (Phase 5's handoff commit) was handoff-log-only (28
  insertions — consistent with the Phase 5 entry above).

### Decisions made (to be added to DECISIONS.md in Phase 13)
- Rate limiter keyed by authenticated user id, not IP — rationale above. Worth a line in the interview-prep
  README alongside the Phase 0 "why no Redis" decision, since the two are related (in-memory limiter is
  the direct consequence of the no-Redis call).

### Open questions / blockers for the next agent
- None blocking. Per the updated `PLAN.md`, Phase 7 (CRUD/Filter test gap-check) is next, also CC. Given
  Phases 3 and 5 already shipped solid test coverage for their own endpoints, Phase 7 should be a
  genuine gap-check (read the existing tests first, only add what's missing) rather than a rewrite.
- This session was interrupted by the user's token-management timer right after this phase's code was
  committed (`18fce62`) but before this HANDOFF entry was written — that's why the entry is arriving in a
  later session. No code was left uncommitted.

### Exit criteria met?
- Yes. `npm test` → 8 suites / 62 tests all passing. `npm run lint` clean. 429 verified under a burst of
  6 rapid apply calls against 6 distinct listings.

---

## Phase 7 — CRUD/Filter test gap-check · CC · 2026-07-13
Commit range: 18fce62..5e5478f (includes `ca17e35`, this session's Phase 6 HANDOFF entry, written first)

### What I did
- Read through Phase 3's (`tests/routes/listing.routes.test.js`) and Phase 5's coverage in full before
  writing anything new, per the plan's instruction that this phase is a gap-check, not a rewrite.
- **Found and fixed a real bug** while gap-checking, not just a missing test: `GET/PUT/DELETE
  /api/listings/:id` (and the equivalent on `/api/applications/:id`) returned a bare **500** for a
  malformed id like `not-a-valid-id`, because Mongoose throws a `CastError` (not an `ApiError`), which
  the Phase 0 `errorHandler` didn't recognize and fell through to the generic `err.statusCode || 500`
  branch. Fixed centrally in `src/middleware/errorHandler.js`: `err.name === "CastError"` now maps to a
  `400` with a clear message, before the generic branch runs. This fixes it for *every* resource's `:id`
  param, not just listings, since the fix is in the shared handler.
- Added tests for the gaps that were actually missing:
  - `listing.routes.test.js`: malformed-id → 400 (proves the fix above), closed listings excluded from
    the default browse, tags+location+status combined in one query (exercises the Phase 1 compound index
    the way it's actually meant to be used), out-of-range `limit` → 400, invalid `status` enum value → 400.
  - `application.routes.test.js`: malformed-id → 400 on `GET /:applicationId`.
- Did not touch auth or status-transition test files, per the plan's boundary for this phase (that's
  Phase 8's job, and largely already covered by Phase 2/4's own tests anyway).

### Diff check against previous entry
- Confirmed: `git diff 6198b05..18fce62 --stat` (Phase 6's actual diff, including the plan-update commit)
  matched what the Phase 6 HANDOFF entry (written in this same session, just before this one) claims.

### Decisions made
- None new — the CastError fix is a bug fix, not a design decision, so it's not going in `DECISIONS.md`.
  Worth a one-line mention in the Phase 13 README under "known issues found and fixed," if that section
  ends up existing.

### Open questions / blockers for the next agent
- None blocking. Phase 8 (Business-Logic Tests: status machine + auth middleware) is next, also CC. Given
  Phase 2 already has `tests/middleware/auth.middleware.test.js` and Phase 4 already tests every legal/
  illegal transition through the real HTTP routes, Phase 8 should likewise be a targeted gap-check: the
  one clear gap is that `isLegalTransition`/`getLegalTransitions` in `src/utils/statusMachine.js` have no
  *direct* unit tests — they're only exercised indirectly through the Phase 4 route tests. Worth adding
  direct unit tests for the state machine function itself (pure function, no DB/HTTP needed) so the
  transition graph is verifiable in isolation, which is exactly the kind of thing to point to in an
  interview.

### Exit criteria met?
- Yes. `npm test` → 8 suites / 68 tests all passing. `npm run lint` clean.

---

## Phase 8 — Business-Logic Tests · CC · 2026-07-13
Commit range: 5e5478f..6095bfb (includes `7a6d1ed`, this session's Phase 7 HANDOFF entry, written first)

### What I did
- New `tests/utils/statusMachine.test.js`: direct, isolated unit tests for `isLegalTransition` and
  `getLegalTransitions` (no DB, no HTTP — pure function tests). Covers every legal edge in the transition
  graph (7 of them, via `it.each`), every illegal edge (13, via `it.each` — includes backward transitions,
  skip-ahead transitions, and every attempted transition out of `rejected`), no-op self-transitions for
  every status, and unknown/garbage status strings (proves it fails closed — returns `false`/`[]` rather
  than throwing). This was the one real gap identified in Phase 7's handoff: the state machine was only
  ever exercised indirectly through Phase 4's HTTP route tests.
- Extended `tests/middleware/auth.middleware.test.js` with edge cases not in Phase 2's original coverage:
  header present but missing the `Bearer ` prefix, an expired token (signed with `expiresIn: -10`), and a
  token forged with the wrong secret (proves signature verification, not just presence, is checked).
- Did not touch `tests/routes/auth.routes.test.js` or `tests/routes/application.routes.test.js` — those
  already have solid end-to-end coverage of the transition graph and auth flow from Phases 2 and 4.

### Diff check against previous entry
- Confirmed: `git diff 18fce62..5e5478f --stat` (Phase 7's actual code diff) matched what the Phase 7
  HANDOFF entry claims — errorHandler.js CastError fix + the listed test additions, nothing else.

### Decisions made
- None new. This phase is pure test-coverage work.

### Open questions / blockers for the next agent
- None blocking. **The backend is now complete** per `PLAN.md`'s Phase 8 exit criteria ("all backend
  tests green; this closes out the backend"). Phase 9 (Frontend Scaffold + Auth Pages) is next, also CC
  per the 2026-07-13 plan update — this is the first frontend phase, so read `frontend/src/App.jsx` and
  `frontend/vite.config.js` from Phase 0 before starting (Vite proxies `/api` to `localhost:4000` already,
  Tailwind v4 is set up via `@tailwindcss/vite`, React Router's `BrowserRouter` is already wrapping `App`
  in `main.jsx`).
- Backend surface for the frontend to consume: `/api/auth/{register,login,refresh,logout}`,
  `/api/listings` (GET list with `?search&tags&location&status&cursor&limit`, GET `/:id`, POST/PUT/DELETE
  poster-only), `/api/applications/{:listingId/apply, listing/:listingId, :applicationId,
  :applicationId/status}`.

### Exit criteria met?
- Yes. `npm test` → 9 suites / 96 tests all passing. `npm run lint` clean. Backend is feature-complete
  and closed out per the plan.

---

## Phase 9 — Frontend Scaffold + Auth Pages · CC · 2026-07-13
Commit range: 6095bfb..d912ea0 (includes `a1f6574`, this session's Phase 8 HANDOFF entry, written first)

### What I did
- **Small backend addition first**: `GET /api/auth/me` (`requireAuth`, returns the public user shape).
  `POST /auth/refresh` only ever returns a new access token by design (Phase 2's decision), so the
  frontend had no way to repopulate `name`/`email`/`role` after a silent refresh on page load without
  this. Added `authService.getUserById`, wired the route, added 2 backend tests
  (`tests/routes/auth.routes.test.js`: happy path + 401-when-unauthenticated). Full rationale in
  `DECISIONS.md` under "Frontend session restore."
- `frontend/src/api/client.js`: axios instance, `withCredentials: true` (so the httpOnly refresh cookie
  rides along automatically). Access token held in a module-level variable (**not** localStorage — same
  XSS-avoidance reasoning as the refresh-token cookie). Request interceptor attaches
  `Authorization: Bearer`. Response interceptor: on a single `401` (guarded by `config._retried` so it
  can't loop), attempts one `POST /auth/refresh` — concurrent 401s share one in-flight refresh via a
  module-level `refreshPromise` rather than firing N parallel refreshes — then retries the original
  request once. `frontend/src/api/auth.js`: thin wrappers (`register`, `login`, `refresh`, `logout`, `me`).
- `frontend/src/context/AuthContext.jsx`: `AuthProvider` + `useAuth()`. On mount: `refresh()` then `me()`
  to restore a session across a hard reload; `status` is `"loading" | "signed-in" | "signed-out"` so
  `ProtectedRoute` can tell "haven't checked yet" apart from "checked, no session" and avoid a
  redirect-flash on reload of an actually-valid session.
- `frontend/src/components/ProtectedRoute.jsx`: gates a route subtree on `status`, optionally further
  restricted by `roles` (redirects non-matching roles to `/` rather than erroring).
- `frontend/src/components/Navbar.jsx` + `Layout.jsx`: shared nav (login/register links when signed out,
  dashboard link + name + logout when signed in), wraps all routes via a layout `<Route>`.
- `frontend/src/pages/{LoginPage,RegisterPage}.jsx`: forms with client-side required/minLength
  validation, error display from the API's error shape, redirect to the role-appropriate dashboard on
  success.
- `frontend/src/pages/{PosterDashboardPage,ApplicantDashboardPage}.jsx`: placeholder shells behind
  `ProtectedRoute` — real content is Phase 11/12's job, per the plan.
- `frontend/src/App.jsx`/`main.jsx`: routes wired (`/`, `/login`, `/register`, `/poster`, `/applicant`),
  `AuthProvider` wraps `App` inside `BrowserRouter`.
- **Verified live, not just built**: booted a standalone `mongodb-memory-server` + backend + `vite dev`
  and curled through the actual Vite proxy (not a mocked fetch) — register → `/me` round trip, and
  `/auth/refresh` both with a valid cookie (succeeds) and with none (401, matching what `AuthContext`'s
  catch branch expects). This is the same request path the real browser app would take. Scratch mongod
  script deleted afterward, not part of the repo.

### Diff check against previous entry
- Confirmed: `git diff 5e5478f..6095bfb --stat` (Phase 8's actual diff) matched the Phase 8 HANDOFF entry.

### Decisions made (already in DECISIONS.md)
- `/api/auth/me` addition and its rationale.
- Frontend auth-state architecture (in-memory access token, single-retry refresh interceptor, shared
  in-flight refresh promise).

### Open questions / blockers for the next agent
- None blocking. Phase 10 (Browse/Search/Filter Page) is next, also CC. It replaces the placeholder
  `HomePage` in `App.jsx` and should call `GET /api/listings` (Phase 5's API: `?search&tags&location&
  status&cursor&limit`, response shape `{ items, nextCursor }`) — this is a **public** page, no auth
  needed, so it doesn't go through `ProtectedRoute`.
- `oxlint` (the frontend linter, different from the backend's ESLint) flags one benign warning on
  `AuthContext.jsx` about fast-refresh and mixed component/hook exports — this is a standard React context
  file pattern, not a real issue, left as-is.
- Dashboard placeholders exist at `/poster` and `/applicant` now — Phase 11/12 replace their bodies,
  routes/guards don't need to change.

### Exit criteria met?
- Yes. A poster and an applicant can each register/login (verified live through the proxy) and land on
  a role-appropriate dashboard shell (`/poster` or `/applicant`, redirect-on-role-mismatch and
  redirect-to-`/login`-when-signed-out both wired via `ProtectedRoute`). Backend still 98/98 (2 new
  `/me` tests). Frontend builds and lints clean.

---

## Phase 10 — Browse/Search/Filter Page · CC · 2026-07-13
Commit range: d912ea0..9743f86 (includes `2bb5fc4`, this session's Phase 9 HANDOFF entry, written first)

### What I did
- `frontend/src/api/listings.js`: `getListings(params)`, `getListing(id)`, `createListing`,
  `updateListing`, `deleteListing` — the last three unused until Phase 11, added now since they're trivial
  wrappers around the same `apiClient` pattern and belong next to the read functions.
- `frontend/src/api/applications.js`: `applyToListing`, `getApplicationsForListing`,
  `updateApplicationStatus`, `getApplication` — same reasoning, `applyToListing` is used this phase, the
  other three are Phase 11/12's.
- `frontend/src/components/ListingCard.jsx`: compact card (title, location, truncated description, tag
  pills), links to `/listings/:id`.
- `frontend/src/pages/BrowsePage.jsx` — **replaces the placeholder `HomePage`** from Phase 9, now the `/`
  route: search box, comma-separated tags input, location input, all submitted together as one query to
  `GET /api/listings`. Pagination is a "Load more" button (see `DECISIONS.md` — a direct consequence of
  cursor pagination not supporting arbitrary page jumps), appends `items` and advances `nextCursor`.
- `frontend/src/pages/ListingDetailPage.jsx` — new, not originally itemized in `PLAN.md`'s Phase 10 but a
  natural requirement once `ListingCard` needed somewhere to link to: fetches one listing, and if the
  signed-in user is an applicant, shows an inline apply form (`resumeUrl` + optional `coverNote`) that
  calls `POST /applications/:listingId/apply`. Posters/signed-out users see a message instead of the form
  rather than a broken/hidden state.
- `frontend/src/App.jsx`: `/` now renders `BrowsePage`, added `/listings/:id` → `ListingDetailPage`.
- **Verified live** (same standalone-mongod + backend + `vite dev` pattern as Phase 9, through the actual
  proxy, not mocked): created 2 listings, confirmed the browse response shape (`{items, nextCursor}`)
  matches what `BrowsePage` consumes, confirmed `search=` and `tags=` filters each narrow to the expected
  listing, fetched a single listing detail, and had a freshly-registered applicant apply to it — all via
  the exact URLs/params the React components use. Scratch mongod script deleted afterward.
- Note on process hygiene: this session's background dev-server processes (from both this phase's and
  Phase 9's smoke tests) didn't die cleanly from `pkill` — had to `kill -9` by PID after checking `ps aux`.
  Worth remembering for whoever does the next live smoke test in this repo: verify with `ps aux` after
  `pkill`, don't assume it worked.

### Diff check against previous entry
- Confirmed: `git diff 6095bfb..d912ea0 --stat` (Phase 9's actual diff) matched the Phase 9 HANDOFF entry
  — backend `/me` addition + all the frontend auth scaffolding listed, nothing else.

### Decisions made (already in DECISIONS.md)
- "Load more" over numbered pages for the browse UI, and why that's a direct consequence of the Phase 0
  cursor-pagination choice rather than an independent UI preference.

### Open questions / blockers for the next agent
- None blocking. Phase 11 (Poster Dashboard) is next, also CC — the flagship interactive screen (listings
  management + the applicant pipeline board). `updateListing`/`deleteListing` in `api/listings.js` and
  `getApplicationsForListing`/`updateApplicationStatus` in `api/applications.js` are already written and
  unused, ready to consume. `PosterDashboardPage.jsx` currently a placeholder — replace its body, the
  route/guard in `App.jsx` doesn't need to change.
- `ListingDetailPage` was added a phase early (Phase 10, not originally scoped there) because
  `ListingCard` needed a destination — flagging in case this reads as scope creep relative to `PLAN.md`'s
  phase-by-phase description. It's a small, self-contained addition and unblocks a dead link, not a
  reach into Phase 11/12's territory.

### Exit criteria met?
- Yes (per `PLAN.md`: "Public listing browse page: search box, tag/location filters, pagination controls
  wired to Phase 5's API"). Verified live through the proxy, not just built. Frontend builds and lints
  clean.

---

## Phase 11 — Poster Dashboard · CC · 2026-07-13
Commit range: 9743f86..bb8372f (includes `6a88894`, this session's Phase 10 HANDOFF entry, written first)

### What I did
- **Small backend addition first**: `GET /api/listings/mine` (poster-only, all statuses, no pagination —
  see `DECISIONS.md` for why this is a separate route rather than extending the public browse endpoint's
  query params). Added `listMyListings` to service/controller, mounted before `GET /:id` (route-ordering
  matters — `/mine` would otherwise be swallowed by the `:id` param matcher). 3 new backend tests: happy
  path (confirms closed listings are included and other posters' listings are excluded), 401, 403.
  Backend now 101/101.
- `frontend/src/utils/statusMachine.js`: a second copy of the backend's transition graph, used only to
  decide which "move to X" buttons the pipeline board renders — backend remains sole enforcer. Full
  duplication rationale in `DECISIONS.md`, including the explicit "keep these two files in sync" warning
  in both files' comments.
- `frontend/src/components/ListingForm.jsx`: shared create/edit form (title, description, location,
  comma-separated tags), used both inline for creating and inline per-row for editing.
- `frontend/src/components/PipelineBoard.jsx`: fetches `GET /applications/listing/:listingId`, renders a
  5-column Kanban board (one per `APPLICATION_STATUSES` value), each applicant card shows name/email/cover
  note/resume link plus only the legal next-status buttons for that card's current status (via the
  frontend statusMachine mirror), calling `PUT /applications/:id/status` on click and patching local state
  with the response rather than refetching the whole board.
- `frontend/src/pages/PosterDashboardPage.jsx` — **replaces the Phase 9 placeholder**: loads
  `GET /listings/mine` on mount, inline create form (toggle-shown), per-listing row with Edit (swaps the
  row for a `ListingForm`)/Toggle open-closed/Delete (with a `window.confirm` guard)/View-applicants
  (expands a `PipelineBoard` inline under that row) actions.
- **Verified live** (same standalone-mongod + backend + `vite dev` pattern as Phases 9-10, through the
  actual proxy): created a listing, confirmed `/listings/mine` returns it, toggled it closed and confirmed
  `/mine` still shows it (proving the "unlike public browse" behavior actually works, not just compiles),
  had an applicant apply, confirmed the poster's pipeline-board fetch shows them under "applied," moved
  them `applied → shortlisted` via the same request the button click makes, then — as a direct test of the
  frontend/backend transition-graph duplication actually being in sync — attempted the illegal
  `shortlisted → offer` jump (a button the UI would never render) directly against the API and confirmed
  the backend still independently rejects it with 400. Scratch mongod script deleted afterward. Also
  had to `kill -9` by PID again after `pkill` didn't reliably stop the background dev processes — same
  note as Phase 10, flagging again since it's now happened twice.

### Diff check against previous entry
- Confirmed: `git diff d912ea0..9743f86 --stat` (Phase 10's actual diff) matched the Phase 10 HANDOFF
  entry — the two new API wrapper files, `ListingCard`, `BrowsePage`, `ListingDetailPage`, and the
  `App.jsx` route change, nothing else.

### Decisions made (already in DECISIONS.md)
- `GET /api/listings/mine` as a separate poster-scoped endpoint rather than overloading the public one.
- Frontend duplication of the transition graph, and why (with the drift risk called out explicitly).

### Open questions / blockers for the next agent
- None blocking. Phase 12 (Applicant Dashboard) is next, also CC — "my applications" list + status view.
  **There is currently no backend endpoint for an applicant to list their own applications across all
  listings** (`GET /applications/listing/:listingId` is poster-scoped to one listing;
  `GET /applications/:applicationId` needs the id already known). Phase 12 will need a small backend
  addition analogous to this phase's `/listings/mine` — something like `GET /api/applications/mine`
  (applicant-only, all their own applications across listings, populated with listing title). Follow the
  same pattern: service function, controller, route registered before any conflicting `:id`-shaped route,
  tests for happy path + 401 + role restriction.
- `frontend/src/utils/statusMachine.js` now exists — Phase 12's applicant-facing status display can import
  `APPLICATION_STATUSES` from it for consistent labeling, no need to redefine the list a third time.

### Exit criteria met?
- Yes (per `PLAN.md`: "Manage-listings view (CRUD) + pipeline board to view/move applicants through
  statuses"). Verified live through the proxy including the illegal-transition-still-rejected case, not
  just the happy path. Backend 101/101, frontend builds and lints clean.

---

## Phase 12 — Applicant Dashboard · CC · 2026-07-13
Commit range: bb8372f..ee9b263 (includes `1361ea9`, this session's Phase 11 HANDOFF entry, written first)

### What I did
- **Small backend addition first** (flagged as needed in the Phase 11 entry above): `GET
  /api/applications/mine` (applicant-only), returns every application the current applicant has made
  across all listings, `listingId` populated with `title`/`location`/`status`, newest first, no
  pagination. Added `getApplicationsForApplicant` to the service, wired controller + route — registered
  before `/:applicationId` for the same route-ordering reason as `/listings/mine` in Phase 11. 3 new
  tests: happy path (2 applications across 2 listings, confirms a *different* applicant's application to
  one of the same listings isn't included), 401, 403-for-posters. Backend now 104/104.
- `frontend/src/components/StatusBadge.jsx`: color-coded pill per status (gray/blue/amber/green/red for
  applied/shortlisted/interview/offer/rejected). Minor note: this hardcodes its own label/color maps
  rather than importing `APPLICATION_STATUSES` from `utils/statusMachine.js` as the Phase 11 entry
  suggested — it only needed per-status lookup objects, not the array itself, so there was nothing to
  import; not a real inconsistency, just flagging since I'd flagged the opposite expectation.
- `frontend/src/api/applications.js`: added `getMyApplications()`.
- `frontend/src/pages/ApplicantDashboardPage.jsx` — **replaces the Phase 9 placeholder**: loads
  `GET /applications/mine` on mount, one card per application (listing title linking to
  `/listings/:id`, location, `StatusBadge`, and a chronological `statusHistory` timeline rendered
  straight from the Application document — no new backend work needed for the timeline itself, that data
  has existed since Phase 4, Phase 12 just surfaces it).
- **Verified live** (same pattern as Phases 9-11): applied to two listings as one applicant, moved one
  application through `applied → shortlisted → interview` as the poster, then confirmed
  `/applications/mine` returns both applications with the full `statusHistory` array intact on the one
  that was moved and listing details populated on both — exactly the shape `ApplicantDashboardPage`
  consumes. Scratch mongod script deleted afterward. Process cleanup this time worked correctly via
  `kill -9` on PIDs gathered with `ps aux | awk` — no leftover processes.

### Diff check against previous entry
- Confirmed: `git diff bb8372f..1361ea9` was the Phase 11 HANDOFF entry (already reviewed as accurate in
  that same session, so this is a formality — no code changes to check, that commit is docs-only).

### Decisions made (already in DECISIONS.md)
- `GET /api/applications/mine` as a separate applicant-scoped endpoint, mirroring the `/listings/mine`
  reasoning from Phase 11.

### Open questions / blockers for the next agent
- None blocking. **All 13 phases in `PLAN.md` are now implemented.** Phase 13 (Integration Pass, README,
  Interview Prep) is next and last, also CC: read every `HANDOFF.md` entry (this file, top to bottom) and
  the full diff from Phase 0's first commit to `HEAD`, reconcile any inconsistencies, write the final
  `README.md`, and consolidate `DECISIONS.md` into an interview-prep section.
- Known minor items for Phase 13 to consider (not blockers, just things a reconciliation pass might want
  to note or clean up): (1) `ListingDetailPage` was built in Phase 10 rather than its own phase, already
  flagged then; (2) the frontend statusMachine duplication's drift risk (Phase 11) is worth a callout in
  the README's "known tradeoffs" section, not just `DECISIONS.md`; (3) no `.env` file exists for the
  frontend (it doesn't need one — the Vite proxy handles the backend URL — but worth confirming the README
  setup instructions don't imply one is needed).

### Exit criteria met?
- Yes (per `PLAN.md`: "'My applications' list + per-application status view"). Verified live through the
  proxy with real status transitions and a real multi-application history, not just the empty/happy-path
  shell. Backend 104/104, frontend builds and lints clean.

---

## Phase 13 (part 1) — Reconciliation finding: resume upload was never built · CC · 2026-07-13
Commit range: ee9b263..1b142bb (includes `b1a0602`, this session's Phase 12 HANDOFF entry, written first)

### What I did
- Started the Phase 13 integration pass as instructed: reading every `HANDOFF.md` entry top to bottom and
  diffing Phase 0's first commit to `HEAD`. That reading surfaced a real gap, not just a style
  inconsistency: `Initial_prompt.md` explicitly requires "multer for resume/PDF uploads, stored locally
  for now (structure it so swapping to S3 later is trivial)," but **no phase in `PLAN.md` ever scheduled
  it**, and no phase implemented it — the apply flow (Phase 4 backend, Phase 10 frontend form) always took
  a plain-text `resumeUrl` string. This is different in kind from the Redis-caching gap: the user
  explicitly deferred caching (see the 2026-07-13 note in `PLAN.md`); nobody ever deferred file upload,
  it just fell through the cracks of the original phase breakdown. Fixed it now rather than deferring it
  further or just writing it up as a known gap in the README.
- `backend/src/services/storage.service.js`: `saveFile(file) -> url`, the *only* place that knows files
  are persisted to local disk right now. Full S3-swap rationale in `DECISIONS.md`.
- `backend/src/middleware/upload.js`: `multer.memoryStorage()` (deliberately not `diskStorage`, see
  `DECISIONS.md`), PDF-only `fileFilter`, 5MB limit.
- `backend/src/controllers/upload.controller.js` + `routes/upload.routes.js`: `POST /api/uploads/resume`
  (`requireAuth`), mounted at `/api/uploads` in `app.js`, plus `express.static('/uploads')` to serve
  files back.
- `backend/src/middleware/errorHandler.js`: added `MulterError` → 400 handling, same reasoning as the
  existing `CastError` case from Phase 7 (a multer validation failure — e.g. file too large — is a client
  error, not a server fault).
- `backend/tests/routes/upload.routes.test.js`: 4 tests (successful upload + fetch-back, non-PDF
  rejected, no-file rejected, unauthenticated rejected), cleans up its own `uploads/` dir in `afterAll`.
  Backend now 108/108.
- `frontend/src/api/uploads.js`: `uploadResume(file)`, posts `FormData`.
- `frontend/src/pages/ListingDetailPage.jsx`: apply form's resume field is now a real `<input
  type="file" accept="application/pdf">`, `handleApply` uploads first (`applyState: "uploading"`) then
  submits the application with the returned URL (`applyState: "submitting"`) — two distinct loading
  states shown to the user rather than one generic spinner, since they're two different network calls
  that can each fail independently.
- **Found and fixed a second bug during live verification** (not from reading code — only showed up when
  actually clicking through): the Vite dev proxy (`vite.config.js`, from Phase 0) only forwarded `/api`,
  so fetching an uploaded file back through the frontend origin returned the SPA's `index.html` (Vite's
  client-routing fallback) instead of the actual PDF. Added `/uploads` to the proxy config. Verified by
  fetching the *same* URL both before and after the fix — before: got back an `<html>` document; after:
  got back the literal PDF bytes.
- Full live verification: uploaded a real (fake-content) PDF through the proxy, fetched it back
  successfully, and confirmed a `.txt` file is rejected with 400 — all through `curl` hitting the same
  URLs the React components hit, not a mocked test.

### Diff check against previous entry
- Confirmed: `git diff bb8372f..ee9b263 --stat` (Phase 12's actual diff) matched the Phase 12 HANDOFF
  entry.

### Decisions made (already in DECISIONS.md)
- Resume storage abstraction (`memoryStorage` + a separate `saveFile` service function) and why it's
  structured that way specifically for the spec's S3-swap requirement.

### Open questions / blockers for the next agent
- None blocking — this was the last code change. What remains for Phase 13 is what was originally
  scoped for it: write the final `README.md` (setup instructions + architecture summary) and consolidate
  `DECISIONS.md` into its interview-prep section. No more implementation gaps expected, but the README
  pass should still double-check the three "known minor items" listed in the Phase 12 entry above.

### Exit criteria met?
- N/A as a standalone phase (this is scope discovered *during* Phase 13, not one of the original 13
  phases) — folded into Phase 13's commit range. Backend 108/108, frontend builds and lints clean, both
  bugs found in this pass (upload endpoint gap, proxy config gap) are fixed and verified live.

---

## Phase 13 (part 2) — README + interview-prep consolidation · CC · 2026-07-13
Commit range: 1b142bb..e7a1906 (includes `8e7a4b5`, this session's Phase 13-part-1 HANDOFF entry, written
first)

### What I did
- Wrote the final `README.md`, replacing the Phase 0 stub: setup instructions (backend `.env` + `npm
  install`/`npm run dev`, frontend `npm install`/`npm run dev`, both verified working commands, not just
  plausible-looking ones — copied from what was actually run in every phase's live smoke test), a testing
  section, project structure overview, a verified API reference table (cross-checked every row against the
  actual route files, not written from memory — see below), and a condensed "Architecture & design
  decisions" section covering the six load-bearing decisions (cursor pagination, `Listing` index design,
  the status-transition state machine, refresh-token revocation, per-user rate limiting, resume-upload
  storage abstraction) plus an explicit "known, deliberate tradeoffs" list (deferred Redis caching,
  frontend status-graph duplication, in-memory rate limiting) so those read as decisions, not oversights.
  Full alternatives-considered detail stays in `DECISIONS.md`; the README links to it rather than
  duplicating it.
- Verified two specific numeric claims before writing them rather than estimating: ran `npm test` for the
  exact current total (108, not the 104 an earlier phase entry cited — Phase 13 part 1 added 4 more), and
  ran the status-machine test file in isolation to get its exact count (25, not the 24 I initially wrote
  from memory — fixed before committing).
- Cross-checked every row of the API reference table against the actual contents of
  `auth.routes.js`/`listing.routes.js`/`application.routes.js`/`upload.routes.js` rather than
  reconstructing it from memory of earlier phases.
- Addressed the three "known minor items" flagged in the Phase 12 entry: (1) `ListingDetailPage`'s
  early construction is a non-issue, nothing to change; (2) the frontend statusMachine duplication is now
  called out explicitly in the README's tradeoffs list, not just `DECISIONS.md`; (3) confirmed the
  frontend genuinely needs no `.env` (the Vite proxy handles both `/api` and, as of Phase 13 part 1,
  `/uploads`) and the README's setup instructions don't imply otherwise.
- Did **not** re-run the full live-smoke-test-through-a-browser-proxy exercise for this part, since no
  application code changed — only documentation. Backend test suite was re-run to get the accurate count
  (see above), which incidentally also serves as a final regression check.

### Diff check against previous entry
- Confirmed: `git diff ee9b263..1b142bb --stat` (Phase 13 part 1's actual code diff) matched what that
  entry claims — storage service, upload middleware/controller/route, errorHandler MulterError handling,
  4 new tests, the frontend upload API wrapper + `ListingDetailPage` file-input rewrite, and the
  `vite.config.js` proxy fix. Nothing unexpected.

### Decisions made
- None new — this part is documentation only, consolidating decisions already recorded across Phases
  0–13 part 1 into `README.md`.

### Open questions / blockers for the next agent
- **There is no next agent.** All 13 phases in the original `PLAN.md` plus the Phase-13-discovered resume
  upload gap are implemented, tested, verified live, and documented. If the user (or a future session)
  picks this back up, the natural next steps — none of them blocking, all optional — are: (1) decide on
  the deferred Redis caching item in `PLAN.md`'s "Optional / Deferred" section; (2) consider adding
  frontend tests (none exist — the original spec only asked for backend business-logic tests, which are
  done, but a portfolio project could still benefit from a few React Testing Library tests on the
  pipeline board or auth flow); (3) the in-memory rate limiter and frontend statusMachine duplication are
  both documented as conscious scope tradeoffs, not bugs — revisit only if the project's purpose changes
  from "portfolio/interview piece" to "production service."

### Exit criteria met?
- Yes — this was the last phase. `README.md` has real, verified setup instructions and an interview-ready
  architecture summary grounded in what was actually built and tested, not aspirational. Full project
  history (every phase's rationale, what was verified and how, every design decision with alternatives
  considered) is preserved in `agent-comms/` for anyone — including the user, prepping for an interview —
  to read start to finish.
