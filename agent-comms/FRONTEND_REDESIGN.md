# Frontend Redesign Spec

Goal: replace the current generic indigo-on-slate scheme (reads like an unstyled Tailwind template)
with a cohesive, intentional, premium-feeling design. This is a portfolio/interview piece — it should
look designed, not defaulted.

## Hard constraints (do not violate)

- **Do not change any application logic, state, props, API calls, or routing.** Only touch: `className`
  strings in `.jsx` files, `src/index.css`, `index.html` (`<title>`/font), and `src/main.jsx` (font
  import only). Do NOT edit anything in `src/api/`, `src/context/`, `src/utils/`, or any `.js` file
  except adding one font import line to `main.jsx`.
- **Do not start, stop, or restart any dev server or MongoDB.** They are already running with HMR. To
  verify, run `npm run build` and `npm run lint` in `frontend/` (build is a separate process from the
  running dev server, safe to run), then `rm -rf dist` after.
- **Tailwind v4** (via `@tailwindcss/vite`) — no `tailwind.config.js`. Use `@theme` in `index.css` for
  custom tokens if needed; `@apply` works inside `@layer components`.
- **No external network at runtime** — no Google Fonts `<link>`, no CDN. Fonts must be bundled via npm
  (`@fontsource-variable/inter`).
- Every page and component must still build and lint clean (one pre-existing benign oxlint warning about
  `AuthContext.jsx` fast-refresh is expected — leave it).
- Preserve all existing text content, labels, and interactive behavior. This is purely visual.

## Design system

### Palette (warm neutral + near-black + emerald accent)
- Background: `stone-50` (warm off-white)
- Surface/cards: white (`#fff`)
- Borders: `stone-200`
- Heading text: `stone-900`; body text: `stone-600`/`stone-700`; muted: `stone-500`
- **Primary action = near-black**: `stone-900` bg, white text, hover `stone-800`. NOT indigo.
- **Accent = emerald**, used sparingly and only where it means something: brand mark, links, focus rings,
  active nav item, the resume-upload dropzone highlight. `emerald-600` base, `emerald-700` hover.
- Status colors (badges/pipeline columns) stay semantic and keep their meaning — the ONLY loud color on
  the page should be a status, because that's information:
  - applied → stone/gray, shortlisted → blue, interview → amber, offer → emerald/green, rejected → red
- Replace every existing `slate-*` with the warm `stone-*` equivalent, and every `indigo-*` with either
  `stone-900` (for primary actions) or `emerald-*` (for accents/links) as appropriate.

### Typography
- Install `@fontsource-variable/inter` (npm, bundled — no CDN) and import it once at the top of
  `src/main.jsx` (`import "@fontsource-variable/inter";`).
- Set Inter as the sans font via `@theme { --font-sans: "Inter Variable", ui-sans-serif, system-ui,
  sans-serif; }` in `index.css`.
- Enable `-webkit-font-smoothing: antialiased;` on `body`.
- Type scale: page titles `text-3xl font-bold tracking-tight text-stone-900`; section headings
  `text-lg font-semibold`; body `text-sm`/`text-base text-stone-600`. Give headings tight tracking.

### Component classes (rewrite these in `index.css @layer components`)
Keep the SAME class names already used across the app so existing markup keeps working
(`.btn-primary`, `.btn-secondary`, `.btn-danger`, `.input-field`, `.card`, `.page-container`,
`.tag-pill`). Redefine their styles:
- `.btn-primary`: `stone-900` bg, white text, `rounded-lg`, `font-medium`, subtle shadow, hover
  `stone-800`, visible `focus-visible` ring (emerald), disabled dim.
- `.btn-secondary`: white bg, `stone-300` border, `stone-700` text, hover `stone-50`.
- `.btn-danger`: white bg, `red-300` border, `red-600` text, hover `red-50`.
- `.input-field`: `stone-300` border, `rounded-lg`, focus ring in **emerald** (`focus:border-emerald-500
  focus:ring-2 focus:ring-emerald-100`), placeholder `stone-400`.
- `.card`: white, `stone-200` border, `rounded-xl`, soft shadow (`shadow-sm`). Consider a slightly richer
  layered shadow for depth.
- `.tag-pill`: subtle — `bg-stone-100 text-stone-600` (or a faint emerald tint), `rounded-full`, small.
- `.page-container`: keep `mx-auto max-w-4xl px-6 py-10` (some pages use narrower — leave those overrides).
- You may ADD new small utility classes (e.g. `.badge`, `.btn-accent`) if it reduces repetition, but keep
  existing names working.

### Polish details to apply throughout
- Cards: subtle hover lift on clickable cards (`hover:-translate-y-0.5 hover:shadow-md transition`) —
  already on `ListingCard`, keep and refine.
- Consistent focus-visible rings (accessibility + looks intentional).
- Smooth `transition` on all interactive elements.
- Empty states (no listings / no applications / no applicants) should be gentle and centered with muted
  text, not a bare left-aligned sentence — small vertical padding, maybe a light icon or just better
  typography.
- The **Navbar** should feel like a real product header: brand mark in emerald, sticky, subtle bottom
  border, backdrop blur (already partially there — refine). Keep the same links/logic.
- The **BrowsePage** header can be a touch more inviting (title + one-line subtitle already there — make
  the search card feel deliberate).
- Generous, consistent spacing rhythm. Don't crowd.

### The resume upload control (already redesigned as a dropzone in `ListingDetailPage`)
- Keep it as a prominent dashed-border dropzone, but restyle to the new palette: the accent/highlight
  should be **emerald**, not indigo. Icon in an emerald-tinted circle, "Click to upload your resume" in
  emerald, filename shown once selected. Keep the whole apply form inside an accent-tinted card so it's
  clearly the focal point of the page.

## Files to touch (visual only)
- `src/index.css` — the design system (palette, font, component classes). This is the highest-leverage file.
- `src/main.jsx` — add the one font import line.
- `index.html` — leave title as "Job Board" (fine).
- Pages: `BrowsePage.jsx`, `ListingDetailPage.jsx`, `LoginPage.jsx`, `RegisterPage.jsx`,
  `PosterDashboardPage.jsx`, `ApplicantDashboardPage.jsx`.
- Components: `Navbar.jsx`, `ListingCard.jsx`, `ListingForm.jsx`, `PipelineBoard.jsx`, `StatusBadge.jsx`,
  `ProtectedRoute.jsx`, `Layout.jsx`.
- Sweep for any remaining `slate-*`/`indigo-*`/`gray-*` classes and convert them to the new palette so
  nothing is left inconsistent (`grep -rn "slate-\|indigo-\|gray-" src`).

## Verification (required before reporting done)
1. `npm run build` succeeds (then `rm -rf dist`).
2. `npm run lint` clean (except the one known `AuthContext.jsx` fast-refresh warning).
3. `grep -rn "indigo-\|slate-" src` returns nothing (all converted).
4. Report a concise summary of what changed. Do not restart servers — HMR will reflect changes live.
