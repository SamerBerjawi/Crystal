import { MerchantRule, RuleFieldAction, TransactionRule, TransactionRuleCondition } from '../types';
import { normalizeMerchantKey } from './brandfetch';

interface RuleTarget {
  description?: string;
  merchant?: string;
  amount?: number;
  type?: string;
  category?: string;
  notes?: string;
  assetId?: string;
}

export function evaluateRuleCondition(tx: RuleTarget, condition: TransactionRuleCondition): boolean {
  if (condition.field === 'amount') {
    const txAmount = Math.abs(tx.amount || 0);
    const condAmount = parseFloat(condition.value);
    if (isNaN(txAmount) || isNaN(condAmount)) return false;
    if (condition.operator === 'equals') return txAmount === condAmount;
    if (condition.operator === 'greater_than') return txAmount > condAmount;
    if (condition.operator === 'less_than') return txAmount < condAmount;
    return false;
  }

  if (condition.operator === 'is_merchant') return normalizeMerchantKey(tx.merchant) === condition.value;

  const text = condition.field === 'text' ? [tx.merchant, tx.description, tx.notes].filter(Boolean).join(' ').trim() : tx[condition.field] || '';

  if (condition.operator === 'matches') {
    try {
      return new RegExp(condition.value, 'i').test(text);
    } catch {
      return false;
    }
  }

  const searchVal = (condition.value || '').toLowerCase();
  const targetVal = text.toLowerCase();

  switch (condition.operator) {
    case 'contains':
      return targetVal.includes(searchVal);
    case 'equals':
      return targetVal === searchVal;
    case 'starts_with':
      return targetVal.startsWith(searchVal);
    case 'ends_with':
      return targetVal.endsWith(searchVal);
    default:
      return false;
  }
}

export const ruleMatches = (tx: RuleTarget, rule: TransactionRule): boolean => {
  if (rule.conditions.length === 0) return false;
  const results = rule.conditions.map(condition => evaluateRuleCondition(tx, condition));
  return rule.conditionLogic === 'OR' ? results.some(Boolean) : results.every(Boolean);
};

export const isAlwaysFile = (rule: TransactionRule) => rule.kind === 'always';

/** Highest priority first. */
export const ordinaryRules = (rules: TransactionRule[] = []): TransactionRule[] =>
  rules.filter(rule => !isAlwaysFile(rule)).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

export interface RuleResult {
  description: string;
  merchant: string;
  category: string;
  /** A Property or Vehicle account id, when a rule set one or the transaction had one. */
  assetId?: string;
  /** The rule that ran after any always file. */
  appliedRuleId?: string;
  filingRuleId?: string;
}

/**
 * The one way rules run (D-105). A merchant's always file sets what it sets. The first rule that matches and still
 * has something to set then fills the rest, so an always file never silently stops a rule.
 */
export function applyRules(tx: { description: string; merchant: string; category: string; amount: number; type: string; notes?: string; assetId?: string }, rules: TransactionRule[] = []): RuleResult {
  const result: RuleResult = { merchant: tx.merchant, description: tx.description, category: tx.category, ...(tx.assetId ? { assetId: tx.assetId } : {}) };
  const locked = new Set<RuleFieldAction>();
  const setField = (field: RuleFieldAction, value: string) => { result[field] = value; };

  const applyFilingFor = (merchantName: string) => {
    const filing = rules.find(rule => isAlwaysFile(rule) && rule.isActive && ruleMatches({ ...tx, merchant: merchantName }, rule));
    if (filing) {
      filing.actions.forEach(action => { setField(action.field, action.value); locked.add(action.field); });
      result.filingRuleId = filing.id;
    }
  };

  applyFilingFor(tx.merchant);

  for (const rule of ordinaryRules(rules).filter(item => item.isActive)) {
    const open = rule.actions.filter(action => !locked.has(action.field));
    if (open.length === 0 || !ruleMatches(tx, rule)) continue;
    open.forEach(action => setField(action.field, action.value));
    result.appliedRuleId = rule.id;
    break;
  }

  // If an ordinary keyword rule detected or changed the merchant, run the new merchant's always-file rule
  // for any fields not already set by the keyword rule itself.
  if (!result.filingRuleId && result.merchant && normalizeMerchantKey(result.merchant) !== normalizeMerchantKey(tx.merchant)) {
    const filing = rules.find(rule => isAlwaysFile(rule) && rule.isActive && ruleMatches({ ...tx, merchant: result.merchant }, rule));
    if (filing) {
      const ruleSetFields = new Set(rules.find(r => r.id === result.appliedRuleId)?.actions.map(a => a.field) ?? []);
      filing.actions.forEach(action => {
        if (!ruleSetFields.has(action.field)) {
          setField(action.field, action.value);
        }
      });
      result.filingRuleId = filing.id;
    }
  }

  return result;
}

