// Breakdown: today's numbers as pictures. Four charts, no endless lists:
//   1. Where the calories came from (macro donut) with today's split against the goal split
//   2. Calories by meal
//   3. Each key nutrient as a share of its daily goal
//   4. The foods that gave you the most of a chosen nutrient
//
// Colors: macros use a validated categorical trio (blue, yellow, aqua), set per light/dark
// in themes.js. Everything single-series uses ink; over-limit uses the palette's over color.
// Every mark has its value printed beside it, so no reading depends on color alone.

import { computeGoals, totalsForEntries, addDays, dateKey, nutrientMeta, DEFAULT_WATCH } from '../nutrition.js';
import { esc, fmt, mount, SLOTS, dateLabel, longDate, icon } from '../ui.js';

const MACROS = [
  { key: 'protein', label: 'Protein', kcalPerG: 4, color: 'var(--m-protein)' },
  { key: 'carbs', label: 'Carbs', kcalPerG: 4, color: 'var(--m-carbs)' },
  { key: 'fat', label: 'Fat', kcalPerG: 9, color: 'var(--m-fat)' },
];
const GOAL_KEYS = [
  ['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat'], ['fiber', 'Fiber'],
  ['addedSugars', 'Sugar'], ['satFat', 'Sat fat'], ['sodium', 'Sodium'], ['cholesterol', 'Chol.'],
];
const TOP_METRICS = [
  ['kcal', 'Calories'], ['protein', 'Protein'], ['sodium', 'Sodium'],
];

let topMetric = 'kcal';
const f1 = (n) => Number(n.toFixed(1));

// ---------- 1. Macro donut ----------

function arcPath(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(r1, a0);
  const [x1, y1] = p(r1, a1);
  const [x2, y2] = p(r0, a1);
  const [x3, y3] = p(r0, a0);
  return `M${f1(x0)},${f1(y0)} A${r1},${r1} 0 ${large} 1 ${f1(x1)},${f1(y1)} L${f1(x2)},${f1(y2)} A${r0},${r0} 0 ${large} 0 ${f1(x3)},${f1(y3)}Z`;
}

function donut(parts, centerTop, centerBottom) {
  const size = 176;
  const c = size / 2;
  const r1 = 84;
  const r0 = 56;
  const total = parts.reduce((s, p) => s + p.value, 0);
  let svg = `<svg class="donut" viewBox="0 0 ${size} ${size}" role="img" aria-label="Calories by macro: ${parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(', ')}">`;
  if (total <= 0) {
    svg += `<circle cx="${c}" cy="${c}" r="${(r0 + r1) / 2}" fill="none" stroke="var(--hair)" stroke-width="${r1 - r0}"/>`;
  } else {
    let a = -Math.PI / 2;
    for (const p of parts) {
      if (p.value <= 0) continue;
      const sweep = (p.value / total) * Math.PI * 2;
      const a1 = a + Math.min(sweep, Math.PI * 2 - 0.0001);
      svg += `<path d="${arcPath(c, c, r0, r1, a, a1)}" fill="${p.color}" stroke="var(--chart-surface)" stroke-width="2" stroke-linejoin="round" data-tip="${esc(p.tip)}"><title>${esc(p.tip)}</title></path>`;
      a += sweep;
    }
  }
  svg += `<text x="${c}" y="${c - 2}" text-anchor="middle" class="donut-big">${centerTop}</text>`;
  svg += `<text x="${c}" y="${c + 18}" text-anchor="middle" class="donut-small">${centerBottom}</text>`;
  return svg + '</svg>';
}

// A thin 100% bar with no text: the legend above carries the figures.
function splitBar(label, shares) {
  return `<div class="split-row"><span class="split-label">${label}</span>
    <div class="split-bar" role="img" aria-label="${label}: ${shares.map((s) => `${s.label} ${Math.round(s.pct)}%`).join(', ')}">
      ${shares.map((s) => (s.pct > 0 ? `<i style="width:${s.pct.toFixed(2)}%;background:${s.color}" data-tip="${esc(`${label}: ${s.label} ${Math.round(s.pct)}%`)}"></i>` : '')).join('')}
    </div></div>`;
}

// ---------- 3. Share of goal columns ----------

