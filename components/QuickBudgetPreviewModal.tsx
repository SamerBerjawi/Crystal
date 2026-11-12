import React, { useMemo, useState } from 'react';
import { Budget, Category, Transaction } from '../types';
import { convertToMain } from '../utils';
import { averageMonthlySpend, autofillPlan, monthOf } from '../utils/budgetModel';
import { Dialog } from './ui/Overlays';
import { Button } from './ui/Actions';
import { Checkbox } from './ui/Fields';
import { Badge } from './ui/Display';
import Icon from './ui/Icon';
import { Amount } from './ui/Money';
import { EmptyState } from './ui/States';
import { cn } from '../lib/utils';

export interface QuickBudgetPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodInMonths: number;
  periodLabel: string;
  transactions: Transaction[];
  budgets: Budget[];
  expenseCategories: Category[];
  accountIds?: Set<string>;
  currency: string;
  onApply: (selectedDrafts: (Omit<Budget, 'id'> & { id?: string })[]) => void;
}

interface DiffItem {
  draft: Omit<Budget, 'id'> & { id?: string };
  categoryName: string;
  category?: Category;
  currentAmount: number | null;
  proposedAmount: number;
  diff: number;
  isNew: boolean;
}

const QuickBudgetPreviewModal: React.FC<QuickBudgetPreviewModalProps> = ({
  isOpen,
  onClose,
  periodInMonths,
  periodLabel,
  transactions,
  budgets,
  expenseCategories,
  accountIds,
  currency,
  onApply,
}) => {
  const todayMonth = useMemo(() => monthOf(new Date()), []);

  const items = useMemo<DiffItem[]>(() => {
    const avgMap = averageMonthlySpend(transactions, todayMonth, periodInMonths, {
      accountIds,
      categories: expenseCategories,
      convert: convertToMain,
    });
    const drafts = autofillPlan(avgMap, budgets, currency, {
      keepExisting: false,
      categories: expenseCategories,
    });

    return drafts.map(draft => {
      const existing = budgets.find(b => b.categoryName === draft.categoryName);
      const category = expenseCategories.find(c => c.name === draft.categoryName);
      const currentAmount = existing ? convertToMain(existing.amount, existing.currency || currency) : null;
      const proposedAmount = draft.amount;
      const diff = currentAmount !== null ? proposedAmount - currentAmount : proposedAmount;

      return {
        draft,
        categoryName: draft.categoryName,
        category,
        currentAmount,
        proposedAmount,
        diff,
        isNew: currentAmount === null,
      };
    });
  }, [transactions, todayMonth, periodInMonths, accountIds, expenseCategories, budgets, currency]);

  const [selectedNames, setSelectedNames] = useState<Set<string>>(() => new Set(items.map(i => i.categoryName)));

  // If items change, keep selection initialized
  React.useEffect(() => {
    setSelectedNames(new Set(items.map(i => i.categoryName)));
  }, [items]);

  const toggleItem = (name: string) => {
    setSelectedNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const allSelected = items.length > 0 && selectedNames.size === items.length;
  const isIndeterminate = selectedNames.size > 0 && selectedNames.size < items.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedNames(new Set());
    } else {
      setSelectedNames(new Set(items.map(i => i.categoryName)));
    }
  };

  const selectedItems = useMemo(() => items.filter(i => selectedNames.has(i.categoryName)), [items, selectedNames]);

  const { totalCurrent, totalProposed, netDiff } = useMemo(() => {
    let current = 0;
    let proposed = 0;
    for (const item of selectedItems) {
      current += item.currentAmount ?? 0;
      proposed += item.proposedAmount;
    }
    return {
      totalCurrent: current,
      totalProposed: proposed,
      netDiff: proposed - current,
    };
  }, [selectedItems]);

  const handleApply = () => {
    const approvedDrafts = selectedItems.map(i => i.draft);
    onApply(approvedDrafts);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Build budgets from spending"
      description={`Review proposed caps calculated from your ${periodLabel.toLowerCase()}. Choose which ones to update.`}
      width={620}
      footer={close => (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-left">
            <span className="type-caption block text-muted">
              {selectedItems.length} of {items.length} selected
            </span>
            {selectedItems.length > 0 && (
              <span className="type-body-strong text-ink">
                Proposed total: <Amount value={totalProposed} currency={currency} />
                {netDiff !== 0 && (
                  <span className={cn('ml-1.5 text-xs font-semibold', netDiff > 0 ? 'text-amber' : 'text-pine')}>
                    ({netDiff > 0 ? '+' : '-'}<Amount value={Math.abs(netDiff)} currency={currency} />)
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" onPress={close}>Cancel</Button>
            <Button
              isDisabled={selectedItems.length === 0}
              onPress={handleApply}
            >
              Apply {selectedItems.length} {selectedItems.length === 1 ? 'budget' : 'budgets'}
            </Button>
          </div>
        </div>
      )}
    >
      {items.length === 0 ? (
        <EmptyState
          icon="pie-chart-01"
          title="No spending history found"
          description={`There are no expense transactions recorded in the last ${periodInMonths === 1 ? 'month' : `${periodInMonths} months`} to base budgets on.`}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <Checkbox
                isSelected={allSelected}
                isIndeterminate={isIndeterminate}
                onChange={toggleAll}
              >
                <span className="type-body-strong text-ink">Select all categories</span>
              </Checkbox>
            </div>
            <span className="type-caption text-muted">
              {items.length} proposed
            </span>
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-line pr-1">
            {items.map(item => {
              const isSelected = selectedNames.has(item.categoryName);
              return (
                <div
                  key={item.categoryName}
                  onClick={() => toggleItem(item.categoryName)}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 py-2.5 px-2 rounded-[var(--radius-md)] transition-colors',
                    isSelected ? 'bg-surface hover:bg-inset' : 'opacity-65 hover:opacity-100 hover:bg-inset'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div onClick={e => e.stopPropagation()}>
                      <Checkbox
                        isSelected={isSelected}
                        onChange={() => toggleItem(item.categoryName)}
                      >
                        <span className="sr-only">Select {item.categoryName}</span>
                      </Checkbox>
                    </div>

                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-inset text-ink"
                      style={item.category?.color ? { color: item.category.color } : undefined}
                    >
                      <Icon name={item.category?.icon || 'folder-01'} size={16} />
                    </span>

                    <div className="min-w-0">
                      <p className="type-body-strong truncate text-ink">{item.categoryName}</p>
                      <p className="type-caption text-muted">
                        Current: {item.currentAmount !== null ? <Amount value={item.currentAmount} currency={currency} /> : 'No cap'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <div>
                      <p className="type-body-strong text-ink">
                        <Amount value={item.proposedAmount} currency={currency} />
                      </p>
                      <div className="type-caption">
                        {item.isNew ? (
                          <Badge tone="positive">New</Badge>
                        ) : item.diff > 0 ? (
                          <span className="font-semibold text-amber">
                            +<Amount value={item.diff} currency={currency} />
                          </span>
                        ) : item.diff < 0 ? (
                          <span className="font-semibold text-pine">
                            -<Amount value={Math.abs(item.diff)} currency={currency} />
                          </span>
                        ) : (
                          <span className="text-muted">Unchanged</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Dialog>
  );
};

export default QuickBudgetPreviewModal;
