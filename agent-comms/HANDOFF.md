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
