import { AppPreferences, MerchantRule, RegexCategorizationRule, Transaction, TransactionRule } from '../types';
import { normalizeMerchantKey } from './brandfetch';
import { alwaysFileRule } from './rules';

export const RULES_VERSION = 2;

export interface RulesMigrationBackup {
  migratedAt: string;
  merchantFiling: Record<string, Pick<MerchantRule, 'category' | 'defaultDescription'>>;
  regexCategorizationRules: RegexCategorizationRule[];
  transactionRules: TransactionRule[];
}

const titleCase = (key: string) => key.replace(/\b\p{L}/gu, letter => letter.toUpperCase());

/** The merchant's most common spelling reads better than its lowercase key. */
const displayNames = (transactions: Transaction[]) => {
  const counts = new Map<string, Map<string, number>>();
  transactions.forEach(({ merchant }) => {
    const key = normalizeMerchantKey(merchant);
    if (!key || !merchant) return;
    const names = counts.get(key) ?? new Map<string, number>();
    names.set(merchant.trim(), (names.get(merchant.trim()) ?? 0) + 1);
    counts.set(key, names);
  });
  return (key: string) => {
    const names = counts.get(key);
    return names ? [...names.entries()].sort((a, b) => b[1] - a[1])[0][0] : titleCase(key);
  };
};

/**
 * Moves merchant categories and descriptions, and regex rules, into transactionRules (D-105). It runs on every load, so
 * an older backup restored later moves across too, and it does nothing once done. The old values stay in a backup.
 */
export const migrateRules = (preferences: AppPreferences, transactions: Transaction[], now: string): AppPreferences => {
  if ((preferences.rulesVersion ?? 0) >= RULES_VERSION) return preferences;

  const nameOf = displayNames(transactions);
  const existing = preferences.transactionRules ?? [];
  const merchantRules: Record<string, MerchantRule> = {};
  const merchantFiling: RulesMigrationBackup['merchantFiling'] = {};
  const filings: TransactionRule[] = [];

  Object.entries(preferences.merchantRules ?? {}).forEach(([key, { category, defaultDescription, ...rest }]) => {
    merchantRules[key] = rest;
    if (!category && !defaultDescription) return;
    merchantFiling[key] = { category, defaultDescription };
    filings.push(alwaysFileRule(key, nameOf(key), { category, description: defaultDescription }));
  });

  // Regex rules used to run after every other rule, so they stay below them, in their own order.
  const regexRules = preferences.regexCategorizationRules ?? [];
  const lowest = Math.min(0, ...existing.map(rule => rule.priority ?? 0));
  const moved = regexRules.map((rule, index): TransactionRule => ({
    id: `regex-${rule.id}`,
    name: rule.description || rule.pattern,
    isActive: rule.isActive,
    priority: lowest - 1 - index,
    conditions: [{ field: 'text', operator: 'matches', value: rule.pattern }],
    actions: [{ field: 'category', value: rule.category }],
  }));

  const hasMoved = filings.length > 0 || moved.length > 0;
  const { regexCategorizationRules: _moved, ...rest } = preferences;
  return {
    ...rest,
    ...(preferences.merchantRules ? { merchantRules } : {}),
    ...(hasMoved ? { transactionRules: [...existing, ...filings, ...moved] } : {}),
    ...(hasMoved ? { rulesMigrationBackup: { migratedAt: now, merchantFiling, regexCategorizationRules: regexRules, transactionRules: existing } } : {}),
    rulesVersion: RULES_VERSION,
  };
};

/** Puts the old setup back from the backup. */
export const undoRulesMigration = (preferences: AppPreferences): AppPreferences => {
  const backup = preferences.rulesMigrationBackup;
  if (!backup) return preferences;
  const { rulesMigrationBackup: _backup, rulesVersion: _version, ...rest } = preferences;
  const merchantRules = { ...preferences.merchantRules };
  Object.entries(backup.merchantFiling).forEach(([key, filing]) => { merchantRules[key] = { ...merchantRules[key], ...filing }; });
  return { ...rest, merchantRules, regexCategorizationRules: backup.regexCategorizationRules, transactionRules: backup.transactionRules };
};
