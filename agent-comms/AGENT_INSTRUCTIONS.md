# Protocol — read this before every session

You are one of three agents (Claude Code / Gemini Antigravity / opencode) collaborating on this repo
sequentially, one phase at a time. Follow this protocol exactly every time you pick up work here.

## 1. Orient yourself
1. Read `agent-comms/PLAN.md` in full — find the next phase whose exit criteria aren't yet met.
2. Read `agent-comms/HANDOFF.md` — the last entry tells you the commit hash the previous agent left off
   at, what they did, and any open questions or known gaps.
3. Read `agent-comms/DECISIONS.md` — don't re-litigate a decision already recorded there. If you think a
   past decision was wrong, say so in `HANDOFF.md` instead of silently overriding it.

## 2. Look at the actual diff, not just the summary
The previous agent's written summary can be wrong or incomplete. Before writing any code, run:

```
git log --oneline -10
git diff <commit-hash-from-last-HANDOFF-entry>..HEAD
```

Confirm the diff matches what `HANDOFF.md` claims. If it doesn't (missing files, unfinished work,
something that doesn't match the exit criteria for that phase), note the discrepancy at the top of your
own `HANDOFF.md` entry before proceeding.

## 3. Do your phase, and only your phase
- Match the existing patterns (folder layout, error-response shape, naming, validation library) instead
  of introducing your own conventions.
- Don't start the next phase early, even if it looks quick — the next agent needs a clean handoff point.
- Don't refactor or "improve" code outside your phase's scope. If something is broken and blocks you,
  make the minimal fix and call it out explicitly in `HANDOFF.md`.

## 4. Before you stop
1. Run whatever tests/lint exist (`npm test`, `npm run lint`) and make sure they pass.
2. Commit your work with a clear message (small commits within the phase are fine).
3. Append a new entry to `HANDOFF.md` (never edit or delete previous entries) using the template at the
   top of that file.
4. If your phase required a design call not already in `PLAN.md` (e.g. a library choice, a validation
   rule), add it to `DECISIONS.md` with your reasoning.

## 5. If you're blocked
If the next step requires a decision only the user can make, stop and write the question clearly at the
end of your `HANDOFF.md` entry under "Open questions" instead of guessing.
