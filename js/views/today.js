// Today: the day's totals laid out like a Nutrition Facts panel, then the diary by meal.

import { NUTRIENTS, computeGoals, totalsForEntries, addDays, dateKey, describeAmount, scaleNutrients, trimNum } from '../nutrition.js';
import { esc, fmt, mount, openSheet, toast, SLOTS, slotOptions, defaultSlot, nutrientTable, readNum, dateLabel, longDate, icon } from '../ui.js';
import { openAdd } from './add.js';
import { confirmOverGoals } from '../guard.js';

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
        ${(() => {
          const prev = store.state.log.filter((e) => e.slot === s.id && e.date === addDays(date, -1));
          return !list.length && prev.length
            ? `<button type="button" class="copy-btn" data-act="copyprev" data-slot="${s.id}">${icon.copy}<span>Same as yesterday<small>${esc(prev.map((e) => e.name).join(', '))}, ${fmt(prev.reduce((t, e) => t + (e.nutrients.kcal || 0), 0))} kcal</small></span></button>`
            : '';
        })()}
        <div class="slot-actions">
          <button type="button" class="add-link" data-act="add" data-slot="${s.id}">${icon.plus} Add to ${s.label.toLowerCase()}</button>
          ${hasHistory(store, s.id, date) ? `<button type="button" class="add-link quiet" data-act="copyfrom" data-slot="${s.id}">${icon.copy} Copy from a past day</button>` : ''}
        </div>
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
      copyprev: (el) => {
        const src = store.state.log.filter((e) => e.slot === el.dataset.slot && e.date === addDays(date, -1));
        copyEntries(ctx, src, date, el.dataset.slot);
      },
      copyfrom: (el) => openCopy(ctx, el.dataset.slot, date),
    }
  );
}

function hasHistory(store, slot, date) {
  const from = addDays(date, -14);
  return store.state.log.some((e) => e.slot === slot && e.date < date && e.date >= from);
}

async function copyEntries(ctx, src, date, slot) {
  if (!src.length) return;
  if (!(await confirmOverGoals(ctx, { date, add: src.map((e) => e.nutrients) }))) return;
  const recs = ctx.store.addEntries(src.map(({ id, date: _d, slot: _s, ...rest }) => ({ ...rest, date, slot })));
  const label = SLOTS.find((x) => x.id === slot).label.toLowerCase();
  toast(`Copied ${recs.length} item${recs.length === 1 ? '' : 's'} to ${label}`, {
    actionLabel: 'Undo',
    onAction: () => ctx.store.deleteEntries(recs.map((r) => r.id)),
  });
}

// Pick a past day (last 14) and copy that meal to the day being viewed.
function openCopy(ctx, slot, date) {
  const label = SLOTS.find((x) => x.id === slot).label;
  const days = [];
  for (let i = 1; i <= 14; i++) {
    const d = addDays(date, -i);
    const entries = ctx.store.state.log.filter((e) => e.slot === slot && e.date === d);
    if (entries.length) days.push({ d, entries });
  }
  const s = openSheet({ title: `Copy ${label.toLowerCase()} from` });
  s.render(
    `<p class="hint">Copies every item from that day's ${label.toLowerCase()} to ${esc(dateLabel(date, dateKey()).toLowerCase() === 'today' ? 'today' : longDate(date))}. You can edit or remove items after.</p>
    <ul class="list">${days
      .map(
        ({ d, entries }, i) => `<li><button type="button" class="row" data-act="copy" data-i="${i}">
          <span class="r-main wrap"><b>${esc(dateLabel(d, dateKey()) === 'Today' ? 'Today' : `${dateLabel(d, dateKey())}, ${longDate(d).split(', ').slice(1).join(', ')}`)}</b>
            <small>${esc(entries.map((e) => e.name).join(', '))}</small></span>
          <span class="r-kcal">${fmt(entries.reduce((t, e) => t + (e.nutrients.kcal || 0), 0))}<small> kcal</small></span></button></li>`
      )
      .join('')}</ul>`,
    {
      copy: (el) => {
        const { entries } = days[Number(el.dataset.i)];
        s.close();
        copyEntries(ctx, entries, date, slot);
      },
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
        const nutrients = scaleNutrients(entry.nutrients, q / entry.qty);
        const slot = root.querySelector('#slot').value;
        confirmOverGoals(ctx, { date: entry.date, add: [nutrients], replacing: entry }).then((ok) => {
          if (!ok) return;
          ctx.store.updateEntry(entry.id, { qty: q, nutrients, slot });
          s.close();
          toast('Entry updated');
        });
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
