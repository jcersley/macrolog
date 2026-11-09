// Progress: weight over time, calories per day, and 7-day nutrient averages.

import {
  computeGoals, weightTrend, weeklyRate, sortedWeights, estimatedGoalDate, totalsForEntries,
  addDays, dateKey, kgToLb, lbToKg, nutrientMeta, trimNum,
} from '../nutrition.js';
import { weightChart, calorieBars, shortDate } from '../charts.js';
import { esc, fmt, mount, openSheet, toast, readNum, fmtWeight, longDate, icon, confirmSheet } from '../ui.js';

let range = 84;
const RANGES = [
  { days: 28, label: '4 weeks' },
  { days: 84, label: '12 weeks' },
  { days: 0, label: 'All' },
];

export function renderProgress(view, ctx) {
  const { store } = ctx;
  const units = store.state.settings.units;
  const today = dateKey();
  const profile = store.state.profile;
  const goals = profile ? computeGoals(profile) : null;
  const weights = sortedWeights(store.state.weights);
  const signed = (kg) => `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${fmtWeight(Math.abs(kg), units)}`;

  // ----- weight -----
  let weightHtml;
  if (!weights.length) {
    weightHtml = `<div class="empty"><p>Log your weight once a week, and your trend shows up here.</p>
      <button type="button" class="btn primary" data-act="logweight">Log weight</button></div>`;
  } else {
    const trend = weightTrend(weights);
    const from = range ? addDays(today, -range) : weights[0].date;
    const pts = weights.filter((w) => w.date >= from);
    const tr = trend.filter((w) => w.date >= from);
    const latest = weights[weights.length - 1];
    const change = latest.kg - weights[0].kg;
    const rate = weeklyRate(weights, 28, today);
    const target = goals?.ok ? goals.effectiveRateKg : 0;
    const eta = profile?.goalWeightKg && rate !== null && rate < 0
      ? estimatedGoalDate({ currentKg: trend[trend.length - 1].kg, goalKg: profile.goalWeightKg, rateKgPerWeek: -rate, today })
      : null;

    weightHtml = `
      <dl class="stats">
        <div><dt>Latest</dt><dd>${fmtWeight(latest.kg, units)}</dd><small>${shortDate(latest.date)}</small></div>
        <div><dt>Since start</dt><dd>${signed(change)}</dd><small>from ${shortDate(weights[0].date)}</small></div>
        <div><dt>Pace</dt><dd>${rate === null ? '—' : `${signed(rate)}<small>/wk</small>`}</dd><small>${rate === null ? 'needs 1+ week of weigh-ins' : 'last 4 weeks'}</small></div>
      </dl>
      ${target > 0 && rate !== null ? `<p class="pace-note">${paceNote(rate, target, units)}</p>` : ''}
      ${eta ? `<p class="pace-note">At this pace you'd reach ${fmtWeight(profile.goalWeightKg, units)} around ${esc(longDate(eta).split(', ').slice(1).join(', '))}.</p>` : ''}
      <div class="seg small" role="group" aria-label="Range">
        ${RANGES.map((r) => `<button type="button" data-act="range" data-days="${r.days}" aria-pressed="${r.days === range}">${r.label}</button>`).join('')}
      </div>
      ${pts.length ? weightChart({ points: pts, trend: tr, units, pace: target > 0 ? { rateKgPerWeek: target } : null, goalKg: profile?.goalWeightKg }) : '<p class="muted">No weigh-ins in this range.</p>'}
      <ul class="legend">
        <li><i class="lg-dot"></i>Weigh-ins</li>
        <li><i class="lg-trend"></i>7-day average</li>
        ${target > 0 ? '<li><i class="lg-pace"></i>Goal pace</li>' : ''}
      </ul>
      <div class="btn-row"><button type="button" class="btn primary" data-act="logweight">${icon.plus} Log weight</button></div>
      <details class="history"><summary>All weigh-ins (${weights.length})</summary>
        <ul class="list">${[...weights].reverse().map((w) => `<li class="hist-row"><span>${esc(longDate(w.date))}</span><b>${fmtWeight(w.kg, units)}</b>
          <button type="button" class="icon-btn" data-act="delweight" data-date="${w.date}" aria-label="Delete weigh-in from ${esc(longDate(w.date))}">${icon.trash}</button></li>`).join('')}</ul>
      </details>`;
  }

  // ----- calories, last 14 days -----
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(today, -i);
    const entries = store.entriesForDate(d);
    days.push({ date: d, kcal: entries.length ? totalsForEntries(entries).totals.kcal : null });
  }
  const loggedDays = days.filter((d) => d.kcal !== null);
  const avg = loggedDays.length ? loggedDays.reduce((s, d) => s + d.kcal, 0) / loggedDays.length : null;
  const goalKcal = goals?.ok ? goals.targets.kcal : null;

  // ----- nutrient averages, last 7 days with entries -----
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const entries = store.entriesForDate(addDays(today, -i));
    if (entries.length) week.push(totalsForEntries(entries).totals);
  }
  const avgKeys = ['protein', 'fiber', 'addedSugars', 'satFat', 'sodium', 'cholesterol'];
  const avgRows = week.length
    ? avgKeys
        .map((k) => {
          const m = nutrientMeta(k);
          const v = week.reduce((s, t) => s + t[k], 0) / week.length;
          const tgt = goals?.ok ? goals.targets[k] : null;
          const flag = tgt ? (m.kind === 'limit' ? (v > tgt ? 'over' : 'ok') : v >= tgt ? 'ok' : 'under') : '';
          const word = { over: 'over limit', ok: m.kind === 'limit' ? 'under limit' : 'on target', under: 'below target' }[flag] || '';
          return `<tr class="${flag}"><th scope="row">${m.label}</th><td>${fmt(v, m.dp)} ${m.unit}</td><td>${tgt ? `${m.kind === 'limit' ? 'up to' : 'goal'} ${fmt(tgt)}` : ''}</td><td>${word}</td></tr>`;
        })
        .join('')
    : '';

  mount(
    view,
    `<header class="page-head"><h1>Progress</h1></header>
    <section class="panel" aria-labelledby="h-weight"><h2 id="h-weight">Weight</h2>${weightHtml}</section>
    <section class="panel" aria-labelledby="h-cal"><h2 id="h-cal">Calories, last 14 days</h2>
      ${
        loggedDays.length
          ? `${calorieBars({ days, goal: goalKcal })}
             <p class="pace-note">Average on the ${loggedDays.length} day${loggedDays.length === 1 ? '' : 's'} you logged: <b>${fmt(avg)}</b> kcal${goalKcal ? ` against a goal of ${fmt(goalKcal)}` : ''}. Days with nothing logged are left blank.</p>`
          : '<p class="muted">Log some food and your daily calories show up here.</p>'
      }
    </section>
    ${
      week.length
        ? `<section class="panel" aria-labelledby="h-avg"><h2 id="h-avg">Daily average, last 7 days</h2>
            <table class="avg-table"><tbody>${avgRows}</tbody></table>
            <p class="hint">Averages only count days with something logged (${week.length} of 7).</p></section>`
        : ''
    }`,
    {
      range: (el) => {
        range = Number(el.dataset.days);
        renderProgress(view, ctx);
      },
      logweight: () => openWeightSheet(ctx),
      delweight: async (el) => {
        const ok = await confirmSheet({ title: 'Delete this weigh-in?', message: longDate(el.dataset.date), confirmLabel: 'Delete', danger: true });
        if (ok) ctx.store.removeWeight(el.dataset.date);
      },
    }
  );
}

function paceNote(rateKg, targetKg, units) {
  const lost = -rateKg;
  const pace = fmtWeight(Math.abs(rateKg), units);
  if (lost <= 0) return `You're not losing yet: up ${pace} a week. Your goal is ${fmtWeight(targetKg, units)} a week down.`;
  const ratio = lost / targetKg;
  if (ratio > 1.4) return `You're losing ${pace} a week, faster than your ${fmtWeight(targetKg, units)} goal. Make sure you're eating enough protein.`;
  if (ratio < 0.6) return `You're losing ${pace} a week, slower than your ${fmtWeight(targetKg, units)} goal. Check that you're logging everything, including drinks and oils.`;
  return `You're losing ${pace} a week, close to your ${fmtWeight(targetKg, units)} goal.`;
}

export function openWeightSheet(ctx, { title = 'Log weight', intro = '', onDone, onSkip, skipLabel } = {}) {
  const { store } = ctx;
  const units = store.state.settings.units;
  const today = dateKey();
  const last = store.latestWeightKg();
  let saved = false;
  const s = openSheet({
    title,
    onClose: () => {
      if (!saved) onSkip?.();
    },
  });
  const root = s.render(
    `${intro ? `<p>${esc(intro)}</p>` : ''}
    <form data-submit="save" novalidate>
      <label class="field"><span>Weight <small>${units === 'us' ? 'lb' : 'kg'}</small></span>
        <input id="w" inputmode="decimal" autocomplete="off" autofocus value="${last ? trimNum(units === 'us' ? kgToLb(last) : last, 1) : ''}"></label>
      ${last ? `<p class="muted small">Last weigh-in: ${fmtWeight(last, units)}</p>` : ''}
      <label class="field"><span>Date</span><input id="d" type="date" value="${today}" max="${today}"></label>
      <p class="hint">For the steadiest trend, weigh in first thing in the morning, before eating.</p>
      <p class="err-text" id="w-err" role="alert"></p>
      <div class="btn-row">
        <button type="submit" class="btn primary">Save weight</button>
        ${skipLabel ? `<button type="button" class="btn" data-act="skip">${esc(skipLabel)}</button>` : ''}
      </div>
    </form>`,
    {
      save: () => {
        const v = readNum(root.querySelector('#w'));
        const kg = units === 'us' ? lbToKg(v) : v;
        const date = root.querySelector('#d').value || today;
        if (!(kg >= 30 && kg <= 320)) {
          root.querySelector('#w-err').textContent = `Enter your weight in ${units === 'us' ? 'pounds' : 'kilograms'}.`;
          return;
        }
        if (date > today) {
          root.querySelector('#w-err').textContent = "The date can't be in the future.";
          return;
        }
        store.setWeight(date, kg);
        saved = true;
        s.close();
        toast(`Saved ${fmtWeight(kg, units)}`);
        onDone?.();
      },
      skip: () => s.close(),
    }
  );
  s.focus();
  return s;
}
