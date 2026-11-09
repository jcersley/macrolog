// Profile: body stats, weekly goal, the goals they produce, and app settings.

import {
  ACTIVITY, computeGoals, kgToLb, lbToKg, ftInToCm, cmToFtIn, trimNum, nutrientMeta, dateKey,
} from '../nutrition.js';
import { esc, fmt, mount, toast, readNum, fmtWeight, confirmSheet } from '../ui.js';

const RATES = {
  us: [0, 0.5, 1, 1.5, 2].map((lb) => ({ kg: lbToKg(lb), label: lb ? `${lb} lb a week` : 'Maintain my weight' })),
  metric: [0, 0.25, 0.5, 0.75, 1].map((kg) => ({ kg, label: kg ? `${kg} kg a week` : 'Maintain my weight' })),
};

const GOAL_ROWS = [
  ['kcal', 'Calories'], ['protein'], ['carbs'], ['fat'], ['fiber'], ['addedSugars'], ['satFat'], ['sodium'], ['cholesterol'],
  ['potassium'], ['calcium'], ['iron'], ['vitD'], ['vitA'], ['vitC'],
];

let draft = null;

export function renderProfile(view, ctx) {
  const { store } = ctx;
  const units = store.state.settings.units;
  if (!draft) draft = { sex: '', age: '', heightCm: '', weightKg: store.latestWeightKg() || '', activity: 'moderate', rateKgPerWeek: lbToKg(1), goalWeightKg: '', ...(store.state.profile || {}) };

  const ftin = draft.heightCm ? cmToFtIn(draft.heightCm) : { ft: '', inches: '' };
  const rates = RATES[units];
  const closestRate = rates.reduce((best, r) => (Math.abs(r.kg - draft.rateKgPerWeek) < Math.abs(best.kg - draft.rateKgPerWeek) ? r : best), rates[0]);
  const wDisp = (kg) => (kg ? trimNum(units === 'us' ? kgToLb(kg) : kg, 1) : '');

  const root = mount(
    view,
    `<header class="page-head"><h1>Profile</h1></header>
    <form class="panel" data-submit="save" novalidate>
      <div class="seg small" role="group" aria-label="Units">
        <button type="button" data-act="units" data-u="us" aria-pressed="${units === 'us'}">lb, ft/in</button>
        <button type="button" data-act="units" data-u="metric" aria-pressed="${units === 'metric'}">kg, cm</button>
      </div>
      <fieldset class="field"><legend>Sex <small>used by the calorie formula</small></legend>
        <div class="seg">
          <label class="seg-opt"><input type="radio" name="sex" value="male"${draft.sex === 'male' ? ' checked' : ''}><span>Male</span></label>
          <label class="seg-opt"><input type="radio" name="sex" value="female"${draft.sex === 'female' ? ' checked' : ''}><span>Female</span></label>
        </div>
      </fieldset>
      <div class="two">
        <label class="field"><span>Age</span><input id="p-age" inputmode="numeric" autocomplete="off" value="${draft.age || ''}"></label>
        <label class="field"><span>Weight <small>${units === 'us' ? 'lb' : 'kg'}</small></span><input id="p-weight" inputmode="decimal" autocomplete="off" value="${wDisp(draft.weightKg)}"></label>
      </div>
      ${
        units === 'us'
          ? `<div class="two"><label class="field"><span>Height <small>ft</small></span><input id="p-ft" inputmode="numeric" autocomplete="off" value="${ftin.ft}"></label>
             <label class="field"><span>&nbsp;<small>in</small></span><input id="p-in" inputmode="numeric" autocomplete="off" value="${ftin.inches}" aria-label="Height, inches"></label></div>`
          : `<label class="field"><span>Height <small>cm</small></span><input id="p-cm" inputmode="numeric" autocomplete="off" value="${draft.heightCm ? Math.round(draft.heightCm) : ''}"></label>`
      }
      <label class="field"><span>Activity</span><select id="p-activity">${ACTIVITY.map((a) => `<option value="${a.id}"${a.id === draft.activity ? ' selected' : ''}>${a.label}</option>`).join('')}</select></label>
      <p class="hint" id="act-hint">${esc(ACTIVITY.find((a) => a.id === draft.activity)?.hint || '')}</p>
      <label class="field"><span>Weekly goal</span><select id="p-rate">${rates.map((r, i) => `<option value="${i}"${r === closestRate ? ' selected' : ''}>${r.label}${r.kg ? ' loss' : ''}</option>`).join('')}</select></label>
      <label class="field"><span>Goal weight <small>optional, for the chart and an estimated date</small></span><input id="p-goal" inputmode="decimal" autocomplete="off" value="${wDisp(draft.goalWeightKg)}"></label>
      <div id="p-errors"></div>
      <button type="submit" class="btn primary block">Save profile</button>
    </form>
    <section class="panel" aria-labelledby="h-goals"><h2 id="h-goals">Your daily goals</h2><div id="goals"></div></section>
    <section class="panel" aria-labelledby="h-settings"><h2 id="h-settings">Settings</h2>
      <label class="field"><span>USDA API key <small>optional</small></span><input id="s-key" autocomplete="off" spellcheck="false" value="${esc(store.state.settings.usdaKey)}" placeholder="Uses a shared demo key if blank"></label>
      <p class="hint">The shared key allows only a few dozen lookups an hour. A free personal key from api.data.gov raises that to 1,000.</p>
      <button type="button" class="btn" data-act="savekey">Save key</button>
      <h3 class="subhead">Backup</h3>
      <p class="hint">Everything lives on this phone only. Export a backup now and then, and before clearing Safari data or switching phones.</p>
      <div class="btn-row">
        <button type="button" class="btn" data-act="export">Export backup</button>
        <label class="btn file-btn">Restore backup<input type="file" accept="application/json,.json" id="s-import" class="visually-hidden"></label>
      </div>
      <h3 class="subhead">Install on iPhone</h3>
      <p class="hint">In Safari, tap the Share button, then Add to Home Screen. It opens full screen like an app and works offline, except for barcode lookups.</p>
      <button type="button" class="btn danger" data-act="reset">Erase all data</button>
    </section>`,
    {
      units: (el) => {
        readForm(root, units);
        store.setSettings({ units: el.dataset.u });
      },
      save: () => {
        readForm(root, units);
        const g = computeGoals(toProfile(draft));
        if (!g.ok) {
          root.querySelector('#p-errors').innerHTML = `<div class="errors" role="alert">${g.errors.map((e) => `<p>${esc(e)}</p>`).join('')}</div>`;
          return;
        }
        store.saveProfile(toProfile(draft), dateKey());
        draft = null;
        toast('Profile saved');
      },
      savekey: () => {
        store.setSettings({ usdaKey: root.querySelector('#s-key').value.trim() });
        toast('Key saved');
      },
      export: () => exportBackup(store),
      reset: async () => {
        const ok = await confirmSheet({
          title: 'Erase everything?',
          message: 'This deletes your profile, foods, meals, diary and weigh-ins from this phone. Export a backup first if you might want them back.',
          confirmLabel: 'Erase all data',
          danger: true,
        });
        if (!ok) return;
        store.resetAll();
        draft = null;
        toast('All data erased');
      },
    }
  );

  root.querySelector('#s-import').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await confirmSheet({
      title: 'Restore this backup?',
      message: 'It replaces everything currently in the app with the contents of the file.',
      confirmLabel: 'Restore',
      danger: true,
    });
    if (!ok) return;
    const res = store.importJSON(await file.text());
    draft = null;
    toast(res.ok ? `Restored ${res.counts.foods} foods, ${res.counts.entries} diary entries and ${res.counts.weights} weigh-ins` : res.error);
  });

  const goalsEl = root.querySelector('#goals');
  const actHint = root.querySelector('#act-hint');
  const live = () => {
    readForm(root, units);
    actHint.textContent = ACTIVITY.find((a) => a.id === draft.activity)?.hint || '';
    goalsEl.innerHTML = goalsHtml(computeGoals(toProfile(draft)), units, store.state.profile);
  };
  root.querySelector('form').addEventListener('input', live);
  root.querySelector('form').addEventListener('change', live);
  live();
}

