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
