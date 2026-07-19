# Design Decisions Log

Durable record of design choices and their rationale — this becomes the interview-prep material
referenced in `PLAN.md` Phase 13. Append-only; if a decision changes later, add a new entry that
supersedes the old one rather than editing history, and note what changed and why.

Each entry:

```
## <topic> — decided in Phase <N> by <agent>
**Decision:** ...
**Why:** ...
**Alternatives considered:** ...
```

---

## Pagination strategy — decided in Phase 0 by CC
**Decision:** Cursor-based pagination for `GET /listings` (and any other list endpoint that can grow
large), using an opaque cursor built from `(createdAt, _id)` of the last item on the page, base64-encoded.
**Why:** `skip()` requires MongoDB to walk and discard every skipped document, so cost grows linearly with
page depth — bad at scale. A cursor built on an indexed, unique-enough compound key (`createdAt` ties
broken by `_id`) turns "next page" into an indexed range query (`{createdAt: {$lt: cursor.createdAt}}`
plus a tiebreaker), which is O(page size) regardless of how deep the user has paged. This is also the
stronger interview answer: it demonstrates awareness of why `skip()`/`limit()` degrades.
**Alternatives considered:** Page-based (`page`/`limit` with `skip()`) — simpler, supports "jump to page
N" UI, but explicitly called out in the spec as something to avoid for large offsets; rejected.

## Redis caching — decided in Phase 0 by CC
**Decision:** Skip Redis. No caching layer on hot listings; rate limiting (Phase 6) uses an in-memory
limiter, not Redis-backed.
**Why:** Keeps the project buildable in a reasonable timeframe with one fewer moving piece to run/deploy.
The caching strategy (cache hot listings by ID, invalidate on `PUT`/`DELETE` of that listing, short TTL as
a backstop) is still fully describable in an interview as a design decision, without needing a live Redis
dependency to maintain.
**Alternatives considered:** Redis-backed cache + rate limiter — more impressive to demo live, but adds
docker-compose/infra overhead disproportionate to a resume project; rejected for scope reasons, not
technical ones. Revisit if the user wants to demo caching live later — this decision is only a Phase 0
default, not a hard ceiling.

## Refresh token strategy — decided in Phase 0 by CC
**Decision:** Static (non-rotating) refresh token, persisted server-side (hashed) on the `User` document,
delivered to the client via an httpOnly, `Secure`, `SameSite=Strict` cookie. Short-lived access JWT
(15 min) issued alongside it and used for `Authorization: Bearer` on API calls.
**Why:** httpOnly cookie storage avoids XSS-exfiltration of the refresh token (the main risk of storing it
in localStorage/response body). Not rotating on each refresh is a deliberate simplification over a
rotating-token scheme — it's simpler to implement and reason about, at the cost of a stolen refresh token
staying valid until expiry or explicit logout/revocation. This tradeoff (rotation vs. static) is a good
one to be able to articulate in an interview.
**Alternatives considered:** Rotating refresh tokens (issue+invalidate a new token on every refresh,
detect reuse of an old token as a theft signal) — stronger security posture, more implementation
complexity (needs a token table/versioning); noted as the natural "if I had more time" upgrade. Refresh
token in response body / localStorage — rejected outright due to XSS exposure.

## Index design on Listing — decided in Phase 1 by CC
**Decision:** Three indexes on `Listing`: (1) a weighted **text index** on `{title, description}`
(`title` weight 5, `description` weight 1) named `listing_text_search`; (2) a **compound index** on
`{tags: 1, location: 1, status: 1}` named `listing_filter_compound`; (3) a compound index on
`{createdAt: -1, _id: -1}` named `listing_cursor_pagination`.
**Why:** MongoDB only allows one text index per collection, so title/description search has to share one
index — weighting title higher reflects that a title match is a stronger relevance signal than a body
match, which is worth being able to explain (`$text` scoring uses these weights). The filter compound
index's field order (`tags`, `location`, `status`) follows the equality-then-selectivity heuristic:
`tags` is an array field queried with `$in`/multikey equality and is usually the most selective filter in
practice, `status` is a low-cardinality field (`open`/`closed`) best left last so it doesn't fragment the
index for little selectivity gain. The pagination index exists separately because the [[pagination
strategy — decided in Phase 0 by CC]] cursor needs an index that matches its sort+tiebreak exactly
(`createdAt` descending, `_id` descending as the tiebreaker for equal timestamps) — reusing the filter
compound index for that would force a mixed-direction sort MongoDB can't serve from one index.
**Alternatives considered:** A single index covering everything (filters + text + sort) — not possible,
since MongoDB text indexes can't be combined with other keys as compound sort indexes the way this needs.
Letting the filter compound index also serve pagination by appending `createdAt` to it — rejected because
filtered *and* unfiltered browse (no tags/location/status) both need fast pagination, and an index led by
`tags`/`location`/`status` doesn't help an unfiltered query at all.

