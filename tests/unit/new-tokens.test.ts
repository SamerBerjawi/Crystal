import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Token guardrails for the New UI (UI_UX_DESIGN_REFERENCE.md D14): colours come from the `nv-*` tokens and
 * stacking from the named z-index scale. `components/new/new.css` is the token source and is not scanned.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const DIRS = ['pages/new', 'components/new', 'components/kokonutui'];

const walk = (dir: string): string[] => readdirSync(join(ROOT, dir)).flatMap(name => {
  const rel = join(dir, name);
  if (statSync(join(ROOT, rel)).isDirectory()) return walk(rel);
  return /\.tsx?$/.test(name) ? [rel] : [];
});

const RULES: { name: string; pattern: RegExp }[] = [
  { name: 'hex colour', pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { name: 'arbitrary z-index', pattern: /\bz-\[/ },
  { name: 'numeric z-index utility', pattern: /\bz-(?:10|20|30|40|50)\b/ },
  { name: 'arbitrary rgb/hsl value', pattern: /\[[^\]]*\b(?:rgb|rgba|hsl|hsla|oklch)\(/ },
  { name: 'Tailwind palette colour', pattern: /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/ },
  { name: 'black fill', pattern: /\bbg-black\b/ },
];

test('New UI files use only nv-* colour tokens and the named z-index scale', () => {
  const offenders: string[] = [];
  for (const file of DIRS.flatMap(walk)) {
    readFileSync(join(ROOT, file), 'utf8').split('\n').forEach((line, i) => {
      for (const rule of RULES) {
        if (rule.pattern.test(line)) offenders.push(`${file}:${i + 1} ${rule.name}: ${line.trim().slice(0, 120)}`);
      }
    });
  }
  assert.deepEqual(offenders, []);
});