function goalColumns(rows) {
  const w = 360;
  const h = 196;
  const m = { l: 30, r: 4, t: 22, b: 30 };
  const pw = w - m.l - m.r;
  const ph = h - m.t - m.b;
  const top = Math.max(150, Math.min(250, Math.ceil(Math.max(...rows.map((r) => r.pct || 0)) / 50) * 50));
  const y = (v) => m.t + ph - (Math.min(v, top) / top) * ph;
  const slot = pw / rows.length;
  const bw = Math.min(26, slot * 0.56);
  let svg = `<svg class="chart goal-cols" viewBox="0 0 ${w} ${h}" role="img" aria-label="Today as a share of each daily goal">`;
  svg += `<line class="base" x1="${m.l}" x2="${w - m.r}" y1="${f1(y(0))}" y2="${f1(y(0))}"/>`;
  svg += `<line class="goal" x1="${m.l}" x2="${w - m.r}" y1="${f1(y(100))}" y2="${f1(y(100))}"/>`;
  rows.forEach((r, i) => {
    const cx = m.l + slot * i + slot / 2;
    if (r.pct === null) {
      svg += `<text class="col-val muted" x="${f1(cx)}" y="${f1(y(0) - 6)}" text-anchor="middle">—</text>`;
    } else {
      const v = Math.max(r.pct, 0);
      const bh = Math.max(2, y(0) - y(v));
      const yTop = y(0) - bh;
      const rad = Math.min(4, bh / 2, bw / 2);
      // Rounded top, square base on the axis.
      svg += `<path class="${r.over ? 'col over' : 'col'}" d="M${f1(cx - bw / 2)},${f1(y(0))} V${f1(yTop + rad)} Q${f1(cx - bw / 2)},${f1(yTop)} ${f1(cx - bw / 2 + rad)},${f1(yTop)} H${f1(cx + bw / 2 - rad)} Q${f1(cx + bw / 2)},${f1(yTop)} ${f1(cx + bw / 2)},${f1(yTop + rad)} V${f1(y(0))}Z" data-tip="${esc(r.tip)}"><title>${esc(r.tip)}</title></path>`;
      if (r.pct > top) svg += `<text class="col-cap" x="${f1(cx)}" y="${f1(m.t - 4 + 12)}" text-anchor="middle">▲</text>`;
      svg += `<text class="col-val${r.over ? ' over' : ''}" x="${f1(cx)}" y="${f1(Math.max(m.t - 6, yTop - 6))}" text-anchor="middle">${Math.round(r.pct)}%</text>`;
    }
    svg += `<text class="col-lab" x="${f1(cx)}" y="${h - 10}" text-anchor="middle">${r.short}</text>`;
  });
  svg += `<text class="goal-tag" x="${m.l - 4}" y="${f1(y(100) + 4)}" text-anchor="end">goal</text>`;
  return svg + '</svg>';
}

// ---------- shared: horizontal bars with values (meals, top foods) ----------

function hbars(rows, unit) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return `<ul class="hbars">${rows
    .map(
      (r) => `<li data-tip="${esc(r.tip || '')}">
        <span class="hb-name">${esc(r.label)}</span>
        <span class="hb-track"><i style="width:${r.value > 0 ? Math.max(1.5, (r.value / max) * 100).toFixed(1) : 0}%"></i></span>
        <span class="hb-val">${fmt(r.value)}<small> ${unit}</small>${r.pct !== undefined ? `<small class="hb-pct">${Math.round(r.pct)}%</small>` : ''}</span>
      </li>`
    )
    .join('')}</ul>`;
}

// ---------- the view ----------

