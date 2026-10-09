'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const KEY = 'leantrack.v1';
const LB = 2.20462, IN = 0.393701;

// ---------- state ----------
let state = load();
let viewDate = todayStr();
let mealFilter = new Set();
let planWeekStart = startOfWeek(todayStr());

function load() {
  const blank = {
    profile: null, goal: 2000, log: {}, weights: [], custom: [], offCache: {}, barcodeCache: {}, activities: {}, water: {}, waterGoal: 8,
    plan: {}, shoppingChecked: {},
    diet: { type: 'none', avoid: [] }, // avoid: mix of ALLERGENS keys and free-text custom words
    reminders: {
      walk: { label: 'Time for your walk', enabled: false, time: '08:00', days: [1, 2, 3, 4, 5], lastFired: null },
      logMeals: { label: 'Log today’s meals', enabled: false, time: '20:00', days: [0, 1, 2, 3, 4, 5, 6], lastFired: null },
      weighIn: { label: 'Weigh-in day', enabled: false, time: '07:30', days: [1], lastFired: null },
    },
  };
  try { return { ...blank, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return blank; }
}
// Small LRU-ish cache helper: cap entries so localStorage doesn't grow unbounded.
function cachePut(bag, key, val, cap = 40) {
  bag[key] = val;
  const keys = Object.keys(bag);
  if (keys.length > cap) delete bag[keys[0]];
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

// ---------- helpers ----------
function todayStr(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
function shiftDay(str, n) { const d = new Date(str + 'T12:00:00'); d.setDate(d.getDate() + n); return todayStr(d); }
// Monday of the week containing dateStr (ISO-style week start), as a YYYY-MM-DD string.
function startOfWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return shiftDay(dateStr, -((d.getDay() + 6) % 7));
}
const round = (n, p = 0) => { const m = 10 ** p; return Math.round(n * m) / m; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const units = () => (state.profile?.units || 'imperial');
const wUnit = () => (units() === 'imperial' ? 'lb' : 'kg');
const kgToDisp = kg => round(units() === 'imperial' ? kg * LB : kg, 1);
const dispToKg = v => units() === 'imperial' ? v / LB : v;
const dayLog = d => state.log[d] || [];
const totals = items => items.reduce((t, i) => ({ cal: t.cal + i.cal, p: t.p + (i.p || 0), c: t.c + (i.c || 0), f: t.f + (i.f || 0) }), { cal: 0, p: 0, c: 0, f: 0 });

// ---------- diet & allergies (Phase 6) ----------
const lc = s => (s || '').toLowerCase();
const matchesAny = (text, keywords) => keywords.some(k => text.includes(k));
// True if a meal idea fits the current diet type + avoid list. Meals have real tags/ingredients,
// so this is a hard filter (meals that fail it are hidden, not just flagged).
function mealAllowed(meal) {
  const { type, avoid } = state.diet;
  if (type === 'vegan' && !meal.tags.includes('Vegan')) return false;
  if (type === 'vegetarian' && !meal.tags.includes('Vegetarian') && !meal.tags.includes('Vegan')) return false;
  if (!avoid.length) return true;
  const names = (meal.ing || []).map(i => lc(i.n));
  return !avoid.some(a => {
    const allergen = ALLERGENS[a];
    const keywords = allergen ? allergen.keywords : [lc(a)];
    return names.some(n => matchesAny(n, keywords));
  });
}
// Best-effort warning tags for a plain food/log item (no structured ingredient data) or an Open
// Food Facts item (which may have real allergens_tags/ingredients_analysis_tags). Never hides
// anything — just returns labels to show next to the item, e.g. ["vegan?", "nuts"].
function dietWarnings(food) {
  const { type, avoid } = state.diet;
  const warnings = [];
  const name = lc(food.n);
  if (type !== 'none') {
    if (food.source === 'off' && food.analysisTags?.length) {
      const bad = type === 'vegan' ? !food.analysisTags.includes('en:vegan') : !food.analysisTags.includes('en:vegetarian') && !food.analysisTags.includes('en:vegan');
      if (bad) warnings.push(type === 'vegan' ? 'vegan?' : 'vegetarian?');
    } else if (matchesAny(name, NONVEG_KEYWORDS) || (type === 'vegan' && matchesAny(name, NONVEGAN_EXTRA_KEYWORDS))) {
      warnings.push(type === 'vegan' ? 'vegan?' : 'vegetarian?');
    }
  }
  for (const a of avoid) {
    const allergen = ALLERGENS[a];
    if (food.source === 'off' && food.allergensTags?.length) {
      if (allergen && allergen.off.some(tag => food.allergensTags.includes(tag))) warnings.push(allergen.label);
      else if (!allergen && name.includes(lc(a))) warnings.push(a);
    } else {
      const keywords = allergen ? allergen.keywords : [lc(a)];
      if (matchesAny(name, keywords)) warnings.push(allergen ? allergen.label : a);
    }
  }
  return [...new Set(warnings)];
}

// ---------- activity & water ----------
const dayActivities = d => state.activities[d] || [];
const activityCal = d => dayActivities(d).reduce((s, a) => s + a.cal, 0);
// Standard MET formula: kcal = MET * 3.5 * weightKg / 200 * minutes.
function estimateBurn(met, mins) {
  const kg = state.profile?.weightKg || 70; // reasonable fallback if no profile yet
  return Math.round(met * 3.5 * kg / 200 * mins);
}
function addActivity(type, mins, cal) {
  (state.activities[viewDate] ||= []).push({ id: crypto.randomUUID(), type, mins, cal });
  save(); render();
}
function activityStreak() {
  let n = 0, d = todayStr();
  while (dayActivities(d).length) { n++; d = shiftDay(d, -1); }
  return n;
}

// ---------- tabs ----------
$('#tabs').addEventListener('click', e => {
  const t = e.target.dataset.tab; if (!t) return;
  showTab(t);
});
function showTab(t) {
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  $$('main > section').forEach(s => s.hidden = s.id !== 'tab-' + t);
  render();
}

// ---------- calorie goal ----------
function calcGoal(p) {
  const kg = p.weightKg, cm = p.heightCm;
  const bmr = 10 * kg + 6.25 * cm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const tdee = bmr * p.activity;
  const deficit = p.paceLb * 500;
  const floor = p.sex === 'male' ? 1500 : 1200;
  const goal = Math.max(floor, Math.round((tdee - deficit) / 10) * 10);
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), goal, floored: tdee - deficit < floor };
}

// ---------- TODAY ----------
function renderToday() {
  $('#dateLabel').textContent = viewDate === todayStr() ? 'Today' :
    new Date(viewDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  $('#nextDay').disabled = viewDate >= todayStr();

  const items = dayLog(viewDate), t = totals(items), goal = state.goal;
  const exCal = activityCal(viewDate);
  const budget = goal + exCal; // exercise calories earn back room in the day, same as MyFitnessPal-style tracking
  const left = budget - t.cal;
  $('#goalCal').textContent = goal;
  $('#eatenCal').textContent = round(t.cal);
  $('#exerciseCal').textContent = (exCal ? '+' : '') + round(exCal);
  $('#remaining').textContent = Math.abs(round(left));
  $('#remainingLabel').textContent = left >= 0 ? 'left' : 'over';
  $('#pTot').textContent = round(t.p) + 'g';
  $('#cTot').textContent = round(t.c) + 'g';
  $('#fTot').textContent = round(t.f) + 'g';
  const ring = $('#ringFg');
  ring.style.strokeDashoffset = 326.7 * (1 - Math.min(1, t.cal / budget));
  ring.classList.toggle('over', left < 0);

  const box = $('#logList'); box.innerHTML = '';
  ['Breakfast', 'Lunch', 'Dinner', 'Snack'].forEach(m => {
    const mi = items.filter(i => i.meal === m); if (!mi.length) return;
    const g = document.createElement('div'); g.className = 'meal-group';
    g.innerHTML = `<h3><span>${m}</span><span>${round(totals(mi).cal)} cal</span></h3><div class="card"><ul class="results">${
      mi.map(i => `<li><div>${esc(i.name)}<small>${round(i.cal)} cal · P ${round(i.p)} C ${round(i.c)} F ${round(i.f)}</small></div>
        <button class="del" data-del="${i.id}" aria-label="Remove">✕</button></li>`).join('')}</ul></div>`;
    box.appendChild(g);
  });
  renderActivity();
  renderWater();
  renderResultsList();
}
$('#logList').addEventListener('click', e => {
  const id = e.target.dataset.del; if (!id) return;
  state.log[viewDate] = dayLog(viewDate).filter(i => i.id !== id); save(); render();
});
$('#prevDay').onclick = () => { viewDate = shiftDay(viewDate, -1); render(); };
$('#nextDay').onclick = () => { if (viewDate < todayStr()) { viewDate = shiftDay(viewDate, 1); render(); } };

function renderActivity() {
  $('#activityQuick').innerHTML = ACTIVITIES.filter(a => a.n !== 'Custom')
    .map(a => `<button class="chip" data-quick="${esc(a.n)}">${esc(a.n)} (30 min)</button>`).join('');
  const sel = $('#activityType');
  if (!sel.options.length) sel.innerHTML = ACTIVITIES.map(a => `<option>${esc(a.n)}</option>`).join('');
  $('#activityList').innerHTML = dayActivities(viewDate).map(a =>
    `<li><div>${esc(a.type)}<small>${a.mins} min · ${a.cal} cal burned</small></div>
      <button class="del" data-adel="${a.id}" aria-label="Remove">✕</button></li>`).join('');
}
$('#activityQuick').addEventListener('click', e => {
  const type = e.target.dataset.quick; if (!type) return;
  const met = ACTIVITIES.find(a => a.n === type).met;
  addActivity(type, 30, estimateBurn(met, 30));
});
$('#activityForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const mins = +f.mins;
  const met = ACTIVITIES.find(a => a.n === f.type)?.met || 4;
  const cal = f.cal ? +f.cal : estimateBurn(met, mins);
  addActivity(f.type, mins, cal); e.target.reset(); $('[name=mins]', e.target).value = 30;
});
$('#activityList').addEventListener('click', e => {
  const id = e.target.dataset.adel; if (!id) return;
  state.activities[viewDate] = dayActivities(viewDate).filter(a => a.id !== id); save(); render();
});

function renderWater() {
  $('#waterCount').textContent = state.water[viewDate] || 0;
  $('#waterGoal').textContent = state.waterGoal;
}
$('#waterPlus').onclick = () => { state.water[viewDate] = (state.water[viewDate] || 0) + 1; save(); renderWater(); };
$('#waterMinus').onclick = () => { state.water[viewDate] = Math.max(0, (state.water[viewDate] || 0) - 1); save(); renderWater(); };

function addEntry(food, meal) {
  (state.log[viewDate] ||= []).push({ id: crypto.randomUUID(), meal, name: food.n + (food.s ? ` (${food.s})` : ''), cal: food.cal, p: food.p || 0, c: food.c || 0, f: food.f || 0 });
  save(); render();
}

// Online search is additive: local results render instantly and always work offline;
// Open Food Facts results are merged in once (if) the network call succeeds.
let onlineResults = [], onlineStatus = ''; // '' | 'loading' | 'done' | 'error'
let searchTimer = null, searchCtrl = null;

function foodLi(f, attr) {
  const tag = f.source === 'off' ? '<span class="src-off">Open Food Facts</span>' : '';
  const warn = dietWarnings(f).map(w => `<span class="diet-warn">${esc(w)}</span>`).join('');
  return `<li><div>${esc(f.n)}${tag}${warn}<small>${esc(f.s || '')} · ${f.cal} cal · P ${f.p || 0} C ${f.c || 0} F ${f.f || 0}</small></div>
    <button ${attr}>Add</button></li>`;
}
// Draws the list from current state only — never schedules a search itself,
// so re-renders (cache hits, async results landing, day navigation) can't recurse.
function renderResultsList() {
  const q = $('#foodSearch').value.trim();
  const ql = q.toLowerCase();
  const all = [...state.custom, ...FOODS];
  const local = ql ? all.filter(f => f.n.toLowerCase().includes(ql)).slice(0, 8) : [];
  let html = local.map(f => foodLi(f, `data-add="${all.indexOf(f)}"`)).join('');
  if (ql.length >= 2) {
    if (onlineStatus === 'loading') html += '<li class="muted">Searching Open Food Facts…</li>';
    else if (onlineStatus === 'error') html += '<li class="muted">Couldn’t reach Open Food Facts (offline?). Showing built-in foods only.</li>';
    else if (onlineStatus === 'done') html += onlineResults.map((f, i) => foodLi(f, `data-online="${i}"`)).join('');
  }
  $('#foodResults').innerHTML = html || (ql ? '<li class="muted">No match. Try the custom food form below.</li>' : '');
}
// Called only on user input: decides whether to use cache, debounce a fetch, or clear online results.
function scheduleOnlineSearch(q) {
  clearTimeout(searchTimer);
  if (searchCtrl) searchCtrl.abort();
  const ql = q.trim().toLowerCase();
  if (ql.length < 2) { onlineResults = []; onlineStatus = ''; renderResultsList(); return; }
  if (state.offCache[ql]) { onlineResults = state.offCache[ql]; onlineStatus = 'done'; renderResultsList(); return; }
  searchTimer = setTimeout(async () => {
    onlineStatus = 'loading'; renderResultsList();
    searchCtrl = new AbortController();
    try {
      const results = await offSearch(ql, searchCtrl.signal);
      cachePut(state.offCache, ql, results); save();
      onlineResults = results; onlineStatus = 'done';
    } catch (err) {
      if (err.name === 'AbortError') return; // superseded by a newer keystroke; don't flash an error
      onlineResults = []; onlineStatus = 'error';
    }
    renderResultsList();
  }, 400);
}
$('#foodSearch').addEventListener('input', () => { renderResultsList(); scheduleOnlineSearch($('#foodSearch').value); });
$('#foodResults').addEventListener('click', e => {
  const i = e.target.dataset.add, oi = e.target.dataset.online;
  if (i !== undefined) addEntry([...state.custom, ...FOODS][+i], $('#mealSel').value);
  else if (oi !== undefined) addEntry(onlineResults[+oi], $('#mealSel').value);
});

// ---- Barcode lookup & camera scan (Phase 1) ----
let barcodeResult = null;
function renderBarcodeResult(msg) {
  $('#barcodeResult').innerHTML = barcodeResult ? foodLi(barcodeResult, 'data-barcode-add') : (msg ? `<li class="muted">${esc(msg)}</li>` : '');
}
$('#barcodeForm').addEventListener('submit', async e => {
  e.preventDefault();
  const code = $('#barcodeIn').value.trim();
  if (!code) return;
  barcodeResult = null; renderBarcodeResult('Looking up…');
  if (state.barcodeCache[code] !== undefined) {
    barcodeResult = state.barcodeCache[code];
    renderBarcodeResult(barcodeResult ? '' : 'No product found for that barcode.');
    return;
  }
  try {
    const food = await offLookupBarcode(code);
    if (food) cachePut(state.barcodeCache, code, food); // cache hits; don't permanently cache misses (could be a transient issue)
    save();
    barcodeResult = food;
    renderBarcodeResult(food ? '' : 'No product found for that barcode.');
  } catch {
    renderBarcodeResult('Couldn’t reach Open Food Facts (offline?).');
  }
});
$('#barcodeResult').addEventListener('click', e => {
  if (e.target.dataset.barcodeAdd === undefined) return;
  addEntry(barcodeResult, $('#mealSel').value);
});

// Camera scanning uses the ZXing JS barcode library (pure JS decoding from camera frames) instead
// of the native BarcodeDetector API, because BarcodeDetector is Chromium-only — iOS Safari (and
// every other iOS browser, which must use WebKit) never implemented it. ZXing works everywhere
// getUserMedia does. It's loaded lazily from a CDN only when the scan button is actually clicked,
// so the rest of the app never depends on it or on being online; manual entry is always available.
let zxingControls = null, zxingLoadPromise = null;
function loadZXing() {
  if (window.ZXing) return Promise.resolve();
  if (!zxingLoadPromise) {
    zxingLoadPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      // Pinned to an exact version + Subresource Integrity hash (verified against jsdelivr's own
      // published file hash when added) — the browser refuses to run this script if the bytes
      // served ever don't match exactly, so a compromised CDN or package can't silently swap it.
      s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.23.0/umd/index.min.js';
      s.integrity = 'sha256-Pt6UFT+wxbZ6Etet/23s2CfCsicU/cb67PJ6jyCTfqY=';
      s.crossOrigin = 'anonymous';
      s.onload = resolve; s.onerror = () => reject(new Error('load failed'));
      document.head.appendChild(s);
    });
  }
  return zxingLoadPromise;
}
if (navigator.mediaDevices?.getUserMedia) {
  $('#scanBtn').hidden = false;
  $('#scanBtn').addEventListener('click', startScan);
  $('#scanClose').addEventListener('click', stopScan);
}
async function startScan() {
  barcodeResult = null; renderBarcodeResult('Loading scanner…');
  try {
    await loadZXing();
  } catch {
    renderBarcodeResult('Couldn’t load the scanner (offline?). Type the barcode instead.');
    return;
  }
  renderBarcodeResult('');
  $('#scanWrap').hidden = false;
  const hints = new Map([[ZXing.DecodeHintType.POSSIBLE_FORMATS,
    [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E]]]);
  const reader = new ZXing.BrowserMultiFormatReader(hints);
  try {
    zxingControls = await reader.decodeFromConstraints(
      { video: { facingMode: 'environment' } }, $('#scanVideo'),
      (result) => {
        if (!result) return; // fires continuously with a "not found" error while no barcode is in view
        $('#barcodeIn').value = result.getText();
        stopScan();
        $('#barcodeForm').requestSubmit();
      }
    );
  } catch {
    renderBarcodeResult('Camera access was denied or unavailable.');
    $('#scanWrap').hidden = true;
  }
}
function stopScan() {
  zxingControls?.stop(); zxingControls = null;
  $('#scanWrap').hidden = true;
}
$('#customForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const food = { n: f.name.trim(), s: f.serving.trim(), cal: +f.cal, p: +f.p || 0, c: +f.c || 0, f: +f.f || 0 };
  state.custom.unshift(food); addEntry(food, $('#mealSel').value); e.target.reset();
});

