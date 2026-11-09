// Build a saved meal (a recipe) from foods in the library.

import { mealPerServing, trimNum } from '../nutrition.js';
import { openSheet, esc, fmt, readNum, toast, confirmSheet, macroLine, icon } from '../ui.js';
import { renderFoodForm, errorBox } from './foodform.js';

function sortFoods(foods, query) {
  const q = query.trim().toLowerCase();
  return foods
    .filter((f) => !q || `${f.name} ${f.brand || ''}`.toLowerCase().includes(q))
    .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0) || a.name.localeCompare(b.name));
}

export function openMealBuilder(ctx, { meal = null, onSaved } = {}) {
  const draft = {
    name: meal?.name || '',
    yield: meal?.yield || 1,
    items: meal ? meal.items.map((it) => ({ ...it })) : [],
  };
  const sheet = openSheet({ title: meal ? 'Edit meal' : 'New meal' });
  let root;

  // Copy what's typed into the draft before redrawing.
  function sync() {
    if (!root || !root.querySelector('#m-name')) return;
    draft.name = root.querySelector('#m-name').value;
    const y = readNum(root.querySelector('#m-yield'));
    draft.yield = y > 0 ? y : draft.yield;
    root.querySelectorAll('[data-ing]').forEach((el) => {
      const v = readNum(el);
      draft.items[Number(el.dataset.ing)].servings = v > 0 ? v : 0;
    });
  }

  function summary() {
    const y = readNum(root.querySelector('#m-yield'));
    const per = mealPerServing(draft.items, y > 0 ? y : 1);
    root.querySelector('#m-summary').innerHTML = draft.items.length
      ? `<p class="pv-kcal"><b>${fmt(per.kcal ?? 0)}</b> kcal per serving</p><p class="pv-macros">${macroLine(per)}</p>`
      : '';
  }

  function main() {
    sheet.setTitle(meal ? 'Edit meal' : 'New meal');
    sheet.showBack(null);
    root = sheet.render(
      `<div id="m-errors"></div>
      <label class="field"><span>Meal name</span><input id="m-name" maxlength="80" autocomplete="off" value="${esc(draft.name)}" placeholder="Chicken rice bowl"></label>
      <label class="field"><span>Servings this makes</span><input id="m-yield" inputmode="decimal" autocomplete="off" value="${trimNum(draft.yield)}"></label>
      <h3 class="subhead">Ingredients</h3>
      ${
        draft.items.length
          ? `<ul class="list ing">${draft.items
              .map(
                (it, i) => `<li class="ing-row">
                  <span class="r-main"><b>${esc(it.name)}</b><small>servings of ${esc(it.servingLabel || '1 serving')}</small></span>
                  <input data-ing="${i}" inputmode="decimal" aria-label="Servings of ${esc(it.name)}" value="${trimNum(it.servings)}">
                  <button type="button" class="icon-btn" data-act="remove" data-i="${i}" aria-label="Remove ${esc(it.name)}">${icon.trash}</button>
                </li>`
              )
              .join('')}</ul>`
          : '<p class="muted">Add what goes into it, in servings of each food. Use the whole batch, then set how many servings it makes.</p>'
      }
      <button type="button" class="btn" data-act="add">${icon.plus} Add an ingredient</button>
      <div id="m-summary" class="preview"></div>
      <div class="btn-row">
        <button type="button" class="btn primary" data-act="save">Save meal</button>
        ${meal ? '<button type="button" class="btn danger" data-act="delete">Delete meal</button>' : ''}
      </div>`,
      {
        add: () => {
          sync();
          pick();
        },
        remove: (el) => {
          sync();
          draft.items.splice(Number(el.dataset.i), 1);
          main();
        },
        save,
        delete: async () => {
          const ok = await confirmSheet({
            title: 'Delete this meal?',
            message: `"${meal.name}" will be removed. Anything you already logged stays in your diary.`,
            confirmLabel: 'Delete meal',
            danger: true,
          });
          if (!ok) return;
          ctx.store.deleteMeal(meal.id);
          toast('Meal deleted');
          sheet.close();
        },
      }
    );
    root.addEventListener('input', () => {
      sync();
      summary();
    });
    summary();
    if (!draft.name) root.querySelector('#m-name').setAttribute('autofocus', '');
    sheet.focus();
  }

  function save() {
    sync();
    const errors = [];
    const name = draft.name.trim();
    if (!name) errors.push('Give the meal a name.');
    if (!(readNum(root.querySelector('#m-yield')) > 0)) errors.push('Servings must be a number above 0.');
    if (!draft.items.length) errors.push('Add at least one ingredient.');
    if (draft.items.some((it) => !(it.servings > 0))) errors.push('Every ingredient needs an amount above 0.');
    if (errors.length) {
      root.querySelector('#m-errors').innerHTML = errorBox(errors);
      sheet.body.scrollTop = 0;
      return;
    }
    const rec = ctx.store.saveMeal({
      ...(meal ? { id: meal.id } : {}),
      name,
      yield: draft.yield,
      items: draft.items,
      perServing: mealPerServing(draft.items, draft.yield),
    });
    toast(meal ? 'Meal updated' : 'Meal saved');
    if (onSaved) {
      sheet.close();
      onSaved(rec);
    } else sheet.close();
  }

  function addItem(food) {
    draft.items.push({ foodId: food.id, name: food.name, servingLabel: food.servingLabel, nutrients: { ...food.nutrients }, servings: 1 });
    main();
  }

  function pick() {
    sheet.setTitle('Add an ingredient');
    sheet.showBack(main);
    const r = sheet.render(
      `${ctx.store.state.foods.length ? '<input type="search" id="q" class="search" placeholder="Search your foods" aria-label="Search your foods" autocomplete="off"><ul class="list" id="list"></ul>' : '<p class="muted">Your foods list is empty. Add the ingredient as a new food.</p>'}
      <button type="button" class="btn" data-act="new">${icon.plus} New food</button>`,
      {
        pick: (el) => {
          const f = ctx.store.state.foods.find((x) => x.id === el.dataset.id);
          if (f) addItem(f);
        },
        new: () => renderFoodForm(sheet, ctx, { onBack: pick, onSave: addItem }),
      }
    );
    const list = r.querySelector('#list');
    if (!list) return;
    const q = r.querySelector('#q');
    const draw = () => {
      const rows = sortFoods(ctx.store.state.foods, q.value);
      list.innerHTML = rows.length
        ? rows
            .map(
              (f) => `<li><button type="button" class="row" data-act="pick" data-id="${esc(f.id)}">
                <span class="r-main"><b>${esc(f.name)}</b><small>${esc([f.brand, f.servingLabel].filter(Boolean).join(', '))}</small></span>
                <span class="r-kcal">${fmt(f.nutrients?.kcal ?? 0)}<small> kcal</small></span></button></li>`
            )
            .join('')
        : `<li class="muted pad">Nothing matches "${esc(q.value)}".</li>`;
    };
    q.addEventListener('input', draw);
    draw();
  }

  main();
  return sheet;
}
