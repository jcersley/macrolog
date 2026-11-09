import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bmr, computeGoals, lbToKg, ftInToCm, cmToFtIn, scaleNutrients, sumNutrients, nutrientsForAmount, mealPerServing,
  normalizeBarcode, gtinCheckDigitValid, upceToUpca, shouldPromptWeighIn, weightTrend, weeklyRate, estimatedGoalDate,
  addDays, daysBetween,
} from '../js/nutrition.js';

const jon = { sex: 'male', age: 31, heightCm: ftInToCm(5, 10), weightKg: lbToKg(220), activity: 'moderate', rateKgPerWeek: lbToKg(1) };

test('Mifflin-St Jeor BMR', () => {
  assert.equal(Math.round(bmr({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 })), 1780);
  assert.equal(Math.round(bmr({ sex: 'female', weightKg: 60, heightCm: 165, age: 30 })), 1320);
});

test('goals for a 220 lb, 5\'10", 31-year-old, moderately active man losing 1 lb a week', () => {
  const g = computeGoals(jon);
  assert.equal(g.ok, true);
  assert.equal(Math.round(g.tdee), 3037);
  assert.equal(g.targets.kcal, 2540);
  assert.equal(g.targets.protein, 160);
  assert.equal(g.targets.fat, 70);
  assert.equal(g.targets.carbs, 320);
  assert.equal(g.targets.fiber, 36);
  assert.equal(g.targets.addedSugars, 50);
  assert.equal(g.targets.satFat, 28);
  assert.equal(g.targets.sodium, 2300);
  assert.equal(g.targets.potassium, 3400);
  assert.equal(g.targets.iron, 8);
  assert.equal(g.warnings.length, 0);
  // Macro calories land within rounding of the calorie goal.
  const fromMacros = g.targets.protein * 4 + g.targets.carbs * 4 + g.targets.fat * 9;
  assert.ok(Math.abs(fromMacros - g.targets.kcal) <= 40, `macros give ${fromMacros}`);
});

test('calorie floor and warnings for an aggressive rate', () => {
  const g = computeGoals({ sex: 'female', age: 40, heightCm: 160, weightKg: 60, activity: 'sedentary', rateKgPerWeek: lbToKg(2) });
  assert.equal(g.ok, true);
  assert.equal(g.targets.kcal, 1200);
  assert.equal(g.flooredByMinimum, true);
  assert.ok(g.effectiveRateKg < lbToKg(2));
  assert.ok(g.warnings.length >= 2);
  assert.equal(g.targets.iron, 18);
  assert.ok(g.targets.carbs >= 100 || g.targets.fat === Math.round((0.2 * 1200) / 9 / 5) * 5);
});

test('maintenance has no deficit', () => {
  const g = computeGoals({ ...jon, rateKgPerWeek: 0 });
  assert.equal(g.dailyDeficit < 10, true);
});

test('invalid profiles return errors instead of numbers', () => {
  const g = computeGoals({ ...jon, age: 15, sex: '' });
  assert.equal(g.ok, false);
  assert.equal(g.errors.length, 2);
});

test('height conversion round-trips', () => {
  assert.deepEqual(cmToFtIn(ftInToCm(5, 10)), { ft: 5, inches: 10 });
  assert.deepEqual(cmToFtIn(ftInToCm(6, 0)), { ft: 6, inches: 0 });
});

test('missing nutrients stay missing when scaling and summing', () => {
  const s = scaleNutrients({ kcal: 100, protein: 5, sodium: undefined }, 2);
  assert.deepEqual(s, { kcal: 200, protein: 10 });
  const sum = sumNutrients([{ kcal: 100, fiber: 3 }, { kcal: 50 }]);
  assert.equal(sum.totals.kcal, 150);
  assert.equal(sum.totals.fiber, 3);
  assert.equal(sum.reported.fiber, 1);
  assert.equal(sum.count, 2);
});

test('logging by grams uses the serving weight', () => {
  const food = { servingGrams: 40, nutrients: { kcal: 200, protein: 8 } };
  assert.deepEqual(nutrientsForAmount(food, 60, 'g'), { kcal: 300, protein: 12 });
  assert.deepEqual(nutrientsForAmount(food, 0.5), { kcal: 100, protein: 4 });
  assert.throws(() => nutrientsForAmount({ nutrients: {} }, 10, 'g'));
});

test('meal per-serving divides the batch', () => {
  const items = [
    { servings: 2, nutrients: { kcal: 150, protein: 30 } },
    { servings: 1, nutrients: { kcal: 200, protein: 4, fiber: 2 } },
  ];
  assert.deepEqual(mealPerServing(items, 4), { kcal: 125, protein: 16, fiber: 0.5 });
});

test('barcodes', () => {
  assert.equal(normalizeBarcode('0 12345 67890 5'), '12345678905');
  assert.equal(normalizeBarcode('0012345678905'), normalizeBarcode('012345678905'));
  assert.equal(gtinCheckDigitValid('036000291452'), true);
  assert.equal(gtinCheckDigitValid('036000291453'), false);
  assert.equal(gtinCheckDigitValid('4006381333931'), true);
  assert.equal(gtinCheckDigitValid('96385074'), true);
  assert.equal(upceToUpca('04252614'), '042100005264');
  assert.equal(gtinCheckDigitValid(upceToUpca('04252614')), true);
  assert.equal(upceToUpca('01234565'), '012345000065');
  assert.equal(upceToUpca('22345678'), null);
  assert.equal(upceToUpca('1234567'), null);
});

test('Monday weigh-in prompt', () => {
  const monday = new Date(2026, 10, 9, 7, 30);
  const sunday = new Date(2026, 10, 8, 7, 30);
  assert.equal(shouldPromptWeighIn({ now: monday, weights: [], dismissedKey: '' }), true);
  assert.equal(shouldPromptWeighIn({ now: sunday, weights: [], dismissedKey: '' }), false);
  assert.equal(shouldPromptWeighIn({ now: monday, weights: [{ date: '2026-11-09', kg: 99 }], dismissedKey: '' }), false);
  assert.equal(shouldPromptWeighIn({ now: monday, weights: [{ date: '2026-11-02', kg: 99 }], dismissedKey: '2026-11-09' }), false);
  assert.equal(shouldPromptWeighIn({ now: monday, weights: [{ date: '2026-11-02', kg: 99 }], dismissedKey: '2026-11-02' }), true);
});

test('weight trend and weekly rate', () => {
  const start = '2026-10-01';
  const weights = [];
  for (let i = 0; i <= 28; i += 2) weights.push({ date: addDays(start, i), kg: 100 - (i / 7) * 0.5 + (i % 4 ? 0.3 : -0.3) });
  const trend = weightTrend(weights);
  assert.equal(trend.length, weights.length);
  const rate = weeklyRate(weights, 28, addDays(start, 28));
  assert.ok(rate < -0.4 && rate > -0.6, `rate ${rate}`);
  assert.equal(weeklyRate(weights.slice(0, 2), 28, addDays(start, 2)), null);
  assert.equal(estimatedGoalDate({ currentKg: 100, goalKg: 95, rateKgPerWeek: 0.5, today: '2026-11-08' }), addDays('2026-11-08', 70));
  assert.equal(estimatedGoalDate({ currentKg: 100, goalKg: 105, rateKgPerWeek: 0.5 }), null);
});

test('date helpers cross month and DST boundaries', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-11-01', 7), '2026-11-08');
  assert.equal(daysBetween('2026-10-25', '2026-11-08'), 14);
});