// ---------- MEALS ----------
const TAGS = ['High protein', 'Low carb', 'Vegetarian', 'Vegan', 'Quick', 'Meal prep'];
function renderMeals() {
  const left = state.goal - totals(dayLog(todayStr())).cal;
  $('#mealHint').textContent = state.profile
    ? `You have about ${Math.max(0, round(left))} calories left today. Meals that fit are highlighted.`
    : 'Set up your Profile to get a daily calorie goal and see which meals fit.';
  const f = $('#mealFilters');
  f.innerHTML = TAGS.map(t => `<button class="chip ${mealFilter.has(t) ? 'on' : ''}" data-tag="${t}">${t}</button>`).join('');
  const meals = MEALS.filter(m => mealAllowed(m) && [...mealFilter].every(t => m.tags.includes(t)))
    .sort((a, b) => (b.cal <= left) - (a.cal <= left) || b.p / b.cal - a.p / a.cal);
  $('#mealList').innerHTML = meals.map((m, i) => `<div class="card">
    <h3>${esc(m.n)}</h3><div>${m.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
    <p style="margin:0;font-size:.9rem">${esc(m.d)}</p>
    <div class="meal-macros">${m.cal} cal · P ${m.p}g C ${m.c}g F ${m.f}g · ${m.type}</div>
    ${m.cal <= left ? '<div class="fits">Fits your day</div>' : ''}
    <button data-meal="${MEALS.indexOf(m)}">Log this meal</button></div>`).join('') || '<p class="muted">No meals match those filters.</p>';
}
$('#mealFilters').addEventListener('click', e => {
  const t = e.target.dataset.tag; if (!t) return;
  mealFilter.has(t) ? mealFilter.delete(t) : mealFilter.add(t); renderMeals();
});
$('#mealList').addEventListener('click', e => {
  const i = e.target.dataset.meal; if (i === undefined) return;
  const m = MEALS[+i];
  viewDate = todayStr();
  addEntry({ n: m.n, cal: m.cal, p: m.p, c: m.c, f: m.f }, m.type);
  showTab('today');
});

