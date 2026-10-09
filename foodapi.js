'use strict';
// Open Food Facts lookups. Pure data-fetching module — no UI, no state mutation.
// Callers must handle rejection (offline, blocked, bad response) themselves.
// Note: the .org search endpoint doesn't send CORS headers for browser fetches; .net does.
// Product-by-barcode lookups work fine on .org, so only search uses the .net host.
const OFF_SEARCH_URL = 'https://world.openfoodfacts.net/cgi/search.pl';
const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product/';
// allergens_tags/ingredients_analysis_tags feed the Phase 6 diet/allergy warnings — real data
// straight from Open Food Facts, preferred over our own keyword-guessing when present.
const OFF_FIELDS = 'code,product_name,generic_name,brands,serving_size,nutriments,allergens_tags,ingredients_analysis_tags';

// Normalize an Open Food Facts product into the same shape as entries in data.js (FOODS).
function offToFood(p) {
  const nutr = p?.nutriments || {};
  const perServing = nutr['energy-kcal_serving'] != null;
  const suf = perServing ? '_serving' : '_100g';
  const cal = Math.round(nutr['energy-kcal' + suf] ?? 0);
  const name = (p.product_name || p.generic_name || '').trim();
  if (!name || !cal) return null; // not enough data to be useful
  const round1 = v => Math.round((v ?? 0) * 10) / 10;
  return {
    n: name + (p.brands ? ` (${p.brands.split(',')[0].trim()})` : ''),
    s: p.serving_size || (perServing ? 'serving' : '100 g'),
    cal,
    p: round1(nutr['proteins' + suf]),
    c: round1(nutr['carbohydrates' + suf]),
    f: round1(nutr['fat' + suf]),
    source: 'off',
    barcode: p.code,
    allergensTags: p.allergens_tags || [],
    analysisTags: p.ingredients_analysis_tags || [],
  };
}

async function offSearch(query, signal) {
  const url = `${OFF_SEARCH_URL}?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=12&fields=${OFF_FIELDS}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Open Food Facts search failed: ' + res.status);
  const data = await res.json();
  return (data.products || []).map(offToFood).filter(Boolean);
}

async function offLookupBarcode(code, signal) {
  const url = `${OFF_PRODUCT_URL}${encodeURIComponent(code)}.json?fields=${OFF_FIELDS},status`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Open Food Facts lookup failed: ' + res.status);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null; // not found
  return offToFood(data.product);
}
