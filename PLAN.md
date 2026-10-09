# LeanTrack — Roadmap

Local-only app for now (data stays on your device). Free Open Food Facts API for food search/barcodes. Revisit online hosting later if you want cross-device sync.

## Phase 1 — Bigger food database + barcode ✅ Done
- Swap the ~60-item built-in food list for live search against **Open Food Facts** (free, no API key).
- Add barcode entry: type a UPC, or scan with phone/webcam camera via a barcode-reading library.
- Keep existing custom foods and past logs working unchanged — this only changes *search*, not storage.

**Notes:** Built-in foods still search instantly offline; Open Food Facts results are merged in below them when online, and cached in `localStorage` so repeat searches/barcodes don't re-hit the network. Camera scanning uses the browser's native `BarcodeDetector` (Chrome/Edge) and only shows up when the browser + camera support it; typing a barcode always works as the fallback. The search endpoint needed `world.openfoodfacts.net` instead of `.org` — the `.org` search endpoint doesn't send CORS headers for browser `fetch()`, while `.net` and the `.org` product-lookup endpoint both do.

## Phase 2 — Exercise & gym tracking (+ water) ✅ Done
- New "Activity" log: gym sessions, walks, custom workouts — each with duration + estimated calories burned, added back into the daily calorie budget.
- Quick-add buttons: Walk, Gym, Run, Bike.
- Streaks ("4 days in a row") and a weekly activity total on Progress.
- Simple daily water counter on the Today tab.

**Notes:** Calories burned use the standard MET formula (`kcal = MET × 3.5 × weightKg / 200 × minutes`) with your profile weight, so it's an estimate, not a measured value. Exercise calories add back into the day's budget (ring + "left"/"over" total), matching how most calorie trackers handle it. Quick-add buttons log a 30-minute default instantly; the custom form lets you set minutes or override the calorie estimate entirely. Water is a simple per-day counter with an 8-cup default goal (not yet editable in Profile — small follow-up if you want that configurable). The weekly Activity chart on Progress reuses the existing bar-chart helper, now also usable without a "goal" line for charts where over/under doesn't apply.

## Phase 3 — Reminders / alarms ✅ Done
- Browser notifications for things like "Time for your walk," "Log today's meals," "Weigh-in day."
- Days/times configured in Profile; stored locally.
- Caveat: a plain browser tab can't reliably alarm you when closed — Phase 5 (installable app) makes this much more reliable.

**Notes:** Three built-in reminders (Walk, Log meals, Weigh-in), each with its own enable/time/day-of-week toggles, live in a new Reminders card on the Profile tab. An "Enable notifications" button only shows up when permission hasn't been decided yet — if blocked, the UI tells you to allow it in browser settings instead of silently failing. A 30-second timer checks enabled reminders against the current time/day and fires at most once per reminder per day (tracked via `lastFired`), so re-opening the tab after the scheduled time still catches up that same day. As called out in the plan: this only works while the tab is open — no closed-tab alarms until Phase 5.

## Phase 4 — Meal planning + shopping list ✅ Done
- Assign meal ideas onto a 7-day planner.
- Auto-generate a shopping list from the week's planned meals, grouped by category, with checkboxes.

**Notes:** New "Planner" tab with Monday-start weeks you can page through, a day card per day with a dropdown per meal slot (Breakfast/Lunch/Dinner/Snack) pulling from the same 24 meal ideas as the Meal ideas tab. All 24 meals got structured ingredient lists added in `data.js` to drive this. The shopping list aggregates ingredients across the visible week, grouped by category (Produce, Protein, Dairy & Eggs, Grains & Bakery, Pantry & Condiments, Frozen & Other), shows a ×N count when an ingredient is used in multiple planned meals, and checkbox state is kept per-week so checking something off doesn't carry over to next week's list.

Fixed a real bug while testing: a global `input{width:100%}` style was stretching checkboxes to fill their row, breaking the shopping list and (less visibly) the reminder list — scoped checkboxes/radios to their natural size in [style.css](style.css).

