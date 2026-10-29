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

/**
 * Reference-compliance guardrails for the pages that have had the pass (Accounts, Account detail, Budget;
 * docs/ACCOUNTS_BUDGET_REVIEW_PLAN.md Phase 3). Add a page's files here once it has been through it.
 */
const COMPLIANT = [
  'pages/new/AccountsNew.tsx',
  'pages/new/AccountDetailNew.tsx',
  'pages/new/BudgetNew.tsx',
  ...walk('components/new/accounts'),
  ...walk('components/new/budget'),
];
// Files that only render inside a sheet may keep the sheet's one call to action (R7).
const SHEET_FILES = /(?:sheets|AccountFormSheet|detailShared)\.tsx$/;
const isChip = (line: string) => /rounded-(?:full|md|lg)\b|\brounded\b/.test(line) && /\bpx-\d/.test(line);

const COMPLIANCE_RULES: { name: string; applies?: (file: string) => boolean; offends: (line: string) => boolean }[] = [
  // D14: 11px is the floor, and only for chips and counters; information is 12px+.
  { name: 'type below 11px', offends: line => /\btext-\[(?:[0-9]|10)(?:\.\d+)?px\]/.test(line) },
  { name: '11px outside a chip', offends: line => /\btext-\[11px\]/.test(line) && !isChip(line) },
  // R2: tiles carry no shadows; only floating overlays (menus, popups, dialogs) use the float token.
  {
    name: 'shadow on a tile',
    offends: line =>
      /\b(?:hover:)?(?:drop-)?shadow-(?!none\b|nv-thumb\b|nv-float\b)[a-z0-9]/.test(line) ||
      (/\bshadow-nv-float\b/.test(line) && !/Popup|z-popover|z-modal|z-dropdown/.test(line)),
  },
  // R7 / N4: the header holds the page's one violet call to action; page bodies use ink.
  { name: 'violet CTA in a page body', applies: file => !SHEET_FILES.test(file), offends: line => /variant="cta"/.test(line) },
  // R9: no glass and no accent-filled surfaces.
  { name: 'glass surface', offends: line => /\bbackdrop-blur/.test(line) },
  { name: 'undefined teal token', offends: line => /\bnv-teal\b|nv-teal-/.test(line) },
];

test('Accounts and Budget follow the type floor, surface, CTA and accent rules', () => {
  const offenders: string[] = [];
  for (const file of COMPLIANT) {
    readFileSync(join(ROOT, file), 'utf8').split('\n').forEach((line, i) => {
      for (const rule of COMPLIANCE_RULES) {
        if (rule.applies && !rule.applies(file)) continue;
        if (rule.offends(line)) offenders.push(`${file}:${i + 1} ${rule.name}: ${line.trim().slice(0, 120)}`);
      }
    });
  }
  assert.deepEqual(offenders, []);
});
