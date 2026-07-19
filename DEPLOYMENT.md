# Deployment Guide — Vercel + MongoDB Atlas

This app was originally built and tested as a long-lived Express process talking to a local MongoDB.
Deploying to Vercel (serverless) + Atlas (managed Mongo) needed two real code changes first — both are
now done (see "Code changes already made" below) — plus config/environment setup, which is what this
checklist walks through. This deploy is scoped for a low-traffic, resume/portfolio site, not a
production service under real load — a couple of items below are called out as intentionally skipped for
that reason.

## Pick your architecture first

**Option A — one Vercel project, frontend + backend together (recommended)**
Frontend (static Vite build) and backend (Express wrapped as a serverless function) live in the *same*
Vercel project and the *same* domain, with `vercel.json` rewriting `/api/*` to the backend function.
Same-origin means: no CORS to configure, the frontend's existing `baseURL: "/api"` in
`src/api/client.js` needs **no code change**, and the refresh cookie's `sameSite: "strict"` keeps working
exactly as it does today. This is the path this guide assumes unless noted otherwise.

**Option B — two separate Vercel projects** (frontend on one domain, backend on another)
More moving parts: you must set a real CORS origin, switch the frontend's API base URL to an absolute
URL, and change the refresh cookie's `sameSite` from `"strict"` to `"none"` (which also forces
`secure: true`, i.e. HTTPS-only — fine on Vercel, just noting it's a real behavior change). Only choose
this if you have a specific reason to. Callouts below are marked **[Option B only]** where they apply.

---

## Code changes already made (nothing left to do here)

- **Resume upload storage** (`backend/src/services/storage.service.js`): `saveFile()` tries, in order,
  **Google Cloud Storage** (`GCS_BUCKET` set — the primary target), then **Vercel Blob**
  (`BLOB_READ_WRITE_TOKEN` set — fallback for a pure-Vercel deploy with no GCP project), then local disk
  (dev/tests, nothing configured). This was required regardless of which cloud backend you pick: Vercel's
  serverless filesystem is read-only/ephemeral outside `/tmp`, so the old local-disk-only version would
  have made every uploaded resume vanish and its link 404. `upload.controller.js` was updated to `await`
  the now-async `saveFile()`.
- **Serverless entrypoint** (`api/index.js` at the **repo root** — not `backend/api/`, see the callout
  below): wraps the Express app as a `(req, res)` handler and connects to MongoDB once when the module
  loads (reused across warm invocations on the same instance — not reconnecting per request, but no
  further caching machinery beyond that, since this app's traffic doesn't warrant it).
- **Root `package.json`** (`{ "type": "module" }`): required alongside the entrypoint above — without it,
  `api/index.js`'s ESM `import`/`export` syntax gets parsed as CommonJS and fails to load, which breaks
  *every* route identically (they all go through this one function). This bit us for real on the first
  deploy attempt — see the callout below.

> **Real gotcha hit during the first deploy attempt, worth understanding:** Vercel only auto-discovers
> Serverless Functions in a literal top-level `api/` directory, relative to the project's Root Directory
> — a path like `backend/api/index.js` is invisible to that discovery step even when explicitly named in
> `vercel.json`'s `functions` key. The first version of this guide got that wrong (told you to put the
> entrypoint at `backend/api/index.js`), which produced exactly this build error: *"The pattern
> `backend/api/index.js` defined in `functions` doesn't match any Serverless Functions inside the `api`
> directory."* The fix was moving the entrypoint to `api/index.js` at the repo root — which then hit the
> second issue above (no root `package.json` to declare ESM) since nothing at the root had ever needed
> one before. Both are fixed now; this note is here so future-you (or an interview question about
> debugging a real deploy) has the actual story, not a sanitized one.
- **Skipped on purpose:** further Mongo connection-pool tuning/caching beyond the above. This site will
  see very little traffic — there's no cold-start storm to defend against here. If that ever changes,
  it's a small addition to `backend/src/config/db.js`, not a redesign.
