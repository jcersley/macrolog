import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeGoals, estimateMaintenance, weekSummary, weekStart, addDays, lbToKg, ftInToCm } from '../js/nutrition.js';
import { createStore } from '../js/store.js';

const base = { sex: 'male', age: 31, heightCm: ftInToCm(5, 10), weightKg: lbToKg(220), activity: 'moderate', rateKgPerWeek: lbToKg(1) };

test('custom calorie goal replaces the computed one and drives everything else', () => {
  const g = computeGoals({ ...base, calorieMode: 'custom', customKcal: 2200 });
  assert.equal(g.targets.kcal, 2200);
  assert.equal(g.calorieMode, 'custom');
  assert.equal(g.targets.fiber, Math.max(30, Math.round(14 * 2.2)));
  assert.ok(g.effectiveRateKg > 0);
  assert.equal(g.basis.kcal, 'You set this number.');
  const low = computeGoals({ ...base, calorieMode: 'custom', customKcal: 1300 });
  assert.equal(low.targets.kcal, 1300);
  assert.ok(low.warnings.some((w) => w.includes('usual minimum')));
  const surplus = computeGoals({ ...base, calorieMode: 'custom', customKcal: 3400 });
  assert.ok(surplus.dailySurplus > 300);
  assert.equal(computeGoals({ ...base, calorieMode: 'custom', customKcal: 300 }).ok, false);
});

test('maintenance from data replaces the formula', () => {
  const g = computeGoals({ ...base, maintenanceSource: 'data', maintenanceKcal: 3300 });
  assert.equal(g.tdee, 3300);
  assert.equal(g.targets.kcal, 2800);
  assert.equal(g.maintenanceSource, 'data');
  assert.equal(computeGoals({ ...base, maintenanceSource: 'formula', maintenanceKcal: 3300 }).maintenanceSource, 'formula');
});

function history({ days = 28, kcal = 2500, lossKgPerWeek = 0.5, today = '2026-11-28', weighEvery = 3, complete = true }) {
  const log = [];
  const dayStatus = {};
  const weights = [];
  for (let i = days; i >= 1; i--) {
    const d = addDays(today, -i);
    log.push({ date: d, nutrients: { kcal: kcal * 0.6 } }, { date: d, nutrients: { kcal: kcal * 0.4 } });
    if (complete) dayStatus[d] = 'complete';
  }
  for (let i = days; i >= 0; i -= weighEvery) weights.push({ date: addDays(today, -i), kg: 100 - ((days - i) / 7) * lossKgPerWeek });
  return { log, dayStatus, weights, today };
}

test('maintenance estimate from intake and weight trend', () => {
  const h = history({});
  const est = estimateMaintenance(h);
  assert.equal(est.ok, true);
  assert.equal(est.maintenance, 3050); // 2,500 eaten + 0.5 kg/wk x 7,716 / 7
  assert.equal(est.confidence, 'good');
  const gaining = estimateMaintenance(history({ lossKgPerWeek: -0.25 }));
  assert.equal(gaining.maintenance, Math.round((2500 - (0.25 * 3500 * 2.2046226218) / 7) / 10) * 10);
});

test('maintenance estimate waits for enough data and ignores incomplete days', () => {
  assert.equal(estimateMaintenance(history({ complete: false })).ok, false);
  const short = estimateMaintenance(history({ days: 8 }));
  assert.equal(short.ok, false);
  assert.equal(short.completeDays, 8);
  // A partial day with tiny intake must not drag the average down.
  const h = history({});
  h.log.push({ date: addDays(h.today, -2), nutrients: { kcal: -0 } });
  h.dayStatus[addDays(h.today, -3)] = 'partial';
  const est = estimateMaintenance(h);
  assert.equal(est.completeDays, 27);
  assert.equal(est.maintenance, 3050);
});

test('week runs Monday to Sunday', () => {
  assert.equal(weekStart('2026-11-11'), '2026-11-09'); // Wednesday
  assert.equal(weekStart('2026-11-09'), '2026-11-09'); // Monday
  assert.equal(weekStart('2026-11-15'), '2026-11-09'); // Sunday
});

test('week budget: unlogged days count as on goal, rest-of-week average', () => {
  const log = [
    { date: '2026-11-09', nutrients: { kcal: 2000 } }, // Mon, 500 under
    { date: '2026-11-11', nutrients: { kcal: 1000 } }, // Wed (today so far)
  ];
  const w = weekSummary({ log, dayStatus: {}, goalKcal: 2500, date: '2026-11-11' });
  assert.equal(w.budget, 17500);
  assert.equal(w.assumed, 1); // Tuesday unlogged
  assert.equal(w.used, 2000 + 2500 + 1000);
  assert.equal(w.left, 17500 - 5500);
  assert.equal(w.remainingDays, 5);
  assert.equal(w.perDayRest, (17500 - 4500) / 5);
  const partial = weekSummary({ log, dayStatus: { '2026-11-09': 'partial' }, goalKcal: 2500, date: '2026-11-11' });
  assert.equal(partial.assumed, 2);
});

test('store keeps waist and day status, and backups carry them', () => {
  const m = new Map();
  const storage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
  const s = createStore({ storage });
  s.setWaist('2026-11-09', 100);
  s.setWaist('2026-11-09', 99);
  s.setDayStatus('2026-11-08', 'complete');
  s.setDayStatus('2026-11-07', 'partial');
  s.setDayStatus('2026-11-07', '');
  assert.deepEqual(s.state.waists, [{ date: '2026-11-09', cm: 99 }]);
  assert.deepEqual(s.state.dayStatus, { '2026-11-08': 'complete' });
  const b = createStore({ storage: { getItem: () => null, setItem() {} } });
  b.importJSON(s.exportJSON());
  assert.equal(b.state.waists.length, 1);
  assert.equal(b.state.dayStatus['2026-11-08'], 'complete');
  // Old backups without these fields still load.
  const old = createStore({ storage: { getItem: () => JSON.stringify({ version: 1, foods: [] }), setItem() {} } });
  assert.deepEqual(old.state.waists, []);
  assert.deepEqual(old.state.dayStatus, {});
});
