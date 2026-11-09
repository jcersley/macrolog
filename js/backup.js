// Backup export and the monthly reminder.

import { dateKey, daysBetween, addDays } from './nutrition.js';

export const BACKUP_EVERY_DAYS = 30;

// Remind once you've been logging 30 days with no backup, or 30 days after the last one.
export function shouldPromptBackup({ today, lastBackup, snoozedUntil, firstLogDate }) {
  if (!firstLogDate) return false;
  if (snoozedUntil && today < snoozedUntil) return false;
  return daysBetween(lastBackup || firstLogDate, today) >= BACKUP_EVERY_DAYS;
}

export const snoozeDate = (today = dateKey()) => addDays(today, 7);

export function firstLogDate(log) {
  let min = '';
  for (const e of log) if (!min || e.date < min) min = e.date;
  return min;
}

// Returns true if a file was handed off (shared or downloaded).
export async function exportBackup(store) {
  const text = store.exportJSON();
  const name = `macrolog-backup-${dateKey()}.json`;
  const file = new File([text], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Macrolog backup' });
      store.setSettings({ lastBackup: dateKey(), backupSnoozed: '' });
      return true;
    }
  } catch (err) {
    if (err?.name === 'AbortError') return false;
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  store.setSettings({ lastBackup: dateKey(), backupSnoozed: '' });
  return true;
}
