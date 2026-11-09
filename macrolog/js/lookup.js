// Barcode lookups against two free food databases:
//   USDA FoodData Central (branded foods, searchable by UPC) and Open Food Facts.
// Parsing is kept separate from fetching so it can be tested without a network.

import { normalizeBarcode } from './nutrition.js';

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : undefined;
};
const rnd = (n, dp) => (n === undefined ? undefined : Math.round(n * 10 ** dp) / 10 ** dp);
const times = (n, f) => (n === undefined ? undefined : n * f);

function titleCase(s) {
  const t = String(s ?? '').trim();
  if (!t) return '';
  // Database names are often ALL CAPS. Leave mixed-case names alone.
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s\-/(])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}

function finish(nutrients) {
  const dps = { kcal: 0, protein: 1, carbs: 1, fat: 1, fiber: 1, sugars: 1, addedSugars: 1, satFat: 1, sodium: 0, cholesterol: 0, potassium: 0, calcium: 0, iron: 1, vitD: 1, vitA: 0, vitC: 1 };
  const out = {};
  for (const [k, v] of Object.entries(nutrients)) {
    if (v !== undefined && Number.isFinite(v)) out[k] = Math.max(0, rnd(v, dps[k] ?? 1));
  }
  return out;
}

// ---------- Open Food Facts ----------

export function parseOpenFoodFacts(json, barcode) {
  if (!json || json.status === 0 || !json.product) return { state: 'notfound' };
  const p = json.product;
  const n = p.nutriments || {};
  const name = String(p.product_name || '').trim();
  const brand = String(p.brands || '').split(',')[0].trim();

  const servingQty = num(p.serving_quantity);
  const perServing = servingQty > 0 && num(n['energy-kcal_serving']) !== undefined;
  const s = perServing ? '_serving' : '_100g';

  let kcal = num(n['energy-kcal' + s]);
  if (kcal === undefined) {
    const kj = num(n['energy' + s]);
    if (kj !== undefined) kcal = kj / 4.184;
  }
  if (kcal === undefined) {
    return { state: 'nodata', prefill: { name, brand, barcode } };
  }

  const sodiumG = num(n['sodium' + s]);
  const saltG = num(n['salt' + s]);
  const nutrients = finish({
    kcal,
    protein: num(n['proteins' + s]),
    carbs: num(n['carbohydrates' + s]),
    fat: num(n['fat' + s]),
    satFat: num(n['saturated-fat' + s]),
    fiber: num(n['fiber' + s]),
    sugars: num(n['sugars' + s]),
    addedSugars: num(n['added-sugars' + s]),
    sodium: sodiumG !== undefined ? sodiumG * 1000 : times(saltG, 400),
    cholesterol: times(num(n['cholesterol' + s]), 1000),
    potassium: times(num(n['potassium' + s]), 1000),
    calcium: times(num(n['calcium' + s]), 1000),
    iron: times(num(n['iron' + s]), 1000),
    vitD: times(num(n['vitamin-d' + s]), 1e6),
    vitC: times(num(n['vitamin-c' + s]), 1000),
  });

  return {
    state: 'found',
    food: {
      name: name || 'Unnamed product',
      brand,
      barcode: normalizeBarcode(p.code || barcode),
      servingLabel: perServing ? String(p.serving_size || `${servingQty} g`).trim() : '100 g',
      servingGrams: perServing ? servingQty : 100,
      nutrients,
      source: 'Open Food Facts',
    },
  };
}

