// Today: the day's totals laid out like a Nutrition Facts panel, then the diary by meal.

import { NUTRIENTS, computeGoals, totalsForEntries, addDays, dateKey, describeAmount, scaleNutrients, trimNum } from '../nutrition.js';
import { esc, fmt, mount, openSheet, toast, SLOTS, slotOptions, defaultSlot, nutrientTable, readNum, dateLabel, longDate, icon } from '../ui.js';
import { openAdd } from './add.js';

const MACROS = ['protein', 'carbs', 'fat'];
const WATCH = ['fiber', 'addedSugars', 'satFat', 'sodium', 'cholesterol'];
const MICROS = ['potassium', 'calcium', 'iron', 'vitD', 'vitA', 'vitC'];

function row(key, totals, reported, count, targets) {
  const m = NUTRIENTS.find((n) => n.key === key);
  const value = totals[key];
  const target = targets?.[key];
  const missing = count > 0 && reported[key] === 0;
  const partial = count > 0 && reported[key] > 0 && reported[key] < count;
  const valText = missing ? '—' : `${fmt(value, m.dp)}${partial ? '*' : ''}`;
  let state = '';
  let note = '';
  let pct = 0;
  if (target) {
    pct = Math.min(100, (value / target) * 100);
    if (m.kind === 'limit' && value > target) {
      state = 'over';
      note = `${fmt(value - target, m.dp)} over`;
    } else if (m.kind === 'target' && value >= target) {
      state = 'met';
    }
  }
  const goalText = target ? `<span class="ntarget">${m.kind === 'limit' ? 'up to' : 'of'} ${fmt(target, m.dp)} ${m.unit}</span>` : `<span class="ntarget">${m.unit}</span>`;
  return `<div class="nrow ${state}">
      <div class="nline"><span class="nlabel">${m.label}</span><span class="nval"><b>${valText}</b> ${goalText}${note ? ` <span class="nnote">${note}</span>` : ''}</span></div>
      ${target ? `<div class="bar" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></div>` : ''}
    </div>`;
}

