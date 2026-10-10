# LeanTrack — Roadmap

Local-only app for now (data stays on your device). Free Open Food Facts API for food search/barcodes. Revisit online hosting later if you want cross-device sync.

## Phase 1 — Bigger food database + barcode ✅ Done
- Swap the ~60-item built-in food list for live search against **Open Food Facts** (free, no API key).
- Add barcode entry: type a UPC, or scan with phone/webcam camera via a barcode-reading library.
- Keep existing custom foods and past logs working unchanged — this only changes *search*, not storage.

**Notes:** Built-in foods still search instantly offline; Open Food Facts results are merged in below them when online, and cached in `localStorage` so repeat searches/barcodes don't re-hit the network. Typing a barcode always works, on every device. The search endpoint needed `world.openfoodfacts.net` instead of `.org` — the `.org` search endpoint doesn't send CORS headers for browser `fetch()`, while `.net` and the `.org` product-lookup endpoint both do.

**Update:** Camera scanning originally used the browser's native `BarcodeDetector` API, which turned out to be Chromium-only — iOS Safari (and every other iOS browser, since Apple requires them all to use WebKit) never implemented it, so the scan button silently never appeared on iPhone. Swapped to the [ZXing JS library](https://github.com/zxing-js/library) (pinned to an exact version with a Subresource Integrity hash, so the browser refuses to run it if the CDN ever serves something different), which decodes barcodes from camera frames itself rather than relying on a native browser API, so it works on iOS Safari and everywhere else `getUserMedia` does. It's loaded lazily only when "Scan with camera" is actually clicked — the rest of the app has no dependency on it, and it fails gracefully (with a message, falling back to manual entry) if the library can't load or camera access is denied.

Fixed two more real issues found by actually using it: (1) the camera kept recording after a scan because the ZXing library's own `.stop()` doesn't always release the camera hardware — now explicitly stops every media track too, on every exit path. (2) Scans of curved cans/bottles (the single most common real-world failure, since the barcode image itself is distorted by the curve) failed to decode at all — added ZXing's `TRY_HARDER` hint, requested a higher camera resolution with continuous autofocus, and added an on-screen tip about angling the can/bottle flatter toward the camera.

**Added: Favorites.** Any food — built-in, custom, an Open Food Facts search result, or a barcode lookup — can be starred. Starred foods show up as a one-tap "Favorites" shortcut list the moment you open Add Food with an empty search box, so something like a specific drink never needs re-searching or re-scanning once it's saved.

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

## Phase 7 — Meal-time alarms ✅ Done
- Extends the existing Reminders feature (Phase 3) with three more built-in time slots: Breakfast time, Lunch time, Dinner time — same enable/time/day-of-week controls already in place, no new mechanism needed.
- Low-effort, high-value addition since Phases 3 and 5 already did the hard part (permissions, the check loop, service-worker notifications).

**Notes:** Added Breakfast/Lunch/Dinner reminders, plus a **Drink water** reminder (user-requested — water tracking existed since Phase 2 but had no reminder tied to it). Both needed zero new UI code since `renderReminders()` already builds its list generically from `state.reminders`. Also added, per user feedback that in-browser notifications aren't reliable enough: an **"Add to Calendar"** button on every reminder that downloads a real recurring `.ics` calendar event (with its own alert) for your phone's native Calendar app — this works even with LeanTrack fully closed, no account or push server needed, and is the most reliable option of everything built so far. Times are written as "floating" (no timezone marker), which calendar apps correctly read as "local time, whatever timezone I'm in."

Also added 15 more meal ideas (24 → 39) per user feedback asking for more variety, in the same structured-ingredient format the Planner/shopping list depend on.

## Usability refinements (post-launch feedback)
A running log of smaller UX fixes made from real usage, outside the phase numbering above:
- **Confirmation toast.** Tapping "Add" on a food gave no visible feedback — added a brief "Added X" bubble, and the search/barcode result now clears after adding so it doesn't look stuck.
- **Bottom tab bar.** Moved navigation from the top header to a fixed bottom tab bar with icons — the standard mobile-app pattern, especially relevant once installed as a PWA. (Shipped with a real bug: the icon/label inside each button broke the click handler, since `e.target` was the inner element, not the button; fixed with `closest()`.)
- **Dropped meal-type categories from the Today log.** "Add food" no longer asks you to pick Breakfast/Lunch/Dinner/Snack — it's just a search box. Logged items now show the real clock time they were added instead, in one flat chronological list rather than grouped sections. (Meal *type* still exists for the 39 meal ideas themselves and the Planner's meal-slot dropdowns — this change only affects how your own logged food entries are organized.)
- **Better barcode scanning.** Added ZXing's "try harder" decode mode, higher camera resolution + continuous autofocus, and an on-screen tip, since curved cans/bottles are the most common real-world scan failure. Also fixed the camera not releasing (staying "recording") after a scan.
- **Favorites.** Star any food to save it; starred foods show up as a one-tap list the moment "Add food" is opened with an empty search, so a specific product never needs re-searching or re-scanning.
- **Barcode scan/entry moved into a modal.** The always-visible "Scan or enter a barcode" section is gone; a small camera-icon button next to the search box opens a modal that goes straight to the camera. If scanning can't happen for any reason (no camera, permission denied, offline so the scanner library can't load), it falls back to a manual UPC entry form automatically instead of a dead end — a "Can't scan?" link also offers that switch manually. Cancel (✕), clicking outside the modal, or Escape all close it; adding the found item closes it automatically too.

