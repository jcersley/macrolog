import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';
import { shouldPromptBackup, firstLogDate, snoozeDate } from '../js/backup.js';
import { parseUsdaGeneric, parseUsdaGenericSearch } from '../js/lookup.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};

function seeded() {
  const s = createStore({ storage: memory() });
  const eggs = s.saveFood({ name: 'Eggs', servingLabel: '1 egg', servingGrams: 50, nutrients: { kcal: 70 } });
  const toast = s.saveFood({ name: 'Toast', servingLabel: '1 slice', nutrients: { kcal: 80 } });
  const add = (date, slot, food, qty, unit = 'serving') =>
    s.addEntry({ date, slot, kind: 'food', foodId: food.id, name: food.name, qty, unit, nutrients: { kcal: 70 * qty } });
  add('2026-11-05', 'breakfast', eggs, 2);
  add('2026-11-06', 'breakfast', eggs, 3);
  add('2026-11-06', 'breakfast', toast, 1);
  add('2026-11-07', 'breakfast', eggs, 2);
  add('2026-11-07', 'lunch', toast, 2);
  s.addEntry({ date: '2026-11-07', slot: 'snacks', kind: 'quick', name: 'Protein shake', qty: 1, unit: 'serving', nutrients: { kcal: 160 } });
  s.addEntry({ date: '2026-11-08', slot: 'snacks', kind: 'quick', name: 'Protein shake', qty: 1, unit: 'serving', nutrients: { kcal: 160 } });
  return { s, eggs, toast };
}

test('recent foods are per meal, most frequent first, with the latest amount', () => {
  const { s, eggs, toast } = seeded();
  const r = s.recentFor('breakfast', { today: '2026-11-08' });
  assert.deepEqual(r.map((g) => g.last.name), ['Eggs', 'Toast']);
  assert.equal(r[0].count, 3);
  assert.equal(r[0].last.qty, 2);
  assert.equal(s.recentFor('lunch', { today: '2026-11-08' })[0].last.foodId, toast.id);
  const snacks = s.recentFor('snacks', { today: '2026-11-08' });
  assert.equal(snacks.length, 1);
  assert.equal(snacks[0].count, 2);
  assert.equal(s.recentFor('dinner', { today: '2026-11-08' }).length, 0);
  assert.equal(s.recentFor(null, { today: '2026-11-08' }).length, 3);
  // Older than 30 days drops off; deleted foods drop off.
  assert.equal(s.recentFor('breakfast', { today: '2026-12-20' }).length, 0);
  s.deleteFood(eggs.id);
  assert.deepEqual(s.recentFor('breakfast', { today: '2026-11-08' }).map((g) => g.last.name), ['Toast']);
});

test('last amount remembers quantity and unit', () => {
  const { s, eggs, toast } = seeded();
  assert.deepEqual(s.lastAmount(eggs.id), { qty: 2, unit: 'serving', portionLabel: '' });
  s.addEntry({ date: '2026-11-08', slot: 'breakfast', kind: 'food', foodId: eggs.id, name: 'Eggs', qty: 120, unit: 'g', nutrients: {} });
  assert.deepEqual(s.lastAmount(eggs.id), { qty: 120, unit: 'g', portionLabel: '' });
  assert.equal(s.lastAmount('nope'), null);
  assert.deepEqual(s.lastAmount(toast.id), { qty: 2, unit: 'serving', portionLabel: '' });
});

test('batch add and delete for copying a meal', () => {
  const { s } = seeded();
  const before = s.state.log.length;
  const recs = s.addEntries([{ date: '2026-11-08', slot: 'lunch', name: 'A', nutrients: {} }, { date: '2026-11-08', slot: 'lunch', name: 'B', nutrients: {} }]);
  assert.equal(s.state.log.length, before + 2);
  assert.notEqual(recs[0].id, recs[1].id);
  s.deleteEntries(recs.map((r) => r.id));
  assert.equal(s.state.log.length, before);
});

test('backup reminder timing', () => {
  assert.equal(shouldPromptBackup({ today: '2026-11-08', firstLogDate: '' }), false);
  assert.equal(shouldPromptBackup({ today: '2026-11-08', firstLogDate: '2026-10-20' }), false);
  assert.equal(shouldPromptBackup({ today: '2026-11-19', firstLogDate: '2026-10-20' }), true);
  assert.equal(shouldPromptBackup({ today: '2026-11-19', firstLogDate: '2026-09-01', lastBackup: '2026-11-01' }), false);
  assert.equal(shouldPromptBackup({ today: '2026-12-01', firstLogDate: '2026-09-01', lastBackup: '2026-11-01' }), true);
  assert.equal(shouldPromptBackup({ today: '2026-12-01', firstLogDate: '2026-09-01', snoozedUntil: snoozeDate('2026-11-28') }), false);
  assert.equal(shouldPromptBackup({ today: '2026-12-05', firstLogDate: '2026-09-01', snoozedUntil: snoozeDate('2026-11-28') }), true);
  assert.equal(firstLogDate([{ date: '2026-11-03' }, { date: '2026-10-30' }]), '2026-10-30');
});

test('USDA generic food: household measure becomes the serving', () => {
  const f = parseUsdaGeneric({
    fdcId: 171477,
    description: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
    dataType: 'SR Legacy',
    foodMeasures: [
      { disseminationText: 'Quantity not specified', gramWeight: 120 },
      { disseminationText: '1 cup, chopped or diced', gramWeight: 140 },
    ],
    foodNutrients: [
      { nutrientId: 1008, unitName: 'KCAL', value: 165 },
      { nutrientId: 1003, unitName: 'G', value: 31 },
      { nutrientId: 1004, unitName: 'G', value: 3.57 },
      { nutrientId: 1093, unitName: 'MG', value: 74 },
    ],
  });
  assert.equal(f.servingLabel, '1 cup, chopped or diced (140 g)');
  assert.equal(f.servingGrams, 140);
  assert.equal(f.nutrients.kcal, 231);
  assert.equal(f.nutrients.protein, 43.4);
  assert.equal(f.nutrients.sodium, 104);
});

test('USDA generic food: Foundation energy via Atwater, falls back to 100 g', () => {
  const f = parseUsdaGeneric({
    description: 'Bananas, ripe and slightly ripe, raw',
    foodNutrients: [
      { nutrientId: 2047, nutrientNumber: '957', unitName: 'KCAL', value: 98 },
      { nutrientId: 2048, nutrientNumber: '958', unitName: 'KCAL', value: 97 },
      { nutrientId: 1003, unitName: 'G', value: 0.74 },
    ],
  });
  assert.equal(f.servingLabel, '100 g');
  assert.equal(f.nutrients.kcal, 97);
  assert.equal(parseUsdaGeneric({ description: 'No energy', foodNutrients: [] }), null);
});

test('USDA generic search drops duplicates and foods without calories', () => {
  const row = (d, kcal) => ({ description: d, foodNutrients: kcal ? [{ nutrientId: 1008, unitName: 'KCAL', value: kcal }] : [] });
  const out = parseUsdaGenericSearch({ foods: [row('Rice, white, cooked', 130), row('RICE, WHITE, COOKED', 130), row('Rice bran', 0)] });
  assert.equal(out.length, 1);
});
