// Recipes: batch cooking logged by weight.
// A recipe holds dated batches. Each batch has its own ingredients and the weight of the
// finished food, so "a 350 g bowl" works out to the right calories for that batch.

import {
  amountOptions, matchAmountOption, nutrientsForAmount, describeAmount, batchTotals, batchRawGrams,
  nutrientsFromBatch, scaleNutrients, trimNum, dateKey, normalizeBarcode, upceToUpca, gtinCheckDigitValid,
} from '../nutrition.js';
import { lookupBarcode, searchUsdaFoods, fetchUsdaFood } from '../lookup.js';
import { BarcodeScanner, describeCameraError } from '../scanner.js';
import { openSheet, mount, esc, fmt, readNum, toast, confirmSheet, slotOptions, defaultSlot, macroLine, nutrientTable, amountChips, wireAmountChips, icon, longDate } from '../ui.js';
import { renderFoodForm } from './foodform.js';
import { confirmOverGoals } from '../guard.js';

export const batchDate = (b) => longDate(b.date).split(', ').slice(1).join(', ');
const per100 = (b) => (b.cookedGrams > 0 ? (b.totals.kcal || 0) * (100 / b.cookedGrams) : null);

export function recipeSummary(ctx, r) {
  const b = ctx.store.latestBatch(r);
  if (!b) return 'No batches yet';
  const p = per100(b);
  return `${batchDate(b)} batch, ${p !== null ? `${fmt(p)} kcal per 100 g` : `${fmt(b.totals.kcal / (b.shares || 1))} kcal a bowl`}`;
}

export function sortRecipes(recipes) {
  return [...recipes].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0) || a.name.localeCompare(b.name));
}

function lastRecipeAmount(ctx, recipeId) {
  const log = ctx.store.state.log;
  for (let i = log.length - 1; i >= 0; i--) if (log[i].recipeId === recipeId) return { qty: log[i].qty, unit: log[i].unit };
  return null;
}

// ---------- Logging a bowl (works inside the Add sheet or on its own) ----------

