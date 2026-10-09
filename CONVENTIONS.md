# LeanTrack — Conventions

Standards to keep the app consistent as we build out the [roadmap](PLAN.md). Follow these unless a specific task calls for an exception (note the exception inline if so).

## Stack & philosophy
- Plain HTML/CSS/JS. No build step, no bundler, no frameworks, no npm-installed dependencies in the shipped app.
- A dev-only tool (e.g. `http-server` for local preview) is fine, but nothing the shipped app depends on at runtime beyond the browser itself — with one narrow exception: a small, well-known JS library loaded lazily from a CDN (`<script src>`, no bundler) for a single feature that genuinely needs it (e.g. ZXing for camera barcode scanning), only fetched when that feature is actually used, and the feature must fail gracefully if it can't load. Don't reach for this casually — it's for cases like "no browser API exists for this," not convenience.
- Works by opening `index.html` directly, or via a static file server. Never require a backend unless a phase explicitly adds one (see PLAN.md Phase 5+).
- Everything works offline except features that are explicitly online (Open Food Facts search/barcode lookup). Those must fail gracefully with a clear message, not a broken screen, when offline.

## Files
- `index.html` — structure only, one `<section id="tab-...">` per tab, hidden/shown via JS.
- `style.css` — all styling. No inline `style=` attributes except small computed values (chart canvas, dynamic ring offsets).
- `app.js` — all behavior, in one file for now. If it passes ~800–1000 lines, split by feature (`food.js`, `activity.js`, etc.) and say so in this file.
- `data.js` — static reference data only (built-in foods, meal ideas). No logic.
- New data sources (e.g. Open Food Facts) get their own small module, e.g. `foodapi.js`, kept separate from UI code in `app.js`.
- `manifest.json`, `sw.js`, `icons/` — PWA installability/offline support (Phase 5). `sw.js` precaches the app shell listed in its own `ASSETS` array; add new top-level files there when they're added to the project. Both are feature-detected and no-op gracefully when unsupported (e.g. opened via `file://`) — never make the app depend on either being active.

## Data & storage
- All user data lives in `localStorage` under a single versioned key (currently `leantrack.v1`). Bump the version suffix and write a migration step in `load()` if the shape changes incompatibly — never silently drop existing user data.
- `state` is the one source of truth in memory; mutate it, then always call `save()`.
- Dates are stored as local `YYYY-MM-DD` strings (see `todayStr()`), never `Date` objects or timestamps, to avoid timezone bugs.
- Weights are stored internally in **kg** regardless of display units; convert only at render/input time (`kgToDisp` / `dispToKg`).
- New entities (activities, water logs, planned meals, etc.) follow the existing `{id: crypto.randomUUID(), ...}` pattern used by food log entries.

## UI patterns
- One tab = one `render<Tab>()` function, called from the central `render()` dispatcher. Keep tabs independent — a function should fully redraw its section from `state`, not patch it incrementally.
- Use the existing `.card` / `.row` / `.grid` / `.chips` CSS building blocks before inventing new layout patterns.
- Colors and spacing go through CSS variables in `:root` (with the existing `prefers-color-scheme: dark` block) — never hardcode a hex color in `app.js` or a new stylesheet.
- Destructive actions (erase data, delete an entry) require a `confirm()` or equivalent explicit step — no silent deletes.
- Empty/zero states get a `.muted` helper line (see weight/meal list empty states) instead of a blank area.

## Networked features (Open Food Facts, future APIs)
- Any network call: show a loading state, handle failure/offline with a visible message, and never block the rest of the app if it fails.
- Cache API responses the user is likely to reuse (recent searches, scanned barcodes) in `state` so repeat lookups don't require network.
- Never send more than the minimal query needed (e.g. search text, barcode) — no bundling of personal data (weight, age, etc.) into outgoing requests.

## Code style
- Vanilla JS, `const`/`let`, arrow functions for helpers, no semicolons-optional style debates — match what's already in `app.js`.
- Small named helpers over inline one-offs (`round`, `esc`, `totals`, etc.) — reuse them rather than re-deriving.
- Keep functions focused on one tab/feature; shared logic (unit conversion, date math, totals) goes in the "helpers" section at the top of `app.js`.
- Comment *why*, not *what*, and only where it's not obvious (e.g. timezone handling, calorie formula source).

## Content & tone
- Calorie/macro numbers are estimates — any new feature that states a number (burned calories, goal dates) should read as an estimate, not a guarantee.
- No medical/diagnostic claims. Keep the existing disclaimer on the Profile tab updated if new health-adjacent features are added.

---
Update this file when a new pattern is introduced that future work should follow.