// ---------- PLANNER ----------
const PLAN_MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const dayPlan = d => state.plan[d] || {};
const mealByName = n => MEALS.find(m => m.n === n);
function renderPlanner() {
  const start = planWeekStart, end = shiftDay(start, 6);
  const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  $('#weekLabel').textContent = `${fmt(start)} – ${fmt(end)}`;
  $('#nextWeek').disabled = false;

  const days = [...Array(7)].map((_, i) => shiftDay(start, i));
  $('#plannerGrid').innerHTML = days.map(d => {
    const plan = dayPlan(d);
    const dayCal = PLAN_MEAL_TYPES.reduce((s, t) => s + (mealByName(plan[t])?.cal || 0), 0);
    const label = new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    return `<div class="card plan-day" data-date="${d}">
      <h3>${label} <span class="plan-day-cal">${dayCal ? dayCal + ' cal planned' : ''}</span></h3>
      ${PLAN_MEAL_TYPES.map(t => `<div class="plan-row"><label>${t}</label>
        <select data-ptype="${t}"><option value="">— none —</option>
        ${MEALS.filter(m => m.type === t && (mealAllowed(m) || plan[t] === m.n)).map(m => `<option value="${esc(m.n)}" ${plan[t] === m.n ? 'selected' : ''}>${esc(m.n)}</option>`).join('')}
        </select></div>`).join('')}
    </div>`;
  }).join('');
  renderShoppingList(days);
}
$('#prevWeek').onclick = () => { planWeekStart = shiftDay(planWeekStart, -7); renderPlanner(); };
$('#nextWeek').onclick = () => { planWeekStart = shiftDay(planWeekStart, 7); renderPlanner(); };
$('#plannerGrid').addEventListener('change', e => {
  const type = e.target.dataset.ptype; if (!type) return;
  const date = e.target.closest('.plan-day').dataset.date;
  (state.plan[date] ||= {})[type] = e.target.value || null;
  save(); renderPlanner();
});