function readForm(root, units) {
  const num = (id) => readNum(root.querySelector(id));
  draft.sex = root.querySelector('input[name="sex"]:checked')?.value || '';
  draft.age = num('#p-age');
  const w = num('#p-weight');
  draft.weightKg = units === 'us' ? lbToKg(w) : w;
  if (units === 'us') {
    const ft = num('#p-ft');
    const inch = num('#p-in');
    draft.heightCm = ft > 0 ? ftInToCm(ft, Number.isFinite(inch) ? inch : 0) : NaN;
  } else draft.heightCm = num('#p-cm');
  draft.activity = root.querySelector('#p-activity').value;
  draft.rateKgPerWeek = RATES[units][Number(root.querySelector('#p-rate').value)]?.kg ?? 0;
  const g = num('#p-goal');
  draft.goalWeightKg = g > 0 ? (units === 'us' ? lbToKg(g) : g) : '';
}

function toProfile(d) {
  return {
    sex: d.sex,
    age: Number(d.age),
    heightCm: Number(d.heightCm),
    weightKg: Number(d.weightKg),
    activity: d.activity,
    rateKgPerWeek: d.rateKgPerWeek,
    ...(d.goalWeightKg > 0 ? { goalWeightKg: d.goalWeightKg } : {}),
  };
}

function goalsHtml(g, units, saved) {
  if (!g.ok) return `<p class="muted">${saved ? 'Fix the profile above to see goals.' : 'Fill in the profile above and your goals appear here.'}</p>`;
  const rows = GOAL_ROWS.map(([k]) => {
    const m = nutrientMeta(k);
    return `<tr><th scope="row">${m.label}</th><td>${m.kind === 'limit' && k !== 'kcal' ? 'up to ' : ''}${fmt(g.targets[k], m.dp)} ${m.unit}</td></tr>
      <tr class="basis"><td colspan="2">${esc(g.basis[k])}</td></tr>`;
  }).join('');
  return `
    <p class="goal-lead"><span class="big">${fmt(g.targets.kcal)}</span> kcal a day</p>
    <p class="muted">You burn about ${fmt(Math.round(g.tdee / 10) * 10)} a day. ${
      g.dailyDeficit > 0 ? `A ${fmt(Math.round(g.dailyDeficit / 10) * 10)} kcal daily deficit is about ${fmtWeight(g.effectiveRateKg, units)} a week.` : 'This goal maintains your weight.'
    }</p>
    <p class="macro-split"><span>Protein <b>${g.targets.protein} g</b></span><span>Carbs <b>${g.targets.carbs} g</b></span><span>Fat <b>${g.targets.fat} g</b></span></p>
    ${g.warnings.map((w) => `<p class="notice">${esc(w)}</p>`).join('')}
    <details class="why"><summary>Every goal and where it comes from</summary><table class="goal-table"><tbody>${rows}</tbody></table></details>
    <p class="hint">These are general adult guidelines (US Dietary Guidelines, FDA Daily Values, National Academies). If you have a condition like high blood pressure, diabetes or kidney disease, ask your doctor which targets fit you.</p>`;
}

async function exportBackup(store) {
  const text = store.exportJSON();
  const name = `macrolog-backup-${dateKey()}.json`;
  const file = new File([text], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Macrolog backup' });
      return;
    }
  } catch (err) {
    if (err?.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
