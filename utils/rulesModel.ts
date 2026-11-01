import { v4 as uuidv4 } from 'uuid';
import { RuleExecutionLog, RuleFieldAction, RuleFieldCondition, RuleOperator, RuleRunBackup, Transaction, TransactionRule, TransactionRuleAction, TransactionRuleCondition } from '../types';
import { normalizeMerchantKey } from './brandfetch';
import { alwaysFileRule, applyRules, filingFor, isAlwaysFile, ordinaryRules, ruleMatches } from './rules';
import { convertSuggestionToTransactionRule, generateSmartRuleSuggestions } from './ruleSuggestions';

export const FIELD_LABELS: Record<RuleFieldCondition, string> = {
  description: 'description',
  merchant: 'merchant',
  amount: 'amount',
  type: 'type',
  category: 'category',
  text: 'anywhere',
};

export const OPERATOR_LABELS: Record<RuleOperator, string> = {
  contains: 'contains',
  equals: 'is',
  starts_with: 'starts with',
  ends_with: 'ends with',
  greater_than: 'is above',
  less_than: 'is below',
  matches: 'matches pattern',
  is_merchant: 'is',
};

const TEXT_OPERATORS: RuleOperator[] = ['contains', 'equals', 'starts_with', 'ends_with', 'matches'];

export const operatorsFor = (field: RuleFieldCondition): RuleOperator[] => {
  if (field === 'amount') return ['equals', 'greater_than', 'less_than'];
  if (field === 'type') return ['equals'];
  return TEXT_OPERATORS;
};

export interface SentencePart {
  text: string;
  isValue?: boolean;
}

const word = (text: string): SentencePart => ({ text });
const value = (text: string): SentencePart => ({ text, isValue: true });

/** A rule in plain words (D-009). Values are marked so the page can emphasise them. */
export const ruleSentence = (rule: TransactionRule): SentencePart[] => {
  if (isAlwaysFile(rule)) {
    const category = rule.actions.find(action => action.field === 'category')?.value;
    const description = rule.actions.find(action => action.field === 'description')?.value;
    if (!category) return [word('Always describe '), value(rule.name), word(' as '), value(description ?? '')];
    return [word('Always file '), value(rule.name), word(' under '), value(category), ...(description ? [word(', described as '), value(description)] : [])];
  }
  const joiner = rule.conditionLogic === 'OR' ? ' or ' : ' and ';
  const parts: SentencePart[] = [word('When ')];
  rule.conditions.forEach((condition, index) => {
    if (index > 0) parts.push(word(joiner));
    parts.push(word(`${FIELD_LABELS[condition.field]} ${OPERATOR_LABELS[condition.operator]} `), value(condition.value));
  });
  rule.actions.forEach((action, index) => {
    parts.push(word(index === 0 ? ', set ' : ' and '), word(`${action.field} to `), value(action.value));
  });
  return parts;
};

export const sentenceText = (rule: TransactionRule) => ruleSentence(rule).map(part => part.text).join('');

export const matchingTransactions = (rule: TransactionRule, transactions: Transaction[]) =>
  transactions.filter(tx => ruleMatches({ ...tx, amount: Number(tx.amount) || 0 }, rule));

export interface RuleChange {
  transaction: Transaction;
  updates: Partial<Record<RuleFieldAction, string>>;
  ruleName: string;
  ruleId: string;
}

/** What running your rules on past transactions would change. It changes nothing itself. */
export const previewChanges = (transactions: Transaction[], rules: TransactionRule[]): RuleChange[] =>
  transactions.flatMap(tx => {
    const before = { description: tx.description || '', merchant: tx.merchant || '', category: tx.category || '' };
    const after = applyRules({ ...before, amount: Number(tx.amount) || 0, type: tx.type || 'expense', notes: tx.notes }, rules);
    const updates: RuleChange['updates'] = {};
    (['merchant', 'description', 'category'] as const).forEach(field => {
      if (after[field] !== before[field]) updates[field] = after[field];
    });
    if (Object.keys(updates).length === 0) return [];
    const ruleId = after.appliedRuleId ?? after.filingRuleId ?? '';
    return [{ transaction: tx, updates, ruleId, ruleName: rules.find(rule => rule.id === ruleId)?.name ?? 'Rule' }];
  });

const FIELD_NAMES: Record<RuleFieldAction, string> = { merchant: 'Merchant', description: 'Description', category: 'Category' };

