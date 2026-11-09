// The "Add food" sheet: Scan, My foods, Meals, Quick add, and the amount picker.

import { nutrientsForAmount, scaleNutrients, trimNum, normalizeBarcode, gtinCheckDigitValid, upceToUpca } from '../nutrition.js';
import { lookupBarcode, searchUsdaFoods } from '../lookup.js';
import { BarcodeScanner, decodeImageFile, describeCameraError } from '../scanner.js';
import { openSheet, mount, esc, fmt, readNum, toast, defaultSlot, slotOptions, nutrientTable, macroLine, icon, SLOTS, amountChips, wireAmountChips } from '../ui.js';
import { renderFoodForm, nutrientInputsHtml, readNutrients, wireCalorieHint, errorBox } from './foodform.js';
import { openMealBuilder } from './mealbuilder.js';
import { confirmOverGoals } from '../guard.js';

const TABS = [
  { id: 'recent', label: 'Recent' },
  { id: 'scan', label: 'Scan' },
  { id: 'library', label: 'Foods' },
  { id: 'meals', label: 'Meals' },
  { id: 'quick', label: 'Quick' },
];
const slotLabel = (id) => SLOTS.find((s) => s.id === id)?.label || 'Snacks';

export function sortFoods(foods, query = '') {
  const q = query.trim().toLowerCase();
  return foods
    .filter((f) => !q || `${f.name} ${f.brand || ''}`.toLowerCase().includes(q))
    .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0) || a.name.localeCompare(b.name));
}

export function foodRow(f, act = 'pick') {
  const sub = [f.brand, f.servingLabel].filter(Boolean).join(', ');
  return `<li><button type="button" class="row" data-act="${act}" data-id="${esc(f.id)}">
      <span class="r-main"><b>${esc(f.name)}</b><small>${esc(sub)}</small></span>
      <span class="r-kcal">${fmt(f.nutrients?.kcal ?? 0)}<small> kcal</small></span>
    </button></li>`;
}

function previewHtml(n) {
  return `<div class="preview">
      <p class="pv-kcal"><b>${fmt(n.kcal ?? 0)}</b> kcal</p>
      <p class="pv-macros">${macroLine(n)}</p>
      <details><summary>All nutrients</summary>${nutrientTable(n)}<p class="hint">Nutrients the label didn't list are left out.</p></details>
    </div>`;
}

