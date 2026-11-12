/*
 * Accent presets: the action colour people see on buttons, links and the net-worth card. The colours themselves live
 * in index.css as `:root[data-accent='…']` blocks; this file is the list, the saved choice and how it is applied.
 * Like the theme, the choice is kept in this browser only.
 */

export const ACCENTS = [
  { id: 'forest', label: 'Forest', description: 'The Crystal green', swatch: { light: '#2F5C50', dark: '#6CC59A' } },
  { id: 'ocean', label: 'Ocean', description: 'Calm blue', swatch: { light: '#285A8C', dark: '#7DB3EA' } },
  { id: 'plum', label: 'Plum', description: 'Muted purple', swatch: { light: '#6B4678', dark: '#C6A2D8' } },
  { id: 'copper', label: 'Copper', description: 'Warm brown', swatch: { light: '#8F5226', dark: '#E6AC7C' } },
  { id: 'graphite', label: 'Graphite', description: 'Quiet grey', swatch: { light: '#3E4650', dark: '#B9C0C8' } },
] as const;

export type AccentId = typeof ACCENTS[number]['id'];

export const DEFAULT_ACCENT: AccentId = 'forest';
export const ACCENT_STORAGE_KEY = 'accent';

export const isAccentId = (value: unknown): value is AccentId => ACCENTS.some(accent => accent.id === value);

export const readAccent = (): AccentId => {
  try {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    return isAccentId(stored) ? stored : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
};

/** Sets the accent on the page and remembers it. Forest is the default, so it clears the attribute. */
export const applyAccent = (accent: AccentId) => {
  const root = document.documentElement;
  if (accent === DEFAULT_ACCENT) root.removeAttribute('data-accent');
  else root.setAttribute('data-accent', accent);
  try { localStorage.setItem(ACCENT_STORAGE_KEY, accent); } catch { /* private window: the choice lasts for this visit */ }
  // The browser bar follows the canvas, which carries a tint of the accent.
  const meta = document.getElementById('theme-color-meta');
  if (meta) {
    const canvas = getComputedStyle(root).getPropertyValue('--canvas').trim();
    if (canvas) meta.setAttribute('content', canvas);
  }
};