export const describeChange = ({ transaction, updates }: RuleChange) =>
  (Object.keys(updates) as RuleFieldAction[]).map(field => `${FIELD_NAMES[field]}: ${transaction[field] || 'Empty'} → ${updates[field]}`).join(', ');

export const buildRun = (changes: RuleChange[], now: string) => {
  const batchId = `batch-${uuidv4()}`;
  const backup: RuleRunBackup = {
    id: batchId,
    batchId,
    timestamp: now,
    ruleName: 'Rules run',
    transactions: changes.map(({ transaction }) => ({
      id: transaction.id,
      originalCategory: transaction.category || '',
      originalMerchant: transaction.merchant || '',
      originalDescription: transaction.description || '',
    })),
  };
  const logs: RuleExecutionLog[] = changes.map(change => ({
    id: `log-${uuidv4()}`,
    batchId,
    ruleId: change.ruleId,
    ruleName: change.ruleName,
    timestamp: now,
    txId: change.transaction.id,
    txDescription: change.transaction.description || '',
    txAmount: Number(change.transaction.amount) || 0,
    changeDetails: describeChange(change),
  }));
  return { payload: changes.map(({ transaction, updates }) => ({ ...transaction, ...updates })), backup, logs };
};

export const buildRevert = (backup: RuleRunBackup, transactions: Transaction[], now: string) => {
  const payload = backup.transactions.flatMap(saved => {
    const current = transactions.find(tx => tx.id === saved.id);
    return current ? [{ ...current, category: saved.originalCategory, merchant: saved.originalMerchant, description: saved.originalDescription }] : [];
  });
  const logs: RuleExecutionLog[] = payload.map(tx => ({
    id: `log-${uuidv4()}`,
    ruleId: 'rollback',
    ruleName: 'Undo',
    timestamp: now,
    txId: tx.id,
    txDescription: tx.description || '',
    txAmount: Number(tx.amount) || 0,
    changeDetails: 'Restored merchant, description and category',
  }));
  return { payload, logs };
};

const reprioritise = (rules: TransactionRule[], ordered: TransactionRule[]) => {
  const priorities = new Map(ordered.map((rule, index) => [rule.id, ordered.length - index]));
  return rules.map(rule => (priorities.has(rule.id) ? { ...rule, priority: priorities.get(rule.id) } : rule));
};

export const moveRule = (rules: TransactionRule[], id: string, targetId: string, position: 'before' | 'after') => {
  const ordered = ordinaryRules(rules);
  const moved = ordered.find(rule => rule.id === id);
  if (!moved || id === targetId) return rules;
  const rest = ordered.filter(rule => rule.id !== id);
  const index = rest.findIndex(rule => rule.id === targetId);
  if (index === -1) return rules;
  rest.splice(position === 'before' ? index : index + 1, 0, moved);
  return reprioritise(rules, rest);
};

export const shiftRule = (rules: TransactionRule[], id: string, direction: -1 | 1) => {
  const ordered = ordinaryRules(rules);
  const index = ordered.findIndex(rule => rule.id === id);
  const target = ordered[index + direction];
  return index === -1 || !target ? rules : moveRule(rules, id, target.id, direction === -1 ? 'before' : 'after');
};

export interface RuleDraft {
  id?: string;
  kind: 'always' | 'rule';
  name: string;
  isActive: boolean;
  priority?: number;
  merchant: string;
  category: string;
  description: string;
  conditionLogic: 'AND' | 'OR';
  conditions: TransactionRuleCondition[];
  actions: TransactionRuleAction[];
}

export const blankDraft = (): RuleDraft => ({
  kind: 'rule',
  name: '',
  isActive: true,
  merchant: '',
  category: '',
  description: '',
  conditionLogic: 'AND',
  conditions: [{ field: 'description', operator: 'contains', value: '' }],
  actions: [{ field: 'category', value: '' }],
});

export const draftFromRule = (rule: TransactionRule): RuleDraft => {
  const base = { ...blankDraft(), id: rule.id, name: rule.name, isActive: rule.isActive, priority: rule.priority };
  if (isAlwaysFile(rule)) {
    return {
      ...base,
      kind: 'always',
      merchant: rule.name,
      category: rule.actions.find(action => action.field === 'category')?.value ?? '',
      description: rule.actions.find(action => action.field === 'description')?.value ?? '',
    };
  }
  return { ...base, conditionLogic: rule.conditionLogic ?? 'AND', conditions: rule.conditions, actions: rule.actions };
};