## Phase 5 — Installable on your phone ✅ Done
- Make it a PWA (installable home-screen icon, works offline, reliable notifications) — still no account, no server.
- Natural point to revisit hosting online for cross-device sync if wanted.

**Notes:** Added `manifest.json`, a service worker (`sw.js`) that precaches the whole app shell for offline use, and generated icon files in `icons/` (a simple ring + checkmark mark, matching the app's accent color). An "Install app" card on Profile shows a real Install button when the browser offers one (Android/desktop Chrome, Edge), gives manual "Add to Home Screen" instructions for iOS Safari (which never offers an automatic prompt), and shows a "you're using the installed app" message once installed. Reminders now fire through the service worker's notification API when one is registered, which is somewhat more reliable than a plain page notification — but to be accurate, "reliable" here means better, not perfect: background/closed-app delivery without a push server is still not guaranteed on any platform, especially iOS. All of this is feature-detected and fails silently on `file://` or unsupported browsers, so opening `index.html` directly still works exactly as before, just without install/offline/the upgraded notification path — serving it over `http(s)` (Live Server, `http-server`, or real hosting) is what unlocks Phase 5.

This completes the original 5-phase roadmap.

## Phase 6 — Diet type & allergy filtering ✅ Done
- Profile setting for diet type (none / vegetarian / vegan) and a list of allergens/foods to avoid (common ones as checkboxes — dairy, eggs, gluten/wheat, nuts/peanuts, soy, shellfish/fish — plus free-text custom exclusions like "mushroom").
- **Meal ideas & Planner:** non-compliant meals are hidden entirely, not just flagged — they won't appear in the Meal ideas list or in the Planner's meal-slot dropdowns. Driven by the ingredient lists already added in Phase 4, matched against a keyword map per allergen (e.g. "nuts" matches almond/peanut/cashew ingredient names).
- **Food search & logging (Today tab):** best-effort warning only, never a hard block — your own logged foods and quick-add choices always stay available. For the ~60 built-in foods, this means a simple name-keyword match (e.g. "milk" flags dairy). For Open Food Facts results, we can do better: OFF products carry real `allergens_tags` and `ingredients_analysis_tags` (vegan/vegetarian) fields, so those get used directly instead of keyword-guessing when available.
- Honest limits to flag in the UI: keyword/tag matching can miss things (e.g. an ingredient named something unexpected) or over-flag (e.g. "almond milk" tripping a dairy keyword by mistake) — this is a safety-conscious *filter*, not a substitute for reading a real label if an allergy is medically serious.

**Notes:** New "Diet & allergies" card on Profile (diet type select + allergen chips + custom-word chips) saves immediately, independent of the "Save & calculate goal" form. Meal ideas and Planner dropdowns now hide anything that fails `mealAllowed()` (diet tag check + ingredient-keyword check against `ALLERGENS` in `data.js`) — the Planner keeps a day's already-selected meal visible even if it stops qualifying later, rather than silently blanking your plan. Food search/barcode results show a small warning tag via `dietWarnings()`, using real Open Food Facts `allergens_tags`/`ingredients_analysis_tags` when a result has them, falling back to name-keyword matching otherwise; this never blocks adding/logging anything, per the plan.

Bumped the service worker's cache name (`leantrack-v2` in [sw.js](sw.js)) since Phase 5's cache-first strategy would otherwise keep serving the pre-Phase-6 `index.html`/`app.js`/etc. to returning visitors — worth remembering to do this on every phase that touches cached files, now that Phase 5 exists.

## Phase 7 — Meal-time alarms
- Extends the existing Reminders feature (Phase 3) with three more built-in time slots: Breakfast time, Lunch time, Dinner time — same enable/time/day-of-week controls already in place, no new mechanism needed.
- Low-effort, high-value addition since Phases 3 and 5 already did the hard part (permissions, the check loop, service-worker notifications).

---

**Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7, each phase shippable and testable before moving to the next.

**Status:** Phases 1–6 done. Phase 7 planned, not started.
