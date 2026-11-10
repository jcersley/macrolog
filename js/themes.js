// Color palettes. Each has light and dark versions, plus the colors for its matching app icon.
// Colors were checked for contrast: text 4.5:1 or better, input borders 3:1 or better.

export const PALETTES = [
  {
    "id": "label",
    "name": "Nutrition label",
    "blurb": "The original: paper grey, navy ink, signal orange.",
    "darkOnly": false,
    "light": {
      "bg": "#EEF1F4",
      "panel": "#FFFFFF",
      "ink": "#0E1A2B",
      "muted": "#556275",
      "hair": "#D3D9E1",
      "line": "#7C8899",
      "accent": "#FF5A1F",
      "onAccent": "#0E1A2B",
      "accentText": "#B93A06",
      "over": "#FF5A1F",
      "overText": "#B93A06"
    },
    "dark": {
      "bg": "#09111C",
      "panel": "#111D2D",
      "ink": "#EAF0F7",
      "muted": "#9DABBD",
      "hair": "#26364C",
      "line": "#61728A",
      "accent": "#FF6A33",
      "onAccent": "#09111C",
      "accentText": "#FF8A5C",
      "over": "#FF6A33",
      "overText": "#FF8A5C"
    },
    "icon": {
      "bg": "#0F1B2B",
      "fg": "#F4F6F8",
      "accent": "#FF5A1F"
    }
  },
  {
    "id": "safety",
    "name": "Hard hat",
    "blurb": "Navy and safety yellow, like a hard hat on a set of plans.",
    "darkOnly": false,
    "light": {
      "bg": "#E8EEF6",
      "panel": "#FFFFFF",
      "ink": "#0B2545",
      "muted": "#4E6280",
      "hair": "#D0DAE8",
      "line": "#7487A3",
      "accent": "#F6C445",
      "onAccent": "#0B2545",
      "accentText": "#8A5D00",
      "over": "#D9480F",
      "overText": "#B03A0A"
    },
    "dark": {
      "bg": "#07152A",
      "panel": "#0E2140",
      "ink": "#E8EEF7",
      "muted": "#9DB0CB",
      "hair": "#213656",
      "line": "#5B7396",
      "accent": "#F6C445",
      "onAccent": "#07152A",
      "accentText": "#F6C445",
      "over": "#FF7A45",
      "overText": "#FF9468"
    },
    "icon": {
      "bg": "#0B2545",
      "fg": "#E8EEF6",
      "accent": "#F6C445"
    }
  },
  {
    "id": "sage",
    "name": "Sage & mustard",
    "blurb": "Soft green and mustard. Calm and warm.",
    "darkOnly": false,
    "light": {
      "bg": "#ECEFE8",
      "panel": "#FBFCF9",
      "ink": "#1F2D24",
      "muted": "#56645A",
      "hair": "#D3DACF",
      "line": "#7E8B80",
      "accent": "#E0A526",
      "onAccent": "#1F2D24",
      "accentText": "#805400",
      "over": "#C2410C",
      "overText": "#A3360A"
    },
    "dark": {
      "bg": "#121812",
      "panel": "#1B231C",
      "ink": "#E7EDE6",
      "muted": "#A3B0A2",
      "hair": "#2C382D",
      "line": "#677A67",
      "accent": "#E8B13A",
      "onAccent": "#121812",
      "accentText": "#F0C35E",
      "over": "#FF7A45",
      "overText": "#FF9468"
    },
    "icon": {
      "bg": "#1F2D24",
      "fg": "#ECEFE8",
      "accent": "#E0A526"
    }
  },
  {
    "id": "pool",
    "name": "Turquoise & sand",
    "blurb": "Desert sand with a turquoise accent.",
    "darkOnly": false,
    "light": {
      "bg": "#F1EDE5",
      "panel": "#FFFDF8",
      "ink": "#1E2A2B",
      "muted": "#5B6566",
      "hair": "#DED8CC",
      "line": "#8A8F8C",
      "accent": "#1BA39C",
      "onAccent": "#0C1A1A",
      "accentText": "#0B6F69",
      "over": "#D9480F",
      "overText": "#B03A0A"
    },
    "dark": {
      "bg": "#0D1717",
      "panel": "#152222",
      "ink": "#E6EFEE",
      "muted": "#9DB3B1",
      "hair": "#233636",
      "line": "#567372",
      "accent": "#2EC4BA",
      "onAccent": "#0D1717",
      "accentText": "#5FD8CF",
      "over": "#FF7A45",
      "overText": "#FF9468"
    },
    "icon": {
      "bg": "#1E2A2B",
      "fg": "#F1EDE5",
      "accent": "#1BA39C"
    }
  },
  {
    "id": "plum",
    "name": "Plum night",
    "blurb": "Always dark: deep plum with a soft pink accent.",
    "darkOnly": true,
    "light": {
      "bg": "#15121C",
      "panel": "#1F1A29",
      "ink": "#EFEAF6",
      "muted": "#ABA1BC",
      "hair": "#322A40",
      "line": "#7A6C90",
      "accent": "#F2A7CB",
      "onAccent": "#15121C",
      "accentText": "#F6BCD8",
      "over": "#FF8A65",
      "overText": "#FFA285"
    },
    "dark": {
      "bg": "#15121C",
      "panel": "#1F1A29",
      "ink": "#EFEAF6",
      "muted": "#ABA1BC",
      "hair": "#322A40",
      "line": "#7A6C90",
      "accent": "#F2A7CB",
      "onAccent": "#15121C",
      "accentText": "#F6BCD8",
      "over": "#FF8A65",
      "overText": "#FFA285"
    },
    "icon": {
      "bg": "#15121C",
      "fg": "#EFEAF6",
      "accent": "#F2A7CB"
    }
  },
  {
    "id": "graphite",
    "name": "Graphite & red",
    "blurb": "Black, white and one red. Nothing else.",
    "darkOnly": false,
    "light": {
      "bg": "#EFEFEF",
      "panel": "#FFFFFF",
      "ink": "#141414",
      "muted": "#5C5C5C",
      "hair": "#D9D9D9",
      "line": "#808080",
      "accent": "#C9252C",
      "onAccent": "#FFFFFF",
      "accentText": "#C1121F",
      "over": "#C9252C",
      "overText": "#C1121F"
    },
    "dark": {
      "bg": "#0F0F0F",
      "panel": "#1A1A1A",
      "ink": "#F0F0F0",
      "muted": "#A6A6A6",
      "hair": "#2E2E2E",
      "line": "#6B6B6B",
      "accent": "#FF5C5F",
      "onAccent": "#0F0F0F",
      "accentText": "#FF7A7C",
      "over": "#FF5C5F",
      "overText": "#FF7A7C"
    },
    "icon": {
      "bg": "#141414",
      "fg": "#EFEFEF",
      "accent": "#E5383B"
    }
  },
  {
    "id": "dmg",
    "name": "DMG green",
    "blurb": "The four greens of an original pocket handheld screen.",
    "darkOnly": false,
    "light": {
      "chartSurface": "#EEF6CC",
      "bg": "#8BAC0F",
      "panel": "#9BBC0F",
      "ink": "#0F380F",
      "muted": "#173D16",
      "hair": "#7E9C10",
      "line": "#306230",
      "accent": "#306230",
      "onAccent": "#C4DE5A",
      "accentText": "#0F380F",
      "over": "#7A2410",
      "overText": "#5E1A0A"
    },
    "dark": {
      "bg": "#0F380F",
      "panel": "#174617",
      "ink": "#C4DE5A",
      "muted": "#9BBC0F",
      "hair": "#285A28",
      "line": "#6E9A2E",
      "accent": "#9BBC0F",
      "onAccent": "#0F380F",
      "accentText": "#B5D23A",
      "over": "#E8853A",
      "overText": "#F0A060"
    },
    "icon": {
      "bg": "#0F380F",
      "fg": "#9BBC0F",
      "accent": "#8BAC0F"
    }
  }
];

