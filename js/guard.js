// Asks before logging something that pushes a watched nutrient past its daily goal.

import { computeGoals, sumNutrients, overages, nutrientMeta, DEFAULT_WATCH } from './nutrition.js';
import { openSheet, esc, fmt } from './ui.js';

// add: list of nutrient objects about to be logged. replacing: the entry being edited, so only
// the increase over its current amount counts. Resolves true to go ahead, false to cancel.
export function confirmOverGoals(ctx, { date, add, replacing = null }) {
  const { store } = ctx;
  if (!store.state.profile) return Promise.resolve(true);
  const goals = computeGoals(store.state.profile);
  if (!goals.ok) return Promise.resolve(true);
  const watch = store.state.settings.warnKeys ?? DEFAULT_WATCH;
  if (!watch.length) return Promise.resolve(true);

  const before = sumNutrients(store.entriesForDate(date).map((e) => e.nutrients)).totals;
  const adding = sumNutrients(add).totals;
  if (replacing) {
    for (const k of Object.keys(adding)) adding[k] = Math.max(0, adding[k] - (replacing.nutrients?.[k] || 0));
  }
  const over = overages({ before, adding, targets: goals.targets, watch });
  if (!over.length) return Promise.resolve(true);

  return new Promise((resolve) => {
    let answered = false;
    const s = openSheet({
      title: over.length === 1 ? `This goes over your ${nutrientMeta(over[0].key).label.toLowerCase()} goal` : 'This goes over your goals',
      onClose: () => {
        if (!answered) resolve(false);
      },
    });
    s.render(
      `<ul class="over-list">${over
        .map((o) => {
          const m = nutrientMeta(o.key);
          const dp = m.dp;
          return `<li><span class="ov-name">${m.label}</span>
            <span class="ov-nums"><b>${fmt(o.after, dp)}</b> of ${fmt(o.target, dp)} ${m.unit}</span>
            <span class="ov-by">${fmt(o.overBy, dp)} ${m.unit} over, ${fmt(o.adding, dp)} from this</span></li>`;
        })
        .join('')}</ul>
      <p class="hint">You can change which goals trigger this in Profile, under Settings.</p>
      <div class="btn-row">
        <button type="button" class="btn" data-act="yes">Log it anyway</button>
        <button type="button" class="btn primary" data-act="no">Don't log</button>
      </div>`,
      {
        yes: () => {
          answered = true;
          s.close();
          resolve(true);
        },
        no: () => s.close(),
      }
    );
    s.el.querySelector('[data-act="no"]').focus({ preventScroll: true });
  });
}

export const watchLabel = (key) => esc(nutrientMeta(key).label);
