# Job Board — Phase-Wise Build Plan

Source spec: [`../Initial_prompt.md`](../Initial_prompt.md)

Three agents work **sequentially**, one phase at a time, in this exact order.
Never work out of order and never touch a phase assigned to another agent
unless that agent's handoff explicitly asks for a fix.

Coordination files (all in `agent-comms/`):
- `PLAN.md` — this file. The fixed roadmap. Only edit it if the *user* changes scope.
- `HANDOFF.md` — running log, newest entry at the bottom. Read before you start, append when you finish.
- `DECISIONS.md` — durable design-decision record (the interview-prep material). Append, don't rewrite history.
- `AGENT_INSTRUCTIONS.md` — the protocol every agent follows every turn. Read this first, always.

Agent key:
- **CC** = Claude Code — architecture, security, and anything the user needs to defend in an interview
  (schema/index design, auth, status-transition state machine, pagination/search strategy).
- **GA** = Gemini / Antigravity — large, well-specified implementation slices, especially UI-heavy ones.
- **OC** = opencode (open-source model via NVIDIA NIM) — mechanical, narrowly-specified work with an
  existing pattern to copy. Keep OC's tasks small and unambiguous; don't hand it open-ended design calls.

> **2026-07-13 update:** the user has decided all remaining phases (6 onward) will be executed by
> Claude Code, not handed to GA/OC. The original GA/OC labels below are left as-is for the historical
> record of the original plan, but `HANDOFF.md` entries from Phase 6 onward should be attributed to CC
> regardless of what's written in this file's phase headers. Caching (previously bundled into Phase 6)
> has been split out into an **Optional / Deferred** section at the end — the user will decide later
> whether it's worth doing at all.

---

## Phase 0 — Architecture & Scaffolding · **CC**
- Confirm open questions with the user before coding: page-based vs cursor pagination, whether Redis
  caching is in scope at all, refresh-token storage strategy (rotating vs static, where stored).
- Record the answers in `DECISIONS.md` immediately.
- Create backend/frontend folder skeletons (`backend/{routes,controllers,services,models,middleware,config}`,
  `frontend/` Vite app shell), root `package.json`/workspace setup, `.env.example`, `.gitignore`,
  ESLint/Prettier config, base `README.md` stub.
- **Exit criteria:** empty-but-runnable backend (`npm run dev` boots an Express server with a health route)
  and empty-but-runnable frontend (Vite dev server serves a blank page). Commit. Append `HANDOFF.md` entry.

## Phase 1 — Mongoose Models & Indexes · **CC**
- `User`, `Listing`, `Application` schemas per the spec.
- Text index on `Listing.title`/`description`; compound index on `(tags, location, status)`.
- DB connection module, seed script (optional, small).
- **Exit criteria:** models importable, indexes created on startup (or via a migration script), one Jest
  test per model confirming required fields/enum validation.

## Phase 2 — Auth · **CC**
- Register, login, refresh-token endpoints; bcrypt hashing; JWT issuance/verification middleware;
  role-based access control middleware (poster vs applicant).
- Centralized error-handling middleware and a request logger (introduced here since auth is the first
  real route surface).
- **Exit criteria:** auth routes work end-to-end via Supertest; RBAC middleware unit-tested.

## Phase 3 — Listings CRUD · **OC**
- Follow the route/controller/service pattern established in Phase 2 exactly — don't invent a new
  layering style.
- Public `GET /listings` (list) and `GET /listings/:id`; poster-only `POST`/`PUT`/`DELETE`.
- Input validation (zod or express-validator, matching whichever CC picked in Phase 2).
- **Exit criteria:** full CRUD reachable, validation rejects malformed input with the centralized error
  handler's shape, no filtering/search/pagination yet (that's Phase 5).

## Phase 4 — Applications & Status Pipeline · **CC**
- Apply endpoint (applicant), list-applicants-for-a-listing endpoint (poster-only), status-update endpoint
  (poster-only) enforcing the legal transition graph (`applied → shortlisted → interview → offer/rejected`,
  no skipping stages), `statusHistory[]` audit trail on every transition.
