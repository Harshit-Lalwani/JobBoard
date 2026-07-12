// Mirrors backend/src/utils/statusMachine.js exactly — the backend is the source of truth and
// enforces this server-side regardless of what the UI shows; this copy only exists so the
// pipeline board can show/hide legal next-status buttons instead of letting every click round-trip
// to the server to find out it was illegal. If the backend graph ever changes, update both.
const TRANSITIONS = {
  applied: ["shortlisted", "rejected"],
  shortlisted: ["interview", "rejected"],
  interview: ["offer", "rejected"],
  offer: ["rejected"],
  rejected: [],
};

export function getLegalTransitions(fromStatus) {
  return TRANSITIONS[fromStatus] ?? [];
}

export const APPLICATION_STATUSES = ["applied", "shortlisted", "interview", "offer", "rejected"];
