# Claude Code Prompt — Job/Task Board with Application Pipeline

I want to build a full-stack **Job/Task Board with an Application Pipeline** (like a mini-ATS) using the **MERN stack** (MongoDB, Express, React, Node.js). This is a resume/portfolio project meant to demonstrate strong REST API design, MongoDB schema design, and clean React frontend architecture. Please build it iteratively with me — plan first, confirm the plan, then implement in stages.

## Core concept
Two user roles:
- **Posters** create job/task listings.
- **Applicants** browse listings and apply.
- Posters move applicants through a pipeline: `applied → shortlisted → interview → offer → rejected`.

## Tech stack
- **Backend:** Node.js + Express, MongoDB with Mongoose
- **Frontend:** React (Vite), React Router, plain fetch/axios for API calls, Tailwind for styling
- **Auth:** JWT-based auth with role-based access control (poster vs applicant), bcrypt for password hashing
- **File upload:** multer for resume/PDF uploads, stored locally for now (structure it so swapping to S3 later is trivial)

## Data model (please refine, but roughly)
- **User**: name, email, passwordHash, role (`poster` | `applicant`), createdAt
- **Listing**: title, description, tags[], location, posterId (ref User), status (`open` | `closed`), createdAt
- **Application**: listingId (ref Listing), applicantId (ref User), resumeUrl, coverNote, status (enum above), statusHistory[] (status + timestamp, for audit trail), createdAt

## REST API requirements
Design a clean, RESTful API — no fat controllers, proper separation of routes/controllers/services/models. Include:
- Auth: register, login, refresh token
- Listings: CRUD (poster-only for create/update/delete), public GET with **filtering by tags/location** and **pagination** (query params, not just skip/limit — use cursor or page-based, whichever you recommend and can justify)
- Applications: apply to a listing (applicant), list applicants for a listing (poster-only), **update application status** (poster-only, with validation that only legal status transitions are allowed — no jumping from `applied` straight to `offer`)
- Search: text search on listing title/description using a **MongoDB text index** — I want to be able to explain how this works in an interview
- Add a Mongo **compound index** on the fields used for filtering (tags + location + status) and be ready to explain the indexing choices

## System design elements I want baked in (not just CRUD)
- Proper input validation (e.g. zod or express-validator) and centralized error handling middleware
- Rate limiting on the apply endpoint (basic in-memory or Redis-backed if you think it's worth the complexity — explain the tradeoff)
- Pagination that scales (avoid `skip()` for large offsets — discuss cursor-based pagination if relevant)
- A short caching layer (Redis, optional) on the most-viewed/hot listings, with a clear invalidation strategy on update
- Sensible logging (request logging + error logging, not just console.log everywhere)

## What I want from you
1. First, propose a project structure (folder layout for backend and frontend) and a short plan — don't start coding yet.
2. Once I confirm, scaffold the backend first: models, then auth, then listings CRUD, then applications + status pipeline, then search/filtering/pagination, then rate limiting/caching last.
3. Write basic tests for the core business logic (status transition validation, auth middleware) using Jest/Supertest.
4. Then scaffold the frontend: auth pages, listing browse/search/filter page, poster dashboard (manage listings + view/move applicants through pipeline), applicant dashboard (my applications + status).
5. Keep commits/changes scoped and explain key design decisions as you go (especially around indexing, pagination, and the status-transition validation) — I want to be able to defend these choices in an interview.
6. At the end, help me write a short README with setup instructions and a summary of the architecture/design decisions, since this will double as interview prep material.

Ask me clarifying questions before making structural decisions I haven't specified (e.g. cursor vs page-based pagination, whether to include Redis at all). Don't over-engineer — this should stay buildable in a reasonable timeframe while still having real substance to discuss in interviews.