const VARS = {
  bg: '--bg', panel: '--panel', ink: '--ink', muted: '--muted', hair: '--hair', line: '--line',
  accent: '--accent', onAccent: '--on-accent', accentText: '--accent-text', over: '--over', overText: '--over-text',
};

export const paletteById = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0];

// --rule is for structural lines (panel borders, the thick label dividers). It's the ink color in
// light mode; in dark mode a full-strength light line is glaring, so it's toned down toward the panel.
// Macro chart colors: a categorical trio checked for color-blind separation in both modes
// (blue, yellow, aqua). --chart-surface lets a palette give charts a calmer backing.
const MACRO = { light: ['#2a78d6', '#eda100', '#1baf7a'], dark: ['#3987e5', '#c98500', '#199e70'] };
const block = (t, dark = false) => {
  const [mp, mc, mf] = MACRO[dark ? 'dark' : 'light'];
  return (
    Object.entries(VARS).map(([k, v]) => `${v}:${t[k]};`).join('') +
    `--rule:${dark ? `color-mix(in srgb, ${t.ink} 32%, ${t.panel})` : t.ink};` +
    `--m-protein:${mp};--m-carbs:${mc};--m-fat:${mf};--chart-surface:${t.chartSurface || t.panel};`
  );
};

// appearance: 'auto' follows the phone's light/dark setting; 'light' or 'dark' forces one.
export function themeCSS(id, appearance = 'auto') {
  const p = paletteById(id);
  if (p.darkOnly || appearance === 'dark') return `:root{${block(p.dark, true)}color-scheme:dark}`;
  if (appearance === 'light') return `:root{${block(p.light)}color-scheme:light}`;
  return `:root{${block(p.light)}color-scheme:light}@media (prefers-color-scheme: dark){:root{${block(p.dark, true)}color-scheme:dark}}`;
}

export function isDarkNow(id, appearance = 'auto') {
  const p = paletteById(id);
  if (p.darkOnly || appearance === 'dark') return true;
  if (appearance === 'light') return false;
  return !!globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export const iconPath = (id, size) => `icons/${paletteById(id).id}-${size}.png`;

// Applies the palette to the page, the browser bar color and the home screen icon link.
export function applyTheme(id, appearance = 'auto') {
  const css = themeCSS(id, appearance);
  let tag = document.getElementById('theme');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'theme';
    document.head.appendChild(tag);
  }
  tag.textContent = css;
  try {
    localStorage.setItem('macrolog.theme', JSON.stringify({ css, icon: iconPath(id, 180) }));
  } catch {
    // the theme still applies for this visit
  }
  const p = paletteById(id);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = isDarkNow(id, appearance) ? p.dark.bg : p.light.bg;
  document.head.appendChild(meta);
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', iconPath(id, 180));
  document.querySelector('link[rel="icon"]')?.setAttribute('href', iconPath(id, 192));
}