## Application uniqueness — decided in Phase 1 by CC
**Decision:** Unique compound index on `Application` at `{listingId: 1, applicantId: 1}`.
**Why:** Enforces "one application per applicant per listing" at the database layer rather than only in
application code, so it holds even under concurrent requests (e.g. a double-submit from a slow network).
**Alternatives considered:** Checking for an existing application in the service layer before insert —
race-prone under concurrency without the DB-level constraint backing it up; kept as a defense-in-depth
check in Phase 4, not a replacement for the index.

## Refresh token implementation — decided in Phase 2 by CC
**Decision:** The refresh token delivered in the httpOnly cookie is itself a signed JWT (`sub: userId`,
long TTL from `REFRESH_TOKEN_TTL`, signed with a *separate* secret from the access token), and its bcrypt
hash is stored on `User.refreshTokenHash`. `/api/auth/refresh` verifies the JWT signature+expiry first
(cheap, no DB hit needed to identify the user), then bcrypt-compares the raw token against the stored hash
before issuing a new access token.
**Why:** This refines the Phase 0 "static, hashed, httpOnly-cookie" decision with a concrete mechanism.
A purely opaque random token can't self-identify its owner, which would force either scanning all users'
hashes (unworkable) or a second identifying cookie (more surface area). A signed JWT solves the lookup
problem for free via its `sub` claim, while the stored-hash comparison is what makes the token *revocable*
server-side — `/api/auth/logout` clears `refreshTokenHash`, so a stolen-but-unexpired refresh JWT is
rejected on its next use even though its signature still verifies.
**Alternatives considered:** Opaque random token + a separate non-httpOnly cookie just for the user id —
rejected, adds a second cookie and a second thing to keep in sync for no real benefit over embedding the
id in a signed token the client can't read anyway (httpOnly). Fully stateless refresh (JWT only, no DB
hash) — rejected because it removes the ability to revoke on logout before natural expiry, which was a
deliberate assumption in the Phase 0 decision.

## Frontend session restore (`GET /api/auth/me`) — decided in Phase 9 by CC
**Decision:** Added a small `GET /api/auth/me` endpoint (auth required, returns the public user shape)
so the frontend can restore full user info (name/email/role) after a silent refresh on page load.
`POST /api/auth/refresh` only ever returns a new access token by design (see the refresh-token decision
above), so on its own it can't repopulate the UI's "who is this user" state after a hard reload.
**Why:** The alternative — decoding the access token's JWT payload client-side to read `sub`/`role` — only
recovers `id` and `role`, not `name`/`email`, and blurs the line between "data the client is allowed to
read" and "data that happens to be readable because JWTs aren't encrypted." A dedicated `/me` endpoint
keeps that boundary explicit and gives the frontend exactly the same public user shape it already gets
from `/register` and `/login`, so `AuthContext` doesn't need two different user object shapes depending on
how the session was established.
**Alternatives considered:** JWT payload decoding on the client (rejected, per above). Embedding full user
info in the access token itself (rejected — bloats every request's Authorization header with data that's
only needed once per page load, and stale name/email in the token until it expires if the user edits their
profile later).

## Frontend auth-state architecture — decided in Phase 9 by CC
**Decision:** Access token lives only in a module-level JS variable inside `src/api/client.js` (not
`localStorage`/`sessionStorage`), attached to outgoing requests via an axios request interceptor. A
response interceptor catches a single `401`, attempts one silent `POST /auth/refresh` (cookie-based,
automatic), and retries the original request exactly once before giving up. `AuthContext` performs the
same refresh-then-`/me` sequence once on mount to restore a session across a hard page reload.
**Why:** Keeping the access token out of `localStorage` avoids XSS-exfiltration of it, matching the same
reasoning already applied to the refresh token in Phase 0/2 — an in-memory access token is lost on reload
by design, which is exactly why the refresh-cookie + `/me` round trip on mount exists. The one-shot retry
guard (`config._retried`) prevents an infinite refresh loop if the refresh endpoint itself ever returns
401 (e.g. a genuinely expired/revoked refresh token) or a legitimately-401 endpoint is called after a
successful refresh.
**Alternatives considered:** Access token in `localStorage` — simpler (survives reload without a refresh
round trip) but reintroduces the exact XSS risk the httpOnly refresh cookie was chosen to avoid; rejected
for consistency with the Phase 0 decision. A global "is refreshing" flag instead of a shared promise —
would have caused duplicate concurrent refresh calls if multiple requests 401 at once right after token
expiry; the shared `refreshPromise` collapses them into one.

