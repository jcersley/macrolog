// Fixtures follow the documented response shapes of USDA FoodData Central and Open Food Facts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenFoodFacts, parseUsdaSearch, lookupBarcode } from '../js/lookup.js';

const usdaSearch = {
  foods: [
    {
      fdcId: 1,
      description: 'CHEERIOS WHOLE GRAIN OAT CEREAL ALMOST GLUTEN FREE',
      gtinUpc: '016000275287',
      brandOwner: 'General Mills Sales Inc.',
      brandName: 'CHEERIOS',
      servingSize: 39,
      servingSizeUnit: 'g',
      householdServingFullText: '1.5 cup',
      foodNutrients: [
        { nutrientId: 1008, nutrientNumber: '208', unitName: 'KCAL', value: 359 },
        { nutrientId: 1003, nutrientNumber: '203', unitName: 'G', value: 12.8 },
        { nutrientId: 1005, nutrientNumber: '205', unitName: 'G', value: 74.4 },
        { nutrientId: 1004, nutrientNumber: '204', unitName: 'G', value: 5.13 },
        { nutrientId: 1079, nutrientNumber: '291', unitName: 'G', value: 10.3 },
        { nutrientId: 1093, nutrientNumber: '307', unitName: 'MG', value: 487 },
        { nutrientId: 1089, nutrientNumber: '303', unitName: 'MG', value: 32.3 },
        { nutrientId: 1114, nutrientNumber: '328', unitName: 'UG', value: 3.6 },
        { nutrientId: 1235, nutrientNumber: '539', unitName: 'G', value: 5.13 },
      ],
    },
    { fdcId: 2, description: 'SOMETHING ELSE', gtinUpc: '016000275999', foodNutrients: [] },
  ],
};

test('USDA: exact UPC match, scaled from per-100 g to per serving', () => {
  const r = parseUsdaSearch(usdaSearch, '0016000275287');
  assert.equal(r.state, 'found');
  assert.equal(r.food.name, 'Cheerios Whole Grain Oat Cereal Almost Gluten Free');
  assert.equal(r.food.brand, 'Cheerios');
  assert.equal(r.food.servingGrams, 39);
  assert.equal(r.food.servingLabel, '1.5 cup (39 g)');
  assert.equal(r.food.nutrients.kcal, 140);
  assert.equal(r.food.nutrients.protein, 5);
  assert.equal(r.food.nutrients.sodium, 190);
  assert.equal(r.food.nutrients.fiber, 4);
  assert.equal(r.food.nutrients.vitD, 1.4);
  assert.equal(r.food.nutrients.cholesterol, undefined);
});

test('USDA: labelNutrients win over computed values', () => {
  const food = { ...usdaSearch.foods[0], labelNutrients: { calories: { value: 140 }, sodium: { value: 190 }, protein: { value: 5 } } };
  const r = parseUsdaSearch({ foods: [food] }, '016000275287');
  assert.equal(r.food.nutrients.kcal, 140);
  assert.equal(r.food.nutrients.sodium, 190);
});

test('USDA: a fuzzy near-miss is not accepted', () => {
  assert.equal(parseUsdaSearch(usdaSearch, '016000275280').state, 'notfound');
});

test('USDA: the alternate nutrient shape (nested nutrient, amount) parses', () => {
  const food = {
    description: 'Milk', gtinUpc: '070038000563', servingSize: 240, servingSizeUnit: 'ml',
    foodNutrients: [
      { nutrient: { id: 1008, number: '208', unitName: 'kcal' }, amount: 42 },
      { nutrient: { id: 1003, number: '203', unitName: 'g' }, amount: 3.4 },
    ],
  };
  const r = parseUsdaSearch({ foods: [food] }, '070038000563');
  assert.equal(r.state, 'found');
  assert.equal(r.food.nutrients.kcal, 101);
  assert.equal(r.food.servingGrams, undefined);
  assert.equal(r.food.servingLabel, '240 ml');
});

test('Open Food Facts: per-serving values with unit conversions', () => {
  const json = {
    status: 1,
    product: {
      code: '0028400090858',
      product_name: 'Classic Potato Chips',
      brands: 'Lay\'s, PepsiCo',
      serving_size: '1 oz (28 g)',
      serving_quantity: 28,
      nutriments: {
        'energy-kcal_serving': 160, 'proteins_serving': 2, 'carbohydrates_serving': 15, 'fat_serving': 10,
        'saturated-fat_serving': 1.5, 'fiber_serving': 1, 'sodium_serving': 0.17, 'cholesterol_serving': 0,
        'potassium_serving': 0.35, 'vitamin-d_serving': 0,
      },
    },
  };
  const r = parseOpenFoodFacts(json, '0028400090858');
  assert.equal(r.state, 'found');
  assert.equal(r.food.brand, "Lay's");
  assert.equal(r.food.servingLabel, '1 oz (28 g)');
  assert.equal(r.food.nutrients.kcal, 160);
  assert.equal(r.food.nutrients.sodium, 170);
  assert.equal(r.food.nutrients.potassium, 350);
  assert.equal(r.food.nutrients.cholesterol, 0);
});

test('Open Food Facts: falls back to per 100 g, salt to sodium, kJ to kcal', () => {
  const json = { status: 1, product: { code: '1', product_name: 'Crackers', nutriments: { energy_100g: 2000, salt_100g: 1.5, proteins_100g: 9 } } };
  const r = parseOpenFoodFacts(json, '1');
  assert.equal(r.food.servingLabel, '100 g');
  assert.equal(r.food.servingGrams, 100);
  assert.equal(r.food.nutrients.kcal, 478);
  assert.equal(r.food.nutrients.sodium, 600);
});

test('Open Food Facts: product with no nutrition is partial', () => {
  const r = parseOpenFoodFacts({ status: 1, product: { product_name: 'Mystery', brands: 'Acme', nutriments: {} } }, '123');
  assert.equal(r.state, 'nodata');
  assert.equal(r.prefill.name, 'Mystery');
});

const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('combined lookup prefers a found result and reports failures', async () => {
  const fetchFn = async (url) => {
    if (url.includes('nal.usda.gov')) return res(429, {});
    return res(200, { status: 1, product: { code: '123', product_name: 'Bar', nutriments: { 'energy-kcal_100g': 400 } } });
  };
  const r = await lookupBarcode('123', { fetchFn });
  assert.equal(r.status, 'found');
  assert.equal(r.food.source, 'Open Food Facts');
  assert.match(r.errors[0], /rate limit/);
});

test('combined lookup: not found in either', async () => {
  const fetchFn = async (url) => (url.includes('nal.usda.gov') ? res(200, { foods: [] }) : res(404, {}));
  assert.equal((await lookupBarcode('000000000000', { fetchFn })).status, 'notfound');
});

test('combined lookup: both offline', async () => {
  const fetchFn = async () => {
    throw new TypeError('Failed to fetch');
  };
  const r = await lookupBarcode('123', { fetchFn });
  assert.equal(r.status, 'error');
  assert.equal(r.errors.length, 2);
});
