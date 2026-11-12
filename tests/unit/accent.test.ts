import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACCENTS, DEFAULT_ACCENT, isAccentId } from '../../utils/accent';

const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** The declarations of the first rule whose selector is exactly `selector`. */
const rule = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `missing rule ${selector}`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
};

const SURFACE = { light: { solid: '#FFFDF8', canvas: '#EBE8E1', ink: '#1B1813', onPrimary: '#FFFFFF' }, dark: { solid: '#1E1C17', canvas: '#100F0C', ink: '#F4F1EA', onPrimary: '#14130F' } };

test('the default accent is in the list and ids are recognised', () => {
  assert.ok(isAccentId(DEFAULT_ACCENT));
  assert.equal(isAccentId('neon'), false);
  assert.equal(new Set(ACCENTS.map(a => a.id)).size, ACCENTS.length);
});

for (const accent of ACCENTS.filter(a => a.id !== DEFAULT_ACCENT)) {
  for (const mode of ['light', 'dark'] as const) {
    test(`${accent.label} (${mode}) meets 4.5:1 for buttons, text and tinted fills`, () => {
      const tokens = rule(mode === 'light' ? `:root[data-accent='${accent.id}']` : `:root[data-accent='${accent.id}'].dark`);
      const s = SURFACE[mode];
      assert.equal(tokens.primary.toUpperCase(), accent.swatch[mode].toUpperCase(), 'swatch matches the stylesheet');
      assert.ok(contrast(tokens.primary, s.onPrimary) >= 4.5, 'button label on primary');
      assert.ok(contrast(tokens['primary-hover'], s.onPrimary) >= 4.5, 'button label on hover');
      assert.ok(contrast(tokens.primary, s.solid) >= 4.5, 'accent text on a solid surface');
      assert.ok(contrast(tokens.primary, s.canvas) >= 4.5, 'accent text on the canvas');
      assert.ok(contrast(tokens.primary, tokens['primary-soft']) >= 4.5, 'accent text on its soft tint');
      assert.ok(contrast(s.ink, tokens['primary-soft']) >= 7, 'ink on the soft tint');
      if (mode === 'light') assert.ok(contrast(tokens.pine, '#FBF8F2') >= 4.5, 'net-worth card text on pine');
    });
  }
}