// opts: { slot, date, tab, food, meal }
export function openAdd(ctx, opts = {}) {
  const state = { slot: opts.slot || defaultSlot(), date: opts.date || ctx.date() };
  let scanner = null;
  let lookupToken = 0;
  const sheet = openSheet({
    title: 'Add food',
    onClose: () => {
      scanner?.stop();
      lookupToken++;
    },
  });
  const stopScanner = () => {
    scanner?.stop();
    scanner = null;
  };

  async function logEntry(entry, label) {
    if (!(await confirmOverGoals(ctx, { date: state.date, add: [entry.nutrients] }))) return false;
    const rec = ctx.store.addEntry({ date: state.date, slot: state.slot, ...entry });
    sheet.close();
    toast(`Logged ${label}`, { actionLabel: 'Undo', onAction: () => ctx.store.deleteEntry(rec.id) });
    return true;
  }

  // ---------- tabs ----------

  function showTab(tab, query = '') {
    stopScanner();
    lookupToken++;
    if (ctx.store.state.settings.addTab !== tab) ctx.store.setSettings({ addTab: tab });
    sheet.setTitle(`Add to ${slotLabel(state.slot).toLowerCase()}`);
    sheet.showBack(null);
    const root = sheet.render(
      `<div class="seg tabs" role="tablist" aria-label="How to add">
        ${TABS.map((t) => `<button type="button" role="tab" data-act="tab" data-tab="${t.id}" aria-selected="${t.id === tab}">${t.label}</button>`).join('')}
      </div>
      <div id="pane"></div>`,
      { tab: (el) => showTab(el.dataset.tab) }
    );
    const pane = root.querySelector('#pane');
    ({ recent: recentPane, scan: scanPane, library: libraryPane, meals: mealsPane, quick: quickPane })[tab](pane, query);
  }

  // ---------- recent ----------

  // Build the diary entry for a recent item at the amount used last time.
  function repeatEntry(group) {
    const e = group.last;
    if (e.kind === 'meal') {
      const meal = ctx.store.state.meals.find((m) => m.id === e.mealId);
      return { kind: 'meal', mealId: meal.id, name: meal.name, brand: '', qty: e.qty, unit: 'serving', servingLabel: '1 serving', nutrients: scaleNutrients(meal.perServing, e.qty) };
    }
    if (e.kind === 'food') {
      const food = ctx.store.state.foods.find((f) => f.id === e.foodId);
      const unit = e.unit === 'g' && food.servingGrams > 0 ? 'g' : 'serving';
      const qty = unit === e.unit ? e.qty : 1;
      return { kind: 'food', foodId: food.id, name: food.name, brand: food.brand || '', qty, unit, servingLabel: food.servingLabel, nutrients: nutrientsForAmount(food, qty, unit) };
    }
    const { id, date, slot, ...rest } = e;
    return rest;
  }

  function recentPane(pane) {
    let groups = ctx.store.recentFor(state.slot);
    const anyMeal = !groups.length;
    if (anyMeal) groups = ctx.store.recentFor(null);
    const amount = (g) => {
      const e = repeatEntry(g);
      return `${e.unit === 'g' ? `${trimNum(e.qty)} g` : `${trimNum(e.qty)} serving${e.qty === 1 ? '' : 's'}`}, ${fmt(e.nutrients.kcal || 0)} kcal`;
    };
    mount(
      pane,
      groups.length
        ? `<p class="hint">${anyMeal ? `Nothing logged at ${slotLabel(state.slot).toLowerCase()} lately, so here's what you've eaten at any meal.` : `What you've had at ${slotLabel(state.slot).toLowerCase()} in the last 30 days. Tap + to log it at the same amount.`}</p>
           <ul class="list">${groups
             .map(
               (g, i) => `<li class="row-wrap">
                 <button type="button" class="row" data-act="open" data-i="${i}">
                   <span class="r-main"><b>${esc(g.last.name)}</b><small>${esc(amount(g))}</small></span>
                 </button>
                 <button type="button" class="btn small add-one" data-act="quicklog" data-i="${i}" aria-label="Log ${esc(g.last.name)}, ${esc(amount(g))}">${icon.plus}</button>
               </li>`
             )
             .join('')}</ul>`
        : `<div class="empty"><p>Foods you log show up here, sorted by what you eat most at each meal. Then logging your usual breakfast is one tap.</p>
           <button type="button" class="btn primary" data-act="scan">Scan a barcode</button></div>`,
      {
        scan: () => showTab('scan'),
        open: (el) => {
          const g = groups[Number(el.dataset.i)];
          const e = repeatEntry(g);
          const back = () => showTab('recent');
          if (e.kind === 'food') showPicker({ food: ctx.store.state.foods.find((f) => f.id === e.foodId), back, initial: { qty: e.qty, unit: e.unit } });
          else if (e.kind === 'meal') showMealPicker(ctx.store.state.meals.find((m) => m.id === e.mealId), back, e.qty);
          else quickLog(el, g);
        },
        quicklog: (el) => quickLog(el, groups[Number(el.dataset.i)]),
      }
    );
  }

  // Logs without closing, so you can add several things in a row.
  async function quickLog(el, group) {
    const entry = repeatEntry(group);
    if (!(await confirmOverGoals(ctx, { date: state.date, add: [entry.nutrients] }))) return;
    if (entry.foodId && entry.kind === 'food') ctx.store.touchFood(entry.foodId);
    if (entry.mealId) ctx.store.touchMeal(entry.mealId);
    const rec = ctx.store.addEntry({ ...entry, date: state.date, slot: state.slot });
    const btn = el.closest('li')?.querySelector('.add-one');
    if (btn) {
      btn.classList.add('done');
      btn.innerHTML = icon.check;
      btn.setAttribute('aria-label', `Logged ${entry.name}`);
    }
    toast(`Logged ${entry.name}`, { actionLabel: 'Undo', onAction: () => ctx.store.deleteEntry(rec.id) });
  }

  // ---------- scan ----------

  function scanPane(pane) {
    const root = mount(
      pane,
      `<div class="viewfinder">
        <video id="cam" playsinline muted autoplay></video>
        <div class="guide" aria-hidden="true"></div>
        <p class="vf-status" id="vf-status">Starting camera…</p>
      </div>
      <div class="btn-row">
        <button type="button" class="btn" data-act="torch" hidden>${icon.bolt} Light</button>
        <label class="btn file-btn">Scan from a photo<input type="file" accept="image/*" id="photo" class="visually-hidden"></label>
      </div>
      <form data-submit="manual" class="inline-form" novalidate>
        <label class="field grow"><span>Or type the barcode number</span>
          <input id="code" inputmode="numeric" autocomplete="off" placeholder="12 or 13 digits"></label>
        <button type="submit" class="btn">Look up</button>
      </form>
      <p class="err-text" id="code-err" role="alert"></p>`,
      {
        torch: async (el) => {
          const on = el.getAttribute('aria-pressed') !== 'true';
          try {
            await scanner?.setTorch(on);
            el.setAttribute('aria-pressed', String(on));
          } catch {
            el.hidden = true;
          }
        },
        manual: () => {
          const digits = root.querySelector('#code').value.replace(/\D/g, '');
          const err = root.querySelector('#code-err');
          if (![8, 12, 13, 14].includes(digits.length)) {
            err.textContent = 'Barcodes have 8, 12 or 13 digits. Check the number under the bars.';
            return;
          }
          if (!gtinCheckDigitValid(digits)) {
            err.textContent = "That number doesn't pass the barcode check. Look for a mistyped digit.";
            return;
          }
          handleCode(digits);
        },
      }
    );

    const status = root.querySelector('#vf-status');
    const torchBtn = root.querySelector('[data-act="torch"]');
    root.querySelector('#photo').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      status.textContent = 'Reading the photo…';
      try {
        const code = await decodeImageFile(file);
        if (code) handleCode(code);
        else status.textContent = 'No barcode found in that photo. Try again closer, with the bars in focus.';
      } catch (err) {
        status.textContent = err.message;
      }
    });

    const s = new BarcodeScanner(root.querySelector('#cam'), { onDetect: (text, format) => handleCode(text, format) });
    scanner = s;
    s.start()
      .then(() => {
        if (scanner !== s) return;
        status.textContent = 'Fit the barcode inside the box';
        if (s.canTorch) torchBtn.hidden = false;
      })
      .catch((err) => {
        if (scanner !== s) return;
        status.textContent = describeCameraError(err);
        status.classList.add('err');
      });
  }

  async function handleCode(raw, format = '') {
    let code = String(raw).replace(/\D/g, '');
    if (format === 'UPC-E') code = upceToUpca(code) || code;
    stopScanner();
    navigator.vibrate?.(30);
    const back = () => showTab('scan');
    sheet.showBack(back);

    const own = ctx.store.findFoodByBarcode(code);
    if (own) return showPicker({ food: own, back });

    const token = ++lookupToken;
    sheet.setTitle('Looking up');
    sheet.render(`<div class="working"><span class="spinner" aria-hidden="true"></span><p>Searching for barcode ${esc(code)}…</p></div>`);
    const result = await lookupBarcode(code, { usdaKey: ctx.store.state.settings.usdaKey });
    if (token !== lookupToken || sheet.closed) return;

    if (result.status === 'found') {
      return showPicker({ food: { ...result.food, barcode: normalizeBarcode(code) }, back, isNew: true });
    }
    if (result.status === 'error') {
      sheet.setTitle('Lookup failed');
      sheet.render(
        `<p>Couldn't reach the food databases. Check your connection and try again.</p>
        ${errorBox(result.errors)}
        <div class="btn-row">
          <button type="button" class="btn primary" data-act="retry">Try again</button>
          <button type="button" class="btn" data-act="manual">Enter it by hand</button>
        </div>`,
        { retry: () => handleCode(code), manual: () => byHand(code, {}) }
      );
      return;
    }
    const note =
      result.status === 'partial'
        ? `Found "${result.prefill.name || 'this product'}" but it has no nutrition data. Copy the numbers from the label. Next time you scan it, it'll come straight from your foods.`
        : `Barcode ${code} isn't in USDA or Open Food Facts. Copy the numbers from the label once, and next time it'll come straight from your foods.`;
    byHand(code, result.prefill || {}, note);
  }

  function byHand(code, prefill, note = '') {
    renderFoodForm(sheet, ctx, {
      prefill: { ...prefill, barcode: normalizeBarcode(code) },
      note,
      onBack: () => showTab('scan'),
      onSave: (saved) => showPicker({ food: saved, back: () => showTab('scan') }),
    });
  }

  // ---------- amount picker ----------

  function showPicker({ food, back, isNew = false, initial = null }) {
    const canGrams = food.servingGrams > 0;
    const last = initial || (isNew ? null : ctx.store.lastAmount(food.id));
    let unit = last?.unit === 'g' && canGrams ? 'g' : 'serving';
    const startQty = last && last.unit === unit ? last.qty : 1;
    sheet.setTitle(isNew ? 'Found it' : 'How much?');
    sheet.showBack(back || null);
    const root = sheet.render(
      `<h3 class="food-name">${esc(food.name)}</h3>
      ${food.brand ? `<p class="muted">${esc(food.brand)}</p>` : ''}
      ${isNew ? `<p class="source">From ${esc(food.source)}. It'll be saved to your foods when you log it. Numbers look off? Tap Edit to fix them first.</p>` : ''}
      <div class="amount">
        <label class="field"><span>Amount</span><input id="qty" inputmode="decimal" autocomplete="off" value="${trimNum(startQty)}"></label>
        <div class="seg" role="group" aria-label="Unit">
          <button type="button" data-act="unit" data-unit="serving" aria-pressed="${unit === 'serving'}">Servings</button>
          ${canGrams ? `<button type="button" data-act="unit" data-unit="g" aria-pressed="${unit === 'g'}">Grams</button>` : ''}
        </div>
      </div>
      <div id="chips"${unit === 'g' ? ' hidden' : ''}>${amountChips(startQty)}</div>
      <p class="muted small">1 serving is ${esc(food.servingLabel || '1 serving')}${last && !initial ? `. Filled in with what you had last time.` : ''}</p>
      <div id="preview"></div>
      <label class="field"><span>Meal</span><select id="slot">${slotOptions(state.slot)}</select></label>
      <div class="btn-row">
        <button type="button" class="btn primary" data-act="log">Log it</button>
        <button type="button" class="btn" data-act="edit">Edit</button>
      </div>`,
      {
        unit: (el) => {
          const next = el.dataset.unit;
          if (next === unit) return;
          const q = readNum(qtyEl);
          if (q > 0) qtyEl.value = trimNum(next === 'g' ? q * food.servingGrams : q / food.servingGrams, next === 'g' ? 0 : 2);
          unit = next;
          root.querySelectorAll('[data-act="unit"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unit === unit)));
          root.querySelector('#chips').hidden = unit === 'g';
          update();
        },
        edit: () =>
          renderFoodForm(sheet, ctx, {
            food,
            onBack: () => showPicker({ food, back, isNew }),
            onSave: (saved) => showPicker({ food: saved, back }),
          }),
        log: () => {
          const q = readNum(qtyEl);
          if (!(q > 0)) return update();
          state.slot = root.querySelector('#slot').value;
          const nutrients = nutrientsForAmount(food, q, unit);
          confirmOverGoals(ctx, { date: state.date, add: [nutrients] }).then((ok) => {
            if (!ok) return;
            const saved = ctx.store.state.foods.some((x) => x.id === food.id) ? food : ctx.store.saveFood(food);
            ctx.store.touchFood(saved.id);
            const rec = ctx.store.addEntry({
              date: state.date,
              slot: state.slot,
              kind: 'food',
              foodId: saved.id,
              name: saved.name,
              brand: saved.brand || '',
              qty: q,
              unit,
              servingLabel: saved.servingLabel,
              nutrients,
            });
            sheet.close();
            toast(`Logged ${saved.name}`, { actionLabel: 'Undo', onAction: () => ctx.store.deleteEntry(rec.id) });
          });
        },
      }
    );
    const qtyEl = root.querySelector('#qty');
    const preview = root.querySelector('#preview');
    function update() {
      const q = readNum(qtyEl);
      preview.innerHTML = q > 0 ? previewHtml(nutrientsForAmount(food, q, unit)) : '<p class="err-text">Enter an amount above 0.</p>';
    }
    wireAmountChips(root, qtyEl, update);
    update();
  }

  // ---------- library and USDA search ----------

  function libraryPane(pane, query = '') {
    let usdaResults = [];
    let searchToken = 0;
    const root = mount(
      pane,
      `<form data-submit="usda" class="inline-form" novalidate role="search">
        <input type="search" id="q" class="search grow" placeholder="Search foods, like banana or chicken breast" aria-label="Search foods" autocomplete="off" value="${esc(query)}">
      </form>
      <ul class="list" id="list"></ul>
      <div id="usda"></div>
      <button type="button" class="btn" data-act="new">${icon.plus} Enter a food by hand</button>`,
      {
        pick: (el) => {
          const food = ctx.store.state.foods.find((f) => f.id === el.dataset.id);
          if (food) showPicker({ food, back: () => showTab('library') });
        },
        usda: () => runUsda(),
        usdapick: (el) => {
          const food = usdaResults[Number(el.dataset.i)];
          const q = qEl.value;
          if (food) showPicker({ food, isNew: true, back: () => showTab('library', q) });
        },
        new: () =>
          renderFoodForm(sheet, ctx, {
            prefill: { name: qEl.value.trim() },
            onBack: () => showTab('library'),
            onSave: (saved) => showPicker({ food: saved, back: () => showTab('library') }),
          }),
      }
    );
    const qEl = root.querySelector('#q');
    const list = root.querySelector('#list');
    const usdaEl = root.querySelector('#usda');

    function drawOwn() {
      const q = qEl.value.trim();
      const rows = sortFoods(ctx.store.state.foods, q);
      if (!ctx.store.state.foods.length) {
        list.hidden = true;
      } else {
        list.innerHTML = rows.length ? rows.map((f) => foodRow(f)).join('') : `<li class="muted pad">None of your saved foods match "${esc(q)}".</li>`;
      }
      usdaResults = [];
      searchToken++;
      usdaEl.innerHTML =
        q.length >= 2
          ? `<button type="button" class="btn block ghost" data-act="usda">Search USDA for "${esc(q)}"</button>`
          : ctx.store.state.foods.length
            ? ''
            : '<p class="hint">Type a food to search USDA\'s database of whole and common foods: produce, meat, eggs, rice, and dishes like tacos or fried rice.</p>';
    }

    async function runUsda() {
      const q = qEl.value.trim();
      if (q.length < 2) return;
      const token = ++searchToken;
      usdaEl.innerHTML = '<div class="working small-work"><span class="spinner" aria-hidden="true"></span><p>Searching USDA\u2026</p></div>';
      try {
        const results = await searchUsdaFoods(q, ctx.store.state.settings.usdaKey);
        if (token !== searchToken || sheet.closed) return;
        usdaResults = results;
        usdaEl.innerHTML = results.length
          ? `<h3 class="subhead">From USDA</h3>
             <ul class="list">${results
               .map(
                 (f, i) => `<li><button type="button" class="row" data-act="usdapick" data-i="${i}">
                   <span class="r-main wrap"><b>${esc(f.name)}</b><small>${esc(f.servingLabel)}</small></span>
                   <span class="r-kcal">${fmt(f.nutrients.kcal ?? 0)}<small> kcal</small></span></button></li>`
               )
               .join('')}</ul>
             <p class="hint">USDA names are wordy. "Raw" and "cooked" matter: cooked meat and rice weigh differently than raw.</p>`
          : `<p class="muted">USDA has nothing for "${esc(q)}". Try fewer or simpler words, like "rice white cooked".</p>`;
      } catch (err) {
        if (token !== searchToken) return;
        usdaEl.innerHTML = `<p class="err-text">${esc(err.name === 'TypeError' ? "Couldn't reach USDA. Check your connection." : err.message)}</p>
          <button type="button" class="btn block ghost" data-act="usda">Try again</button>`;
      }
    }

    qEl.addEventListener('input', drawOwn);
    drawOwn();
    if (query) runUsda();
  }

  // ---------- meals ----------

  function mealsPane(pane) {
    const meals = [...ctx.store.state.meals].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0) || a.name.localeCompare(b.name));
    const build = () =>
      openMealBuilder(ctx, {
        onSaved: (meal) => {
          if (!sheet.closed) showMealPicker(meal, () => showTab('meals'));
        },
      });
    mount(
      pane,
      meals.length
        ? `<ul class="list">${meals
            .map(
              (m) => `<li><button type="button" class="row" data-act="pick" data-id="${esc(m.id)}">
                <span class="r-main"><b>${esc(m.name)}</b><small>${m.items.length} ingredient${m.items.length === 1 ? '' : 's'}, makes ${trimNum(m.yield)}</small></span>
                <span class="r-kcal">${fmt(m.perServing?.kcal ?? 0)}<small> kcal</small></span></button></li>`
            )
            .join('')}</ul>
           <button type="button" class="btn" data-act="build">${icon.plus} Build a meal</button>`
        : `<div class="empty"><p>Save something you make often, like your usual breakfast or a pot of chili, and log a serving of it in one tap.</p>
           <button type="button" class="btn primary" data-act="build">Build a meal</button></div>`,
      {
        pick: (el) => {
          const meal = ctx.store.state.meals.find((m) => m.id === el.dataset.id);
          if (meal) showMealPicker(meal, () => showTab('meals'));
        },
        build,
      }
    );
  }

  function showMealPicker(meal, back, startQty = 1) {
    sheet.setTitle('How much?');
    sheet.showBack(back || null);
    const root = sheet.render(
      `<h3 class="food-name">${esc(meal.name)}</h3>
      <p class="muted small">Makes ${trimNum(meal.yield)} serving${meal.yield === 1 ? '' : 's'}</p>
      <label class="field"><span>Servings</span><input id="qty" inputmode="decimal" autocomplete="off" value="${trimNum(startQty)}"></label>
      <div id="chips">${amountChips(startQty)}</div>
      <div id="preview"></div>
      <label class="field"><span>Meal</span><select id="slot">${slotOptions(state.slot)}</select></label>
      <button type="button" class="btn primary block" data-act="log">Log it</button>`,
      {
        log: () => {
          const q = readNum(qtyEl);
          if (!(q > 0)) return update();
          state.slot = root.querySelector('#slot').value;
          logEntry(
            { kind: 'meal', mealId: meal.id, name: meal.name, brand: '', qty: q, unit: 'serving', servingLabel: '1 serving', nutrients: scaleNutrients(meal.perServing, q) },
            meal.name
          ).then((ok) => ok && ctx.store.touchMeal(meal.id));
        },
      }
    );
    const qtyEl = root.querySelector('#qty');
    const preview = root.querySelector('#preview');
    const update = () => {
      const q = readNum(qtyEl);
      preview.innerHTML = q > 0 ? previewHtml(scaleNutrients(meal.perServing, q)) : '<p class="err-text">Enter an amount above 0.</p>';
    };
    wireAmountChips(root, qtyEl, update);
    update();
  }

  // ---------- quick add ----------

  function quickPane(pane) {
    const root = mount(
      pane,
      `<form data-submit="add" novalidate>
        <p class="hint">For home cooking or anything without a label. Only calories are required.</p>
        <div id="q-errors"></div>
        <label class="field"><span>What was it? <small>optional</small></span><input id="q-name" maxlength="100" autocomplete="off" placeholder="Leftover enchiladas"></label>
        ${nutrientInputsHtml({})}
        <label class="field"><span>Meal</span><select id="slot">${slotOptions(state.slot)}</select></label>
        <label class="check"><input type="checkbox" id="q-save"> <span>Also save to my foods, so I can log it again</span></label>
        <button type="submit" class="btn primary block">Add it</button>
      </form>`,
      {
        add: () => {
          const { nutrients, errors } = readNutrients(root);
          const name = root.querySelector('#q-name').value.trim();
          const save = root.querySelector('#q-save').checked;
          if (save && !name) errors.push('Give it a name so you can find it in your foods.');
          if (errors.length) {
            root.querySelector('#q-errors').innerHTML = errorBox(errors);
            sheet.body.scrollTop = 0;
            return;
          }
          state.slot = root.querySelector('#slot').value;
          confirmOverGoals(ctx, { date: state.date, add: [nutrients] }).then((ok) => {
            if (!ok) return;
            let foodId;
            if (save) {
              const f = ctx.store.saveFood({ name, brand: '', barcode: '', servingLabel: '1 serving', nutrients, source: 'Quick add' });
              ctx.store.touchFood(f.id);
              foodId = f.id;
            }
            const rec = ctx.store.addEntry({ date: state.date, slot: state.slot, kind: 'quick', foodId, name: name || 'Quick add', brand: '', qty: 1, unit: 'serving', servingLabel: '1 serving', nutrients });
            sheet.close();
            toast(`Logged ${name || 'quick add'}`, { actionLabel: 'Undo', onAction: () => ctx.store.deleteEntry(rec.id) });
          });
        },
      }
    );
    wireCalorieHint(root);
  }

  // ---------- start ----------

  if (opts.food) showPicker({ food: opts.food });
  else if (opts.meal) showMealPicker(opts.meal);
  else {
    const hasRecent = ctx.store.recentFor(null).length > 0;
    const remembered = ctx.store.state.settings.addTab;
    showTab(opts.tab || (hasRecent ? 'recent' : remembered && remembered !== 'recent' ? remembered : 'scan'));
  }
  return sheet;
}
