# Job Board — MERN Application Pipeline

A mini-ATS: posters create job/task listings, applicants apply, and posters move applicants through a
pipeline (`applied → shortlisted → interview → offer/rejected`).

Full spec: [`Initial_prompt.md`](Initial_prompt.md).
Build plan and multi-agent coordination: [`agent-comms/PLAN.md`](agent-comms/PLAN.md).

> This README is a Phase 0 stub. It will be expanded in the final phase with full setup instructions and
> an architecture/design-decisions summary (interview prep). See
> [`agent-comms/DECISIONS.md`](agent-comms/DECISIONS.md) for the running design-decision log in the
> meantime.

## Status

Phase 0 complete: repo scaffolding only (empty backend + frontend shells). No auth, models, or business
logic yet — see `agent-comms/PLAN.md` for what's next.

## Stack

- **Backend:** Node.js + Express, MongoDB/Mongoose, JWT auth, multer for uploads
- **Frontend:** React (Vite), React Router, Tailwind CSS, Axios
- **Tests:** Jest + Supertest

## Running locally (current scaffold)

Backend:

```
cd backend
cp .env.example .env
npm install
npm run dev        # http://localhost:4000/health
```

Frontend:

```
cd frontend
npm install
npm run dev         # http://localhost:5173, proxies /api to the backend
```

MongoDB is not required yet (no models/DB connection wired up until Phase 1).