/** Runs saved rules on a new record, including one that arrives from a bank with its own id. */
export function applySavedRules<T extends RuleTarget>(tx: T, rules: { transactionRules?: TransactionRule[] }): T & Pick<RuleTarget, 'assetId'> {
  const result = applyRules(
    { description: tx.description || '', merchant: tx.merchant || '', category: tx.category || '', amount: Number(tx.amount) || 0, type: tx.type || 'expense', notes: tx.notes, assetId: tx.assetId },
    rules.transactionRules,
  );
  return { ...tx, merchant: result.merchant, description: result.description, category: result.category, ...(result.assetId ? { assetId: result.assetId } : {}) };
}

export interface Filing {
  category?: string;
  description?: string;
}

const alwaysFileId = (key: string) => `always-${key}`;

export const alwaysFileRule = (key: string, name: string, { category, description }: Filing, isActive = true): TransactionRule => ({
  id: alwaysFileId(key),
  name,
  kind: 'always',
  isActive,
  conditions: [{ field: 'merchant', operator: 'is_merchant', value: key }],
  actions: [
    ...(category ? [{ field: 'category' as const, value: category }] : []),
    ...(description ? [{ field: 'description' as const, value: description }] : []),
  ],
});

const merchantKeyOf = (rule: TransactionRule) => rule.conditions[0]?.value;

export const filingFor = (merchant: string | undefined, rules: TransactionRule[] = []): TransactionRule | undefined => {
  const key = normalizeMerchantKey(merchant);
  return key ? rules.find(rule => isAlwaysFile(rule) && merchantKeyOf(rule) === key) : undefined;
};

/** Adds, edits or, with nothing to file, removes a merchant's always file. */
export const setFiling = (rules: TransactionRule[], key: string, name: string, filing: Filing): TransactionRule[] => {
  const existing = rules.find(rule => isAlwaysFile(rule) && merchantKeyOf(rule) === key);
  const others = rules.filter(rule => rule !== existing);
  if (!filing.category && !filing.description) return others;
  return [...others, alwaysFileRule(key, existing?.name ?? name, filing, existing?.isActive ?? true)];
};

/** Merchant screens still show category and description, so they read them from always file rules. */
export const withFiling = (merchantRules: Record<string, MerchantRule> = {}, rules: TransactionRule[] = []): Record<string, MerchantRule> => {
  const merged = { ...merchantRules };
  rules.filter(rule => isAlwaysFile(rule) && rule.isActive).forEach(rule => {
    const key = merchantKeyOf(rule);
    merged[key] = {
      ...merged[key],
      category: rule.actions.find(action => action.field === 'category')?.value,
      defaultDescription: rule.actions.find(action => action.field === 'description')?.value,
    };
  });
  return merged;
};

/** What rounds an outflow up to the next whole unit. Whole amounts have nothing to round. */
export const spareChangeFor = (amount: number): number => {
  const remainder = parseFloat((Math.abs(amount) % 1).toFixed(2));
  return remainder === 0 ? 0 : parseFloat((1 - remainder).toFixed(2));
};
