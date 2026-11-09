// App state in localStorage, with change notifications and JSON backup/restore.

import { dateKey, normalizeBarcode, sortedWeights } from './nutrition.js';

const KEY = 'macrolog.v1';

const defaults = () => ({
  version: 1,
  profile: null, // { sex, age, heightCm, weightKg, activity, rateKgPerWeek, goalWeightKg? }
  settings: { units: 'us', usdaKey: '', weighDismissed: '' },
  foods: [], // { id, name, brand, barcode, servingLabel, servingGrams?, nutrients, source, lastUsed, uses }
  meals: [], // { id, name, yield, items: [{ name, servings, servingLabel, nutrients }], lastUsed }
  log: [], // { id, date, slot, name, detail, nutrients, kind }
  weights: [], // { date, kg }
});

export const uid = () =>
  globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function createStore({ storage = globalThis.localStorage, onError = () => {} } = {}) {
  let state = load();
  const listeners = new Set();

  function load() {
    try {
      const raw = storage.getItem(KEY);
      if (!raw) return defaults();
      return normalize(JSON.parse(raw));
    } catch {
      return defaults();
    }
  }

  function normalize(obj) {
    const d = defaults();
    const s = obj && typeof obj === 'object' ? obj : {};
    return {
      version: 1,
      profile: s.profile && typeof s.profile === 'object' ? s.profile : null,
      settings: { ...d.settings, ...(s.settings || {}) },
      foods: Array.isArray(s.foods) ? s.foods : [],
      meals: Array.isArray(s.meals) ? s.meals : [],
      log: Array.isArray(s.log) ? s.log : [],
      weights: Array.isArray(s.weights) ? s.weights : [],
    };
  }

  function commit() {
    try {
      storage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      onError(err);
    }
    listeners.forEach((fn) => fn(state));
  }

  const api = {
    get state() {
      return state;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    // --- settings ---
    setSettings(patch) {
      state.settings = { ...state.settings, ...patch };
      commit();
    },

    // --- weight and profile ---
    latestWeightKg() {
      const s = sortedWeights(state.weights);
      return s.length ? s[s.length - 1].kg : state.profile?.weightKg ?? null;
    },
    setWeight(date, kg) {
      const i = state.weights.findIndex((w) => w.date === date);
      if (i >= 0) state.weights[i].kg = kg;
      else state.weights.push({ date, kg });
      if (state.profile) state.profile.weightKg = api.latestWeightKg();
      commit();
    },
    removeWeight(date) {
      state.weights = state.weights.filter((w) => w.date !== date);
      if (state.profile && state.weights.length) state.profile.weightKg = api.latestWeightKg();
      commit();
    },
    saveProfile(profile, today = dateKey()) {
      const latest = sortedWeights(state.weights).at(-1);
      const weightChanged = !latest || Math.abs(latest.kg - profile.weightKg) > 0.05;
      state.profile = { ...profile };
      if (weightChanged) {
        const i = state.weights.findIndex((w) => w.date === today);
        if (i >= 0) state.weights[i].kg = profile.weightKg;
        else state.weights.push({ date: today, kg: profile.weightKg });
      } else {
        state.profile.weightKg = latest.kg;
      }
      commit();
    },

    // --- foods ---
    findFoodByBarcode(code) {
      const want = normalizeBarcode(code);
      return want ? state.foods.find((f) => normalizeBarcode(f.barcode) === want) : undefined;
    },
    saveFood(food) {
      const rec = { uses: 0, lastUsed: 0, ...food, id: food.id || uid() };
      const i = state.foods.findIndex((f) => f.id === rec.id);
      if (i >= 0) state.foods[i] = { ...state.foods[i], ...rec };
      else state.foods.push(rec);
      commit();
      return rec;
    },
    touchFood(id) {
      const f = state.foods.find((x) => x.id === id);
      if (f) {
        f.uses = (f.uses || 0) + 1;
        f.lastUsed = Date.now();
        commit();
      }
    },
    deleteFood(id) {
      state.foods = state.foods.filter((f) => f.id !== id);
      commit();
    },

    // --- meals ---
    saveMeal(meal) {
      const rec = { lastUsed: 0, ...meal, id: meal.id || uid() };
      const i = state.meals.findIndex((m) => m.id === rec.id);
      if (i >= 0) state.meals[i] = { ...state.meals[i], ...rec };
      else state.meals.push(rec);
      commit();
      return rec;
    },
    touchMeal(id) {
      const m = state.meals.find((x) => x.id === id);
      if (m) {
        m.lastUsed = Date.now();
        commit();
      }
    },
    deleteMeal(id) {
      state.meals = state.meals.filter((m) => m.id !== id);
      commit();
    },

    // --- diary ---
    addEntry(entry) {
      const rec = { ...entry, id: uid() };
      state.log.push(rec);
      commit();
      return rec;
    },
    updateEntry(id, patch) {
      const e = state.log.find((x) => x.id === id);
      if (e) {
        Object.assign(e, patch);
        commit();
      }
    },
    deleteEntry(id) {
      state.log = state.log.filter((e) => e.id !== id);
      commit();
    },
    entriesForDate(date) {
      return state.log.filter((e) => e.date === date);
    },

    // --- backup ---
    exportJSON() {
      return JSON.stringify({ app: 'macrolog', exportedAt: new Date().toISOString(), data: state }, null, 2);
    },
    importJSON(text) {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { ok: false, error: 'That file is not valid JSON.' };
      }
      const data = parsed?.app === 'macrolog' ? parsed.data : null;
      if (!data || typeof data !== 'object') return { ok: false, error: 'That file is not a macrolog backup.' };
      state = normalize(data);
      commit();
      return { ok: true, counts: { foods: state.foods.length, meals: state.meals.length, entries: state.log.length, weights: state.weights.length } };
    },
    resetAll() {
      state = defaults();
      commit();
    },
  };
  return api;
}