- **Skipped on purpose:** fixing the in-memory rate limiter's per-instance-not-global behavior under
  serverless scaling (see `agent-comms/DECISIONS.md`). At this traffic level it's a non-issue — the limiter
  still does its job of stopping accidental double-submits/scripted abuse from a single visitor, which is
  all it needs to do here.

## Checklist

### 1. MongoDB Atlas
- [ ] Create a free (M0) cluster.
- [ ] Create a database user (Atlas → Database Access) with a strong, generated password — not one you
      reuse elsewhere.
- [ ] Network access: add `0.0.0.0/0` (allow from anywhere). Vercel serverless functions don't have
      static outbound IPs on the free/hobby tier, so you can't IP-allowlist Vercel specifically — Atlas's
      own auth (username/password + TLS) is your actual security boundary here, not IP allowlisting.
- [ ] Grab the connection string (Atlas → Connect → Drivers → Node.js). It looks like
      `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/jobboard?retryWrites=true&w=majority`.
      Make sure the database name (`jobboard`, or whatever you pick) is in the path — Atlas's copy-paste
      string sometimes omits it.

### 2. GitHub
- [ ] Push this repo to a GitHub repo (if it isn't already) — Vercel's normal flow is "import from
      GitHub," which also gives you automatic preview deployments on every PR and a production deploy on
      every push to `main`, with no extra CLI steps needed.

### 3. Resume upload storage — pick Google Cloud Storage (primary) or Vercel Blob (fallback)

**Google Cloud Storage** (checked first in code — use this if you have/want a GCP project):
- [ ] Create or pick a GCP project. Enable the **Cloud Storage API** for it (APIs & Services → Library).
- [ ] Create a bucket (Cloud Storage → Buckets → Create). Leave **Uniform bucket-level access** ON — it's
      the default for new buckets, and the code deliberately targets it (no legacy per-object ACL calls).
- [ ] Grant public read at the **bucket** level, not per-object: bucket → Permissions → Grant Access →
      principal `allUsers`, role `Storage Object Viewer`. This is what makes uploaded resume URLs
      (`https://storage.googleapis.com/<bucket>/<file>`) actually loadable — same effect as Vercel Blob's
      `access: "public"`, just done once at the bucket instead of per-upload.
- [ ] Create a service account (IAM & Admin → Service Accounts → Create) with **Storage Object Admin** on
      that bucket (or project-wide if simpler for a single-bucket setup). Create a JSON key for it and
      download it — **never commit this file to git**.
- [ ] You now have everything for `GCS_BUCKET` and the credentials env var below. **Important:** don't use
      `GOOGLE_APPLICATION_CREDENTIALS` (a file path) on Vercel — serverless functions have nowhere durable
      to put that key file. Open the downloaded JSON key file, copy its *entire contents*, and paste them
      as the single-line value of `GOOGLE_APPLICATION_CREDENTIALS_JSON` instead (the code checks for this
      variable first and constructs the client from it directly). `GOOGLE_APPLICATION_CREDENTIALS` (file
      path) still works for local dev if you'd rather point at the key file on disk than paste its
      contents into `.env`.

**Vercel Blob** (only needed if you're *not* using GCS — skip if you set up GCS above):
- [ ] In your Vercel project (create it in step 5 first if you haven't) → Storage → create a **Blob**
      store. Vercel gives you a `BLOB_READ_WRITE_TOKEN` — copy it for step 4.

### 3b. Upstash Redis (distributed rate limiting + listing cache) — optional but recommended
- [ ] Create a free database at [upstash.com](https://upstash.com) (Redis → Create Database — the
      free tier is enough for this project's traffic).
- [ ] Open the database → REST API section → copy the `UPSTASH_REDIS_REST_URL` and
      `UPSTASH_REDIS_REST_TOKEN` values for step 4. Upstash's REST API (not a raw Redis connection) is
      what makes this work on Vercel serverless — no persistent connection to manage per function
      instance.
- [ ] If skipped: the app falls back to the original in-memory rate limiter automatically (works, just
      doesn't coordinate across multiple serverless instances) and simply doesn't cache listings — no
      code change needed either way, this is purely an env-var toggle.

### 4. Environment variables
Set these in Vercel (Project Settings → Environment Variables), for both Production and Preview:
- [ ] `MONGO_URI` — the Atlas connection string from step 1.
- [ ] `JWT_ACCESS_SECRET` — **generate a real one**, don't reuse the `change-me` placeholder from
      `.env.example`: `openssl rand -base64 48`.
- [ ] `JWT_REFRESH_SECRET` — same, a **different** random value from the access secret.
- [ ] `ACCESS_TOKEN_TTL` — `15m` (or your preference).
- [ ] `REFRESH_TOKEN_TTL` — `30d` (or your preference).
- [ ] **If using GCS:** `GCS_BUCKET` (the bucket name) and `GOOGLE_APPLICATION_CREDENTIALS_JSON` (the
      service-account key file's full contents, pasted as one line) — from step 3.
- [ ] **If using Vercel Blob instead:** `BLOB_READ_WRITE_TOKEN` — from step 3.
- [ ] **If using Upstash (recommended):** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — from
      step 3b.
- [ ] `CORS_ORIGIN` — **[Option B only]**: your frontend's deployed URL (e.g.
      `https://your-app.vercel.app`). **[Option A]**: irrelevant, same-origin means CORS isn't in play.
- [ ] `NODE_ENV=production` — Vercel sets this automatically; this is what flips the refresh cookie's
      `secure: true`, no action needed, just noting why it matters.

### 5. Vercel project setup
**[Option A — one project]** — already set up this way in the repo, nothing left to do here except set
env vars:
- [x] Root `package.json` (`{ "type": "module" }`) — required so `api/index.js`'s ESM syntax parses
      correctly. Already added.
- [x] `api/index.js` at the repo root — the actual serverless entrypoint. Must stay at the repo root,
      not under `backend/` (see the callout above for why).
- [x] `vercel.json` at the repo root:
      ```json
      {
        "buildCommand": "cd frontend && npm install && npm run build && cd ../backend && npm install",
        "outputDirectory": "frontend/dist",
        "functions": { "api/index.js": { "includeFiles": "backend/src/**" } },
        "rewrites": [
          { "source": "/api/(.*)", "destination": "/api/index.js" },
          { "source": "/uploads/(.*)", "destination": "/api/index.js" }
        ]
      }
      ```
      (The `/uploads` rewrite is a harmless no-op once `BLOB_READ_WRITE_TOKEN` is set — Blob returns
      absolute URLs, not `/uploads/...` paths, so that route just never gets hit in production. Keeping it
      costs nothing and preserves local-dev behavior. The `buildCommand` also runs `npm install` inside
      `backend/` so its dependencies — express, mongoose, etc. — are on disk when Vercel traces
      `api/index.js`'s imports.)
- [ ] Import the GitHub repo into Vercel, with Root Directory left as the repo root (not `frontend/`),
      since the build needs to see both `frontend/` and `api/`.
- [ ] Set all env vars from step 4 on this one project.

**[Option B — two projects]**
- [ ] Frontend project: root directory `frontend/`, standard Vite build. Set
      `VITE_API_URL=https://your-backend.vercel.app` as an env var, and change
      `frontend/src/api/client.js`'s `baseURL: "/api"` to `` baseURL: `${import.meta.env.VITE_API_URL}/api` ``
      **(code change — not done, only needed if you pick Option B)**.
- [ ] Backend project: root directory `backend/`, needs its own minimal `vercel.json` pointing at
      `api/index.js` as the function.
- [ ] Change `backend/src/controllers/auth.controller.js`'s `refreshCookieOptions.sameSite` from
      `"strict"` to `"none"` **(code change — not done, only needed if you pick Option B)** — required for
      the cookie to be sent on cross-origin requests between the two domains. `secure` is already
      conditional on `NODE_ENV`, so it correctly becomes `true` in production (required alongside
      `sameSite: "none"` — browsers reject `SameSite=None` cookies without `Secure`).
- [ ] Set `CORS_ORIGIN` on the backend project to the frontend's exact deployed URL.

### 6. Deploy
- [ ] Vercel deploys automatically on push once the GitHub repo is connected — push to `main` (or
      whichever branch you configured as production) and watch the deployment in the Vercel dashboard.
- [ ] Watch the build logs for the frontend build and the function build separately — a failure in one
      doesn't always surface clearly in the other's log.

### 7. Post-deploy smoke test (do this for real, don't assume)
- [ ] Visit the deployed frontend URL — browse page loads, listings (if any — fresh Atlas DB starts
      empty) render without console errors.
- [ ] Register a poster account. Confirm the response sets a cookie (check DevTools → Application →
      Cookies) and an access token comes back.
- [ ] Hard-refresh the page while logged in — confirm the session survives (exercises the
      `/auth/refresh` → `/auth/me` flow against the *real* deployed cookie).
- [ ] Create a listing, log in as an applicant, apply with a real PDF — confirm the upload succeeds and
      the returned resume URL is actually fetchable. This is the step that would have silently failed
      without the Blob storage change — worth checking explicitly rather than assuming.
- [ ] Move an application through the pipeline as the poster.
- [ ] Check Vercel's function logs (Project → Deployments → your deployment → Functions) for any
      unhandled errors during the above.

### 8. If something's broken
- [ ] 500s on every request, immediately: almost always `MONGO_URI` wrong/missing, or Atlas network
      access not actually saved.
- [ ] Login works but refresh/reload logs you out: cookie isn't being set or read — check `sameSite`/
      `secure` match your architecture choice (A vs B) and that you're testing over HTTPS (Vercel always
      serves HTTPS).
- [ ] Uploads "succeed" but the resume link 404s later: whichever storage env vars you're using
      (`GCS_BUCKET`+`GOOGLE_APPLICATION_CREDENTIALS_JSON`, or `BLOB_READ_WRITE_TOKEN`) aren't set in
      Vercel, or weren't set at the time of that deployment (redeploy after adding them).
- [ ] Uploads fail with a permissions/403-style error from GCS specifically: almost always the bucket-level
      `allUsers` → `Storage Object Viewer` IAM grant from step 3 wasn't actually saved, or the service
      account is missing `Storage Object Admin` on the bucket.
- [ ] Everything works locally in preview but not production (or vice versa): double check env vars are
      set for *both* Preview and Production in Vercel's dashboard — they're separate.

---

## Running locally with Docker instead (optional — not how this deploys to production)

A `docker-compose.yml` at the repo root brings up the backend + a real MongoDB with one command,
for anyone who'd rather not install MongoDB locally. This is a **local-dev convenience**, not the
production deploy path — production is Vercel (serverless) + Atlas, per everything above.

```bash
docker compose up --build
# backend on http://localhost:4000, GET /health should return {"status":"ok"}
```

- ⚠️ **Written but not run in the environment that authored it** (no Docker available there). It was
  checked as thoroughly as possible without Docker itself — the exact `npm ci --omit=dev` install and
  the exact env vars `docker-compose.yml` sets were run directly (outside a container) against a real
  MongoDB and confirmed working, including that production-mode JSON logging is active and
  `/health`/`/ready` both respond correctly. But `docker build`/`docker compose up` themselves were
  never executed — please verify once before relying on it.
- Resume storage, Redis, and real JWT secrets are all deliberately **not** set in `docker-compose.yml` —
  the stack runs standalone with zero external accounts needed. Uploads fall back to local disk *inside
  the container* (ephemeral — fine for trying the app locally, not for anything you want to persist).
- The `Dockerfile` copies `package*.json` and `src/` explicitly, never `COPY . .` — the repo root has a
  real GCP service-account key file sitting next to `backend/`, and a blanket copy from a wider build
  context would bake it into an image layer. See the comments in `backend/Dockerfile` and
  `backend/.dockerignore` for the full reasoning.

## What's genuinely optional
- Frontend tests still don't exist (noted in `README.md`) — not a deployment blocker.
- An async job queue/outbox and a Postgres analytics read-model were considered and deliberately not
  built — see [`FUTURE_WORK.md`](FUTURE_WORK.md) for why.
