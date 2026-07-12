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
