import { APPLICATION_STATUSES } from "../models/Application.js";

/**
 * Legal transitions for the application pipeline. An applicant starts at 'applied',
 * and the poster moves them through the pipeline: shortlist, interview, then offer or reject.
 * Once rejected, no further transitions. Rejection can happen from any non-terminal state.
 * See agent-comms/DECISIONS.md for the rationale on this transition graph.
 */
const TRANSITIONS = {
  applied: ["shortlisted", "rejected"],
  shortlisted: ["interview", "rejected"],
  interview: ["offer", "rejected"],
  offer: ["rejected"], // allow offer rescind
  rejected: [], // terminal
};

export function isLegalTransition(fromStatus, toStatus) {
  if (!APPLICATION_STATUSES.includes(fromStatus) || !APPLICATION_STATUSES.includes(toStatus)) {
    return false;
  }
  return TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

export function getLegalTransitions(fromStatus) {
  return TRANSITIONS[fromStatus] ?? [];
}
