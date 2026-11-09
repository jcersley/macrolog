// Food entry form (by hand, or to fix a scanned food), plus nutrient inputs shared with Quick add.

import { NUTRIENTS, normalizeBarcode, trimNum } from '../nutrition.js';
import { esc, readNum, confirmSheet, toast } from '../ui.js';

const CORE = ['kcal', 'protein', 'carbs', 'fat'];
const EXTRA = NUTRIENTS.filter((n) => !CORE.includes(n.key));

function input(meta, value) {
  const v = typeof value === 'number' ? trimNum(value, 2) : '';
  return `<label class="field nfield"><span>${meta.label} <small>${meta.unit}</small></span>
    <input id="n-${meta.key}" inputmode="decimal" autocomplete="off" value="${v}"${meta.key === 'kcal' ? ' required' : ''}></label>`;
}

export function nutrientInputsHtml(values = {}, { openExtra = false } = {}) {
  const core = CORE.map((k) => input(NUTRIENTS.find((n) => n.key === k), values[k])).join('');
  const hasExtra = EXTRA.some((m) => typeof values[m.key] === 'number');
  return `<div class="ngrid">${core}</div>
    <p class="hint" id="kcal-hint" hidden></p>
    <details class="more"${openExtra || hasExtra ? ' open' : ''}>
      <summary>Fiber, sodium, vitamins and more</summary>
      <p class="hint">Enter amounts in g, mg or mcg as printed on the label, not the % Daily Value. Leave a box blank if the label doesn't list it.</p>
      <div class="ngrid">${EXTRA.map((m) => input(m, values[m.key])).join('')}</div>
    </details>`;
}

// Blank protein/carbs/fat count as 0. Blank extras mean "not listed".
export function readNutrients(root) {
  const nutrients = {};
  const errors = [];
  for (const m of NUTRIENTS) {
    const el = root.querySelector(`#n-${m.key}`);
    if (!el) continue;
    const v = readNum(el);
    const blank = String(el.value).trim() === '';
    if (blank) {
      if (m.key === 'kcal') errors.push('Enter the calories.');
      else if (CORE.includes(m.key)) nutrients[m.key] = 0;
      continue;
    }
    if (!Number.isFinite(v) || v < 0) {
      errors.push(`${m.label} must be a number, 0 or more.`);
      continue;
    }
    if (m.key === 'kcal' && v > 5000) {
      errors.push('Calories look too high for one serving. Check for a typo.');
      continue;
    }
    nutrients[m.key] = v;
  }
  return { nutrients, errors };
}

// Non-blocking check: do protein, carbs and fat roughly add up to the calories?
export function wireCalorieHint(root) {
  const hint = root.querySelector('#kcal-hint');
  const ids = ['kcal', 'protein', 'carbs', 'fat'].map((k) => root.querySelector(`#n-${k}`));
  const check = () => {
    const [kcal, p, c, f] = ids.map((el) => readNum(el));
    const est = (p || 0) * 4 + (c || 0) * 4 + (f || 0) * 9;
    const off = kcal > 0 && est > 0 && Math.abs(est - kcal) > Math.max(40, kcal * 0.3);
    hint.hidden = !off;
    if (off) hint.textContent = `Check these numbers: protein, carbs and fat add up to about ${Math.round(est)} kcal, not ${Math.round(kcal)}.`;
  };
  ids.forEach((el) => el?.addEventListener('input', check));
  check();
}

export function errorBox(errors) {
  return errors.length ? `<div class="errors" role="alert">${errors.map((e) => `<p>${esc(e)}</p>`).join('')}</div>` : '';
}

// Renders the form into an open sheet. onSave receives the saved food record.
export function renderFoodForm(sheet, ctx, { food = null, prefill = {}, onSave, onBack, allowDelete = false, note = '' } = {}) {
  const f = { name: '', brand: '', barcode: '', servingLabel: '1 serving', servingGrams: undefined, nutrients: {}, ...prefill, ...(food || {}) };
  const editing = !!(food && food.id && ctx.store.state.foods.some((x) => x.id === food.id));
  sheet.setTitle(editing ? 'Edit food' : 'New food');
  sheet.showBack(onBack || null);

  const root = sheet.render(
    `${note ? `<p class="notice">${esc(note)}</p>` : ''}
    <form data-submit="save" novalidate>
      <div id="form-errors"></div>
      <label class="field"><span>Name</span><input id="f-name" required maxlength="100" autocomplete="off" value="${esc(f.name)}" placeholder="Greek yogurt, plain"></label>
      <label class="field"><span>Brand <small>optional</small></span><input id="f-brand" maxlength="80" autocomplete="off" value="${esc(f.brand)}"></label>
      <div class="two">
        <label class="field"><span>Serving size</span><input id="f-serving" maxlength="60" autocomplete="off" value="${esc(f.servingLabel)}" placeholder="1 cup"></label>
        <label class="field"><span>Serving weight <small>g, optional</small></span><input id="f-grams" inputmode="decimal" autocomplete="off" value="${f.servingGrams ? trimNum(f.servingGrams) : ''}"></label>
      </div>
      <p class="hint">Add the weight to log this food by the gram later. Labels print it next to the serving size, like "1 cup (227g)".</p>
      <h3 class="subhead">Per serving</h3>
      ${nutrientInputsHtml(f.nutrients)}
      <label class="field"><span>Barcode <small>optional</small></span><input id="f-barcode" inputmode="numeric" autocomplete="off" value="${esc(f.barcode || '')}"></label>
      <div class="btn-row">
        <button type="submit" class="btn primary">Save food</button>
        ${editing && allowDelete ? '<button type="button" class="btn danger" data-act="delete">Delete food</button>' : ''}
      </div>
    </form>`,
    {
      save: () => {
        const errors = [];
        const name = root.querySelector('#f-name').value.trim();
        if (!name) errors.push('Give the food a name.');
        const gramsEl = root.querySelector('#f-grams');
        const grams = readNum(gramsEl);
        if (gramsEl.value.trim() && !(grams > 0)) errors.push('Serving weight must be a number above 0, or blank.');
        const { nutrients, errors: nErrors } = readNutrients(root);
        errors.push(...nErrors);
        const barcode = normalizeBarcode(root.querySelector('#f-barcode').value);
        const clash = barcode && ctx.store.findFoodByBarcode(barcode);
        if (clash && clash.id !== f.id) errors.push(`That barcode is already saved for "${clash.name}".`);
        if (errors.length) {
          root.querySelector('#form-errors').innerHTML = errorBox(errors);
          sheet.body.scrollTop = 0;
          return;
        }
        const saved = ctx.store.saveFood({
          ...(f.id ? { id: f.id } : {}),
          name,
          brand: root.querySelector('#f-brand').value.trim(),
          barcode,
          servingLabel: root.querySelector('#f-serving').value.trim() || '1 serving',
          servingGrams: grams > 0 ? grams : undefined,
          nutrients,
          source: f.source || 'Entered by hand',
        });
        toast(editing ? 'Food updated' : 'Saved to your foods');
        onSave?.(saved);
      },
      delete: async () => {
        const ok = await confirmSheet({
          title: 'Delete this food?',
          message: `"${f.name}" will be removed from your foods. Anything you already logged stays in your diary.`,
          confirmLabel: 'Delete food',
          danger: true,
        });
        if (!ok) return;
        ctx.store.deleteFood(f.id);
        toast('Food deleted');
        sheet.close();
      },
    }
  );
  wireCalorieHint(root);
  if (!f.name) root.querySelector('#f-name').setAttribute('autofocus', '');
  sheet.focus();
  return root;
}
