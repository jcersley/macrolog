import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';
import { weightChart, calorieBars } from '../js/charts.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};

test('foods, barcode lookup, diary and persistence', () => {
  const storage = memory();
  const s = createStore({ storage });
  const f = s.saveFood({ name: 'Yogurt', barcode: '036000291452', servingLabel: '1 cup', nutrients: { kcal: 150 } });
  assert.equal(s.findFoodByBarcode('0036000291452').id, f.id);
  s.addEntry({ date: '2026-11-08', slot: 'breakfast', name: 'Yogurt', qty: 1, unit: 'serving', nutrients: { kcal: 150 } });
  const again = createStore({ storage });
  assert.equal(again.state.foods.length, 1);
  assert.equal(again.entriesForDate('2026-11-08').length, 1);
});

test('profile save records a weigh-in only when weight changes', () => {
  const s = createStore({ storage: memory() });
  const p = { sex: 'male', age: 31, heightCm: 178, weightKg: 100, activity: 'moderate', rateKgPerWeek: 0.45 };
  s.saveProfile(p, '2026-11-08');
  s.saveProfile({ ...p, age: 32 }, '2026-11-09');
  assert.equal(s.state.weights.length, 1);
  s.setWeight('2026-11-09', 99);
  assert.equal(s.state.profile.weightKg, 99);
});

test('backup round-trip and bad files', () => {
  const a = createStore({ storage: memory() });
  a.saveFood({ name: 'Rice', nutrients: { kcal: 200 } });
  const b = createStore({ storage: memory() });
  assert.equal(b.importJSON('nope').ok, false);
  assert.equal(b.importJSON('{"hello":1}').ok, false);
  const r = b.importJSON(a.exportJSON());
  assert.equal(r.ok, true);
  assert.equal(b.state.foods[0].name, 'Rice');
});

test('charts produce valid SVG without NaN', () => {
  const svg = weightChart({
    points: [{ date: '2026-10-01', kg: 100 }, { date: '2026-10-15', kg: 99 }, { date: '2026-11-01', kg: 98 }],
    trend: [{ date: '2026-10-01', kg: 100 }, { date: '2026-11-01', kg: 98.5 }],
    pace: { rateKgPerWeek: 0.45 },
    goalKg: 90,
  });
  assert.match(svg, /^<svg/);
  assert.doesNotMatch(svg, /NaN|undefined/);
  const one = weightChart({ points: [{ date: '2026-10-01', kg: 100 }], trend: [] });
  assert.doesNotMatch(one, /NaN|undefined/);
  const bars = calorieBars({ days: [{ date: '2026-11-07', kcal: null }, { date: '2026-11-08', kcal: 2600 }], goal: 2540 });
  assert.match(bars, /bar over/);
  assert.doesNotMatch(bars, /NaN|undefined/);
});