## Browse page pagination UI — decided in Phase 10 by CC
**Decision:** The browse page uses a single "Load more" button that appends results, not numbered page
links / a page-jump control.
**Why:** This is a direct UI consequence of the Phase 0 cursor-pagination decision, worth being able to
connect explicitly in an interview: a cursor only knows how to say "give me the page after *this specific
item*," it has no concept of "give me page 7." A numbered-pages UI would require the client to either fake
it (request page 1..N sequentially to reach page 7, defeating the point of avoiding `skip()`) or the API
to expose a second, offset-based mode just for the UI — both wrong. "Load more" is the pagination UI that
a cursor actually supports honestly.
**Alternatives considered:** Numbered pages — rejected for the reason above. Infinite scroll (auto-load on
scroll-to-bottom) — same underlying data-fetching as "Load more," just a different trigger; kept it as an
explicit button for this pass since it's simpler to reason about and test, infinite scroll would be a
small follow-up change to the trigger only, not the pagination logic.

## Poster-only "my listings" endpoint — decided in Phase 11 by CC
**Decision:** Added `GET /api/listings/mine` (poster-only), returning *all* of the requesting poster's own
listings regardless of status, with no pagination. Kept separate from `GET /api/listings` rather than
extending that endpoint's query params.
**Why:** The public browse endpoint defaults `status` to `"open"` deliberately (Phase 5) — anonymous
browsing shouldn't surface closed listings. A poster managing their own listings needs the opposite
default: see everything, including closed ones, scoped to just themselves. Overloading the public
endpoint with a "show me all statuses for this poster" mode would mean either a second, differently-scoped
meaning for the existing `status` param, or a new `posterId` param that only makes sense when it equals
`req.user.id` — both muddy what's supposed to be a simple public read endpoint. A dedicated route keeps
the public endpoint's contract (and the reasoning behind its default) unchanged. No pagination on `/mine`
because it's bounded to one poster's own listings, not the open-ended public catalog Phase 5's cursor
pagination exists for.
**Alternatives considered:** `GET /api/listings?posterId=me&status=all` — rejected per above (conflates
two different endpoints' concerns). Client-side filtering of the full public listing set down to the
poster's own — rejected, wasteful (fetches every other poster's open listings just to discard them) and
still wouldn't surface the poster's *closed* listings, which the public endpoint never returns at all.

## Frontend duplication of the status-transition graph — decided in Phase 11 by CC
**Decision:** `frontend/src/utils/statusMachine.js` contains a second copy of the transition graph from
`backend/src/utils/statusMachine.js`, used only to decide which "move to X" buttons the pipeline board
shows for a given application. The backend remains the sole enforcer — every transition still round-trips
through `PUT /applications/:id/status`, which validates independently.
**Why:** Without this, the UI would either have to show every status as a candidate button and let the
server reject illegal ones (bad UX — buttons that are always wrong to click), or fetch "what's legal from
here" from the server before rendering each card (an extra round trip per applicant card, for a graph
that's static and small). Duplicating a 5-line, rarely-changing lookup table client-side is a reasonable
trade given the alternative costs; the risk (drift between the two copies) is called out explicitly in
both files' comments so it isn't a silent trap.
**Alternatives considered:** An API endpoint like `GET /applications/:id/legal-transitions` — more
"correct" in the sense of a single source of truth, but adds a new endpoint and a request per card for a
value that's a pure function of a 5-status enum; rejected as disproportionate. Exposing the backend's
transition table via a shared package/module between frontend and backend — would solve the duplication
cleanly in a monorepo with a shared package, but this project's frontend/backend aren't set up as
workspaces with shared internal packages, so it would be a bigger structural change than this decision
warrants for a 5-entry table.

