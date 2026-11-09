// SVG chart builders. They return markup built only from numbers and fixed labels,
// so it is safe to insert with innerHTML. Colors come from CSS classes.

import { daysBetween, kgToLb, parseKey } from './nutrition.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const shortDate = (key) => {
  const d = parseKey(key);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

function niceTicks(min, max, count = 4) {
  const span = Math.max(max - min, 1e-6);
  const rough = span / count;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) || 10 * pow;
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

const f1 = (n) => Number(n.toFixed(1));

// Also draws waist: pass convert and unit to override the kg-to-lb conversion.
export function weightChart({ points, trend, units = 'us', pace, goalKg, width = 360, height = 230, convert, unit, title = 'Weight' }) {
  const conv = convert || ((kg) => (units === 'us' ? kgToLb(kg) : kg));
  const unitLabel = unit || (units === 'us' ? 'lb' : 'kg');
  const m = { l: 44, r: 14, t: 14, b: 28 };
  const pw = width - m.l - m.r;
  const ph = height - m.t - m.b;
  if (!points.length) return '';

  const d0 = points[0].date;
  const d1 = points[points.length - 1].date;
  const span = Math.max(daysBetween(d0, d1), 1);
  const x = (date) => m.l + (points.length === 1 ? pw / 2 : (daysBetween(d0, date) / span) * pw);

  const paceLine = pace && points.length > 1
    ? [
        { date: d0, v: conv(points[0].kg) },
        { date: d1, v: conv(points[0].kg - (pace.rateKgPerWeek * span) / 7) },
      ]
    : null;

  const values = [...points.map((p) => conv(p.kg)), ...(trend || []).map((p) => conv(p.kg))];
  if (paceLine) values.push(...paceLine.map((p) => p.v));
  if (goalKg) values.push(conv(goalKg));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.12, 1);
  const ticks = niceTicks(lo - pad, hi + pad, 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const y = (v) => m.t + ph - ((v - yMin) / (yMax - yMin)) * ph;

  let svg = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title} over time in ${unitLabel}, from ${shortDate(d0)} to ${shortDate(d1)}">`;
  for (const t of ticks) {
    svg += `<line class="grid" x1="${m.l}" x2="${width - m.r}" y1="${f1(y(t))}" y2="${f1(y(t))}"/>`;
    svg += `<text class="axis" x="${m.l - 6}" y="${f1(y(t) + 4)}" text-anchor="end">${Number(t.toFixed(1))}</text>`;
  }
  const xLabels = points.length === 1 ? [d0] : [d0, points[Math.floor((points.length - 1) / 2)].date, d1];
  [...new Set(xLabels)].forEach((d, i, arr) => {
    const anchor = arr.length > 1 ? (i === 0 ? 'start' : i === arr.length - 1 ? 'end' : 'middle') : 'middle';
    svg += `<text class="axis" x="${f1(x(d))}" y="${height - 8}" text-anchor="${anchor}">${shortDate(d)}</text>`;
  });
  if (goalKg) {
    svg += `<line class="goal" x1="${m.l}" x2="${width - m.r}" y1="${f1(y(conv(goalKg)))}" y2="${f1(y(conv(goalKg)))}"/>`;
    svg += `<text class="axis goal-label" x="${width - m.r}" y="${f1(y(conv(goalKg)) - 5)}" text-anchor="end">Goal ${Number(conv(goalKg).toFixed(1))}</text>`;
  }
  if (paceLine) {
    svg += `<polyline class="pace" points="${paceLine.map((p) => `${f1(x(p.date))},${f1(y(p.v))}`).join(' ')}"/>`;
  }
  if (trend && trend.length > 1) {
    svg += `<polyline class="trend" points="${trend.map((p) => `${f1(x(p.date))},${f1(y(conv(p.kg)))}`).join(' ')}"/>`;
  }
  for (const p of points) {
    svg += `<circle class="dot" cx="${f1(x(p.date))}" cy="${f1(y(conv(p.kg)))}" r="3.2"/>`;
  }
  return svg + '</svg>';
}

export function calorieBars({ days, goal, width = 360, height = 200 }) {
  const m = { l: 44, r: 14, t: 14, b: 28 };
  const pw = width - m.l - m.r;
  const ph = height - m.t - m.b;
  const logged = days.filter((d) => d.kcal !== null);
  const top = Math.max(goal ? goal * 1.2 : 0, ...logged.map((d) => d.kcal), 500);
  const ticks = niceTicks(0, top, 4);
  const yMax = ticks[ticks.length - 1];
  const y = (v) => m.t + ph - (v / yMax) * ph;
  const slot = pw / days.length;
  const barW = Math.max(2, Math.min(18, slot * 0.68));

  let svg = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Calories eaten per day for the last ${days.length} days${goal ? `, against a goal of ${goal}` : ''}">`;
  for (const t of ticks) {
    svg += `<line class="grid" x1="${m.l}" x2="${width - m.r}" y1="${f1(y(t))}" y2="${f1(y(t))}"/>`;
    svg += `<text class="axis" x="${m.l - 6}" y="${f1(y(t) + 4)}" text-anchor="end">${t}</text>`;
  }
  days.forEach((d, i) => {
    if (d.kcal === null) return;
    const cx = m.l + slot * i + slot / 2;
    const over = goal && d.kcal > goal;
    svg += `<rect class="${over ? 'bar over' : 'bar'}" x="${f1(cx - barW / 2)}" y="${f1(y(d.kcal))}" width="${f1(barW)}" height="${f1(Math.max(1, m.t + ph - y(d.kcal)))}" rx="1.5"/>`;
  });
  if (goal) {
    svg += `<line class="goal" x1="${m.l}" x2="${width - m.r}" y1="${f1(y(goal))}" y2="${f1(y(goal))}"/>`;
    svg += `<text class="axis goal-label" x="${width - m.r}" y="${f1(y(goal) - 5)}" text-anchor="end">Goal ${goal}</text>`;
  }
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const mid = days[Math.floor((days.length - 1) / 2)].date;
  [[first, 0, 'start'], [mid, Math.floor((days.length - 1) / 2), 'middle'], [last, days.length - 1, 'end']].forEach(([d, i, anchor]) => {
    const cx = m.l + slot * i + slot / 2;
    svg += `<text class="axis" x="${f1(anchor === 'start' ? m.l : anchor === 'end' ? width - m.r : cx)}" y="${height - 8}" text-anchor="${anchor}">${shortDate(d)}</text>`;
  });
  return svg + '</svg>';
}