// Tallies ingredients across the visible week's planned meals, grouped by category, with a count
// of how many planned meals use each one. Checked state is per week (keyed by week start + name)
// so ticking something off this week doesn't carry over to next week's list.
function renderShoppingList(days) {
  const counts = new Map(); // "cat|name" -> { n, cat, count }
  days.forEach(d => {
    const plan = dayPlan(d);
    PLAN_MEAL_TYPES.forEach(t => {
      const meal = mealByName(plan[t]); if (!meal) return;
      (meal.ing || []).forEach(({ n, cat }) => {
        const key = cat + '|' + n;
        const entry = counts.get(key) || { n, cat, count: 0 };
        entry.count++; counts.set(key, entry);
      });
    });
  });
  if (!counts.size) {
    $('#shoppingHint').textContent = 'Assign meals above to build a shopping list for the week.';
    $('#shoppingList').innerHTML = '';
    return;
  }
  $('#shoppingHint').textContent = 'Generated from this week’s planned meals. Check items off as you shop.';
  const byCat = {};
  for (const e of counts.values()) (byCat[e.cat] ||= []).push(e);
  const wk = planWeekStart;
  $('#shoppingList').innerHTML = Object.keys(byCat).sort().map(cat => `<div class="shop-group">
    <h4>${esc(cat)}</h4>
    ${byCat[cat].sort((a, b) => a.n.localeCompare(b.n)).map(e => {
      const key = `${wk}|${e.n}`, checked = !!state.shoppingChecked[key];
      return `<label class="shop-item ${checked ? 'checked' : ''}"><input type="checkbox" data-shop="${esc(key)}" ${checked ? 'checked' : ''}>
        <span>${esc(e.n)}${e.count > 1 ? ` ×${e.count}` : ''}</span></label>`;
    }).join('')}
  </div>`).join('');
}
$('#shoppingList').addEventListener('change', e => {
  const key = e.target.dataset.shop; if (!key) return;
  state.shoppingChecked[key] = e.target.checked; save();
  e.target.closest('.shop-item').classList.toggle('checked', e.target.checked);
});