- This is the piece the user most needs to defend in interviews — keep the state machine explicit and
  centrally defined (not scattered if/else checks).
- **Exit criteria:** illegal transitions rejected with a clear error; every legal transition appends to
  `statusHistory`.

## Phase 5 — Search, Filtering, Pagination · **CC**
- Text search using the Phase 1 text index; filtering by tags/location/status using the compound index.
- Cursor-based pagination (justify the choice over `skip()` in `DECISIONS.md`).
- **Exit criteria:** `GET /listings?...` supports search + filters + cursor pagination together;
  `.explain()` output or index usage noted in `DECISIONS.md` for interview reference.

## Phase 6 — Rate Limiting on the apply endpoint · **CC**
- In-memory rate limiter on `POST /api/applications/:listingId/apply` (Redis was ruled out in Phase 0).
- **Exit criteria:** apply endpoint returns 429 under burst load, covered by a test.
- Caching (previously bundled here) moved to **Optional / Deferred** at the end of this file.

## Phase 7 — CRUD/Filter Tests · **CC**
- Supertest coverage for Listings CRUD (Phase 3) and search/filter/pagination (Phase 5) happy paths +
  obvious edge cases (bad query params, unauthorized writes) not already covered by Phases 3/5's own tests.

## Phase 8 — Business-Logic Tests · **CC**
- Focused Jest/Supertest coverage for the status-transition state machine and auth/RBAC middleware —
  the two things listed explicitly in the spec as must-test. (Largely already covered by Phases 2 and 4's
  tests — this phase is a targeted gap-check, not a rewrite.)
- **Exit criteria:** all backend tests green; this closes out the backend.

## Phase 9 — Frontend Scaffold + Auth Pages · **CC**
- Vite + React Router + Tailwind setup, API client wrapper (fetch/axios) with token refresh handling,
  login/register pages, protected-route wrapper.
- **Exit criteria:** a poster and an applicant can each register/login and land on a role-appropriate
  empty dashboard shell.

## Phase 10 — Browse/Search/Filter Page · **CC**
- Public listing browse page: search box, tag/location filters, pagination controls wired to Phase 5's API.

## Phase 11 — Poster Dashboard · **CC**
- Manage-listings view (CRUD) + pipeline board to view/move applicants through statuses, calling Phase 4's
  status-update endpoint. This is the flagship interactive screen.

## Phase 12 — Applicant Dashboard · **CC**
- "My applications" list + per-application status view. Reuse the table/list components and API client
  patterns already established in Phases 10–11; no new architecture.

## Phase 13 — Integration Pass, README, Interview Prep · **CC**
- Read every `HANDOFF.md` entry and the full diff from Phase 0's commit to HEAD; reconcile any
  inconsistencies (error shapes, naming, unused code).
- Write final `README.md`: setup instructions + architecture summary.
- Consolidate `DECISIONS.md` into the interview-prep section of the README (indexing, pagination,
  status-transition validation, rate limiting tradeoffs).

---

## Optional / Deferred — Redis Caching on hot listings
- Not scheduled. Phase 0 decided against Redis for scope reasons (see `DECISIONS.md`), but the spec
  calls it out as an optional stretch goal, so it's kept here rather than dropped outright.
- If revisited: cache hot/most-viewed listings, explicit invalidation on listing update, and a note in
  `DECISIONS.md` on the invalidation strategy chosen.
- The user will decide later whether this is worth doing; do not start it without that go-ahead.

---

## Ground rules for every agent
1. Read `AGENT_INSTRUCTIONS.md` before starting your phase.
2. Do only the phase assigned to you. If you find something broken from an earlier phase, fix it only if
   it blocks you, note it in `HANDOFF.md`, and keep the fix minimal.
3. Commit at the end of your phase. Never force-push, never rewrite another agent's commits.
4. If the plan itself looks wrong for what you're seeing in the code, stop and flag it in `HANDOFF.md`
   rather than silently deviating — the user reviews `HANDOFF.md` between phases.