export function renderToday(view, ctx) {
  const { store } = ctx;
  const date = ctx.date();
  const today = dateKey();
  const entries = store.entriesForDate(date);
  const { totals, reported, count } = totalsForEntries(entries);
  const goals = store.state.profile ? computeGoals(store.state.profile) : null;
  const t = goals?.ok ? goals.targets : null;
  const anyPartial = [...MACROS, ...WATCH, ...MICROS].some((k) => count > 0 && reported[k] > 0 && reported[k] < count);

  const eaten = Math.round(totals.kcal);
  let calBlock;
  if (t) {
    const left = t.kcal - eaten;
    calBlock = `<div class="cal ${left < 0 ? 'over' : ''}">
        <p class="cal-num"><span class="big">${fmt(Math.abs(left))}</span><span class="cal-word">${left < 0 ? 'calories over' : 'calories left'}</span></p>
        <p class="cal-sub">${fmt(eaten)} eaten of ${fmt(t.kcal)}</p>
      </div>`;
  } else {
    calBlock = `<div class="cal"><p class="cal-num"><span class="big">${fmt(eaten)}</span><span class="cal-word">calories eaten</span></p></div>`;
  }

  const slotHtml = SLOTS.map((s) => {
    const list = entries.filter((e) => e.slot === s.id);
    const kcal = list.reduce((sum, e) => sum + (e.nutrients.kcal || 0), 0);
    return `<section class="slot" aria-labelledby="slot-${s.id}">
        <header><h2 id="slot-${s.id}">${s.label}</h2>${list.length ? `<span class="slot-kcal">${fmt(kcal)} kcal</span>` : ''}</header>
        ${
          list.length
            ? `<ul class="entries">${list
                .map(
                  (e) => `<li><button type="button" class="row" data-act="entry" data-id="${esc(e.id)}">
                    <span class="r-main"><b>${esc(e.name)}</b><small>${esc([e.brand, describeAmount({ servingLabel: e.servingLabel }, e.qty, e.unit)].filter(Boolean).join(', '))}</small></span>
                    <span class="r-kcal">${fmt(e.nutrients.kcal || 0)}</span></button></li>`
                )
                .join('')}</ul>`
            : ''
        }
        <button type="button" class="add-link" data-act="add" data-slot="${s.id}">${icon.plus} Add to ${s.label.toLowerCase()}</button>
      </section>`;
  }).join('');

  mount(
    view,
    `${
      !store.state.profile
        ? `<div class="banner"><p><b>Set up your profile</b> to get daily calorie, macro and nutrient goals.</p><button type="button" class="btn primary" data-act="profile">Set up profile</button></div>`
        : ''
    }
    <section class="label" aria-label="Totals for ${esc(longDate(date))}">
      <header class="label-head">
        <button type="button" class="icon-btn" data-act="prev" aria-label="Previous day">${icon.left}</button>
        <div class="label-title"><h1>${dateLabel(date, today)}</h1><p>${esc(longDate(date))}</p></div>
        <button type="button" class="icon-btn" data-act="next" aria-label="Next day"${date >= today ? ' disabled' : ''}>${icon.right}</button>
      </header>
      <div class="rule-heavy"></div>
      ${calBlock}
      <div class="rule-mid"></div>
      ${MACROS.map((k) => row(k, totals, reported, count, t)).join('')}
      <div class="rule-mid"></div>
      ${WATCH.map((k) => row(k, totals, reported, count, t)).join('')}
      <details class="micros">
        <summary>Vitamins and minerals</summary>
        ${MICROS.map((k) => row(k, totals, reported, count, t)).join('')}
        <p class="hint">US labels must list vitamin D, calcium, iron and potassium. Vitamins A and C are optional, so their totals are often incomplete.</p>
      </details>
      ${anyPartial ? '<p class="foot">* Some foods you logged don’t list this nutrient, so the real total is likely higher.</p>' : ''}
      ${date !== today ? '<button type="button" class="link" data-act="today">Back to today</button>' : ''}
    </section>
    ${slotHtml}
    <button type="button" class="fab" data-act="add">${icon.plus}<span>Add food</span></button>`,
    {
      prev: () => ctx.setDate(addDays(date, -1)),
      next: () => date < today && ctx.setDate(addDays(date, 1)),
      today: () => ctx.setDate(today),
      add: (el) => openAdd(ctx, { slot: el.dataset.slot || (date === today ? defaultSlot() : 'snacks'), date }),
      entry: (el) => {
        const e = store.state.log.find((x) => x.id === el.dataset.id);
        if (e) openEntry(ctx, e);
      },
      profile: () => ctx.goTab('profile'),
    }
  );
}

function openEntry(ctx, entry) {
  const s = openSheet({ title: entry.name });
  const unitWord = entry.unit === 'g' ? 'Grams' : 'Servings';
  const root = s.render(
    `${entry.brand ? `<p class="muted">${esc(entry.brand)}</p>` : ''}
    <label class="field"><span>${unitWord}</span><input id="qty" inputmode="decimal" autocomplete="off" value="${trimNum(entry.qty)}"></label>
    ${entry.unit === 'serving' ? `<p class="muted small">1 serving is ${esc(entry.servingLabel || '1 serving')}</p>` : ''}
    <div id="np"></div>
    <label class="field"><span>Meal</span><select id="slot">${slotOptions(entry.slot)}</select></label>
    <div class="btn-row">
      <button type="button" class="btn primary" data-act="save">Save changes</button>
      <button type="button" class="btn danger" data-act="delete">${icon.trash} Delete</button>
    </div>`,
    {
      save: () => {
        const q = readNum(qtyEl);
        if (!(q > 0)) return draw();
        ctx.store.updateEntry(entry.id, {
          qty: q,
          nutrients: scaleNutrients(entry.nutrients, q / entry.qty),
          slot: root.querySelector('#slot').value,
        });
        s.close();
        toast('Entry updated');
      },
      delete: () => {
        const copy = { ...entry };
        ctx.store.deleteEntry(entry.id);
        s.close();
        toast(`Removed ${entry.name}`, {
          actionLabel: 'Undo',
          onAction: () => {
            const { id, ...rest } = copy;
            ctx.store.addEntry(rest);
          },
        });
      },
    }
  );
  const qtyEl = root.querySelector('#qty');
  const np = root.querySelector('#np');
  const draw = () => {
    const q = readNum(qtyEl);
    np.innerHTML = q > 0 ? nutrientTable(scaleNutrients(entry.nutrients, q / entry.qty)) : '<p class="err-text">Enter an amount above 0.</p>';
  };
  qtyEl.addEventListener('input', draw);
  draw();
}
