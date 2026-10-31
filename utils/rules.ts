import { TransactionRule, TransactionRuleCondition, MerchantRule, RegexCategorizationRule } from '../types';
import { normalizeMerchantKey } from './brandfetch';

export function evaluateRuleCondition(
  tx: { description?: string; merchant?: string; amount?: number; type?: string; category?: string },
  condition: TransactionRuleCondition
): boolean {
  let valToMatch = '';

  if (condition.field === 'description') {
    valToMatch = tx.description || '';
  } else if (condition.field === 'merchant') {
    valToMatch = tx.merchant || '';
  } else if (condition.field === 'type') {
    valToMatch = tx.type || '';
  } else if (condition.field === 'category') {
    valToMatch = tx.category || '';
  } else if (condition.field === 'amount') {
    const txAmount = Math.abs(tx.amount || 0);
    const condAmount = parseFloat(condition.value);
    if (isNaN(txAmount) || isNaN(condAmount)) return false;
    if (condition.operator === 'equals') return txAmount === condAmount;
    if (condition.operator === 'greater_than') return txAmount > condAmount;
    if (condition.operator === 'less_than') return txAmount < condAmount;
    return false;
  }

  const searchVal = (condition.value || '').toLowerCase();
  const targetVal = valToMatch.toLowerCase();

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

export function applyTransactionRulesToFields(
  tx: { description: string; merchant: string; category: string; amount: number; type: string },
  merchantRules: Record<string, MerchantRule>,
  transactionRules: TransactionRule[]
): { description: string; merchant: string; category: string; appliedRuleId?: string; isFromMerchantRule?: boolean } {
  // 1. Merchant rule - if merchant already exists and has category or defaultDescription configured, it takes absolute precedence!
  const merchantKey = normalizeMerchantKey(tx.merchant);
  if (merchantKey) {
    const mRule = merchantRules[merchantKey];
    if (mRule && (mRule.category || mRule.defaultDescription)) {
      return {
        merchant: tx.merchant,
        category: mRule.category || tx.category,
        description: mRule.defaultDescription || tx.description,
        isFromMerchantRule: true
      };
    }
  }

  // 2. Rule engine (IF-WHEN-THEN rules)
  const activeRules = (transactionRules || [])
    .filter(r => r.isActive)
    .slice()
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  for (const rule of activeRules) {
    if (rule.conditions.length === 0) continue;

    // Evaluate using AND (default) or OR logic depending on rule.conditionLogic
    const logic = rule.conditionLogic ?? 'AND';
    const conditionResults = rule.conditions.map(cond => evaluateRuleCondition(tx, cond));
    const allMatch = logic === 'OR'
      ? conditionResults.some(Boolean)
      : conditionResults.every(Boolean);

    if (allMatch) {
      let nextMerchant = tx.merchant;
      let nextDescription = tx.description;
      let nextCategory = tx.category;

      rule.actions.forEach(act => {
        if (act.field === 'merchant') nextMerchant = act.value;
        else if (act.field === 'description') nextDescription = act.value;
        else if (act.field === 'category') nextCategory = act.value;
      });

      return {
        merchant: nextMerchant,
        description: nextDescription,
        category: nextCategory,
        appliedRuleId: rule.id
      };
    }
  }

  return {
    merchant: tx.merchant,
    description: tx.description,
    category: tx.category
  };
}

interface SavedRules {
  merchantRules?: Record<string, MerchantRule>;
  transactionRules?: TransactionRule[];
  regexCategorizationRules?: RegexCategorizationRule[];
}

/**
 * Runs merchant, transaction and regex rules on a new record, including one that arrives from a bank with its own id.
 * A merchant's own category wins, so regex rules only fill in where the merchant has none (DEF-07).
 */
export function applySavedRules<T extends { description?: string; merchant?: string; category?: string; amount?: number; type?: string; notes?: string }>(tx: T, rules: SavedRules): T {
  const result = applyTransactionRulesToFields(
    { description: tx.description || '', merchant: tx.merchant || '', category: tx.category || '', amount: Number(tx.amount) || 0, type: tx.type || 'expense' },
    rules.merchantRules || {},
    rules.transactionRules || []
  );
  const next = { ...tx, merchant: result.merchant, description: result.description, category: result.category };
  if (result.isFromMerchantRule) return next;

  const text = [next.merchant, next.description, tx.notes || ''].join(' ').trim();
  for (const rule of (rules.regexCategorizationRules || []).filter(item => item.isActive)) {
    try {
      if (new RegExp(rule.pattern, 'i').test(text)) return { ...next, category: rule.category };
    } catch (error) {
      console.error('Invalid regex pattern:', rule.pattern, error);
    }
  }
  return next;
}

/** What rounds an outflow up to the next whole unit. Whole amounts have nothing to round. */
export const spareChangeFor = (amount: number): number => {
  const remainder = parseFloat((Math.abs(amount) % 1).toFixed(2));
  return remainder === 0 ? 0 : parseFloat((1 - remainder).toFixed(2));
};
