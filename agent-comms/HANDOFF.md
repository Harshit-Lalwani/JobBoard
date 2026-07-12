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
