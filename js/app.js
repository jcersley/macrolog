// Boot, tab routing, day rollover and the Monday weigh-in prompt.

import { createStore } from './store.js';
import { dateKey, shouldPromptWeighIn } from './nutrition.js';
import { toast } from './ui.js';
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

store.subscribe(() => render());

function maybeWeighIn() {
  if (state.weighOpen || !store.state.profile) return;
  const now = new Date();
  if (!shouldPromptWeighIn({ now, weights: store.state.weights, dismissedKey: store.state.settings.weighDismissed })) return;
  state.weighOpen = true;
  const today = dateKey(now);
  openWeightSheet(ctx, {
    title: 'Monday weigh-in',
    intro: "It's Monday. What does the scale say this morning?",
    skipLabel: 'Not today',
    onDone: () => (state.weighOpen = false),
    onSkip: () => {
      state.weighOpen = false;
      store.setSettings({ weighDismissed: today });
    },
  });
}

// The app can sit open in the background for days, so check the date when it comes back.
function onResume() {
  const t = dateKey();
  if (t !== state.todayKey) {
    if (state.date === state.todayKey) state.date = t;
    state.todayKey = t;
    render();
  }
  maybeWeighIn();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') onResume();
});

render();
maybeWeighIn();

navigator.storage?.persist?.().catch(() => {});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