// ---------- PROGRESS ----------
$('#weightForm').addEventListener('submit', e => {
  e.preventDefault();
  const kg = dispToKg(+$('#weightIn').value), d = todayStr();
  state.weights = state.weights.filter(w => w.date !== d).concat({ date: d, kg }).sort((a, b) => a.date.localeCompare(b.date));
  if (state.profile) state.profile.weightKg = kg;
  save(); e.target.reset(); render();
});
$('#weightList').addEventListener('click', e => {
  const d = e.target.dataset.wdel; if (!d) return;
  state.weights = state.weights.filter(w => w.date !== d); save(); render();
});

function renderProgress() {
  $('#weightUnit').textContent = wUnit();
  const ws = state.weights, p = state.profile;
  if (ws.length) {
    const first = ws[0].kg, last = ws[ws.length - 1].kg, lost = first - last;
    let s = `Started ${kgToDisp(first)} ${wUnit()} · now ${kgToDisp(last)} ${wUnit()} · ${lost >= 0 ? 'lost' : 'gained'} ${Math.abs(kgToDisp(lost))} ${wUnit()}`;
    if (p?.goalKg) s += ` · ${kgToDisp(Math.max(0, last - p.goalKg))} ${wUnit()} to goal`;
    $('#weightSummary').textContent = s;
  } else $('#weightSummary').textContent = 'No weigh-ins yet.';
  $('#weightList').innerHTML = [...ws].reverse().slice(0, 10).map(w =>
    `<li><span>${w.date}</span><span>${kgToDisp(w.kg)} ${wUnit()} <button class="del" data-wdel="${w.date}" aria-label="Delete">✕</button></span></li>`).join('');
  lineChart($('#weightChart'), ws.map(w => ({ x: w.date, y: kgToDisp(w.kg) })), p?.goalKg ? kgToDisp(p.goalKg) : null);
  const days = [...Array(7)].map((_, i) => shiftDay(todayStr(), i - 6));
  barChart($('#calChart'), days.map(d => ({ x: d.slice(5), y: round(totals(dayLog(d)).cal) })), state.goal);

  const weekCal = days.reduce((s, d) => s + activityCal(d), 0);
  const weekMins = days.reduce((s, d) => s + dayActivities(d).reduce((m, a) => m + a.mins, 0), 0);
  const streak = activityStreak();
  $('#activitySummary').textContent = `${weekCal} cal burned and ${weekMins} min active in the last 7 days` +
    (streak ? ` · ${streak}-day streak` : '');
  barChart($('#activityChart'), days.map(d => ({ x: d.slice(5), y: activityCal(d) })), null);
}