export function renderBreakdown(view, ctx) {
  const { store } = ctx;
  const date = ctx.date();
  const today = dateKey();
  const entries = store.entriesForDate(date);
  const { totals, reported, count } = totalsForEntries(entries);
  const goals = store.state.profile ? computeGoals(store.state.profile) : null;
  const t = goals?.ok ? goals.targets : null;

  const head = `<header class="page-head bd-head">
      <button type="button" class="icon-btn" data-act="prev" aria-label="Previous day">${icon.left}</button>
      <div><h1>Breakdown</h1><p class="muted small">${esc(dateLabel(date, today))}, ${esc(longDate(date).split(', ').slice(1).join(', '))}</p></div>
      <button type="button" class="icon-btn" data-act="next" aria-label="Next day"${date >= today ? ' disabled' : ''}>${icon.right}</button>
    </header>`;
  const nav = {
    prev: () => ctx.setDate(addDays(date, -1)),
    next: () => date < today && ctx.setDate(addDays(date, 1)),
  };

  if (!entries.length) {
    mount(view, `${head}<div class="empty"><p>Nothing logged ${date === today ? 'today' : 'on this day'} yet. Once you log food, this page shows where your calories came from, how each meal stacked up, and how close you are to each goal.</p>
      <button type="button" class="btn primary" data-act="today">Go to Today</button></div>`, { ...nav, today: () => ctx.goTab('today') });
    return;
  }

  // 1. Macros
  const macroKcal = MACROS.map((mc) => ({ ...mc, grams: totals[mc.key] || 0, value: (totals[mc.key] || 0) * mc.kcalPerG }));
  const macroTotal = macroKcal.reduce((s, x) => s + x.value, 0);
  const goalKcal = t ? MACROS.reduce((s, mc) => s + t[mc.key] * mc.kcalPerG, 0) : 0;
  const parts = macroKcal.map((x) => ({
    label: x.label,
    color: x.color,
    value: x.value,
    tip: `${x.label}: ${fmt(x.grams)} g, ${fmt(x.value)} kcal, ${macroTotal ? Math.round((x.value / macroTotal) * 100) : 0}% of calories`,
  }));
  const legend = macroKcal
    .map((x) => {
      const pct = macroTotal ? (x.value / macroTotal) * 100 : 0;
      const gpct = t ? ((t[x.key] * x.kcalPerG) / goalKcal) * 100 : null;
      return `<li><i class="sw" style="background:${x.color}"></i>
        <span class="lg-name">${x.label}</span>
        <span class="lg-pct">${Math.round(pct)}%</span>
        <span class="lg-sub">${fmt(x.grams)} g${gpct !== null ? `, goal ${Math.round(gpct)}%` : ''}</span></li>`;
    })
    .join('');
  const shares = (fn) => macroKcal.map((x) => ({ label: x.label, color: x.color, pct: fn(x) }));
  const macroCard = `<section class="panel viz" aria-labelledby="h-macro">
      <h2 id="h-macro">Where your calories came from</h2>
      <div class="donut-wrap">
        ${donut(parts, fmt(Math.round(totals.kcal)), 'kcal eaten')}
        <ul class="macro-legend">${legend}</ul>
      </div>
      ${
        t
          ? `<div class="split">${splitBar('Today', shares((x) => (macroTotal ? (x.value / macroTotal) * 100 : 0)))}${splitBar('Goal', shares((x) => ((t[x.key] * x.kcalPerG) / goalKcal) * 100))}</div>`
          : ''
      }
      ${Math.abs(macroTotal - totals.kcal) > Math.max(60, totals.kcal * 0.15) ? `<p class="hint">Protein, carbs and fat account for ${fmt(Math.round(macroTotal))} of your ${fmt(Math.round(totals.kcal))} kcal. The rest is from foods without a full macro breakdown (like quick adds) or from fiber and alcohol.</p>` : ''}
    </section>`;

  // 2. Meals
  const mealRows = SLOTS.map((s) => {
    const kcal = entries.filter((e) => e.slot === s.id).reduce((a, e) => a + (e.nutrients.kcal || 0), 0);
    return { label: s.label, value: Math.round(kcal), pct: totals.kcal ? (kcal / totals.kcal) * 100 : 0, tip: `${s.label}: ${fmt(Math.round(kcal))} kcal` };
  });
  const mealCard = `<section class="panel viz" aria-labelledby="h-meals"><h2 id="h-meals">Calories by meal</h2>${hbars(mealRows, 'kcal')}</section>`;

  // 3. Share of goal
  let goalCard = '';
  if (t) {
    const watch = store.state.settings.warnKeys ?? DEFAULT_WATCH;
    const rows = GOAL_KEYS.map(([k, short]) => {
      const meta = nutrientMeta(k);
      const missing = reported[k] === 0;
      const pct = missing ? null : ((totals[k] || 0) / t[k]) * 100;
      const over = pct > 100 && (meta.kind === 'limit' || watch.includes(k));
      return {
        short,
        pct,
        over,
        tip: missing
          ? `${meta.label}: not listed on the foods you logged`
          : `${meta.label}: ${fmt(totals[k], meta.dp)} of ${fmt(t[k], meta.dp)} ${meta.unit} (${Math.round(pct)}%)${reported[k] < count ? ', some foods don’t list it' : ''}`,
      };
    });
    goalCard = `<section class="panel viz" aria-labelledby="h-goals2"><h2 id="h-goals2">How close you are to each goal</h2>
      ${goalColumns(rows)}
      <ul class="legend"><li><i class="lg-goal"></i>Your daily goal (100%)</li><li><i class="lg-over"></i>Past a goal you want to stay under</li></ul>
      <p class="hint">Sugar, saturated fat, sodium and cholesterol are limits, so under the line is good. Protein and fiber are worth reaching. Carbs and fat show as over when you've asked to be warned about them in Settings.</p>
    </section>`;
  }

  // 4. Top foods for a chosen nutrient
  const byFood = new Map();
  for (const e of entries) {
    const k = e.name;
    const cur = byFood.get(k) || { label: e.name, n: {} };
    for (const [key] of TOP_METRICS) cur.n[key] = (cur.n[key] || 0) + (e.nutrients[key] || 0);
    byFood.set(k, cur);
  }
  const meta = nutrientMeta(topMetric);
  const ranked = [...byFood.values()].map((x) => ({ label: x.label, value: x.n[topMetric] })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const topRows = ranked.slice(0, 5);
  const rest = ranked.slice(5).reduce((s, x) => s + x.value, 0);
  if (rest > 0) topRows.push({ label: `Everything else (${ranked.length - 5})`, value: rest });
  const sum = ranked.reduce((s, x) => s + x.value, 0);
  topRows.forEach((r) => {
    r.pct = sum ? (r.value / sum) * 100 : 0;
    r.value = Math.round(r.value);
    r.tip = `${r.label}: ${fmt(r.value)} ${meta.unit}`;
  });
  const topCard = `<section class="panel viz" aria-labelledby="h-top"><h2 id="h-top">Biggest sources</h2>
    <div class="seg small" role="group" aria-label="Nutrient">
      ${TOP_METRICS.map(([k, l]) => `<button type="button" data-act="metric" data-k="${k}" aria-pressed="${k === topMetric}">${l}</button>`).join('')}
    </div>
    ${topRows.length ? hbars(topRows, meta.unit) : `<p class="muted">None of today's foods list ${meta.label.toLowerCase()}.</p>`}
  </section>`;

  const root = mount(view, head + macroCard + mealCard + goalCard + topCard + '<div class="tip" id="tip" role="status" hidden></div>', {
    ...nav,
    metric: (el) => {
      topMetric = el.dataset.k;
      renderBreakdown(view, ctx);
    },
  });
  wireTips(root);
}

// Tap (or hover) any bar, slice or row for its exact numbers.
function wireTips(root) {
  const tip = root.querySelector('#tip');
  let current = null;
  let shownAt = 0;
  const show = (el, x, y) => {
    current = el;
    shownAt = Date.now();
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    const r = root.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const left = Math.min(Math.max(8, x - r.left - tw / 2), r.width - tw - 8);
    tip.style.left = `${left}px`;
    tip.style.top = `${y - r.top - tip.offsetHeight - 14}px`;
  };
  const hide = () => {
    current = null;
    tip.hidden = true;
  };
  root.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-tip]');
    if (!el || !el.dataset.tip) return hide();
    // A second tap on the same mark closes it (taps only; a mouse already shows it on hover).
    if (el === current && e.pointerType !== 'mouse') return hide();
    show(el, e.clientX, e.clientY);
  });
  root.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest('[data-tip]');
    if (el && el.dataset.tip) show(el, e.clientX, e.clientY);
    else hide();
  });
  const onScroll = () => {
    if (!root.isConnected) return window.removeEventListener('scroll', onScroll);
    if (Date.now() - shownAt > 400) hide();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}
