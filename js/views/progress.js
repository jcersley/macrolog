// Progress: weight over time, calories per day, and 7-day nutrient averages.

import {
  computeGoals, weightTrend, weeklyRate, sortedWeights, estimatedGoalDate, totalsForEntries,
  addDays, dateKey, kgToLb, lbToKg, nutrientMeta, trimNum, estimateMaintenance, cmToIn, inToCm,
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

  // ----- maintenance estimated from your own data -----
  const dayStatus = store.state.dayStatus || {};
  const est = estimateMaintenance({ log: store.state.log, weights: store.state.weights, dayStatus, today });
  const usingData = profile?.maintenanceSource === 'data' && profile?.maintenanceKcal;
  let maintHtml;
  if (!est.ok) {
    const n = est.needs;
    const bar = (have, need) => `<span class="need ${have >= need ? 'met' : ''}">${Math.min(have, need)} of ${need}</span>`;
    maintHtml = `<p>After a few weeks of logging, the app compares what you ate with how your weight changed and works out what you really burn. That's usually more accurate than the formula.</p>
      <ul class="needs">
        <li>Complete days logged, last 4 weeks ${bar(est.completeDays, n.minDays)}</li>
        <li>Weigh-ins, last 4 weeks ${bar(est.weighIns, n.minWeighIns)}</li>
        <li>Days between first and last weigh-in ${bar(est.spanDays, n.minSpanDays)}</li>
      </ul>
      <p class="hint">Mark days complete on the Today screen. Weighing in 2 or 3 times a week, not just Mondays, makes the estimate steadier.</p>
      ${usingData ? `<p class="small">Your goals use ${fmt(profile.maintenanceKcal)} kcal from your data (${esc(longDate(profile.maintenanceDate || today).split(', ').slice(1).join(', '))}).</p><button type="button" class="btn" data-act="useformula">Switch back to the formula</button>` : ''}`;
  } else {
    const formula = goals?.ok ? goals.formulaTdee : null;
    const differs = !usingData || Math.abs(profile.maintenanceKcal - est.maintenance) >= 30;
    maintHtml = `<p class="goal-lead"><span class="big">${fmt(est.maintenance)}</span> kcal a day</p>
      <p>On ${est.completeDays} complete days you averaged <b>${fmt(Math.round(est.avgIntake))}</b> kcal, and your weight trended ${
        est.rateKgPerWeek < 0 ? 'down' : 'up'
      } ${fmtWeight(Math.abs(est.rateKgPerWeek), units)} a week. That points to burning about ${fmt(est.maintenance)} a day${
        formula ? `. The formula guessed ${fmt(Math.round(formula / 10) * 10)}` : ''
      }.</p>
      ${est.confidence === 'rough' ? '<p class="hint">Rough estimate so far. It firms up with more complete days and more weigh-ins.</p>' : ''}
      ${usingData ? `<p class="small">Your goals currently use ${fmt(profile.maintenanceKcal)} kcal from ${esc(longDate(profile.maintenanceDate || today).split(', ').slice(1).join(', '))}.</p>` : ''}
      <div class="btn-row">
        ${profile && differs ? `<button type="button" class="btn primary" data-act="usedata" data-k="${est.maintenance}">${usingData ? `Update goals to ${fmt(est.maintenance)}` : 'Use this for my goals'}</button>` : ''}
        ${usingData ? '<button type="button" class="btn" data-act="useformula">Use the formula</button>' : ''}
      </div>
      ${profile?.calorieMode === 'custom' ? '<p class="hint">You have a custom calorie goal, so this only changes the deficit shown in Profile, not the goal itself.</p>' : ''}`;
  }

  // ----- waist -----
  const waists = [...(store.state.waists || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
  const wUnit = units === 'us' ? 'in' : 'cm';
  const wConv = (cm) => (units === 'us' ? cmToIn(cm) : cm);
  const fmtWaist = (cm) => `${fmt(wConv(cm), 1)} ${wUnit}`;
  const waistHtml = waists.length
    ? `<dl class="stats two-col">
        <div><dt>Latest</dt><dd>${fmtWaist(waists[waists.length - 1].cm)}</dd><small>${shortDate(waists[waists.length - 1].date)}</small></div>
        <div><dt>Since start</dt><dd>${(() => {
          const d = waists[waists.length - 1].cm - waists[0].cm;
          return `${d > 0 ? '+' : d < 0 ? '\u2212' : ''}${fmtWaist(Math.abs(d))}`;
        })()}</dd><small>from ${shortDate(waists[0].date)}</small></div>
      </dl>
      ${waists.length > 1 ? weightChart({ points: waists.map((w) => ({ date: w.date, kg: w.cm })), trend: [], convert: wConv, unit: wUnit, title: 'Waist', height: 180 }) : ''}
      <p class="hint">A shrinking waist with a flat scale usually means you're losing fat and holding on to muscle or water.</p>
      <div class="btn-row"><button type="button" class="btn" data-act="logwaist">${icon.plus} Log waist</button></div>
      <details class="history"><summary>All measurements (${waists.length})</summary>
        <ul class="list">${[...waists].reverse().map((w) => `<li class="hist-row"><span>${esc(longDate(w.date))}</span><b>${fmtWaist(w.cm)}</b>
          <button type="button" class="icon-btn" data-act="delwaist" data-date="${w.date}" aria-label="Delete waist measurement from ${esc(longDate(w.date))}">${icon.trash}</button></li>`).join('')}</ul>
      </details>`
    : `<div class="empty"><p>Weight swings with water and salt. Your waist is a steadier sign of fat loss. Measure once a week at your belly button, relaxed, before eating. You can add it on the Monday weigh-in.</p>
       <button type="button" class="btn" data-act="logwaist">Log waist</button></div>`;

  // ----- calories, last 14 days -----
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(today, -i);
    const entries = store.entriesForDate(d);
    days.push({ date: d, kcal: entries.length ? totalsForEntries(entries).totals.kcal : null });
  }
  // Once you've marked any day complete, averages use complete days only.
  const anyMarked = Object.values(dayStatus).includes('complete');
  const countable = (d) => d.kcal !== null && (!anyMarked || dayStatus[d.date] === 'complete');
  const loggedDays = days.filter(countable);
  const avg = loggedDays.length ? loggedDays.reduce((s, d) => s + d.kcal, 0) / loggedDays.length : null;
  const goalKcal = goals?.ok ? goals.targets.kcal : null;

  // ----- nutrient averages, last 7 days with entries -----
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const entries = store.entriesForDate(d);
    if (entries.length && (!anyMarked || dayStatus[d] === 'complete')) week.push(totalsForEntries(entries).totals);
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
    <section class="panel" aria-labelledby="h-maint"><h2 id="h-maint">What you actually burn</h2>${maintHtml}</section>
    <section class="panel" aria-labelledby="h-waist"><h2 id="h-waist">Waist</h2>${waistHtml}</section>
    <section class="panel" aria-labelledby="h-cal"><h2 id="h-cal">Calories, last 14 days</h2>
      ${
        days.some((d) => d.kcal !== null)
          ? `${calorieBars({ days, goal: goalKcal })}
             ${
               loggedDays.length
                 ? `<p class="pace-note">Average on ${loggedDays.length} ${anyMarked ? 'complete' : 'logged'} day${loggedDays.length === 1 ? '' : 's'}: <b>${fmt(avg)}</b> kcal${goalKcal ? ` against a goal of ${fmt(goalKcal)}` : ''}.</p>`
                 : '<p class="pace-note">No complete days in this stretch yet.</p>'
             }
             <p class="hint">${anyMarked ? 'Only days marked complete count toward the average.' : 'Days with nothing logged are left blank. Mark days complete on Today for a cleaner average.'}</p>`
          : '<p class="muted">Log some food and your daily calories show up here.</p>'
      }
    </section>
    ${
      week.length
        ? `<section class="panel" aria-labelledby="h-avg"><h2 id="h-avg">Daily average, last 7 days</h2>
            <table class="avg-table"><tbody>${avgRows}</tbody></table>
            <p class="hint">Averages count ${anyMarked ? 'complete' : 'logged'} days only (${week.length} of 7).</p></section>`
        : ''
    }`,
    {
      range: (el) => {
        range = Number(el.dataset.days);
        renderProgress(view, ctx);
      },
      logweight: () => openWeightSheet(ctx),
      logwaist: () => openWaistSheet(ctx),
      delwaist: async (el) => {
        const ok = await confirmSheet({ title: 'Delete this measurement?', message: longDate(el.dataset.date), confirmLabel: 'Delete', danger: true });
        if (ok) ctx.store.removeWaist(el.dataset.date);
      },
      usedata: (el) => {
        ctx.store.saveProfile({ ...profile, maintenanceSource: 'data', maintenanceKcal: Number(el.dataset.k), maintenanceDate: today }, today);
        toast(`Goals now use ${fmt(Number(el.dataset.k))} kcal maintenance`);
      },
      useformula: () => {
        ctx.store.saveProfile({ ...profile, maintenanceSource: 'formula' }, today);
        toast('Goals use the formula again');
      },
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

export function openWeightSheet(ctx, { title = 'Log weight', intro = '', onDone, onSkip, skipLabel, withWaist = false } = {}) {
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
      ${withWaist ? `<label class="field"><span>Waist <small>${units === 'us' ? 'in' : 'cm'}, optional</small></span><input id="waist" inputmode="decimal" autocomplete="off"></label>` : ''}
      <label class="field"><span>Date</span><input id="d" type="date" value="${today}" max="${today}"></label>
      <p class="hint">For the steadiest trend, weigh in first thing in the morning, before eating.${withWaist ? ' Measure your waist at your belly button, relaxed.' : ''}</p>
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
        const waistEl = root.querySelector('#waist');
        const wv = waistEl ? readNum(waistEl) : NaN;
        const waistCm = units === 'us' ? inToCm(wv) : wv;
        if (waistEl && waistEl.value.trim() && !(waistCm >= 40 && waistCm <= 250)) {
          root.querySelector('#w-err').textContent = `Enter your waist in ${units === 'us' ? 'inches' : 'centimeters'}, or leave it blank.`;
          return;
        }
        store.setWeight(date, kg);
        if (waistCm >= 40) store.setWaist(date, waistCm);
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

export function openWaistSheet(ctx) {
  const { store } = ctx;
  const units = store.state.settings.units;
  const today = dateKey();
  const s = openSheet({ title: 'Log waist' });
  const root = s.render(
    `<form data-submit="save" novalidate>
      <label class="field"><span>Waist <small>${units === 'us' ? 'in' : 'cm'}</small></span><input id="waist" inputmode="decimal" autocomplete="off" autofocus></label>
      <label class="field"><span>Date</span><input id="d" type="date" value="${today}" max="${today}"></label>
      <p class="hint">Measure at your belly button, standing relaxed, before eating. Same spot every time matters more than the exact spot.</p>
      <p class="err-text" id="w-err" role="alert"></p>
      <button type="submit" class="btn primary block">Save waist</button>
    </form>`,
    {
      save: () => {
        const v = readNum(root.querySelector('#waist'));
        const cm = units === 'us' ? inToCm(v) : v;
        const date = root.querySelector('#d').value || today;
        if (!(cm >= 40 && cm <= 250)) {
          root.querySelector('#w-err').textContent = `Enter your waist in ${units === 'us' ? 'inches' : 'centimeters'}.`;
          return;
        }
        if (date > today) {
          root.querySelector('#w-err').textContent = "The date can't be in the future.";
          return;
        }
        store.setWaist(date, cm);
        s.close();
        toast('Waist saved');
      },
    }
  );
  s.focus();
  return s;
}
