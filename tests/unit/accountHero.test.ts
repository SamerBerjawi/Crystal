import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALL_ACCOUNT_TYPES } from '../../constants';
import { AccountType } from '../../types';
import { heroClassFor } from '../../utils/accountHero';

test('every account type has its own colour', () => {
  const classes = ALL_ACCOUNT_TYPES.map(heroClassFor);
  assert.equal(new Set(classes).size, ALL_ACCOUNT_TYPES.length);
});

test('every colour is defined, and an unknown type falls back to Checking', () => {
  const css = readFileSync('index.css', 'utf8');
  ALL_ACCOUNT_TYPES.map(heroClassFor).filter(name => name !== 'bg-pine').forEach(name => {
    assert.ok(css.includes(`${name.match(/var\((--[a-z-]+)\)/)![1]}:`), name);
  });
  assert.equal(heroClassFor('Nope' as AccountType), 'bg-pine');
});

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

test('hero text passes AA on every colour', () => {
  const css = readFileSync('index.css', 'utf8');
  const colours = [...css.matchAll(/--hero-[a-z-]+: (#[0-9A-Fa-f]{6});/g)].map(match => match[1]);
  assert.equal(colours.length, ALL_ACCOUNT_TYPES.length - 1);
  const text = luminance('#FBF8F2');
  colours.forEach(colour => assert.ok((text + 0.05) / (luminance(colour) + 0.05) >= 4.5, colour));
});
