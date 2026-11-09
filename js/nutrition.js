// Pure nutrition math. No DOM, no storage, so the app and the Node tests share it.

export const LB_PER_KG = 2.2046226218;
export const KCAL_PER_LB_FAT = 3500;

export const kgToLb = (kg) => kg * LB_PER_KG;
export const lbToKg = (lb) => lb / LB_PER_KG;
export const cmToIn = (cm) => cm / 2.54;
export const inToCm = (inches) => inches * 2.54;
export const ftInToCm = (ft, inches) => inToCm(ft * 12 + inches);
export function cmToFtIn(cm) {
  const total = Math.round(cmToIn(cm));
  return { ft: Math.floor(total / 12), inches: total % 12 };
}

export const ACTIVITY = [
  { id: 'sedentary', label: 'Sedentary', hint: 'Desk job, little exercise', factor: 1.2 },
  { id: 'light', label: 'Lightly active', hint: 'On your feet part of the day, or exercise 1–3 days a week', factor: 1.375 },
  { id: 'moderate', label: 'Moderately active', hint: 'On your feet most of the day (trade work, for example), or exercise 3–5 days a week', factor: 1.55 },
  { id: 'very', label: 'Very active', hint: 'Heavy physical work plus regular training', factor: 1.725 },
];

// Weekly loss options, stored in kg/week. Shown to the person in lb or kg.
export const RATE_OPTIONS_LB = [0, 0.5, 1, 1.5, 2];

// Every nutrient the app tracks. "per serving" values on foods use these keys.
// kind: 'target' = aim to reach it, 'limit' = try not to exceed it.
export const NUTRIENTS = [
  { key: 'kcal', label: 'Calories', unit: 'kcal', group: 'energy', kind: 'limit', dp: 0 },
  { key: 'protein', label: 'Protein', unit: 'g', group: 'macro', kind: 'target', dp: 0 },
  { key: 'carbs', label: 'Carbs', unit: 'g', group: 'macro', kind: 'target', dp: 0 },
  { key: 'fat', label: 'Fat', unit: 'g', group: 'macro', kind: 'target', dp: 0 },
  { key: 'fiber', label: 'Fiber', unit: 'g', group: 'watch', kind: 'target', dp: 0 },
  { key: 'sugars', label: 'Total sugars', unit: 'g', group: 'none', kind: 'none', dp: 0 },
  { key: 'addedSugars', label: 'Added sugars', unit: 'g', group: 'watch', kind: 'limit', dp: 0 },
  { key: 'satFat', label: 'Saturated fat', unit: 'g', group: 'watch', kind: 'limit', dp: 0 },
  { key: 'sodium', label: 'Sodium', unit: 'mg', group: 'watch', kind: 'limit', dp: 0 },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg', group: 'watch', kind: 'limit', dp: 0 },
  { key: 'potassium', label: 'Potassium', unit: 'mg', group: 'micro', kind: 'target', dp: 0 },
  { key: 'calcium', label: 'Calcium', unit: 'mg', group: 'micro', kind: 'target', dp: 0 },
  { key: 'iron', label: 'Iron', unit: 'mg', group: 'micro', kind: 'target', dp: 1 },
  { key: 'vitD', label: 'Vitamin D', unit: 'mcg', group: 'micro', kind: 'target', dp: 1 },
  { key: 'vitA', label: 'Vitamin A', unit: 'mcg RAE', group: 'micro', kind: 'target', dp: 0 },
  { key: 'vitC', label: 'Vitamin C', unit: 'mg', group: 'micro', kind: 'target', dp: 0 },
];
export const NUTRIENT_KEYS = NUTRIENTS.map((n) => n.key);
export const nutrientMeta = (key) => NUTRIENTS.find((n) => n.key === key);

// ---------- Goals ----------

