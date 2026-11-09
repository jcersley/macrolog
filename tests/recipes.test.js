import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchTotals, batchRawGrams, nutrientsFromBatch, amountOptions, matchAmountOption, nutrientsForAmount } from '../js/nutrition.js';
import { createStore } from '../js/store.js';

const sausage = { name: 'Italian sausage', servingLabel: '2 oz (56 g)', servingGrams: 56, nutrients: { kcal: 160, protein: 9, fat: 13, sodium: 500 } };
const onion = { name: 'Onion', servingLabel: '1 medium (110 g)', servingGrams: 110, portions: [{ label: '1 medium', grams: 110 }, { label: '1 cup, chopped', grams: 160 }], nutrients: { kcal: 44, carbs: 10, fiber: 1.9 } };
const tomatoes = { name: 'Crushed tomatoes', servingLabel: '1/2 cup (122 g)', servingGrams: 122, nutrients: { kcal: 40, carbs: 9, sodium: 230 } };

function ing(food, qty, unit = 'serving', portion = null) {
  const opt = amountOptions(food).find((o) => o.unit === unit && (!portion || o.portion?.label === portion.label));
  return { name: food.name, qty, unit, ...(portion ? { portionLabel: portion.label } : {}), grams: opt?.grams ? qty * opt.grams : null, nutrients: nutrientsForAmount(food, qty, unit, portion) };
}

test('lasagna soup: totals, raw weight, and a 350 g bowl', () => {
  const ingredients = [ing(sausage, 454, 'g'), ing(onion, 1, 'portion', onion.portions[0]), ing(tomatoes, 794, 'g')];
  const totals = batchTotals(ingredients);
  assert.equal(Math.round(totals.kcal), Math.round(160 * (454 / 56) + 44 + 40 * (794 / 122)));
  assert.equal(totals.fiber, 1.9); // only the onion reports fiber
  assert.equal(totals.cholesterol, undefined);
  assert.equal(batchRawGrams(ingredients), 454 + 110 + 794);
  const batch = { totals, cookedGrams: 2400, shares: 6 };
  const bowl = nutrientsFromBatch(batch, 350, 'g');
  assert.equal(Math.round(bowl.kcal), Math.round((totals.kcal * 350) / 2400));
  assert.equal(Math.round(nutrientsFromBatch(batch, 1, 'portion').kcal), Math.round(totals.kcal / 6));
  assert.throws(() => nutrientsFromBatch({ totals, shares: 6 }, 300, 'g'), /Weigh/);
});

test('raw weight is unknown if any ingredient has no weight', () => {
  assert.equal(batchRawGrams([{ grams: 100 }, { grams: null }]), null);
});

test('amount options match a remembered amount', () => {
  const opts = amountOptions(onion);
  assert.deepEqual(opts.map((o) => o.key), ['p0', 'p1', 'g']);
  assert.equal(matchAmountOption(opts, { unit: 'portion', portionLabel: '1 cup, chopped' }).key, 'p1');
  assert.equal(matchAmountOption(opts, { unit: 'g' }).key, 'g');
  assert.deepEqual(amountOptions({ servingLabel: '1 can', nutrients: {} }).map((o) => o.key), ['s']);
});

test('store: recipes with dated batches, latest batch, partial updates, backups', () => {
  const m = new Map();
  const s = createStore({ storage: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) } });
  const r = s.saveRecipe({ name: 'Lasagna soup', tareGrams: 1800 });
  const b1 = s.saveBatch(r.id, { date: '2026-11-08', ingredients: [], cookedGrams: 2400, totals: { kcal: 3000 } });
  const b2 = s.saveBatch(r.id, { date: '2026-11-15', ingredients: [], cookedGrams: 2300, totals: { kcal: 2600 } });
  assert.equal(s.latestBatch(s.state.recipes[0]).id, b2.id);
  s.saveBatch(r.id, { ...b1, cookedGrams: 2500 });
  assert.equal(s.state.recipes[0].batches.length, 2);
  assert.equal(s.state.recipes[0].batches.find((b) => b.id === b1.id).cookedGrams, 2500);
  const renamed = s.saveRecipe({ id: r.id, name: 'Lasagna soup (turkey)' });
  assert.equal(renamed.tareGrams, 1800);
  assert.equal(renamed.batches.length, 2);
  s.addEntry({ date: '2026-11-15', slot: 'dinner', kind: 'recipe', recipeId: r.id, batchId: b2.id, name: 'Lasagna soup', qty: 350, unit: 'g', nutrients: { kcal: 396 } });
  assert.equal(s.entriesForBatch(b2.id).length, 1);
  assert.equal(s.recentFor('dinner', { today: '2026-11-16' })[0].key, `r:${r.id}`);
  s.deleteBatch(r.id, b1.id);
  assert.equal(s.state.recipes[0].batches.length, 1);
  const restored = createStore({ storage: { getItem: () => null, setItem() {} } });
  restored.importJSON(s.exportJSON());
  assert.equal(restored.state.recipes[0].batches[0].cookedGrams, 2300);
  s.deleteRecipe(r.id);
  assert.equal(s.state.recipes.length, 0);
  assert.equal(s.recentFor('dinner', { today: '2026-11-16' }).length, 0);
});
