import React from 'react';
import { TransactionRule, Transaction } from '../../types';
import { formatCurrency } from '../../utils';
import { evaluateRuleCondition } from '../../utils/rules';

interface RuleSimulatorProps {
  rule: TransactionRule;
  sampleTransactions: Transaction[];
  onClose: () => void;
}

export const RuleSimulator: React.FC<RuleSimulatorProps> = ({ rule, sampleTransactions, onClose }) => {
  const logic = rule.conditionLogic ?? 'AND';

  const matches = sampleTransactions.filter((tx) => {
    if (rule.conditions.length === 0) return false;
    const results = rule.conditions.map(cond =>
      evaluateRuleCondition(
        {
          description: tx.description || '',
          merchant: tx.merchant || '',
          amount: Math.abs(Number(tx.amount) || 0),
          type: tx.type || 'expense',
          category: tx.category || '',
        },
        cond
      )
    );
    return logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
  });

  return (
    <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-light-text dark:text-dark-text">
          Rule Test Dry-Run: {rule.name}
        </h4>
        <button
          onClick={onClose}
          className="text-xs font-semibold text-light-text-secondary hover:text-light-text dark:hover:text-dark-text"
        >
          Dismiss
        </button>
      </div>

      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
        Matched <span className="font-bold text-primary-500">{matches.length}</span> transaction(s) out of {sampleTransactions.length} sample records.{' '}
        <span className="font-mono text-2xs uppercase tracking-wider bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-gray-500 font-semibold">{logic} logic</span>
      </p>

      {matches.length > 0 && (
        <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {matches.slice(0, 5).map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between text-xs p-2 bg-white dark:bg-dark-card rounded-xl border border-black/5 dark:border-white/5"
            >
              <span className="font-medium text-light-text dark:text-dark-text truncate max-w-[200px]">
                {m.description}
              </span>
              <span className="font-bold tabular-nums text-light-text dark:text-dark-text">
                {formatCurrency(m.amount, m.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RuleSimulator;