function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function setupCanvas(c) { const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.font = '12px system-ui'; return x; }
function lineChart(c, pts, goal) {
  const x = setupCanvas(c), W = c.width, H = c.height, pad = 36;
  x.fillStyle = css('--muted');
  if (pts.length < 2) { x.fillText('Log at least two weigh-ins to see a trend.', pad, H / 2); return; }
  const ys = pts.map(p => p.y).concat(goal ?? []);
  const lo = Math.min(...ys) - 1, hi = Math.max(...ys) + 1;
  const px = i => pad + (W - pad * 2) * i / (pts.length - 1), py = v => H - pad - (H - pad * 2) * (v - lo) / (hi - lo);
  x.strokeStyle = css('--line'); x.fillStyle = css('--muted');
  for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4, y = py(v); x.beginPath(); x.moveTo(pad, y); x.lineTo(W - pad, y); x.stroke(); x.fillText(round(v, 1), 2, y + 4); }
  if (goal != null) { x.setLineDash([6, 4]); x.strokeStyle = css('--warn'); x.beginPath(); x.moveTo(pad, py(goal)); x.lineTo(W - pad, py(goal)); x.stroke(); x.setLineDash([]); x.fillStyle = css('--warn'); x.fillText('goal', W - pad - 26, py(goal) - 4); }
  x.strokeStyle = css('--accent'); x.lineWidth = 2.5; x.beginPath();
  pts.forEach((p, i) => i ? x.lineTo(px(i), py(p.y)) : x.moveTo(px(i), py(p.y))); x.stroke();
  x.fillStyle = css('--accent'); pts.forEach((p, i) => { x.beginPath(); x.arc(px(i), py(p.y), 3.5, 0, 7); x.fill(); });
  x.fillStyle = css('--muted'); x.fillText(pts[0].x.slice(5), pad, H - 10); x.fillText(pts[pts.length - 1].x.slice(5), W - pad - 28, H - 10);
}
// goal is optional: when given, bars over goal are highlighted and a dashed goal line is drawn
// (used for "stayed under calorie budget"); omit it for charts with no over/under meaning (e.g. activity).
function barChart(c, pts, goal) {
  const x = setupCanvas(c), W = c.width, H = c.height, pad = 30;
  const hi = Math.max((goal ?? 0) * 1.15, 1, ...pts.map(p => p.y)) , bw = (W - pad * 2) / pts.length;
  const py = v => H - pad - (H - pad * 2) * v / hi;
  pts.forEach((p, i) => {
    x.fillStyle = (goal != null && p.y > goal) ? css('--warn') : css('--accent');
    x.fillRect(pad + i * bw + bw * .15, py(p.y), bw * .7, H - pad - py(p.y));
    x.fillStyle = css('--muted'); x.fillText(p.x, pad + i * bw + bw * .2, H - 10);
    if (p.y) x.fillText(p.y, pad + i * bw + bw * .2, py(p.y) - 4);
  });
  if (goal == null) return;
  x.setLineDash([6, 4]); x.strokeStyle = css('--text'); x.beginPath(); x.moveTo(pad, py(goal)); x.lineTo(W - pad, py(goal)); x.stroke(); x.setLineDash([]);
}

