// Boot, tab routing, day rollover, the Monday weigh-in and the monthly backup reminder.

import { createStore } from './store.js';
import { dateKey, shouldPromptWeighIn } from './nutrition.js';
import { toast, openSheet } from './ui.js';
import { shouldPromptBackup, snoozeDate, firstLogDate, exportBackup } from './backup.js';
import { APP_VERSION } from './version.js';
import { applyTheme } from './themes.js';
import { renderToday } from './views/today.js';
import { renderFoods } from './views/foods.js';
import { renderProgress, openWeightSheet } from './views/progress.js';
import { renderProfile } from './views/profile.js';

const VIEWS = { today: renderToday, foods: renderFoods, progress: renderProgress, profile: renderProfile };

const store = createStore({ onError: () => toast("Couldn't save. Your phone's storage may be full.") });
const state = { tab: 'today', date: dateKey(), todayKey: dateKey(), weighOpen: false };
const viewEl = document.getElementById('view');

const ctx = {
  store,
  date: () => state.date,
  setDate(d) {
    state.date = d;
    render();
  },
  goTab,
  rerender: () => render(),
};

function render({ resetScroll = false } = {}) {
  const y = window.scrollY;
  VIEWS[state.tab](viewEl, ctx);
  document.querySelectorAll('#tabs [data-tab]').forEach((b) => {
    if (b.dataset.tab === state.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  window.scrollTo(0, resetScroll ? 0 : y);
}

function goTab(tab) {
  if (!VIEWS[tab]) return;
  if (tab === 'today' && state.tab === 'today') state.date = dateKey();
  state.tab = tab;
  render({ resetScroll: true });
  viewEl.focus({ preventScroll: true });
}

document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) goTab(b.dataset.tab);
});

// Re-apply the palette only when it changes.
let themeKey = '';
function syncTheme() {
  const { palette = 'label', appearance = 'auto' } = store.state.settings;
  const key = `${palette}|${appearance}`;
  if (key !== themeKey) {
    themeKey = key;
    applyTheme(palette, appearance);
  }
}
syncTheme();
store.subscribe(() => {
  syncTheme();
  render();
});

function maybeBackup() {
  const today = dateKey();
  const { lastBackup, backupSnoozed } = store.state.settings;
  if (state.backupOpen) return;
  if (!shouldPromptBackup({ today, lastBackup, snoozedUntil: backupSnoozed, firstLogDate: firstLogDate(store.state.log) })) return;
  state.backupOpen = true;
  let handled = false;
  const s = openSheet({
    title: 'Time for a backup',
    onClose: () => {
      state.backupOpen = false;
      if (!handled) store.setSettings({ backupSnoozed: snoozeDate(today) });
    },
  });
  s.render(
    `<p>Your foods and history live only on this phone. A backup takes ten seconds: tap Export, then Save to Files and pick iCloud Drive.</p>
    <div class="btn-row">
      <button type="button" class="btn primary" data-act="export">Export backup</button>
      <button type="button" class="btn" data-act="later">Remind me next week</button>
    </div>`,
    {
      export: async () => {
        if (await exportBackup(store)) {
          handled = true;
          s.close();
          toast('Backup exported. Next reminder in 30 days.');
        }
      },
      later: () => s.close(),
    }
  );
}

// One prompt per open: the weigh-in comes first.
function prompts() {
  if (!maybeWeighIn()) maybeBackup();
}

function maybeWeighIn() {
  if (state.weighOpen) return true;
  if (!store.state.profile) return false;
  const now = new Date();
  if (!shouldPromptWeighIn({ now, weights: store.state.weights, dismissedKey: store.state.settings.weighDismissed })) return false;
  state.weighOpen = true;
  const today = dateKey(now);
  openWeightSheet(ctx, {
    title: 'Monday weigh-in',
    intro: "It's Monday. What does the scale say this morning? Add your waist too if you measure it.",
    withWaist: true,
    skipLabel: 'Not today',
    onDone: () => (state.weighOpen = false),
    onSkip: () => {
      state.weighOpen = false;
      store.setSettings({ weighDismissed: today });
    },
  });
  return true;
}

// The app can sit open in the background for days, so check the date when it comes back.
function onResume() {
  const t = dateKey();
  if (t !== state.todayKey) {
    if (state.date === state.todayKey) state.date = t;
    state.todayKey = t;
    render();
  }
  prompts();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') onResume();
});

// Note the date this phone first ran the current version.
if (store.state.settings.appVersion !== APP_VERSION) store.setSettings({ appVersion: APP_VERSION, versionSince: dateKey() });

render();
prompts();

navigator.storage?.persist?.().catch(() => {});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  // A new version finished installing while the app was open.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) toast('An update is ready.', { actionLabel: 'Reload', onAction: () => location.reload(), ms: 15000 });
  });
}