## Applicant-only "my applications" endpoint — decided in Phase 12 by CC
**Decision:** Added `GET /api/applications/mine` (applicant-only), returning all of the requesting
applicant's own applications across every listing they've applied to, with `listingId` populated
(title/location/status) and no pagination.
**Why:** Same shape of gap as Phase 11's `/listings/mine`: the existing application-listing endpoints are
either poster-scoped to one listing (`GET /applications/listing/:listingId`) or need the application id
already known (`GET /applications/:applicationId`) — nothing let an applicant ask "show me everything I've
applied to." A dedicated route keeps the applicant's own-data query separate from the poster-facing
per-listing one rather than overloading either. No pagination for the same reason as `/listings/mine`: an
individual applicant's own application count is small and bounded, this isn't the kind of open-ended
catalog Phase 5's cursor pagination exists for.
**Alternatives considered:** Client-side aggregation from per-listing calls — would require the applicant
to already know every listing id they'd applied to (they don't, that's the whole problem), so not
actually viable, not just suboptimal.

## Resume upload storage abstraction — decided in Phase 13 by CC
**Decision:** `multer.memoryStorage()` (not `diskStorage`) parses the multipart upload into a buffer;
a separate `storage.service.js` with one function — `saveFile(file) -> url` — is what actually writes the
buffer to disk (`backend/uploads/`, gitignored) and returns a URL. The upload route/controller only ever
calls `saveFile`; they don't know or care that today's implementation happens to be local disk.
**Why:** This directly satisfies the original spec's requirement to "structure it so swapping to S3 later
is trivial" — a future S3 version replaces `saveFile`'s body (buffer → `PutObjectCommand`, return the S3
URL) with the exact same function signature, and nothing in `upload.middleware.js`, `upload.controller.js`,
or `upload.routes.js` changes. Using `memoryStorage` instead of `diskStorage` in multer itself is what
makes this possible — `diskStorage` would bake "write straight to a local path" into the multer config
itself, coupling the multipart-parsing step to the persistence decision instead of keeping them separate.
**Alternatives considered:** `multer.diskStorage()` writing directly to `uploads/` — simpler (one less
module) but couples multipart parsing to local-disk persistence, so an S3 swap would mean reconfiguring
multer itself rather than swapping one small module; rejected given the spec explicitly asked for
S3-swap-friendliness. Storing the file as a Buffer directly in MongoDB (e.g. on the `Application` document)
— rejected, bloats the database with binary blobs and defeats the point of a URL-based `resumeUrl` field
that's already in the Phase 1 schema.

**Update (deploy prep):** the swap actually happened — `saveFile()` now calls **Vercel Blob** (`@vercel/
blob`'s `put()`) when `BLOB_READ_WRITE_TOKEN` is set, falling back to the original local-disk code
otherwise, so local dev/tests are unaffected. This is exactly the "change one function's body, nothing
else moves" swap the abstraction was designed for — confirmed by how small the diff actually was. See
`DEPLOYMENT.md` for the deploy checklist this unblocks.

## Switching listing search/filters from exact/`$text` matching to substring regex — revised post-launch by CC
**Decision:** `GET /api/listings`'s `search`, `tags`, and `location` params now all match as
case-insensitive **substrings** using escaped regexes (`new RegExp(escapeRegExp(input), "i")`), replacing
the original Phase 5 design where `search` used MongoDB's `$text` index and `tags`/`location` were exact
matches (`$in`/equality).
**Why:** User testing surfaced that typing a prefix like "ma" into any of the three filter fields returned
nothing — you had to type the whole word ("machine") for a hit. That's actually correct behavior for
`$text` (it indexes and matches whole tokens, with stemming, not substrings) and for `$in`/equality (exact
value match only) — but it's not what a live search-as-you-type box is expected to do, and it's a genuine
UX bug for this app's actual usage. Regex substring matching fixes all three fields with the same
technique. User input is escaped (`escapeRegExp`) before being embedded in a `RegExp` so that metacharacters
in a search term (e.g. `.`, `(`, `[`) can't throw a `SyntaxError` or match more broadly than intended.
**Tradeoff, stated plainly for interview purposes:** this is a conscious step *away* from what the index
design actually optimizes for. The Phase 1 text index (`listing_text_search`) is no longer queried at all
by this code path — an unanchored regex like `/ma/i` cannot use a text index (or a regular one) the way an
anchored prefix or exact match could, so this query now falls back to a collection scan on `title`/
`description` for the search field, and doesn't get index support on `tags`/`location` either once those
became regexes instead of exact/`$in` matches. For this app's scale (a portfolio project's dataset), that's
an acceptable tradeoff for correct UX. At real scale, the honest fix is a dedicated search solution (MongoDB
Atlas Search, Elasticsearch, or a n-gram/prefix index) rather than regex scans — worth being able to say
outright in an interview rather than presenting the regex approach as the "correct" scalable answer.
**Alternatives considered:** Anchored prefix regex (`^ma`) instead of unanchored substring — *would* be
able to use a regular (non-text) index if one existed on `title`, but doesn't match "machine" if the user
types a substring that isn't a prefix (e.g. "chine"), which is a real expectation for a search box; rejected
for not fully fixing the reported bug. Keeping `$text` for `search` and adding regex only for `tags`/
`location` — rejected for inconsistency: the bug report was "all 3 search bars," and users don't
distinguish "the text-indexed field" from "the exact-match fields" — they just expect typing a substring
to work everywhere it looks like a text input.