// ---------- PROFILE ----------
const pf = $('#profileForm');
function renderProfile() {
  const p = state.profile, u = p?.units || pf.units.value;
  $$('.unit-w').forEach(s => s.textContent = `(${u === 'imperial' ? 'lb' : 'kg'})`);
  $$('.unit-h').forEach(s => s.textContent = `(${u === 'imperial' ? 'in' : 'cm'})`);
  if (p && !pf.dataset.filled) {
    pf.dataset.filled = 1;
    pf.units.value = p.units; pf.sex.value = p.sex; pf.age.value = p.age; pf.activity.value = p.activity;
    pf.pace.value = p.paceLb;
    pf.height.value = u === 'imperial' ? round(p.heightCm * IN, 1) : p.heightCm;
    pf.weight.value = kgToDisp(p.weightKg); pf.goal.value = kgToDisp(p.goalKg);
    showGoal(calcGoal(p));
  }
  renderReminders();
  renderInstall();
  renderDiet();
}
pf.units.addEventListener('change', () => {
  const to = pf.units.value, from = to === 'imperial' ? 'metric' : 'imperial';
  const conv = (el, k) => { if (el.value) el.value = round(+el.value * k, 1); };
  const w = to === 'imperial' ? LB : 1 / LB, h = to === 'imperial' ? IN : 1 / IN;
  conv(pf.weight, w); conv(pf.goal, w); conv(pf.height, h);
  $$('.unit-w').forEach(s => s.textContent = `(${to === 'imperial' ? 'lb' : 'kg'})`);
  $$('.unit-h').forEach(s => s.textContent = `(${to === 'imperial' ? 'in' : 'cm'})`);
});
pf.addEventListener('submit', e => {
  e.preventDefault();
  const u = pf.units.value, imp = u === 'imperial';
  const p = {
    units: u, sex: pf.sex.value, age: +pf.age.value, activity: +pf.activity.value, paceLb: +pf.pace.value,
    heightCm: imp ? +pf.height.value / IN : +pf.height.value,
    weightKg: imp ? +pf.weight.value / LB : +pf.weight.value,
    goalKg: imp ? +pf.goal.value / LB : +pf.goal.value,
  };
  const r = calcGoal(p);
  state.profile = p; state.goal = r.goal;
  if (!state.weights.length) state.weights.push({ date: todayStr(), kg: p.weightKg });
  save(); showGoal(r); render();
});
function showGoal(r) {
  const p = state.profile, toLose = Math.max(0, p.weightKg - p.goalKg);
  const weeks = toLose ? Math.ceil(toLose * LB / p.paceLb) : 0;
  $('#goalResult').innerHTML = `Daily goal: <b>${r.goal} calories</b><br>
    <span class="muted">Estimated maintenance ${r.tdee} cal (BMR ${r.bmr}).${r.floored ? ' Goal was raised to a safe minimum.' : ''}
    ${weeks ? ` About ${weeks} weeks to reach your goal weight at this pace.` : ''}</span>`;
}
// ---------- diet & allergies UI ----------
function renderDiet() {
  $('#dietType').value = state.diet.type;
  $('#allergenChips').innerHTML = Object.entries(ALLERGENS).map(([key, a]) =>
    `<button class="chip ${state.diet.avoid.includes(key) ? 'on' : ''}" data-allergen="${key}">${esc(a.label)}</button>`).join('');
  const custom = state.diet.avoid.filter(a => !ALLERGENS[a]);
  $('#customAvoidList').innerHTML = custom.map(a =>
    `<button class="chip on" data-custom-avoid="${esc(a)}">${esc(a)} ✕</button>`).join('');
}
$('#dietType').addEventListener('change', e => { state.diet.type = e.target.value; save(); });
$('#allergenChips').addEventListener('click', e => {
  const key = e.target.dataset.allergen; if (!key) return;
  const avoid = state.diet.avoid;
  state.diet.avoid = avoid.includes(key) ? avoid.filter(a => a !== key) : [...avoid, key];
  save(); renderDiet();
});
$('#customAvoidForm').addEventListener('submit', e => {
  e.preventDefault();
  const word = lc($('#customAvoidIn').value.trim());
  if (!word || state.diet.avoid.includes(word)) return;
  state.diet.avoid = [...state.diet.avoid, word];
  save(); renderDiet(); e.target.reset();
});
$('#customAvoidList').addEventListener('click', e => {
  const word = e.target.dataset.customAvoid; if (word === undefined) return;
  state.diet.avoid = state.diet.avoid.filter(a => a !== word);
  save(); renderDiet();
});

