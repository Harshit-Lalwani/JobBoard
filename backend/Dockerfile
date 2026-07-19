# ⚠️ Unverified — Docker was not available in the environment this was written in. Written
# carefully and reviewed against the actual package.json/scripts, but please `docker build` and
# `docker compose up` this yourself before relying on it (see DEPLOYMENT.md).
FROM node:20-slim

WORKDIR /app

# Copy manifest first so `npm ci` is only re-run when dependencies actually change, not on every
# source edit — standard layer-caching practice.
COPY package*.json ./
RUN npm ci --omit=dev

# Explicit copies, not `COPY . .` — this is deliberate, not an oversight. The repo root has a real
# GCP service-account key file sitting next to this backend directory; a blanket `COPY . .` from a
# root build context would bake it into an image layer (recoverable via `docker history` even after
# a later layer "deletes" it). Scoping to `backend/src` also means the container never even has
# `.env`, `node_modules`, `tests/`, or `loadtest/` on it, none of which belong in a runtime image.
COPY src ./src

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/index.js"]
