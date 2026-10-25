import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';

/**
 * UI_UX_DESIGN_REFERENCE.md §5.0: New pages may use data and logic but never classic UI, and classic UI never
 * imports New pages. App.tsx is the one place that mounts both.
 */
const ROOT = resolve(import.meta.dirname, '../..');
const NEW_DIRS = ['pages/new', 'components/new', 'components/kokonutui'];
const NEW_UI_LIBS = ['components/new', 'components/bklit', 'components/kokonutui', 'components/magicui'];
const CLASSIC_DIRS = ['pages', 'components', 'contexts', 'hooks', 'utils', 'src'];

const walk = (dir: string): string[] => readdirSync(join(ROOT, dir)).flatMap(name => {
  const rel = join(dir, name);
  if (statSync(join(ROOT, rel)).isDirectory()) return walk(rel);
  return /\.(tsx?|css)$/.test(name) ? [rel] : [];
});

const imports = (file: string): string[] => {
  const src = readFileSync(join(ROOT, file), 'utf8');
  return [...src.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+|@\/[^'"]+)['"]/g)].map(m => {
    const spec = m[1];
    return spec.startsWith('@/') ? spec.slice(2) : relative(ROOT, resolve(dirname(join(ROOT, file)), spec));
  });
};

const under = (path: string, dirs: string[]) => dirs.some(d => path === d || path.startsWith(d + '/'));

test('New pages and components import no classic UI', () => {
  const offenders: string[] = [];
  for (const file of NEW_DIRS.flatMap(walk)) {
    for (const target of imports(file)) {
      const classicUi = (under(target, ['components', 'pages']) && !under(target, [...NEW_UI_LIBS, 'pages/new']))
        || target === 'constants' || target.startsWith('constants.');
      if (classicUi) offenders.push(`${file} → ${target}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('classic code never imports the New UI', () => {
  const offenders: string[] = [];
  const classicFiles = CLASSIC_DIRS.flatMap(walk).filter(f => !under(f, [...NEW_UI_LIBS, 'pages/new']));
  for (const file of classicFiles) {
    for (const target of imports(file)) {
      if (under(target, ['components/new', 'pages/new', 'components/bklit'])) offenders.push(`${file} → ${target}`);
    }
  }
  assert.deepEqual(offenders, []);
});
