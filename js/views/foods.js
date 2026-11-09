// Foods tab: the saved food library and saved meals.

import { trimNum } from '../nutrition.js';
import { esc, fmt, mount, openSheet, icon } from '../ui.js';
import { openAdd, sortFoods } from './add.js';
import { renderFoodForm } from './foodform.js';
import { openMealBuilder } from './mealbuilder.js';
import { openRecipe, recipeSummary, sortRecipes, renderRecipeLog } from './recipes.js';
import { defaultSlot } from '../ui.js';

let section = 'foods';
let query = '';

export function renderFoods(view, ctx) {
  const { store } = ctx;
  const foods = store.state.foods;
  const meals = store.state.meals;

  const root = mount(
    view,
    `<header class="page-head"><h1>Foods</h1></header>
    <div class="seg" role="tablist" aria-label="Show">
      <button type="button" role="tab" data-act="section" data-s="foods" aria-selected="${section === 'foods'}">Foods <small>${foods.length}</small></button>
      <button type="button" role="tab" data-act="section" data-s="recipes" aria-selected="${section === 'recipes'}">Recipes <small>${store.state.recipes.length}</small></button>
      <button type="button" role="tab" data-act="section" data-s="meals" aria-selected="${section === 'meals'}">Meals <small>${meals.length}</small></button>
    </div>
    ${
      section === 'recipes'
        ? `<div class="toolbar"><button type="button" class="btn" data-act="newrecipe">${icon.plus} New recipe</button></div>
           ${
             store.state.recipes.length
               ? `<ul class="list">${sortRecipes(store.state.recipes)
                   .map(
                     (r) => `<li class="row-wrap">
                       <button type="button" class="row" data-act="openrecipe" data-id="${esc(r.id)}">
                         <span class="r-main"><b>${esc(r.name)}</b><small>${esc(recipeSummary(ctx, r))}</small></span>
                       </button>
                       ${r.batches.length ? `<button type="button" class="btn small" data-act="logrecipe" data-id="${esc(r.id)}" aria-label="Log ${esc(r.name)}">Log</button>` : ''}
                     </li>`
                   )
                   .join('')}</ul>`
               : '<div class="empty"><p>For batch cooking. Enter what went in the pot and weigh the finished food once. Then log your bowl by its weight. Next time you make it, copy the last batch and change what\u2019s different.</p></div>'
           }`
        : section === 'foods'
        ? `<div class="toolbar">
             ${foods.length ? `<input type="search" id="q" class="search" placeholder="Search your foods" aria-label="Search your foods" autocomplete="off" value="${esc(query)}">` : ''}
             <button type="button" class="btn" data-act="newfood">${icon.plus} New food</button>
           </div>
           ${foods.length ? '<ul class="list" id="list"></ul>' : '<div class="empty"><p>Nothing saved yet. Every food you scan or enter lands here, ready to log again.</p></div>'}`
        : `<div class="toolbar"><button type="button" class="btn" data-act="newmeal">${icon.plus} Build a meal</button></div>
           ${
             meals.length
               ? `<ul class="list">${[...meals]
                   .sort((a, b) => a.name.localeCompare(b.name))
                   .map(
                     (m) => `<li class="row-wrap">
                       <button type="button" class="row" data-act="editmeal" data-id="${esc(m.id)}">
                         <span class="r-main"><b>${esc(m.name)}</b><small>Makes ${trimNum(m.yield)}, ${m.items.length} ingredient${m.items.length === 1 ? '' : 's'}</small></span>
                         <span class="r-kcal">${fmt(m.perServing?.kcal ?? 0)}<small> kcal</small></span>
                       </button>
                       <button type="button" class="btn small" data-act="logmeal" data-id="${esc(m.id)}" aria-label="Log ${esc(m.name)}">Log</button>
                     </li>`
                   )
                   .join('')}</ul>`
               : '<div class="empty"><p>Meals are recipes built from your foods. Make one for anything you cook often, then log a serving in one tap.</p></div>'
           }`
    }`,
    {
      section: (el) => {
        section = el.dataset.s;
        renderFoods(view, ctx);
      },
      newfood: () => {
        const s = openSheet({ title: 'New food' });
        renderFoodForm(s, ctx, { onSave: () => s.close() });
      },
      editfood: (el) => {
        const food = store.state.foods.find((f) => f.id === el.dataset.id);
        if (!food) return;
        const s = openSheet({ title: 'Edit food' });
        renderFoodForm(s, ctx, { food, allowDelete: true, onSave: () => s.close() });
      },
      logfood: (el) => {
        const food = store.state.foods.find((f) => f.id === el.dataset.id);
        if (food) openAdd(ctx, { food });
      },
      newmeal: () => openMealBuilder(ctx),
      newrecipe: () => openRecipe(ctx),
      openrecipe: (el) => openRecipe(ctx, el.dataset.id),
      logrecipe: (el) => {
        const recipe = store.state.recipes.find((r) => r.id === el.dataset.id);
        if (!recipe) return;
        const s = openSheet({ title: 'Log a serving' });
        renderRecipeLog(s, ctx, { recipe, date: ctx.date(), slot: defaultSlot(), onLogged: () => s.close() });
      },
      editmeal: (el) => {
        const meal = store.state.meals.find((m) => m.id === el.dataset.id);
        if (meal) openMealBuilder(ctx, { meal });
      },
      logmeal: (el) => {
        const meal = store.state.meals.find((m) => m.id === el.dataset.id);
        if (meal) openAdd(ctx, { meal });
      },
    }
  );

  const list = root.querySelector('#list');
  if (!list) return;
  const q = root.querySelector('#q');
  const draw = () => {
    query = q.value;
    const rows = sortFoods(store.state.foods, query);
    list.innerHTML = rows.length
      ? rows
          .map(
            (f) => `<li class="row-wrap">
              <button type="button" class="row" data-act="editfood" data-id="${esc(f.id)}">
                <span class="r-main"><b>${esc(f.name)}</b><small>${esc([f.brand, f.servingLabel].filter(Boolean).join(', '))}</small></span>
                <span class="r-kcal">${fmt(f.nutrients?.kcal ?? 0)}<small> kcal</small></span>
              </button>
              <button type="button" class="btn small" data-act="logfood" data-id="${esc(f.id)}" aria-label="Log ${esc(f.name)}">Log</button>
            </li>`
          )
          .join('')
      : `<li class="muted pad">Nothing matches "${esc(query)}".</li>`;
  };
  q.addEventListener('input', draw);
  draw();
}