## Phase 8 — Meal ingredient substitution
- User-requested: swap an ingredient in a meal idea (e.g. can't eat peppers → swap in lettuce) and have the meal's calories/macros actually recalculate, not just the ingredient list changing cosmetically.
- Requires restructuring meal data: every ingredient needs its own per-serving nutrition (calories/protein/carbs/fat), so a meal's totals become the *sum* of its current ingredients rather than a fixed stated number. This is a real data model change across all 39 meals, not a small addition — planned as its own phase rather than squeezed in alongside smaller fixes.
- Rough shape: each ingredient gets a nutrition entry (reusing/extending the existing `FOODS` data where possible so there's one source of truth, not two); a "Swap" picker on a meal (in Meal ideas and/or the Planner) lets you replace one ingredient with another food of the same rough category; the meal's displayed cal/p/c/f recompute live from the ingredient list. Needs a decision on where the swap lives (just when logging it that day vs. a saved personal variant of the meal) — to be worked out when this phase starts.

## Phase 9 — Gym workout log (sets, reps, weight)
- User-requested: a proper strength-training log, not just the quick-add "Gym (30 min)" button from Phase 2. Pick an exercise from a categorized library (Legs, Back, Chest, Shoulders, Biceps, Triceps, Core, Cardio), log each set's reps and weight, and have calories factor back into the day's budget like everything else.
- **Scope decided with the user:**
  - Weight is tracked per set, not just once per exercise — a pyramid set like 10 reps @ 135 lb, 8 @ 145 lb, 6 @ 155 lb needs to record each set's own weight.
  - Logging a workout here **does** add an estimated calorie burn into the day's budget, the same way existing Activity entries do.
  - The exercise library is a **starting set of built-ins plus custom exercises** — same "built-in list + add your own" pattern as foods and activities already use.

### Data model
- New `GYM_EXERCISES` list in `data.js`: `{ n: name, cat: category, met }`, grouped under categories (Legs, Back, Chest, Shoulders, Biceps, Triceps, Core, Cardio), ~5–6 exercises per category to start (e.g. Legs: Squat, Lunge, Leg Press, Leg Curl, Calf Raise). `met` is a reasonable default per exercise for the calorie estimate below — approximate, like every other calorie number in this app.
- `state.customExercises`: user-added exercises, `{ n, cat }`, same shape as built-ins so they can be searched/filtered together — mirrors `state.custom` for foods.
- `state.gym[date]`: array of exercise blocks logged that day: `{ id, exercise, cat, sets: [{ reps, weight }, ...] }`. One block per exercise per session; a block can have any number of sets, each with its own reps and weight.

### Calorie estimate
- No separate "how long did this take" field — duration is estimated from set count (roughly 2 minutes per set, covering both the working set and rest between sets), fed into the existing MET formula from Phase 2 (`kcal = MET × 3.5 × weightKg / 200 × minutes`).
- Each day's total gym calories/minutes are synced into `state.activities[date]` as a single rolled-up entry (stable id like `gym-<date>` that gets replaced, not duplicated, whenever that day's gym log changes) — this means it automatically shows up in the existing Activity list, the daily calorie ring/budget, and the Progress tab's weekly activity chart with no changes needed to that code. The detailed set-by-set breakdown (reps/weight) lives only in the new Gym tab.

### UI
- New **Gym** tab on the bottom nav (6th tab). A day navigator like Today's, then category chips to filter the exercise library, then tapping an exercise opens a simple set-entry form (reps + weight, "Add set" to append, each set editable/removable) and a "Save" that commits the block for the day.
- Logged exercises for the day show as cards: exercise name + category, each set listed ("Set 1: 10 reps @ 135 lb"), with a simple total volume stat (Σ reps × weight) per exercise.
- "+ Add custom exercise" (name + category) alongside the built-in library, same spot/pattern as other custom-entry forms in the app.
- Possible stretch addition once the core log exists: a small weekly volume/workout-count chart on the Progress tab, reusing the existing bar-chart helper.

**Not decided yet (to work out when this phase starts):** exact starting exercise list per category, and whether weight should default to the unit system already set in Profile (lb/kg) — almost certainly yes, reusing `state.profile.units`, just confirming before building.

---

## Parked ideas (not being built right now)
- **Fitbit / Google Fit / real step-count syncing.** Skipped for now per user request — these need a developer account registered with Fitbit or Google (this app has no backend of its own to hold shared credentials), which is a bigger commitment than the app's current "no accounts" design. Revisit if wanted later; a simpler middle ground (manual daily step entry, no sync) is always available as a smaller alternative.

---

**Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7, each phase shippable and testable before moving to the next. Phases 8–9 are planned but not yet ordered against each other — whichever you want first.

**Status:** Phases 1–7 done. Phases 8–9 planned, not started.
