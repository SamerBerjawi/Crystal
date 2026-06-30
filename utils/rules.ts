import { TransactionRule, TransactionRuleCondition, MerchantRule } from '../types';
import { normalizeMerchantKey } from './brandfetch';

export function evaluateRuleCondition(
  tx: { description?: string; merchant?: string; amount?: number; type?: string },
  condition: TransactionRuleCondition
): boolean {
  let valToMatch = '';
  if (condition.field === 'description') {
    valToMatch = tx.description || '';
  } else if (condition.field === 'merchant') {
    valToMatch = tx.merchant || '';
  } else if (condition.field === 'type') {
    valToMatch = tx.type || '';
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
  // 1. Merchant rule - if merchant already exists and has category configured, it takes absolute precedence!
  const merchantKey = normalizeMerchantKey(tx.merchant);
  if (merchantKey) {
    const mRule = merchantRules[merchantKey];
    if (mRule && mRule.category) {
      return {
        merchant: tx.merchant,
        category: mRule.category,
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
    // Check if ALL conditions match (AND logic)
    const allMatch = rule.conditions.every(cond => evaluateRuleCondition(tx, cond));
    if (allMatch && rule.conditions.length > 0) {
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