$('#exportBtn').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  a.download = `leantrack-backup-${todayStr()}.json`; a.click();
};
$('#resetBtn').onclick = () => {
  if (confirm('Erase all LeanTrack data in this browser? This cannot be undone.')) { localStorage.removeItem(KEY); location.reload(); }
};

// ---------- reminders ----------
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const hasNotif = 'Notification' in window;
function notifStatusText() {
  if (!hasNotif) return 'This browser doesn’t support notifications.';
  return { granted: 'Notifications are enabled.', denied: 'Notifications are blocked — allow them for this site in your browser settings to use reminders.', default: 'Notifications aren’t enabled yet.' }[Notification.permission];
}
function renderReminders() {
  $('#notifStatus').textContent = notifStatusText();
  $('#enableNotif').hidden = !hasNotif || Notification.permission !== 'default';
  $('#reminderList').innerHTML = Object.entries(state.reminders).map(([key, r]) => `
    <div class="reminder-row" data-key="${key}">
      <div class="reminder-head">
        <label><input type="checkbox" data-rfield="enabled" ${r.enabled ? 'checked' : ''}> ${esc(r.label)}</label>
        <input type="time" data-rfield="time" value="${r.time}">
      </div>
      <div class="day-toggle">${DAY_LETTERS.map((d, i) => `<button type="button" data-rday="${i}" class="${r.days.includes(i) ? 'on' : ''}">${d}</button>`).join('')}</div>
    </div>`).join('');
}
$('#enableNotif').addEventListener('click', async () => {
  if (!hasNotif) return;
  await Notification.requestPermission();
  renderReminders();
});
$('#reminderList').addEventListener('change', e => {
  const row = e.target.closest('.reminder-row'); if (!row) return;
  const r = state.reminders[row.dataset.key], field = e.target.dataset.rfield;
  if (field === 'enabled') r.enabled = e.target.checked;
  else if (field === 'time') r.time = e.target.value;
  save();
});
$('#reminderList').addEventListener('click', e => {
  const day = e.target.dataset.rday; if (day === undefined) return;
  const row = e.target.closest('.reminder-row'), r = state.reminders[row.dataset.key], d = +day;
  r.days = r.days.includes(d) ? r.days.filter(x => x !== d) : [...r.days, d].sort();
  save(); renderReminders();
});
// Prefer firing through the installed service worker (Phase 5) when one is active: a notification
// raised by the SW isn't tied to a page's JS staying alive, which is a bit more reliable than
// `new Notification()` from page script, especially once the app is installed. Falls back cleanly
// when there's no SW (e.g. running from file://, or an unsupported browser).
async function fireNotification(title, body, tag) {
  if (navigator.serviceWorker?.controller) {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification(title, { body, tag });
  } else {
    new Notification(title, { body, tag });
  }
}
// Runs on a timer while the tab is open; fires each enabled reminder at most once per day.
function checkReminders() {
  if (!hasNotif || Notification.permission !== 'granted') return;
  const now = new Date(), hhmm = now.toTimeString().slice(0, 5), day = now.getDay(), today = todayStr();
  let changed = false;
  for (const r of Object.values(state.reminders)) {
    if (!r.enabled || r.lastFired === today || !r.days.includes(day) || hhmm < r.time) continue;
    fireNotification('LeanTrack', r.label, r.label);
    r.lastFired = today; changed = true;
  }
  if (changed) save();
}
checkReminders();
setInterval(checkReminders, 30000);

// ---------- install (Phase 5: PWA) ----------
// Service worker registration is feature-detected and silently skipped on file:// or unsupported
// browsers — the app works the same either way, just without offline caching / installability.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {}); // offline/installable is a bonus, not a requirement
  });
}
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  renderInstall();
});
window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; renderInstall(); });
function renderInstall() {
  const statusEl = $('#installStatus'), btn = $('#installBtn');
  if (isStandalone()) {
    statusEl.textContent = 'You’re using the installed app.';
    btn.hidden = true;
  } else if (deferredInstallPrompt) {
    statusEl.textContent = 'Install LeanTrack for a home-screen icon, offline use, and more reliable reminders.';
    btn.hidden = false;
  } else {
    statusEl.textContent = 'On iPhone/iPad: open this page in Safari, tap Share, then "Add to Home Screen". On Android/desktop Chrome or Edge, an install option will appear here once it’s offered.';
    btn.hidden = true;
  }
}
$('#installBtn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  renderInstall();
});

// ---------- render ----------
function render() {
  const t = $$('#tabs button').find(b => b.classList.contains('active')).dataset.tab;
  ({ today: renderToday, meals: renderMeals, planner: renderPlanner, progress: renderProgress, profile: renderProfile })[t]();
}
if (!state.profile) showTab('profile'); else render();