export function bmr({ sex, weightKg, heightCm, age }) {
  // Mifflin-St Jeor
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

const round = (n, step = 1) => Math.round(n / step) * step;

export function validateProfile(p) {
  const errors = [];
  if (!p) return ['Fill in your profile to get daily goals.'];
  if (p.sex !== 'male' && p.sex !== 'female') errors.push('Choose a sex. The calorie formula needs it.');
  if (!(p.age >= 18 && p.age <= 100)) errors.push('Age must be between 18 and 100. These guidelines are for adults.');
  if (!(p.heightCm >= 120 && p.heightCm <= 230)) errors.push('Enter a height between 120 and 230 cm (3‱9″ to 7‱6″).');
  if (!(p.weightKg >= 35 && p.weightKg <= 300)) errors.push('Enter a weight between 77 and 660 lb (35–300 kg).');
  if (!ACTIVITY.some((a) => a.id === p.activity)) errors.push('Pick an activity level.');
  return errors;
}

export function micronutrientTargets({ sex, age }) {
  const male = sex === 'male';
  const calcium = (!male && age >= 51) || (male && age >= 71) ? 1200 : 1000;
  const iron = !male && age <= 50 ? 18 : 8;
  return {
    potassium: male ? 3400 : 2600,
    calcium,
    iron,
    vitD: age > 70 ? 20 : 15,
    vitA: male ? 900 : 700,
    vitC: male ? 90 : 75,
  };
}

// Returns { ok, errors, warnings, ... } for a profile.
// profile: { sex, age, heightCm, weightKg, activity, rateKgPerWeek }
export function computeGoals(profile) {
  const errors = validateProfile(profile);
  if (errors.length) return { ok: false, errors, warnings: [] };

  const warnings = [];
  const factor = ACTIVITY.find((a) => a.id === profile.activity).factor;
  const bmrKcal = bmr(profile);
  const tdee = bmrKcal * factor;

  const requestedRate = Math.max(0, profile.rateKgPerWeek || 0);
  const requestedDeficit = requestedRate * LB_PER_KG * (KCAL_PER_LB_FAT / 7);

  const floor = profile.sex === 'male' ? 1500 : 1200;
  let calories = round(tdee - requestedDeficit, 10);
  let flooredByMinimum = false;
  if (calories < floor) {
    calories = floor;
    flooredByMinimum = true;
  }
  const dailyDeficit = Math.max(0, tdee - calories);
  const effectiveRateKg = (dailyDeficit * 7) / (KCAL_PER_LB_FAT * LB_PER_KG);

  if (flooredByMinimum) {
    warnings.push(
      `Your chosen rate would put you under ${floor.toLocaleString('en-US')} kcal a day, which is the usual minimum without medical supervision. ` +
        `Your goal is held at ${floor.toLocaleString('en-US')} kcal, so expect a slower loss than you picked.`
    );
  }
  if (requestedRate > 0.01 * profile.weightKg) {
    warnings.push(
      'This rate is more than 1% of your body weight per week. Losing faster than that raises the odds of losing muscle along with fat. Consider a slower rate.'
    );
  }
  if (tdee > 0 && dailyDeficit / tdee > 0.25) {
    warnings.push('Your daily deficit is more than 25% of what you burn. That is hard to sustain for most people.');
  }

  // Macros
  const proteinCap = (0.35 * calories) / 4;
  let proteinG = Math.min(1.6 * profile.weightKg, proteinCap);
  let fatG = (0.25 * calories) / 9;
  let carbsG = (calories - proteinG * 4 - fatG * 9) / 4;
  if (carbsG < 100) {
    fatG = (0.2 * calories) / 9;
    carbsG = (calories - proteinG * 4 - fatG * 9) / 4;
  }
  proteinG = round(proteinG, 5);
  fatG = round(fatG, 5);
  // Carbs fill what's left after the rounded protein and fat, so the three add up.
  carbsG = round(Math.max((calories - proteinG * 4 - fatG * 9) / 4, 0), 5);
  const recommendedMacros = { protein: proteinG, carbs: carbsG, fat: fatG };

  const custom = profile.macroMode === 'custom' && profile.customMacros ? applyCustomMacros(calories, profile.customMacros) : null;
  if (custom) {
    ({ protein: proteinG, carbs: carbsG, fat: fatG } = custom.macros);
    const names = { protein: 'Protein', carbs: 'Carbs', fat: 'Fat' };
    if (custom.overBy > 0) {
      warnings.push(
        `The macros you set add up to ${Math.round(custom.overBy).toLocaleString('en-US')} kcal more than your calorie goal, so ${names[custom.fill].toLowerCase()} is at 0 g. Lower one of them.`
      );
    }
    if (proteinG < 0.8 * profile.weightKg) {
      warnings.push(`Protein is under 0.8 g per kg of body weight, the minimum daily recommendation. While losing weight, more protein helps you keep muscle.`);
    }
    if ((fatG * 9) / calories < 0.2) {
      warnings.push('Fat is under 20% of calories, below the Dietary Guidelines range. Very low fat makes some vitamins harder to absorb.');
    }
  }

  const micro = micronutrientTargets(profile);
  const fiberFloor = profile.sex === 'male' ? 30 : 25;

  const targets = {
    kcal: calories,
    protein: proteinG,
    carbs: carbsG,
    fat: fatG,
    fiber: round(Math.max(fiberFloor, (14 * calories) / 1000)),
    addedSugars: Math.min(50, round((0.1 * calories) / 4)),
    satFat: round((0.1 * calories) / 9),
    sodium: 2300,
    cholesterol: 300,
    ...micro,
  };

  const basis = {
    kcal: 'Maintenance calories (Mifflin-St Jeor × activity) minus your weekly-loss deficit. 500 kcal a day is about 1 lb a week.',
    protein: '1.6 g per kg of body weight, a common range for keeping muscle while losing weight. Capped at 35% of calories.',
    fat: '25% of calories, inside the 20–35% range in the Dietary Guidelines.',
    carbs: 'What is left after protein and fat.',
    ...(custom
      ? Object.fromEntries(
          ['protein', 'carbs', 'fat'].map((k) => [k, k === custom.fill ? `Fills what's left of your ${calories.toLocaleString('en-US')} kcal after the other two.` : 'You set this.'])
        )
      : {}),
    fiber: 'Dietary Guidelines: 14 g per 1,000 kcal, with a floor of 25 g (30 g for men).',
    addedSugars: 'Under 10% of calories, and no more than the FDA Daily Value of 50 g.',
    satFat: 'Under 10% of calories (Dietary Guidelines).',
    sodium: 'Under 2,300 mg a day (Dietary Guidelines). The American Heart Association aims for 1,500 mg if you have high blood pressure.',
    cholesterol: 'FDA Daily Value of 300 mg. The Guidelines say keep it as low as you can.',
    potassium: 'Adequate Intake from the National Academies (2019).',
    calcium: 'Recommended Dietary Allowance for your age and sex.',
    iron: 'Recommended Dietary Allowance for your age and sex.',
    vitD: 'Recommended Dietary Allowance (600 IU is 15 mcg; 800 IU after age 70).',
    vitA: 'Recommended Dietary Allowance, in mcg RAE.',
    vitC: 'Recommended Dietary Allowance.',
  };

  return {
    ok: true,
    errors: [],
    warnings,
    bmr: bmrKcal,
    tdee,
    calories,
    floor,
    flooredByMinimum,
    requestedRateKg: requestedRate,
    effectiveRateKg,
    dailyDeficit,
    targets,
    basis,
    macroMode: custom ? 'custom' : 'auto',
    macroFill: custom?.fill || 'carbs',
    recommendedMacros,
    macroPct: {
      protein: (proteinG * 4 * 100) / calories,
      carbs: (carbsG * 4 * 100) / calories,
      fat: (fatG * 9 * 100) / calories,
    },
  };
}

export const MACRO_KCAL = { protein: 4, carbs: 4, fat: 9 };
export const MACRO_KEYS = ['protein', 'carbs', 'fat'];

// You set two macros in grams; the third ("fill") takes whatever calories are left.
export function applyCustomMacros(calories, custom) {
  const fill = MACRO_KEYS.includes(custom?.fill) ? custom.fill : 'carbs';
  const macros = {};
  let used = 0;
  for (const k of MACRO_KEYS) {
    if (k === fill) continue;
    const g = Math.max(0, Math.round(Number(custom?.[k]) || 0));
    macros[k] = g;
    used += g * MACRO_KCAL[k];
  }
  const left = calories - used;
  macros[fill] = Math.max(0, Math.round(left / MACRO_KCAL[fill]));
  return { macros, fill, overBy: left < 0 ? -left : 0 };
}

// ---------- Over-goal check ----------

// Nutrients where going past the goal is worth a heads-up. Protein, fiber and vitamins are left out by default.
export const WATCHABLE = ['kcal', 'protein', 'carbs', 'fat', 'addedSugars', 'satFat', 'sodium', 'cholesterol'];
export const DEFAULT_WATCH = ['kcal', 'carbs', 'fat', 'addedSugars', 'satFat', 'sodium', 'cholesterol'];

// Which watched nutrients this addition pushes from at-or-under the goal to over it.
export function overages({ before, adding, targets, watch = DEFAULT_WATCH }) {
  const out = [];
  for (const key of watch) {
    const target = targets?.[key];
    const add = adding?.[key] || 0;
    if (!(target > 0) || !(add > 0)) continue;
    const was = before?.[key] || 0;
    const now = was + add;
    if (was <= target && now > target) out.push({ key, before: was, after: now, target, adding: add, overBy: now - target });
  }
  return out;
}

// ---------- Nutrient arithmetic ----------

// Missing values stay missing so "not reported" is never confused with zero.
export function scaleNutrients(n, factor) {
  const out = {};
  for (const k of NUTRIENT_KEYS) {
    if (typeof n?.[k] === 'number' && Number.isFinite(n[k])) out[k] = n[k] * factor;
  }
  return out;
}

export function sumNutrients(list) {
  const totals = {};
  const reported = {};
  for (const k of NUTRIENT_KEYS) {
    totals[k] = 0;
    reported[k] = 0;
  }
  for (const n of list) {
    for (const k of NUTRIENT_KEYS) {
      if (typeof n?.[k] === 'number' && Number.isFinite(n[k])) {
        totals[k] += n[k];
        reported[k] += 1;
      }
    }
  }
  return { totals, reported, count: list.length };
}

export function totalsForEntries(entries) {
  return sumNutrients(entries.map((e) => e.nutrients));
}

// Nutrients for eating `qty` of a food. unit: 'serving' | 'g'
export function nutrientsForAmount(food, qty, unit = 'serving') {
  let factor = qty;
  if (unit === 'g') {
    if (!food.servingGrams) throw new Error('This food has no gram weight for a serving.');
    factor = qty / food.servingGrams;
  }
  return scaleNutrients(food.nutrients, factor);
}

export function describeAmount(food, qty, unit = 'serving') {
  if (unit === 'g') return `${trimNum(qty)} g`;
  const label = food.servingLabel || '1 serving';
  return qty === 1 ? label : `${trimNum(qty)} × ${label}`;
}

// Recipe: ingredients [{ food snapshot fields, servings }] and how many servings it makes.
export function mealPerServing(items, yieldServings) {
  const scaled = items.map((it) => scaleNutrients(it.nutrients, it.servings));
  const { totals, reported } = sumNutrients(scaled);
  const y = yieldServings > 0 ? yieldServings : 1;
  const per = {};
  for (const k of NUTRIENT_KEYS) {
    if (reported[k] > 0) per[k] = totals[k] / y;
  }
  return per;
}

export function trimNum(n, dp = 2) {
  if (!Number.isFinite(n)) return '';
  return String(Number(n.toFixed(dp)));
}

// ---------- Barcodes ----------

export function normalizeBarcode(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits.replace(/^0+/, '');
}

export function gtinCheckDigitValid(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const nums = digits.split('').map(Number);
  const check = nums.pop();
  let sum = 0;
  nums.reverse().forEach((d, i) => {
    sum += d * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

// Small packages use 8-digit UPC-E. Databases index the 12-digit UPC-A form.
export function upceToUpca(raw) {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (d.length !== 8 || (d[0] !== '0' && d[0] !== '1')) return null;
  const [n, a, b, c, e, f, g, check] = d;
  let body;
  if ('012'.includes(g)) body = `${n}${a}${b}${g}0000${c}${e}${f}`;
  else if (g === '3') body = `${n}${a}${b}${c}00000${e}${f}`;
  else if (g === '4') body = `${n}${a}${b}${c}${e}00000${f}`;
  else body = `${n}${a}${b}${c}${e}${f}0000${g}`;
  return body + check;
}

// ---------- Dates ----------

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
export function daysBetween(a, b) {
  return Math.round((parseKey(b) - parseKey(a)) / 86400000);
}

// Monday check-in: prompt on the first open of a Monday when nothing is logged for today.
export function shouldPromptWeighIn({ now, weights, dismissedKey }) {
  if (now.getDay() !== 1) return false;
  const key = dateKey(now);
  if (dismissedKey === key) return false;
  return !weights.some((w) => w.date === key);
}

// ---------- Weight trend ----------

export function sortedWeights(weights) {
  return [...weights].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// 7-day trailing average, so day-to-day water swings do not hide the trend.
export function weightTrend(weights, windowDays = 7) {
  const s = sortedWeights(weights);
  return s.map((w) => {
    const inWindow = s.filter((x) => {
      const diff = daysBetween(x.date, w.date);
      return diff >= 0 && diff < windowDays;
    });
    const avg = inWindow.reduce((sum, x) => sum + x.kg, 0) / inWindow.length;
    return { date: w.date, kg: avg };
  });
}

// Least-squares slope over the last `days` days, in kg per week (negative = losing).
export function weeklyRate(weights, days = 28, today = dateKey()) {
  const s = sortedWeights(weights).filter((w) => daysBetween(w.date, today) <= days);
  if (s.length < 2) return null;
  const span = daysBetween(s[0].date, s[s.length - 1].date);
  if (span < 7) return null;
  const xs = s.map((w) => daysBetween(s[0].date, w.date));
  const ys = s.map((w) => w.kg);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  return (num / den) * 7;
}

export function estimatedGoalDate({ currentKg, goalKg, rateKgPerWeek, today = dateKey() }) {
  if (!(goalKg > 0) || !(rateKgPerWeek > 0) || goalKg >= currentKg) return null;
  const weeks = (currentKg - goalKg) / rateKgPerWeek;
  return addDays(today, Math.ceil(weeks * 7));
}