const firstUpper = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const ruleFromDraft = (draft: RuleDraft, rules: TransactionRule[]): TransactionRule => {
  if (draft.kind === 'always') {
    const name = draft.merchant.trim();
    const key = normalizeMerchantKey(name) ?? name;
    return alwaysFileRule(key, name, { category: draft.category, description: draft.description.trim() }, draft.isActive);
  }
  const top = Math.max(0, ...ordinaryRules(rules).map(rule => rule.priority ?? 0));
  const first = draft.conditions[0];
  return {
    id: draft.id ?? `rule-${uuidv4()}`,
    name: draft.name.trim() || firstUpper(`${FIELD_LABELS[first.field]} ${OPERATOR_LABELS[first.operator]} ${first.value}`),
    isActive: draft.isActive,
    priority: draft.priority ?? top + 1,
    conditionLogic: draft.conditionLogic,
    conditions: draft.conditions.map(condition => ({ ...condition, value: condition.value.trim() })),
    actions: draft.actions,
  };
};

const isValidPattern = (pattern: string) => {
  try {
    new RegExp(pattern, 'i');
    return true;
  } catch {
    return false;
  }
};

/** Why a draft can't be saved, in a sentence, or null when it can. */
export const findRuleProblem = (draft: RuleDraft): string | null => {
  if (draft.kind === 'always') {
    if (!draft.merchant.trim()) return 'Choose a merchant.';
    if (!draft.category && !draft.description.trim()) return 'Add a category or description.';
    return null;
  }
  for (const condition of draft.conditions) {
    if (!condition.value.trim()) return 'Give every condition a value.';
    if (condition.field === 'amount' && isNaN(parseFloat(condition.value))) return 'Amounts need a number.';
    if (condition.operator === 'matches' && !isValidPattern(condition.value)) return 'That pattern isn’t valid.';
  }
  if (draft.actions.some(action => !action.value.trim())) return 'Choose what each action should set.';
  return null;
};

export interface RuleSuggestion {
  id: string;
  rule: TransactionRule;
  reason: string;
}

const MIN_REPEATS = 2;
const MAX_FILING_SUGGESTIONS = 4;

/** Merchants you keep filing the same way become always file suggestions. Keyword suggestions follow. */
export const ruleSuggestions = (transactions: Transaction[], rules: TransactionRule[]): RuleSuggestion[] => {
  const groups = new Map<string, { name: string; category: string; count: number }>();
  transactions.forEach(tx => {
    const key = normalizeMerchantKey(tx.merchant);
    if (!key || !tx.merchant || !tx.category || filingFor(tx.merchant, rules)) return;
    const groupKey = `${key}|${tx.category}`;
    const group = groups.get(groupKey) ?? { name: tx.merchant.trim(), category: tx.category, count: 0 };
    group.count += 1;
    groups.set(groupKey, group);
  });

  // A merchant filed several ways gets one suggestion, for the way it's filed most.
  const seenMerchants = new Set<string>();
  const filings = [...groups.values()]
    .filter(group => group.count >= MIN_REPEATS)
    .sort((a, b) => b.count - a.count)
    .filter(group => {
      const key = normalizeMerchantKey(group.name) ?? group.name;
      return !seenMerchants.has(key) && !!seenMerchants.add(key);
    })
    .slice(0, MAX_FILING_SUGGESTIONS)
    .map(group => ({
      id: `always-${group.name}`,
      rule: alwaysFileRule(normalizeMerchantKey(group.name) ?? group.name, group.name, { category: group.category }),
      reason: `${group.count} transactions already filed this way`,
    }));

  const keywords = generateSmartRuleSuggestions(transactions, rules).map(suggestion => ({
    id: suggestion.id,
    rule: { ...convertSuggestionToTransactionRule(suggestion), conditions: [{ field: 'description' as const, operator: 'contains' as const, value: suggestion.keyword }] },
    reason: suggestion.reason,
  }));
  return [...filings, ...keywords];
};

/** Starting points that open in the builder, so you can change them to your own categories (RUL-03). */
export const RULE_TEMPLATES: { id: string; label: string; keyword: string; category: string }[] = [
  { id: 'subscriptions', label: 'Subscriptions', keyword: 'netflix', category: 'Subscriptions' },
  { id: 'rideshares', label: 'Rideshares', keyword: 'uber', category: 'Transportation' },
  { id: 'coffee', label: 'Coffee', keyword: 'starbucks', category: 'Dining & Cafes' },
  { id: 'salary', label: 'Salary', keyword: 'payroll', category: 'Income & Salary' },
  { id: 'transfers', label: 'Transfers', keyword: 'transfer', category: 'Transfer' },
];
