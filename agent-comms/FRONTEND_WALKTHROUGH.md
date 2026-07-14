# Frontend Testing Walkthrough

The app is running: **http://localhost:5173** (frontend), backend on **http://localhost:4000**, MongoDB
running persistently. A subagent is seeding mock data (posters, applicants, listings, applications in
varied pipeline stages) — check the summary message for login credentials once it finishes.

Work through this roughly top-to-bottom; each section builds on the last.

## 1. Public browsing (no login needed)

- [ ] Open `http://localhost:5173` — you should land on the browse page with the seeded listings visible.
- [ ] Type something into the search box (e.g. a word from one listing's description) and submit —
      confirm only matching listings remain.
- [ ] Filter by a tag (comma-separated field) — confirm it narrows to listings with that tag.
- [ ] Filter by location — confirm it narrows correctly.
- [ ] Combine search + tag + location in one query.
- [ ] If there are enough listings, click "Load more" — confirm it appends more results rather than
      replacing them, and that the button disappears once there's nothing left.
- [ ] Click into a listing — confirm the detail page shows full description, tags, location.
- [ ] While signed out, confirm the detail page prompts you to log in rather than showing an apply form.

## 2. Registration & login

- [ ] Register a **new** poster account (use an email not in the seed data). Confirm you land on the
      poster dashboard immediately after registering (no separate login step).
- [ ] Log out (Navbar → Log out). Confirm you're returned to the browse page and the Navbar switches
      back to "Log in / Register".
- [ ] Log back in with the same account. Confirm you land on `/poster` again.
- [ ] Register a new applicant account similarly, confirm it lands on `/applicant`.
- [ ] Try registering with a password under 8 characters — confirm client-side validation blocks it
      before it even hits the network tab.
- [ ] Try registering with an email that's already in use (reuse the poster email from above) — confirm
      you get a clear error message, not a crash.
- [ ] **Session persistence**: while logged in as either role, hard-refresh the page (Cmd/Ctrl+R).
      Confirm you're still logged in (briefly shows "Loading…" then lands back on your dashboard) rather
      than being bounced to `/login`. This exercises the silent-refresh-on-load flow.

## 3. Role boundaries

- [ ] While logged in as an applicant, manually navigate to `http://localhost:5173/poster` — confirm you
      get redirected away (not an error page, not a blank screen).
- [ ] While logged in as a poster, manually navigate to `/applicant` — same check.
- [ ] While signed out, navigate to `/poster` or `/applicant` — confirm you're redirected to `/login`.

## 4. Poster dashboard — listings management

(Log in as one of the seeded posters, or your own test poster account.)

- [ ] Click "New listing", fill out the form, submit — confirm it appears in "My listings" immediately.
- [ ] Click "Edit" on a listing, change the title, save — confirm the change shows immediately.
- [ ] Click "Close" on an open listing — confirm its status label flips to "closed". Then go to the
      **public** browse page (in an incognito window or after logging out) and confirm that closed
      listing is **not** visible there, even though it still shows up in your own "My listings".
- [ ] Click "Reopen" on it — confirm it's browsable publicly again.
- [ ] Click "Delete" on a listing — confirm the browser's confirm dialog appears, cancel it once (listing
      should remain), then confirm it for real and verify the listing disappears from your list.

## 5. Poster dashboard — the pipeline board

- [ ] Pick a seeded listing that has applicants, click "View applicants" — confirm a 5-column board
      appears (Applied / Shortlisted / Interview / Offer / Rejected) with applicant cards in the right
      columns matching what the seed data set up.
- [ ] On a card in "Applied", confirm you only see a button to move it forward (to Shortlisted) or
      reject it — **not** a button that jumps straight to Interview or Offer. This is the state-machine
      enforcement showing up in the UI.
- [ ] Click "Shortlisted" on an applied card — confirm it moves to that column immediately (no page
      reload).
- [ ] Keep advancing one applicant all the way to "Offer" one stage at a time.
- [ ] Pick a different applicant and reject them directly from "Applied" — confirm rejection is allowed
      from an early stage, not just from further along.
- [ ] Confirm a card in "Rejected" has **no** move buttons at all (terminal state).
- [ ] Open your browser's network tab, then try (via curl, not the UI, since the UI won't offer it) an
      illegal transition directly against the API for one of your applications — confirm the backend
      rejects it with 400 even though you're bypassing the UI's button logic. Example:
      ```
      curl -X PUT http://localhost:5173/api/applications/<id>/status \
        -H "Authorization: Bearer <your access token from localStorage/network tab>" \
        -H "Content-Type: application/json" -d '{"status":"offer"}'
      ```
      (grab an application id and a fresh access token from the Network tab while using the app)

## 6. Applying as an applicant (resume upload)

(Log in as one of the seeded applicants, or a fresh one.)

- [ ] Find a listing you haven't applied to, open its detail page.
- [ ] Try submitting the apply form with no file selected — confirm the browser blocks it (required
      file input).
- [ ] Select a real PDF file (any small PDF on your machine, or make one), fill in an optional cover
      note, submit — confirm you see "Uploading resume…" then "Submitting…" then "Application submitted."
- [ ] Try applying to the same listing again — confirm you get a clear "already applied" error rather
      than a duplicate application or a crash.
- [ ] Try uploading a non-PDF file (e.g. a `.txt` or `.png`) — confirm it's rejected with a clear message
      before/without creating an application.

## 7. Applicant dashboard

- [ ] Go to "My applications" — confirm every listing you've applied to (seeded + any you just added)
      appears, each with a colored status badge.
- [ ] Confirm the status badge colors are visually distinct per status (gray/blue/amber/green/red).
- [ ] Expand/read the status history timeline under an application that a poster has moved through
      multiple stages (from the seed data) — confirm it shows every transition with a timestamp, oldest
      first.
- [ ] Click a listing title from your applications list — confirm it takes you back to that listing's
      detail page.

## 8. Cross-role sanity check

- [ ] Open two browser windows (or one normal + one incognito): log in as a poster in one, an applicant
      in the other. Have the applicant apply to a listing; refresh the poster's pipeline board (or
      re-open "View applicants") and confirm the new application shows up without the poster needing to
      log out/in.
- [ ] Have the poster move that application to "Shortlisted"; refresh the applicant's dashboard and
      confirm the status badge and timeline update to reflect it.

## 9. Rate limiting (optional, more of a backend demo than a UI one)

- [ ] As a single applicant, apply to 6 different listings within about a minute (you may need to create
      a few more listings as a poster first if the seed data doesn't have 6 unapplied-to listings
      available). Confirm the 6th attempt is rejected with a rate-limit error rather than succeeding.

---

If anything on this list behaves unexpectedly, note the exact step and what happened — that's a real bug
report, not a false alarm, since every flow above was also verified live during development (see
`agent-comms/HANDOFF.md`), so a regression would mean something changed since then.