## Serverless entrypoint location + missing root package.json — real bug found during first deploy attempt
**What happened:** The first version of `DEPLOYMENT.md` (written before ever actually deploying) told the
reader to put the Vercel serverless entrypoint at `backend/api/index.js`. On the first real deploy
attempt, Vercel's build failed: *"The pattern `backend/api/index.js` defined in `functions` doesn't match
any Serverless Functions inside the `api` directory."* Root cause: Vercel only auto-discovers Serverless
Functions in a literal top-level `api/` directory relative to the project's Root Directory — a nested path
is invisible to that discovery step no matter how it's referenced in `vercel.json`'s `functions` key. The
entrypoint was moved to `api/index.js` at the repo root to fix this — which immediately surfaced a second,
related bug: nothing at the repo root had ever needed a `package.json` before, so there was none, and
`api/index.js`'s ESM `import`/`export` syntax got parsed as CommonJS and failed to load. Since every API
route goes through this one function, that failure took down every route identically (`/api/auth/register`,
`/api/auth/refresh`, `/api/listings`, all failing the same way — which is itself a useful diagnostic
signal: identical failures across otherwise-unrelated routes point at the shared entrypoint, not
route-specific logic).
**Fix:** `api/index.js` lives at the repo root (not `backend/`) and directly imports `createApp`/
`connectDB` from `../backend/src/...`; a minimal root `package.json` (`{ "type": "module" }`) was added
alongside it. An earlier intermediate fix (from a different agent, Antigravity) worked around the first
bug by moving a *stub* to `api/index.js` at the root that re-exported from `backend/api/index.js` — this
satisfied Vercel's discovery step but still needed the root `package.json` fix, and left a redundant
two-file indirection; consolidated to one file to remove that indirection.
**Why this is worth keeping in the record:** it's a real example of "deploy target conventions you can't
know until you try deploying" — the local dev/test setup (Jest + Supertest hitting `createApp()` directly,
`node --watch src/index.js` for local `npm run dev`) never exercises the serverless entrypoint at all, so
none of this could have been caught by the test suite. It was only caught by actually deploying and reading
the real error message — a good concrete answer if asked "what broke in production that tests didn't
catch, and why."

## Third resume-storage backend: Google Cloud Storage, checked ahead of Vercel Blob
**Decision:** `saveFile()` now tries three backends in order: **GCS** (`GCS_BUCKET` set), **Vercel Blob**
(`BLOB_READ_WRITE_TOKEN` set), then local disk (neither set — dev/tests). GCS is checked first, so it wins
if both happen to be configured.
**Why:** The user wants the deployed resume storage to actually be on GCP — partly a real preference,
partly because working GCP integration is a more relevant signal than Vercel Blob for the kinds of roles
this project is on the resume for. The three-backend branch is exactly the shape the original storage
abstraction (Phase 13, see above) was built to support cheaply: adding a backend means adding one more
`if` branch and a private helper function, nothing in the upload route/controller/validation changes.
GCS is checked *before* Blob (not the other way around) since it's the intended primary target — Blob
remains as a fallback for a pure-Vercel deploy with no GCP project attached, not because it's second-choice
in general.
**Two implementation details worth calling out, since the initial task sketch didn't get them right without
checking the real API surface first** (as instructed — "treat this as a starting sketch, not final code"):
- **No `.makePublic()` call.** The sketch used the legacy per-object ACL API. Modern GCS buckets default
  to **Uniform Bucket-Level Access**, which disables per-object ACLs entirely — calling `.makePublic()` on
  such a bucket throws. Public read is granted once, at the bucket level, via IAM (`allUsers` →
  `Storage Object Viewer`) instead — a one-time console step (documented in `DEPLOYMENT.md`), not
  something the app does per upload. This also matches how Vercel Blob's `access: "public"` already
  behaves elsewhere in this same function, so the two backends have consistent semantics.
