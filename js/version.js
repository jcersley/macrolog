// Bump these with every release, and bump VERSION in sw.js to match (macrolog-v + the release number).
export const APP_VERSION = '1.6.0';
export const RELEASED = '2026-11-09';

export const CHANGELOG = [
  {
    version: '1.6.0',
    date: '2026-11-09',
    notes: [
      'Recipes for batch cooking: enter what went in the pot, weigh the finished food, and log your bowl by weight.',
      'Each batch is dated. "Make it again" copies the last batch so you only change what\'s different.',
      'Log leftovers from an older batch, and fix a batch later with the option to update what you already logged.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-11-08',
    notes: [
      'USDA foods come with all of USDA\'s portion sizes, like "1 large" egg or "1 cup", picked from a Portion menu when you log.',
      'USDA foods default to their first real portion instead of 100 g.',
      'Foods saved from USDA earlier can get their portion sizes from the food\'s edit screen.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-11-08',
    notes: [
      'Custom calorie goal in Profile.',
      'Mark days complete. Averages and the maintenance estimate count complete days only.',
      'Progress estimates what you actually burn from your logs and weigh-ins, and can use it for your goals.',
      'Weekly calorie budget on Today, Monday to Sunday.',
      'Waist tracking, including on the Monday weigh-in.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-11-08',
    notes: [
      'Asks you to confirm before logging something that puts you over a daily goal. Choose which goals in Profile > Settings.',
      'Custom macros: set two in grams, and the third fills the rest of your calories.',
    ],
  },
  { version: '1.2.0', date: '2026-11-08', notes: ['Version and update info in Profile.'] },
  {
    version: '1.1.0',
    date: '2026-11-08',
    notes: [
      'Recent foods by meal, with one-tap logging.',
      'Foods open with the amount you had last time.',
      'Quick amount buttons: ½, 1, 1½, 2.',
      'Same as yesterday, and copy a meal from a past day.',
      'Search USDA by name for foods without barcodes.',
      'Monthly backup reminder and an update notice.',
    ],
  },
  { version: '1.0.0', date: '2026-11-08', notes: ['First build.'] },
];