export function renderRecipeLog(sheet, ctx, { recipe, batch = null, date, slot, back = null, onLogged }) {
  const batches = [...recipe.batches].sort((a, b) => (a.date < b.date ? 1 : -1));
  let b = batch || batches[0];
  const last = lastRecipeAmount(ctx, recipe.id);
  let unit = b.cookedGrams > 0 && (last?.unit !== 'portion' || !(b.shares > 0)) ? 'g' : 'portion';
  let startQty = last && last.unit === unit ? last.qty : unit === 'g' ? '' : 1;

  sheet.setTitle('Log a serving');
  sheet.showBack(back);
  const root = sheet.render(
    `<h3 class="food-name">${esc(recipe.name)}</h3>
    ${
      batches.length > 1
        ? `<label class="field"><span>Batch</span><select id="batch">${batches
            .map((x, i) => `<option value="${x.id}"${x === b ? ' selected' : ''}>${esc(batchDate(x))}${i === 0 ? ' (latest)' : ''}</option>`)
            .join('')}</select></label>`
        : `<p class="muted small">${esc(batchDate(b))} batch</p>`
    }
    <div id="amount"></div>
    <div id="preview"></div>
    <label class="field"><span>Meal</span><select id="slot">${slotOptions(slot)}</select></label>
    <button type="button" class="btn primary block" data-act="log">Log it</button>`,
    {
      unit: (el) => {
        unit = el.dataset.u;
        startQty = unit === 'g' ? '' : 1;
        drawAmount();
      },
      log: () => {
        const q = readNum(root.querySelector('#qty'));
        if (!(q > 0)) return update();
        const nutrients = nutrientsFromBatch(b, q, unit);
        const chosenSlot = root.querySelector('#slot').value;
        confirmOverGoals(ctx, { date, add: [nutrients] }).then((ok) => {
          if (!ok) return;
          ctx.store.touchRecipe(recipe.id);
          const rec = ctx.store.addEntry({
            date,
            slot: chosenSlot,
            kind: 'recipe',
            recipeId: recipe.id,
            batchId: b.id,
            name: recipe.name,
            brand: `${batchDate(b)} batch`,
            qty: q,
            unit,
            ...(unit === 'portion' ? { portionLabel: `1/${trimNum(b.shares)} of the batch` } : {}),
            servingLabel: '',
            nutrients,
          });
          toast(`Logged ${recipe.name}`, { actionLabel: 'Undo', onAction: () => ctx.store.deleteEntry(rec.id) });
          onLogged?.(rec);
        });
      },
    }
  );

  const amountEl = root.querySelector('#amount');
  const preview = root.querySelector('#preview');
  function update() {
    const q = readNum(root.querySelector('#qty'));
    preview.innerHTML =
      q > 0
        ? `<div class="preview"><p class="pv-kcal"><b>${fmt(nutrientsFromBatch(b, q, unit).kcal ?? 0)}</b> kcal</p><p class="pv-macros">${macroLine(nutrientsFromBatch(b, q, unit))}</p>
           <details><summary>All nutrients</summary>${nutrientTable(nutrientsFromBatch(b, q, unit))}</details></div>`
        : `<p class="hint">${unit === 'g' ? 'Weigh your bowl and enter the food’s weight (not the bowl’s).' : 'Enter how many bowls.'}</p>`;
  }
  function drawAmount() {
    const canG = b.cookedGrams > 0;
    const canShare = b.shares > 0;
    if (unit === 'g' && !canG) unit = 'portion';
    if (unit === 'portion' && !canShare && canG) unit = 'g';
    amountEl.innerHTML = `
      ${
        canG && canShare
          ? `<div class="seg small" role="group" aria-label="Log by">
               <button type="button" data-act="unit" data-u="g" aria-pressed="${unit === 'g'}">By weight</button>
               <button type="button" data-act="unit" data-u="portion" aria-pressed="${unit === 'portion'}">Bowls</button>
             </div>`
          : ''
      }
      <label class="field"><span>${unit === 'g' ? 'Grams of food' : `Bowls (the batch makes ${trimNum(b.shares)})`}</span>
        <input id="qty" inputmode="decimal" autocomplete="off" value="${startQty === '' ? '' : trimNum(startQty)}" ${unit === 'g' ? 'placeholder="e.g. 350"' : ''}></label>
      ${unit === 'portion' ? amountChips(Number(startQty)) : ''}
      <p class="muted small">${canG ? `The whole batch weighs ${fmt(b.cookedGrams)} g and has ${fmt(b.totals.kcal || 0)} kcal, about ${fmt(per100(b))} kcal per 100 g.` : `The whole batch has ${fmt(b.totals.kcal || 0)} kcal.`}</p>`;
    const qtyEl = amountEl.querySelector('#qty');
    if (unit === 'portion') wireAmountChips(amountEl, qtyEl, update);
    else qtyEl.addEventListener('input', update);
    if (unit === 'g' && startQty === '') qtyEl.setAttribute('autofocus', '');
    update();
  }
  root.querySelector('#batch')?.addEventListener('change', (e) => {
    b = batches.find((x) => x.id === e.target.value);
    drawAmount();
  });
  drawAmount();
  sheet.focus();
}

// ---------- Recipe overview ----------