- **Credentials as a JSON env var, not a file path.** `GOOGLE_APPLICATION_CREDENTIALS` (the client
  library's usual auto-detected env var) is a *file path* — fine for local dev or a GCP-hosted runtime,
  but Vercel's serverless functions have nowhere durable to put a service-account key file. Added
  `GOOGLE_APPLICATION_CREDENTIALS_JSON` (the key file's contents, pasted as one env var) as an
  alternative that takes precedence when set, constructing the `Storage` client with `{ credentials:
  JSON.parse(...) }` directly instead of relying on file-path lookup. `GOOGLE_APPLICATION_CREDENTIALS`
  still works unchanged for local dev.
**Verification:** unit-tested with the `Storage` client mocked (`jest.unstable_mockModule`, since the
import is a dynamic `await import()` inside the function, not a static one) — covers backend selection
priority (GCS over Blob when both configured), credential-passing logic (both branches), and per-upload
filename uniqueness. **Not verified against a real GCS bucket** — no live GCP project/bucket was available
in this environment. That distinction matters: this is "implemented and unit-tested," not "integrated and
tested against a live bucket," until someone actually runs it against real GCS credentials per the
`DEPLOYMENT.md` checklist.
**Alternatives considered:** Signed URLs instead of a public bucket — more secure (time-limited access
instead of permanent public read), but adds real complexity (URL expiry means a resume link that worked
yesterday can 403 today, needs a regeneration strategy) for a portfolio-scale app where resumes aren't
sensitive enough to justify it; rejected as disproportionate, consistent with the Vercel Blob branch's own
`access: "public"` choice already made in Phase 13.

## Stress-test-driven hardening — Phase 0: seed script, load harness, committed baseline
**Decision:** Before touching any code, seed the database at realistic scale (100k listings / 800k
applications, `backend/scripts/seed-load.js`) and record load-test results as a committed baseline
(`BENCHMARKS.md`) — a reproducible command, raw output, and honest caveats — before writing a single
fix. Every later fix in this round must show a before/after pair against the same seed and command.
**Why:** an "improvement" claimed without a recorded starting point is unverifiable, and retroactively
guessing a baseline after the fix already landed is common and dishonest. This also surfaced that the
project's real problems were latent — nothing in the app is contended or slow at the ~30-listing scale it
had before, so none of what follows could have been found without deliberately generating scale and
concurrency first.
**What the baseline run actually found (all in `BENCHMARKS.md`, verified live against a running server):**
- The duplicate-apply race (`application.service.js:6-21`) returns **HTTP 500 with the raw MongoDB driver
  error leaked in the response body** for 4 of 10 concurrent identical requests — the unique index
  correctly blocks the duplicate, but nothing maps `E11000` to a clean 409.
- The status-transition race (`application.service.js:40-65`) is a genuine data-integrity bug, not just a
  timing curiosity: two concurrent, individually-legal transitions (`applied→shortlisted`,
  `applied→rejected`) both return 200, and the final state ends up `shortlisted` — silently bypassing
  `rejected`'s terminal-state guarantee in `statusMachine.js`.
- Listing search's cost is **data-dependent**, which is a more precise and more useful finding than a
  blanket "full collection scan" claim: because the sort is served by an existing index, a *common* search
  term (`"ma"`, matching ~1/3 of the seeded corpus) terminates early and looks fast (25ms); a *rare* term
  (matching 1 of 100,000 docs — the realistic case, since real searches target a specific skill/role) pays
  the full cost of walking the entire collection (434ms, 100,000 docs examined). The naive framing
  ("always COLLSCAN") would have been wrong; measuring instead of guessing caught that.
**Tooling notes worth keeping:** `autocannon` chosen as an npm devDependency over k6/wrk/ab — none were
preinstalled, and autocannon needs no system install, which also means it can run in CI later without
extra setup. It's the wrong tool for concurrency *correctness* though — throughput/percentiles only; the
race demonstrations above used plain `Promise.all` against the live API, which is what Phase 2's
regression tests will formalize. Also: running the persistent load-test MongoDB instance *alongside* the
Jest suite (which spins its own ephemeral `mongodb-memory-server` per test file) caused severe resource
contention — 69 spurious test failures and a 322s run instead of the normal ~15s. Not a real regression;
stopping the load-test Mongo before running `npm test` restored a clean 116/116. Documented here so it
doesn't get mistaken for an actual break later.
**Alternatives considered:** Seeding through the HTTP API instead of direct Mongoose bulk inserts —
rejected, since 800k applications through the real endpoints would take hours and would also hit the
per-user apply rate limiter, which is itself correct behavior, not a seeding obstacle to route around.

## Stress-test-driven hardening — Phase 1: limited openings per listing
**Decision:** Added `openings` (default `null` = unlimited) and `filledCount` (default `0`) to `Listing`.
`apply()` claims a slot with a single atomic guarded update rather than a read-then-write, and auto-closes
the listing in the same operation once the last slot fills.
**Why:** the app previously had no scarce resource, so no two writers could ever genuinely contend over
the same document — which is exactly why the concurrency bugs in Phase 0's baseline had never been
noticed. `openings` is also a legitimate ATS feature on its own (cap applicants per role), not manufactured
purely to create a race.
**Two things the implementation gets right that a naive version wouldn't, both verified before writing
the real code:**
- **`filledCount: { $lt: "$openings" }` in a plain filter silently matches nothing.** MongoDB treats
  `"$openings"` there as a literal string, not a field reference — the query would just never match, and
  the feature would look broken (every apply rejected) with no error to explain why. The fix is `$expr:
  { $lt: ["$filledCount", "$openings"] }`. Confirmed by direct experiment before landing this in
  `application.service.js`.
- **`openings` defaults to `null`, not `1`.** Defaulting to 1 would make the *second* applicant to every
  existing listing get rejected, breaking a large share of the already-passing test suite in confusing,
  hard-to-trace ways. The slot guard in `apply()` only activates when `listing.openings != null`, so every
  listing created before this feature (and every listing created without setting it) keeps working exactly
  as it did.
- **Claim and auto-close happen in one atomic operation** (an aggregation-pipeline `findOneAndUpdate`, not
  two separate writes), so there's no window where the last slot is claimed but the listing still reports
  `open`. Verified the pipeline-update syntax directly (`$set` with `$cond`) before relying on it — no
  transaction needed since it's a single document.
**Compensation, not a transaction:** if the slot claim succeeds but the application ultimately isn't
created (the applicant already applied — either found via a pre-check, or via the unique-index race
described in Phase 2 below), the claimed slot is released with a plain `$inc: { filledCount: -1 }`.
Deliberately does **not** auto-reopen a listing that got auto-closed by the claim — reopening would be
ambiguous against a poster manually closing the listing at the same moment, and the specific edge case that
would free a slot this way (a duplicate-key collision on the very last slot) is rare enough that requiring
a manual reopen is an acceptable, explicit tradeoff rather than added complexity to resolve an edge case.
**Known, accepted limitation:** no transaction guards the claim against a process crash between the slot
claim and the application write — a crash in that exact window leaks one slot permanently. Fixing this
properly needs either a replica-set transaction (the test environment runs standalone Mongo, so this would
also require switching `mongodb-memory-server` to `MongoMemoryReplSet`) or a reconciliation job — both are
disproportionate to this project's scale and traffic. Documented as a real, known gap rather than solved.
**Verification:** `tests/routes/application.openings.test.js` — single-request behavior (accept under cap,
auto-close on last slot, clean 409 when full, no regression when unlimited, reject applying to a closed
listing, reject lowering `openings` below `filledCount`) plus the actual point of the feature: 30 concurrent
distinct applicants against a 10-opening listing — verified **exactly 10 accepted, 20 clean 409s,
`filledCount` ends at exactly 10, and `Application.countDocuments` confirms no over-allocation and no
phantom documents.**
**Alternatives considered:** insert-then-increment (create the `Application` first, then try to claim a
slot, rolling back the application if the claim fails) — rejected because it does the expensive/side-effecting
write first and the cheap check second, backwards from claim-then-insert; it also means a failed claim
has to delete a document that was already visible to any concurrent read in between, a worse failure
window than releasing a plain counter.