export async function fetchOpenFoodFacts(barcode, { fetchFn = fetch, signal } = {}) {
  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json` +
    '?fields=code,product_name,brands,serving_size,serving_quantity,nutriments';
  const res = await fetchFn(url, { signal });
  if (res.status === 404) return { state: 'notfound' };
  if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);
  return parseOpenFoodFacts(await res.json(), barcode);
}

// ---------- USDA FoodData Central ----------

const FDC_BY_NUMBER = {
  '208': 'kcal', '203': 'protein', '205': 'carbs', '204': 'fat', '291': 'fiber',
  '269': 'sugars', '269.3': 'sugars', '539': 'addedSugars', '606': 'satFat',
  '307': 'sodium', '601': 'cholesterol', '306': 'potassium', '301': 'calcium',
  '303': 'iron', '328': 'vitD', '320': 'vitA', '401': 'vitC',
};
const FDC_BY_ID = {
  1008: 'kcal', 1003: 'protein', 1005: 'carbs', 1004: 'fat', 1079: 'fiber',
  2000: 'sugars', 1235: 'addedSugars', 1258: 'satFat', 1093: 'sodium',
  1253: 'cholesterol', 1092: 'potassium', 1087: 'calcium', 1089: 'iron',
  1114: 'vitD', 1106: 'vitA', 1162: 'vitC',
};
const TARGET_UNIT = {
  protein: 'g', carbs: 'g', fat: 'g', fiber: 'g', sugars: 'g', addedSugars: 'g', satFat: 'g',
  sodium: 'mg', cholesterol: 'mg', potassium: 'mg', calcium: 'mg', iron: 'mg', vitC: 'mg',
  vitD: 'mcg', vitA: 'mcg',
};
const TO_GRAMS = { G: 1, MG: 1e-3, UG: 1e-6, MCG: 1e-6, 'µG': 1e-6 };
const GRAMS_PER = { g: 1, mg: 1e-3, mcg: 1e-6 };

function convertMass(value, fromUnit, toUnit, key) {
  const from = String(fromUnit || '').toUpperCase();
  if (key === 'vitD' && from === 'IU') return value / 40;
  if (!(from in TO_GRAMS)) return undefined;
  return (value * TO_GRAMS[from]) / GRAMS_PER[toUnit];
}

// Handles both shapes FoodData Central uses for nutrient rows.
function readFoodNutrients(list) {
  const out = {};
  for (const row of list || []) {
    const id = row.nutrientId ?? row.nutrient?.id;
    const number = String(row.nutrientNumber ?? row.nutrient?.number ?? '');
    const key = FDC_BY_ID[id] ?? FDC_BY_NUMBER[number];
    if (!key) continue;
    const value = num(row.value ?? row.amount);
    if (value === undefined) continue;
    const unit = row.unitName ?? row.nutrient?.unitName;
    if (key === 'kcal') {
      if (String(unit).toUpperCase() !== 'KCAL') continue;
      out.kcal = value;
    } else {
      const v = convertMass(value, unit, TARGET_UNIT[key], key);
      if (v !== undefined && out[key] === undefined) out[key] = v;
    }
  }
  return out;
}

const LABEL_KEYS = {
  calories: 'kcal', protein: 'protein', carbohydrates: 'carbs', fat: 'fat', saturatedFat: 'satFat',
  fiber: 'fiber', sugars: 'sugars', sodium: 'sodium', cholesterol: 'cholesterol',
  potassium: 'potassium', calcium: 'calcium', iron: 'iron',
};

export function parseUsdaFood(food) {
  const servingSize = num(food.servingSize);
  const unit = String(food.servingSizeUnit || '').toLowerCase();
  const isGrams = unit === 'g' || unit === 'grm';
  const isMl = unit === 'ml' || unit === 'mlt';
  const hasServing = servingSize > 0 && (isGrams || isMl);

  // Branded foods report nutrients per 100 g (or per 100 ml for liquids).
  const per100 = readFoodNutrients(food.foodNutrients);
  const factor = hasServing ? servingSize / 100 : 1;
  const nutrients = {};
  for (const [k, v] of Object.entries(per100)) nutrients[k] = v * factor;

  // When the label's own per-serving numbers are present, they win.
  for (const [labelKey, key] of Object.entries(LABEL_KEYS)) {
    const v = num(food.labelNutrients?.[labelKey]?.value);
    if (v !== undefined) nutrients[key] = v;
  }

  if (nutrients.kcal === undefined) {
    return { state: 'nodata', prefill: { name: titleCase(food.description), brand: titleCase(food.brandName || food.brandOwner), barcode: normalizeBarcode(food.gtinUpc) } };
  }

  const household = String(food.householdServingFullText || '').trim();
  const unitLabel = isMl ? 'ml' : 'g';
  let servingLabel = '100 g';
  if (hasServing) {
    servingLabel = household ? `${household} (${servingSize} ${unitLabel})` : `${servingSize} ${unitLabel}`;
  }

  return {
    state: 'found',
    food: {
      name: titleCase(food.description) || 'Unnamed product',
      brand: titleCase(food.brandName || food.brandOwner),
      barcode: normalizeBarcode(food.gtinUpc),
      servingLabel,
      servingGrams: hasServing ? (isGrams ? servingSize : undefined) : 100,
      nutrients: finish(nutrients),
      source: 'USDA FoodData Central',
    },
  };
}

// Only an exact UPC match counts. Search is fuzzy, so a near miss would log the wrong food.
export function parseUsdaSearch(json, barcode) {
  const want = normalizeBarcode(barcode);
  const match = (json?.foods || []).find((f) => normalizeBarcode(f.gtinUpc) === want);
  return match ? parseUsdaFood(match) : { state: 'notfound' };
}

export async function fetchUsda(barcode, apiKey, { fetchFn = fetch, signal } = {}) {
  const key = apiKey || 'DEMO_KEY';
  const tries = [barcode];
  if (barcode.length === 13 && barcode.startsWith('0')) tries.push(barcode.slice(1));
  for (const code of tries) {
    const url =
      'https://api.nal.usda.gov/fdc/v1/foods/search' +
      `?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(code)}&dataType=Branded&pageSize=10`;
    const res = await fetchFn(url, { signal });
    if (res.status === 429) throw new Error('USDA rate limit reached. Add your own free API key in Profile.');
    if (res.status === 403 || res.status === 401) throw new Error('USDA rejected the API key. Check it in Profile.');
    if (!res.ok) throw new Error(`USDA returned ${res.status}`);
    const parsed = parseUsdaSearch(await res.json(), barcode);
    if (parsed.state !== 'notfound') return parsed;
  }
  return { state: 'notfound' };
}

// ---------- Combined lookup ----------

function withTimeout(run, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return run(ctrl.signal).finally(() => clearTimeout(timer));
}

// Returns { status: 'found' | 'partial' | 'notfound' | 'error', food?, prefill?, errors[] }
export async function lookupBarcode(barcode, { fetchFn = fetch, usdaKey = '', timeoutMs = 10000 } = {}) {
  const [usda, off] = await Promise.allSettled([
    withTimeout((signal) => fetchUsda(barcode, usdaKey, { fetchFn, signal }), timeoutMs),
    withTimeout((signal) => fetchOpenFoodFacts(barcode, { fetchFn, signal }), timeoutMs),
  ]);

  const errors = [];
  const results = [];
  for (const [label, r] of [['USDA', usda], ['Open Food Facts', off]]) {
    if (r.status === 'fulfilled') results.push(r.value);
    else errors.push(r.reason?.name === 'AbortError' ? `${label} took too long to answer.` : r.reason?.message || `${label} failed.`);
  }

  const found = results.find((r) => r.state === 'found');
  if (found) return { status: 'found', food: found.food, errors };

  const nodata = results.find((r) => r.state === 'nodata');
  if (nodata) return { status: 'partial', prefill: nodata.prefill, errors };

  if (results.length === 0) return { status: 'error', errors };
  return { status: 'notfound', errors };
}
