// Fixtures follow USDA FoodData Central's food_portion fields
// (amount, measureUnit, modifier, portionDescription, gramWeight, sequenceNumber).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usdaPortionLabel, parseUsdaPortions, parseUsdaGeneric, fetchUsdaFood } from '../js/lookup.js';
import { nutrientsForAmount, describeAmount } from '../js/nutrition.js';

const eggNutrients = [
  { nutrient: { id: 2048, number: '958', unitName: 'kcal' }, amount: 148 },
  { nutrient: { id: 1003, number: '203', unitName: 'g' }, amount: 12.4 },
  { nutrient: { id: 1004, number: '204', unitName: 'g' }, amount: 9.96 },
  { nutrient: { id: 1253, number: '601', unitName: 'mg' }, amount: 411 },
];

const foundationEgg = {
  fdcId: 748967,
  description: 'Eggs, Grade A, Large, egg whole',
  dataType: 'Foundation',
  foodNutrients: eggNutrients,
  foodPortions: [
    { sequenceNumber: 2, amount: 1, measureUnit: { name: 'cup' }, modifier: '', gramWeight: 243 },
    { sequenceNumber: 1, amount: 1, measureUnit: { name: 'undetermined' }, modifier: 'large', portionDescription: '', gramWeight: 50 },
    { sequenceNumber: 3, amount: 1, measureUnit: { name: 'undetermined' }, portionDescription: 'Quantity not specified', gramWeight: 50 },
  ],
};

test('portion labels across USDA datasets', () => {
  assert.equal(usdaPortionLabel({ amount: 1, measureUnit: { name: 'undetermined' }, modifier: 'large', gramWeight: 50 }), '1 large');
  assert.equal(usdaPortionLabel({ amount: 1, measureUnit: { name: 'cup' }, modifier: 'chopped', gramWeight: 136 }), '1 cup chopped');
  assert.equal(usdaPortionLabel({ amount: 0.5, measureUnit: { name: 'cup' }, gramWeight: 68 }), '0.5 cup');
  // FNDDS: the description is the measure, modifier is a code.
  assert.equal(usdaPortionLabel({ portionDescription: '1 medium', modifier: '10205', measureUnit: { name: 'undetermined' }, gramWeight: 118 }), '1 medium');
  // Search-result measures.
  assert.equal(usdaPortionLabel({ disseminationText: '1 slice', gramWeight: 28 }), '1 slice');
});

test('portions are ordered, deduplicated and skip "quantity not specified"', () => {
  const p = parseUsdaPortions(foundationEgg);
  assert.deepEqual(p, [
    { label: '1 large', grams: 50 },
    { label: '1 cup', grams: 243 },
  ]);
});

test('a USDA egg defaults to 1 large, not 100 g, and keeps every portion', () => {
  const egg = parseUsdaGeneric(foundationEgg);
  assert.equal(egg.servingLabel, '1 large (50 g)');
  assert.equal(egg.servingGrams, 50);
  assert.equal(egg.nutrients.kcal, 74);
  assert.equal(egg.portions.length, 2);
  assert.equal(egg.fdcId, 748967);
  // Two large eggs, one cup, and 100 g.
  assert.equal(nutrientsForAmount(egg, 2, 'portion', egg.portions[0]).kcal, 148);
  assert.equal(Math.round(nutrientsForAmount(egg, 1, 'portion', egg.portions[1]).kcal), 360);
  assert.equal(nutrientsForAmount(egg, 100, 'g').kcal, 148);
  assert.equal(describeAmount(egg, 2, 'portion', '1 large'), '2 × 1 large');
  assert.equal(describeAmount(egg, 1, 'portion', '1 large'), '1 large');
});

test('a food with no portions still falls back to 100 g', () => {
  const f = parseUsdaGeneric({ description: 'Something', foodNutrients: eggNutrients });
  assert.equal(f.servingLabel, '100 g');
  assert.equal(f.portions, undefined);
});

test('details request hits the single-food endpoint and parses portions', async () => {
  let url = '';
  const fetchFn = async (u) => {
    url = u;
    return { ok: true, status: 200, json: async () => foundationEgg };
  };
  const egg = await fetchUsdaFood(748967, 'KEY', { fetchFn });
  assert.match(url, /\/fdc\/v1\/food\/748967\?api_key=KEY$/);
  assert.equal(egg.portions[0].label, '1 large');
  await assert.rejects(fetchUsdaFood(1, '', { fetchFn: async () => ({ ok: false, status: 429 }) }), /rate limit/);
});
