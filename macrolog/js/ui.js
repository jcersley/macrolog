// Shared UI helpers: escaping, formatting, bottom sheets, toasts, icons.

import { NUTRIENT_KEYS, nutrientMeta, kgToLb, daysBetween, parseKey } from './nutrition.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const fmt = (n, dp = 0) =>
  Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dp });

// Reads a number from a text input. Empty or invalid gives NaN.
export function readNum(el) {
  const raw = String(el?.value ?? '').trim().replace(',', '.');
  if (raw === '') return NaN;
  return Number(raw);
}

export function fmtWeight(kg, units, dp = 1) {
  return units === 'us' ? `${fmt(kgToLb(kg), dp)} lb` : `${fmt(kg, dp)} kg`;
}

export const SLOTS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks' },
];

export function defaultSlot(now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h < 10.5) return 'breakfast';
  if (h < 14.5) return 'lunch';
  if (h < 20) return 'dinner';
  return 'snacks';
}

export const slotOptions = (selected) =>
  SLOTS.map((s) => `<option value="${s.id}"${s.id === selected ? ' selected' : ''}>${s.label}</option>`).join('');

const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" class="ico">${d}</svg>`;
export const icon = {
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  left: svg('<path d="M15 5l-7 7 7 7"/>'),
  right: svg('<path d="M9 5l7 7-7 7"/>'),
  trash: svg('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>'),
  bolt: svg('<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>'),
};

// Replaces a container's content with `html` and wires data-act clicks and data-submit forms.
export function mount(container, html, handlers = {}) {
  container.innerHTML = `<div class="screen">${html}</div>`;
  const root = container.firstElementChild;
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t || !root.contains(t)) return;
    const fn = handlers[t.dataset.act];
    if (fn) {
      e.preventDefault();
      fn(t, e);
    }
  });
  root.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-submit]');
    if (!form) return;
    e.preventDefault();
    handlers[form.dataset.submit]?.(form, e);
  });
  return root;
}

// ---------- Sheets ----------

const stack = [];
let sheetId = 0;

function syncBackground() {
  const app = document.getElementById('app');
  document.body.classList.toggle('locked', stack.length > 0);
  if (stack.length) app.setAttribute('inert', '');
  else app.removeAttribute('inert');
  stack.forEach((s, i) => (i === stack.length - 1 ? s.el.removeAttribute('inert') : s.el.setAttribute('inert', '')));
}

export function openSheet({ title = '', onClose } = {}) {
  const id = ++sheetId;
  const opener = document.activeElement;
  const el = document.createElement('div');
  el.className = 'backdrop';
  el.innerHTML = `
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title-${id}">
      <header class="sheet-head">
        <button type="button" class="icon-btn" data-sheet-back hidden aria-label="Back">${icon.back}</button>
        <h2 id="sheet-title-${id}" tabindex="-1"></h2>
        <button type="button" class="icon-btn" data-sheet-close aria-label="Close">${icon.close}</button>
      </header>
      <div class="sheet-body"></div>
    </section>`;
  const titleEl = el.querySelector('h2');
  const bodyEl = el.querySelector('.sheet-body');
  const backBtn = el.querySelector('[data-sheet-back]');
  titleEl.textContent = title;
  let backFn = null;
  let closed = false;

  const sheet = {
    el,
    body: bodyEl,
    get closed() {
      return closed;
    },
    setTitle(t) {
      titleEl.textContent = t;
    },
    showBack(fn) {
      backFn = fn || null;
      backBtn.hidden = !fn;
    },
    render(html, handlers) {
      const root = mount(bodyEl, html, handlers);
      bodyEl.scrollTop = 0;
      return root;
    },
    focus() {
      (bodyEl.querySelector('[autofocus]') || titleEl).focus({ preventScroll: true });
    },
    close() {
      if (closed) return;
      closed = true;
      const i = stack.indexOf(sheet);
      if (i >= 0) stack.splice(i, 1);
      el.remove();
      syncBackground();
      onClose?.();
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    },
  };

  backBtn.addEventListener('click', () => backFn?.());
  el.querySelector('[data-sheet-close]').addEventListener('click', () => sheet.close());
  el.addEventListener('click', (e) => {
    if (e.target === el) sheet.close();
  });
  stack.push(sheet);
  document.getElementById('layers').appendChild(el);
  syncBackground();
  titleEl.focus({ preventScroll: true });
  return sheet;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close();
});

export function confirmSheet({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const s = openSheet({
      title,
      onClose: () => {
        if (!answered) resolve(false);
      },
    });
    s.render(
      `<p>${esc(message)}</p>
       <div class="btn-row">
         <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-act="yes">${esc(confirmLabel)}</button>
         <button type="button" class="btn" data-act="no">Cancel</button>
       </div>`,
      {
        yes: () => {
          answered = true;
          s.close();
          resolve(true);
        },
        no: () => s.close(),
      }
    );
    s.focus();
  });
}

// ---------- Toasts ----------

export function toast(message, { actionLabel, onAction, ms = 5000 } = {}) {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(message)}</span>${actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : ''}`;
  host.replaceChildren(el);
  const timer = setTimeout(() => el.remove(), ms);
  el.querySelector('button')?.addEventListener('click', () => {
    clearTimeout(timer);
    el.remove();
    onAction?.();
  });
}

// ---------- Nutrient table ----------

export function nutrientTable(nutrients, keys = NUTRIENT_KEYS) {
  const rows = keys
    .filter((k) => typeof nutrients[k] === 'number')
    .map((k) => {
      const m = nutrientMeta(k);
      return `<tr><th scope="row">${m.label}</th><td>${fmt(nutrients[k], Math.max(m.dp, nutrients[k] < 10 && m.dp === 0 ? 1 : m.dp))} ${m.unit}</td></tr>`;
    })
    .join('');
  return `<table class="ntable"><tbody>${rows}</tbody></table>`;
}

export function macroLine(n) {
  const g = (v) => fmt(v ?? 0, 0);
  return `<span><b>${g(n.protein)}</b> g protein</span><span><b>${g(n.carbs)}</b> g carbs</span><span><b>${g(n.fat)}</b> g fat</span>`;
}

export function dateLabel(key, todayKey) {
  const diff = daysBetween(key, todayKey);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return parseKey(key).toLocaleDateString('en-US', { weekday: 'long' });
}

export const longDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};