export function openRecipe(ctx, recipeId = null) {
  let scanner = null;
  const stopScanner = () => {
    scanner?.stop();
    scanner = null;
  };
  const sheet = openSheet({ title: 'Recipe', onClose: stopScanner });
  const recipe = () => ctx.store.state.recipes.find((r) => r.id === recipeId);

  function overview() {
    stopScanner();
    const r = recipe();
    if (!r) return sheet.close();
    const batches = [...r.batches].sort((a, b) => (a.date < b.date ? 1 : -1));
    const latest = batches[0];
    sheet.setTitle(r.name);
    sheet.showBack(null);
    sheet.render(
      `${
        latest
          ? `<section class="batch-card">
               <p class="batch-date">Latest batch: ${esc(batchDate(latest))}</p>
               ${batchStats(latest)}
               <div class="btn-row">
                 <button type="button" class="btn primary" data-act="log" data-b="${latest.id}">Log a serving</button>
                 <button type="button" class="btn" data-act="again">Make it again</button>
               </div>
               <button type="button" class="link" data-act="edit" data-b="${latest.id}">Edit this batch</button>
             </section>`
          : `<div class="empty"><p>No batches yet.</p><button type="button" class="btn primary" data-act="again">Add a batch</button></div>`
      }
      ${
        batches.length > 1
          ? `<h3 class="subhead">Earlier batches</h3>
             <ul class="list">${batches
               .slice(1)
               .map(
                 (b) => `<li class="row-wrap">
                   <button type="button" class="row" data-act="edit" data-b="${b.id}">
                     <span class="r-main"><b>${esc(batchDate(b))}</b><small>${esc(b.ingredients.length + ' ingredients' + (per100(b) !== null ? `, ${fmt(per100(b))} kcal per 100 g` : ''))}</small></span>
                   </button>
                   <button type="button" class="btn small" data-act="log" data-b="${b.id}" aria-label="Log from the ${esc(batchDate(b))} batch">Log</button>
                 </li>`
               )
               .join('')}</ul>
             <p class="hint">Eating leftovers from an older pot? Log from that batch so the numbers match what's in it.</p>`
          : ''
      }
      <button type="button" class="btn danger" data-act="delete">Delete recipe</button>`,
      {
        log: (el) => {
          const b = r.batches.find((x) => x.id === el.dataset.b);
          renderRecipeLog(sheet, ctx, { recipe: r, batch: b, date: ctx.date(), slot: defaultSlot(), back: overview, onLogged: () => sheet.close() });
        },
        again: () => {
          const base = ctx.store.latestBatch(r);
          batchEditor({
            date: dateKey(),
            ingredients: base ? base.ingredients.map((i) => ({ ...i })) : [],
            cookedGrams: null,
            shares: base?.shares || null,
          }, { isNew: true, copiedFrom: base });
        },
        edit: (el) => {
          const b = r.batches.find((x) => x.id === el.dataset.b);
          batchEditor(JSON.parse(JSON.stringify(b)), { isNew: false });
        },
        delete: async () => {
          const ok = await confirmSheet({
            title: `Delete ${r.name}?`,
            message: 'This removes the recipe and all its batches. Anything you already logged stays in your diary.',
            confirmLabel: 'Delete recipe',
            danger: true,
          });
          if (!ok) return;
          ctx.store.deleteRecipe(r.id);
          toast('Recipe deleted');
          sheet.close();
        },
      }
    );
  }

  function batchStats(b) {
    const p = per100(b);
    return `<dl class="stats">
        <div><dt>Whole batch</dt><dd>${fmt(b.totals.kcal || 0)}</dd><small>kcal</small></div>
        <div><dt>Cooked weight</dt><dd>${b.cookedGrams > 0 ? fmt(b.cookedGrams) : '—'}</dd><small>${b.cookedGrams > 0 ? 'g' : 'not weighed'}</small></div>
        <div><dt>Per 100 g</dt><dd>${p !== null ? fmt(p) : '—'}</dd><small>kcal</small></div>
      </dl>
      <p class="pv-macros">${macroLine(b.cookedGrams > 0 ? scaleNutrients(b.totals, 100 / b.cookedGrams) : b.totals)}${b.cookedGrams > 0 ? '<span>per 100 g</span>' : '<span>whole batch</span>'}</p>`;
  }

  // ---------- Batch editor ----------

  // draft: { id?, date, ingredients, cookedGrams, shares }
  function batchEditor(draft, { isNew, copiedFrom = null }) {
    stopScanner();
    const r = recipe();
    const name = draft.name ?? r?.name ?? '';
    sheet.setTitle(r ? (isNew ? 'New batch' : 'Edit batch') : 'New recipe');
    sheet.showBack(r ? overview : null);

    const raw = batchRawGrams(draft.ingredients);
    const totals = batchTotals(draft.ingredients);
    const tare = r?.tareGrams || '';
    const root = sheet.render(
      `<div id="b-errors"></div>
      ${copiedFrom ? `<p class="notice">Copied from your ${esc(batchDate(copiedFrom))} batch. Change what's different this time: swap, remove or adjust ingredients, then weigh the new pot.</p>` : ''}
      <label class="field"><span>Recipe name</span><input id="r-name" maxlength="80" autocomplete="off" value="${esc(name)}" placeholder="Lasagna soup"></label>
      <label class="field"><span>Date made</span><input id="b-date" type="date" value="${esc(draft.date)}" max="${dateKey()}"></label>
      <h3 class="subhead">Ingredients <small>for the whole batch</small></h3>
      ${
        draft.ingredients.length
          ? `<ul class="list">${draft.ingredients
              .map(
                (ing, i) => `<li class="row-wrap">
                  <button type="button" class="row" data-act="ing" data-i="${i}">
                    <span class="r-main"><b>${esc(ing.name)}</b><small>${esc(describeAmount({ servingLabel: ing.servingLabel }, ing.qty, ing.unit, ing.portionLabel))}</small></span>
                    <span class="r-kcal">${fmt(ing.nutrients.kcal || 0)}<small> kcal</small></span>
                  </button>
                  <button type="button" class="icon-btn" data-act="remove" data-i="${i}" aria-label="Remove ${esc(ing.name)}">${icon.trash}</button>
                </li>`
              )
              .join('')}</ul>`
          : '<p class="muted">Add everything that goes in the pot, in the amounts you used: the onion, the pound of sausage, the can of tomatoes.</p>'
      }
      <button type="button" class="btn" data-act="add">${icon.plus} Add an ingredient</button>
      ${
        draft.ingredients.length
          ? `<div class="preview"><p class="pv-kcal"><b>${fmt(totals.kcal || 0)}</b> kcal in the whole batch</p><p class="pv-macros">${macroLine(totals)}</p>
             ${raw ? `<p class="hint">The raw ingredients weigh ${fmt(raw)} g. Cooking changes that (water cooks off, pasta soaks it up), so weigh the finished food.</p>` : ''}</div>`
          : ''
      }
      <h3 class="subhead">Weigh the finished batch</h3>
      <p class="hint">This is what lets you log by the weight of your bowl. Use grams on your kitchen scale.</p>
      <div class="two">
        <label class="field"><span>Pot and food <small>g</small></span><input id="gross" inputmode="decimal" autocomplete="off"></label>
        <label class="field"><span>Empty pot <small>g, remembered</small></span><input id="tare" inputmode="decimal" autocomplete="off" value="${tare ? trimNum(tare) : ''}"></label>
      </div>
      <label class="field"><span>Weight of the food <small>g</small></span><input id="cooked" inputmode="decimal" autocomplete="off" value="${draft.cookedGrams > 0 ? trimNum(draft.cookedGrams) : ''}"></label>
      <details class="more"${draft.shares > 0 && !(draft.cookedGrams > 0) ? ' open' : ''}><summary>No scale? Split it into bowls instead</summary>
        <label class="field"><span>Number of bowls in the batch</span><input id="shares" inputmode="decimal" autocomplete="off" value="${draft.shares > 0 ? trimNum(draft.shares) : ''}"></label>
        <p class="hint">You can fill in both. Then you can log either way.</p>
      </details>
      <div class="btn-row">
        <button type="button" class="btn primary" data-act="save">${isNew ? 'Save batch' : 'Save changes'}</button>
        ${!isNew ? '<button type="button" class="btn danger" data-act="delbatch">Delete batch</button>' : ''}
      </div>`,
      {
        add: () => {
          sync();
          ingredientPicker(draft, { isNew, copiedFrom });
        },
        ing: (el) => {
          sync();
          const i = Number(el.dataset.i);
          const ing = draft.ingredients[i];
          let food = ctx.store.state.foods.find((f) => f.id === ing.foodId);
          if (!food) {
            // The saved food was deleted: let the amount scale from what the ingredient already holds.
            const label = describeAmount({ servingLabel: ing.servingLabel }, 1, ing.unit, ing.portionLabel);
            food = { name: ing.name, servingLabel: label, nutrients: scaleNutrients(ing.nutrients, 1 / ing.qty), servingGrams: ing.grams > 0 ? ing.grams / ing.qty : undefined };
            draft.ingredients[i] = { ...ing, unit: 'serving', servingLabel: label, portionLabel: undefined };
          }
          ingredientAmount(draft, { isNew, copiedFrom }, food, i);
        },
        remove: (el) => {
          sync();
          draft.ingredients.splice(Number(el.dataset.i), 1);
          batchEditor(draft, { isNew, copiedFrom });
        },
        save: () => save(),
        delbatch: async () => {
          const used = ctx.store.entriesForBatch(draft.id).length;
          const ok = await confirmSheet({
            title: 'Delete this batch?',
            message: `The ${batchDate(draft)} batch will be removed.${used ? ` The ${used} diary entr${used === 1 ? 'y' : 'ies'} from it stay as they are.` : ''}`,
            confirmLabel: 'Delete batch',
            danger: true,
          });
          if (!ok) return;
          ctx.store.deleteBatch(recipeId, draft.id);
          toast('Batch deleted');
          overview();
        },
      }
    );

    const gross = root.querySelector('#gross');
    const tareEl = root.querySelector('#tare');
    const cooked = root.querySelector('#cooked');
    const fromPot = () => {
      const g = readNum(gross);
      const t = readNum(tareEl) || 0;
      if (g > 0 && g - t > 0) cooked.value = trimNum(g - t, 0);
    };
    gross.addEventListener('input', fromPot);
    tareEl.addEventListener('input', fromPot);
    if (!name) root.querySelector('#r-name').setAttribute('autofocus', '');
    sheet.focus();

    function sync() {
      draft.name = root.querySelector('#r-name').value;
      draft.date = root.querySelector('#b-date').value || dateKey();
      const c = readNum(cooked);
      draft.cookedGrams = c > 0 ? c : null;
      const s = readNum(root.querySelector('#shares'));
      draft.shares = s > 0 ? s : null;
      const t = readNum(tareEl);
      draft.tareGrams = t > 0 ? t : null;
    }

    function save() {
      sync();
      const errors = [];
      const nm = (draft.name || '').trim();
      if (!nm) errors.push('Give the recipe a name.');
      if (!draft.ingredients.length) errors.push('Add at least one ingredient.');
      if (!(draft.cookedGrams > 0) && !(draft.shares > 0)) errors.push('Enter the weight of the finished food, or the number of bowls, so you can log it.');
      if (draft.date > dateKey()) errors.push("The date can't be in the future.");
      if (errors.length) {
        root.querySelector('#b-errors').innerHTML = `<div class="errors" role="alert">${errors.map((e) => `<p>${esc(e)}</p>`).join('')}</div>`;
        sheet.body.scrollTop = 0;
        return;
      }
      if (!recipeId) recipeId = ctx.store.saveRecipe({ name: nm, tareGrams: draft.tareGrams || null }).id;
      else ctx.store.saveRecipe({ id: recipeId, name: nm, ...(draft.tareGrams ? { tareGrams: draft.tareGrams } : {}) });
      const batch = ctx.store.saveBatch(recipeId, {
        ...(draft.id ? { id: draft.id } : {}),
        date: draft.date,
        ingredients: draft.ingredients,
        cookedGrams: draft.cookedGrams,
        shares: draft.shares,
        totals: batchTotals(draft.ingredients),
      });
      toast(isNew ? 'Batch saved' : 'Batch updated');
      if (!isNew) offerEntryUpdate(batch);
      else overview();
    }
  }

  // After fixing a batch, the bowls you already logged from it can be recalculated.
  async function offerEntryUpdate(batch) {
    const entries = ctx.store.entriesForBatch(batch.id);
    if (!entries.length) return overview();
    const ok = await confirmSheet({
      title: 'Update past entries?',
      message: `You logged ${entries.length} serving${entries.length === 1 ? '' : 's'} from this batch. Recalculate ${entries.length === 1 ? 'it' : 'them'} with the changes? Amounts stay the same.`,
      confirmLabel: 'Update entries',
    });
    if (ok) {
      let n = 0;
      for (const e of entries) {
        try {
          const nutrients = nutrientsFromBatch(batch, e.qty, e.unit);
          ctx.store.updateEntry(e.id, { nutrients, brand: `${batchDate(batch)} batch`, ...(e.unit === 'portion' ? { portionLabel: `1/${trimNum(batch.shares)} of the batch` } : {}) });
          n++;
        } catch {
          // e.g. logged by weight but the batch no longer has a weight
        }
      }
      toast(`Updated ${n} entr${n === 1 ? 'y' : 'ies'}`);
    }
    if (!sheet.closed) overview();
  }

  // ---------- Ingredient picker ----------

  function ingredientPicker(draft, ctxOpts) {
    stopScanner();
    const back = () => batchEditor(draft, ctxOpts);
    sheet.setTitle('Add an ingredient');
    sheet.showBack(back);
    let usdaResults = [];
    let token = 0;
    const root = sheet.render(
      `<input type="search" id="q" class="search" placeholder="Search your foods or USDA" aria-label="Search foods" autocomplete="off">
      <ul class="list" id="list"></ul>
      <div id="usda"></div>
      <div class="btn-row">
        <button type="button" class="btn" data-act="scan">Scan a barcode</button>
        <button type="button" class="btn" data-act="hand">Enter by hand</button>
      </div>`,
      {
        pick: (el) => {
          const f = ctx.store.state.foods.find((x) => x.id === el.dataset.id);
          if (f) ingredientAmount(draft, ctxOpts, f);
        },
        usda: async () => {
          const q = qEl.value.trim();
          if (q.length < 2) return;
          const my = ++token;
          usdaEl.innerHTML = '<div class="working small-work"><span class="spinner" aria-hidden="true"></span><p>Searching USDA…</p></div>';
          try {
            usdaResults = await searchUsdaFoods(q, ctx.store.state.settings.usdaKey);
            if (my !== token) return;
            usdaEl.innerHTML = usdaResults.length
              ? `<h3 class="subhead">From USDA</h3><ul class="list">${usdaResults
                  .map((f, i) => `<li><button type="button" class="row" data-act="usdapick" data-i="${i}"><span class="r-main wrap"><b>${esc(f.name)}</b><small>Tap for portion sizes</small></span></button></li>`)
                  .join('')}</ul>`
              : `<p class="muted">USDA has nothing for "${esc(q)}". Try simpler words.</p>`;
          } catch (err) {
            if (my === token) usdaEl.innerHTML = `<p class="err-text">${esc(err.name === 'TypeError' ? "Couldn't reach USDA." : err.message)}</p>`;
          }
        },
        usdapick: async (el) => {
          const base = usdaResults[Number(el.dataset.i)];
          if (!base) return;
          sheet.render('<div class="working"><span class="spinner" aria-hidden="true"></span><p>Getting portion sizes…</p></div>');
          let full = base;
          try {
            full = (await fetchUsdaFood(base.fdcId, ctx.store.state.settings.usdaKey)) || base;
            full = { ...full, name: base.name };
          } catch {
            // keep the search result
          }
          if (sheet.closed) return;
          const existing = full.fdcId && ctx.store.state.foods.find((f) => f.fdcId === full.fdcId);
          const saved = existing ? ctx.store.saveFood({ id: existing.id, ...(full.portions ? { portions: full.portions } : {}) }) : ctx.store.saveFood(full);
          ingredientAmount(draft, ctxOpts, saved);
        },
        scan: () => ingredientScan(draft, ctxOpts),
        hand: () =>
          renderFoodForm(sheet, ctx, {
            prefill: { name: qEl.value.trim() },
            onBack: () => ingredientPicker(draft, ctxOpts),
            onSave: (saved) => ingredientAmount(draft, ctxOpts, saved),
          }),
      }
    );
    const qEl = root.querySelector('#q');
    const list = root.querySelector('#list');
    const usdaEl = root.querySelector('#usda');
    const draw = () => {
      const q = qEl.value.trim().toLowerCase();
      const foods = ctx.store.state.foods
        .filter((f) => !q || `${f.name} ${f.brand || ''}`.toLowerCase().includes(q))
        .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0) || a.name.localeCompare(b.name))
        .slice(0, 30);
      list.hidden = !foods.length;
      list.innerHTML = foods
        .map(
          (f) => `<li><button type="button" class="row" data-act="pick" data-id="${esc(f.id)}"><span class="r-main"><b>${esc(f.name)}</b><small>${esc([f.brand, f.servingLabel].filter(Boolean).join(', '))}</small></span></button></li>`
        )
        .join('');
      token++;
      usdaEl.innerHTML = q.length >= 2 ? `<button type="button" class="btn block ghost" data-act="usda">Search USDA for "${esc(qEl.value.trim())}"</button>` : '';
    };
    qEl.addEventListener('input', draw);
    draw();
    qEl.focus({ preventScroll: true });
  }

  function ingredientScan(draft, ctxOpts) {
    const back = () => ingredientPicker(draft, ctxOpts);
    sheet.setTitle('Scan an ingredient');
    sheet.showBack(back);
    const root = sheet.render(
      `<div class="viewfinder"><video id="cam" playsinline muted autoplay></video><div class="guide" aria-hidden="true"></div><p class="vf-status" id="vf-status">Starting camera…</p></div>
      <form data-submit="manual" class="inline-form" novalidate>
        <label class="field grow"><span>Or type the barcode number</span><input id="code" inputmode="numeric" autocomplete="off"></label>
        <button type="submit" class="btn">Look up</button>
      </form>
      <p class="err-text" id="code-err" role="alert"></p>`,
      {
        manual: () => {
          const d = root.querySelector('#code').value.replace(/\D/g, '');
          if (![8, 12, 13, 14].includes(d.length) || !gtinCheckDigitValid(d)) {
            root.querySelector('#code-err').textContent = 'That number doesn’t look like a valid barcode. Check for a typo.';
            return;
          }
          handle(d);
        },
      }
    );
    const status = root.querySelector('#vf-status');
    const s = new BarcodeScanner(root.querySelector('#cam'), { onDetect: (text, format) => handle(text, format) });
    scanner = s;
    s.start()
      .then(() => scanner === s && (status.textContent = 'Fit the barcode inside the box'))
      .catch((err) => scanner === s && (status.textContent = describeCameraError(err)));

    async function handle(raw, format = '') {
      let code = String(raw).replace(/\D/g, '');
      if (format === 'UPC-E') code = upceToUpca(code) || code;
      stopScanner();
      const own = ctx.store.findFoodByBarcode(code);
      if (own) return ingredientAmount(draft, ctxOpts, own);
      sheet.render(`<div class="working"><span class="spinner" aria-hidden="true"></span><p>Looking up ${esc(code)}…</p></div>`);
      const res = await lookupBarcode(code, { usdaKey: ctx.store.state.settings.usdaKey });
      if (sheet.closed) return;
      if (res.status === 'found') return ingredientAmount(draft, ctxOpts, ctx.store.saveFood({ ...res.food, barcode: normalizeBarcode(code) }));
      renderFoodForm(sheet, ctx, {
        prefill: { ...(res.prefill || {}), barcode: normalizeBarcode(code) },
        note: res.status === 'error' ? "Couldn't reach the food databases. Enter it from the label." : `Barcode ${code} wasn't found. Copy the numbers from the label once and it's saved for next time.`,
        onBack: () => ingredientPicker(draft, ctxOpts),
        onSave: (saved) => ingredientAmount(draft, ctxOpts, saved),
      });
    }
  }

  // ---------- Ingredient amount ----------

  function ingredientAmount(draft, ctxOpts, food, index = null) {
    stopScanner();
    const existing = index !== null ? draft.ingredients[index] : null;
    const opts = amountOptions(food);
    let cur = matchAmountOption(opts, existing) || opts[0];
    const startQty = existing && matchAmountOption(opts, existing) ? existing.qty : 1;
    sheet.setTitle(existing ? 'Change amount' : 'How much went in?');
    sheet.showBack(() => (existing ? batchEditor(draft, ctxOpts) : ingredientPicker(draft, ctxOpts)));
    const root = sheet.render(
      `<h3 class="food-name">${esc(food.name)}</h3>
      ${food.brand ? `<p class="muted">${esc(food.brand)}</p>` : ''}
      <div class="amount portioned">
        <label class="field"><span>Amount</span><input id="qty" inputmode="decimal" autocomplete="off" value="${trimNum(startQty)}"></label>
        <label class="field"><span>Unit</span><select id="unit">${opts.map((o) => `<option value="${o.key}"${o === cur ? ' selected' : ''}>${esc(o.unit === 'serving' && !food.portions?.length ? `Servings (${food.servingLabel || '1 serving'})` : o.text)}</option>`).join('')}</select></label>
      </div>
      <p class="hint">For packages, the label's serving size and grams per serving tell you how many servings the whole package is. A 1 lb package is 454 g.</p>
      <div id="preview"></div>
      <button type="button" class="btn primary block" data-act="done">${existing ? 'Save' : 'Add to batch'}</button>`,
      {
        done: () => {
          const q = readNum(qtyEl);
          if (!(q > 0)) return update();
          const ing = {
            foodId: food.id,
            name: food.name,
            qty: q,
            unit: cur.unit,
            ...(cur.portion ? { portionLabel: cur.portion.label, portionGrams: cur.portion.grams } : {}),
            servingLabel: food.servingLabel,
            grams: cur.grams > 0 ? q * cur.grams : null,
            nutrients: nutrientsForAmount(food, q, cur.unit, cur.portion),
          };
          if (existing) draft.ingredients[index] = ing;
          else draft.ingredients.push(ing);
          if (food.id) ctx.store.touchFood(food.id);
          batchEditor(draft, ctxOpts);
        },
      }
    );
    const qtyEl = root.querySelector('#qty');
    const preview = root.querySelector('#preview');
    const update = () => {
      const q = readNum(qtyEl);
      preview.innerHTML = q > 0 ? `<div class="preview"><p class="pv-kcal"><b>${fmt(nutrientsForAmount(food, q, cur.unit, cur.portion).kcal ?? 0)}</b> kcal</p><p class="pv-macros">${macroLine(nutrientsForAmount(food, q, cur.unit, cur.portion))}</p></div>` : '<p class="err-text">Enter an amount above 0.</p>';
    };
    root.querySelector('#unit').addEventListener('change', (e) => {
      const next = opts.find((o) => o.key === e.target.value);
      const q = readNum(qtyEl);
      if (q > 0 && cur.grams > 0 && next.grams > 0) qtyEl.value = trimNum((q * cur.grams) / next.grams, next.unit === 'g' ? 0 : 2);
      cur = next;
      update();
    });
    qtyEl.addEventListener('input', update);
    update();
  }

  if (recipeId) overview();
  else batchEditor({ date: dateKey(), ingredients: [], cookedGrams: null, shares: null }, { isNew: true });
  return sheet;
}
