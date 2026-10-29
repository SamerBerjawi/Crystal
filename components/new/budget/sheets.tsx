import React, { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import type { Budget, Currency } from '../../../types';
import type { BudgetData } from '../../../hooks/useBudgetData';
import type { Month, Suggestion } from '../../../utils/budgetModel';
import { AUTOFILL_OPTIONS, friendlyAmount, parseAmount } from '../../../utils/budgetModel';
import { AmountPad } from '../../kokonutui/amount-pad';
import { Drawer, useMediaQuery } from '../Drawer';
import { EntityGlyph } from '../EntityIcon';
import { NvIcon } from '../NvIcon';
import { toast } from '../toast';
import { Button, IconButton, Money, Switch } from '../ui';
import { CategoryDisc } from './parts';

/*
 * Drawers for BudgetNew:
 * 1. BudgetSheet: Add or edit a budget limit with AmountPad, category picker and spending history suggestions.
 * 2. AutofillSheet: Auto-generate/update budgets based on past months' averages with preview.
 * 3. SuggestionsSheet: Review and apply smart adjustments based on spending trends.
 * 4. UnbudgetedSheet: Review spending in categories without a budget.
 */

const currencySign = (currency: string = ''): string => {
  const parenMatch = currency.match(/\((.*?)\)/);
  if (parenMatch && parenMatch[1]) {
    const inside = parenMatch[1].trim();
    if (inside === '€' || inside === '$' || inside === '£' || inside === '¥' || inside === '₹' || inside === '₿') {
      return inside;
    }
  }
  const code = (currency.split(/[\s(]/)[0] || currency).trim().toUpperCase();
  const map: Record<string, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    BTC: '₿',
    RON: 'lei',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
    CAD: '$',
    AUD: '$',
    CHF: 'CHF',
  };
  return map[code] ?? (parenMatch?.[1]?.trim() || code);
};

/* ── 1. Add / Edit Budget Sheet ─────────────────────────────────────────── */

export const BudgetSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: BudgetData;
  month: Month;
  editingBudget?: Budget | null;
  initialCategoryName?: string;
  /** Pre-filled limit for a new budget (e.g. the suggestion from "Spending without a budget"). */
  initialAmount?: number;
  onSaved?: () => void;
}> = ({ open, onOpenChange, data, month, editingBudget, initialCategoryName, initialAmount, onSaved }) => {
  const phone = !useMediaQuery('(min-width: 768px)');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    editingBudget?.categoryName ?? initialCategoryName ?? data.parents[0]?.name ?? ''
  );
  const [amountStr, setAmountStr] = useState<string>(
    editingBudget ? String(editingBudget.amount) : ''
  );

  // Sync state when editing target changes
  React.useEffect(() => {
    if (open) {
      const cat = editingBudget?.categoryName ?? initialCategoryName ?? data.parents[0]?.name ?? '';
      setSelectedCategory(cat);
      setAmountStr(editingBudget ? String(editingBudget.amount) : initialAmount ? String(initialAmount) : '');
    }
  }, [open, editingBudget, initialCategoryName, initialAmount, data.parents]);

  const activeCategory = useMemo(() => {
    return data.parents.find(p => p.name === selectedCategory);
  }, [data.parents, selectedCategory]);

  // Amounts are typed in the budget's own currency; only new budgets use the display currency.
  const budgetCurrency =
    editingBudget?.currency ??
    data.budgets.find(b => b.categoryName === selectedCategory)?.currency ??
    data.displayCurrency;

  const categoryAverage = useMemo(() => {
    if (!selectedCategory) return 0;
    const avgMap = data.averageFor(month, 3);
    return avgMap.get(selectedCategory) ?? 0;
  }, [data, month, selectedCategory]);

  // Existing budgets map to avoid duplicates unless editing
  const existingBudgetMap = useMemo(() => {
    const map = new Map<string, Budget>();
    for (const b of data.budgets) {
      map.set(b.categoryName, b);
    }
    return map;
  }, [data.budgets]);

  const handleSave = () => {
    const num = parseAmount(amountStr);
    if (!selectedCategory) {
      toast.error('Please select a category');
      return;
    }
    if (Number.isNaN(num) || num <= 0) {
      toast.error('Please enter a valid budget amount');
      return;
    }

    const existing = existingBudgetMap.get(selectedCategory);
    const draft = {
      id: editingBudget?.id ?? existing?.id,
      categoryName: selectedCategory,
      amount: Math.round(num * 100) / 100,
      period: 'monthly' as const,
      // The amount is typed in the budget's own currency (shown in the field), so keep it.
      currency: budgetCurrency,
    };

    const res = data.save(draft);
    if (res.undo) {
      toast.undo(
        `Updated ${selectedCategory} budget to ${currencySign(draft.currency)}${draft.amount}`,
        res.undo
      );
    } else {
      toast.success(
        `Created ${selectedCategory} budget of ${currencySign(draft.currency)}${draft.amount}`
      );
    }

    onOpenChange(false);
    onSaved?.();
  };

  const handleDelete = () => {
    if (!editingBudget) return;
    // The app's delete handler shows the one Undo toast; a second one here restored the budget twice.
    data.remove(editingBudget);
    onOpenChange(false);
    onSaved?.();
  };

  const isEditing = !!editingBudget;
  const numValue = parseAmount(amountStr);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? `Edit ${editingBudget.categoryName}` : 'New budget'}
      description={
        isEditing
          ? 'Adjust monthly spending limit for this category'
          : 'Set a monthly spending limit for a category'
      }
      footer={
        <div className="flex items-center gap-3">
          {isEditing && (
            <Button variant="danger" onClick={handleDelete} icon="delete">
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="cta"
            onClick={handleSave}
            disabled={!selectedCategory || Number.isNaN(numValue) || numValue <= 0}
            className="flex-1"
          >
            {isEditing ? 'Save changes' : 'Create budget'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Category Picker */}
        <div>
          <label className="mb-2 block text-[13px] font-medium text-nv-muted">Category</label>
          {isEditing ? (
            <div className="flex items-center gap-3 rounded-nv-tile bg-nv-inset p-3.5">
              <CategoryDisc
                name={editingBudget.categoryName}
                color={activeCategory?.color}
                icon={activeCategory?.icon}
              />
              <div>
                <p className="text-[15px] font-medium text-nv-ink">{editingBudget.categoryName}</p>
                <p className="text-[12px] text-nv-muted">Monthly budget</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {data.parents.map(cat => {
                const isSelected = selectedCategory === cat.name;
                const hasBudget = existingBudgetMap.has(cat.name);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.name)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-nv-control p-2.5 text-left transition-colors',
                      isSelected
                        ? 'border border-nv-ink bg-nv-ink text-nv-on-ink'
                        : 'border border-nv-line bg-nv-surface text-nv-ink hover:bg-nv-inset'
                    )}
                  >
                    <EntityGlyph
                      icon={cat.icon}
                      label={cat.name}
                      color={isSelected ? undefined : cat.color}
                      size={18}
                    />
                    <div className="min-w-0 flex-1 truncate">
                      <p className="truncate text-[13px] font-medium">{cat.name}</p>
                      {hasBudget && (
                        <p
                          className={cn(
                            'text-[10px]',
                            isSelected ? 'opacity-80' : 'text-nv-muted'
                          )}
                        >
                          Has budget
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Amount Input */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[13px] font-medium text-nv-muted">Monthly Limit</label>
            {categoryAverage > 0 && (
              <button
                type="button"
                onClick={() => setAmountStr(String(friendlyAmount(categoryAverage)))}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-nv-violet-text hover:underline"
              >
                <span>3-mo avg:</span>
                <Money amount={categoryAverage} currency={data.displayCurrency} />
                <span className="opacity-80">(Set {friendlyAmount(categoryAverage)})</span>
              </button>
            )}
          </div>

          <div className="rounded-nv-sub bg-nv-inset p-4">
            <AmountPad
              value={amountStr}
              onChange={setAmountStr}
              currency={currencySign(budgetCurrency)}
              keypad={phone}
              label="Budget amount"
              autoFocus={!phone}
            />
          </div>

          {/* Quick Preset Buttons */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[50, 100, 200, 500, 1000].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setAmountStr(String(val))}
                className="h-8 rounded-full border border-nv-line bg-nv-surface px-3 text-[12px] font-medium text-nv-ink hover:bg-nv-inset"
              >
                +{val}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
};

/* ── 2. Quick Auto-fill Sheet ───────────────────────────────────────────── */

export const AutofillSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: BudgetData;
  month: Month;
  onApplied?: () => void;
}> = ({ open, onOpenChange, data, month, onApplied }) => {
  const [selectedMonths, setSelectedMonths] = useState<'1' | '3' | '6' | '12'>(data.defaultAutofill);
  const [keepExisting, setKeepExisting] = useState(true);

  // The same plan the apply writes, so the preview and the result match.
  const previewAverages = useMemo(() => {
    const numMonths = parseInt(selectedMonths, 10);
    const avgMap = data.averageFor(month, numMonths);
    return data
      .autofillPreview(month, numMonths, keepExisting)
      .map(draft => {
        const current = data.budgets.find(b => b.id === draft.id);
        return {
          categoryName: draft.categoryName,
          avg: avgMap.get(draft.categoryName) ?? 0,
          current: current ? data.convert(current.amount, current.currency) : undefined,
          proposed: data.convert(draft.amount, draft.currency),
        };
      })
      .sort((x, y) => y.proposed - x.proposed);
  }, [data, month, selectedMonths, keepExisting]);

  const totalProposed = useMemo(() => {
    return previewAverages.reduce((acc, item) => acc + item.proposed, 0);
  }, [previewAverages]);

  const handleApply = () => {
    const numMonths = parseInt(selectedMonths, 10);
    const res = data.autofill(month, numMonths, keepExisting);
    if (res.count === 0) {
      toast.info('No historical spending found to create budgets.');
    } else if (res.undo) {
      toast.undo(`Applied ${res.count} budget${res.count === 1 ? '' : 's'} from ${selectedMonths}-month spending`, res.undo);
    }
    onOpenChange(false);
    onApplied?.();
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Auto-fill budgets"
      description="Calculate budgets automatically from your past spending patterns"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="cta"
            onClick={handleApply}
            disabled={previewAverages.length === 0}
            className="flex-1"
          >
            Apply {previewAverages.length} budgets
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Time period options */}
        <div>
          <label className="mb-2 block text-[13px] font-medium text-nv-muted">
            Base on spending from:
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {AUTOFILL_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedMonths(opt.value)}
                className={cn(
                  'h-11 rounded-full border px-2 text-center text-[12px] sm:text-[13px] font-medium transition-colors whitespace-nowrap',
                  selectedMonths === opt.value
                    ? 'border-nv-ink bg-nv-ink text-nv-on-ink'
                    : 'border-nv-line bg-nv-surface text-nv-ink hover:bg-nv-inset'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-nv-ink">Keep existing limits</span>
          <Switch checked={keepExisting} onChange={setKeepExisting} label="Keep existing limits" />
        </div>

        {/* Total Summary */}
        <div className="flex items-center justify-between rounded-nv-tile bg-nv-tile p-4">
          <div>
            <p className="text-[12px] text-nv-muted">Total monthly budget</p>
            <div className="mt-0.5">
              <Money amount={totalProposed} currency={data.displayCurrency} size="xl" />
            </div>
          </div>
          <span className="rounded-full bg-nv-surface px-3 py-1 text-[12px] font-medium text-nv-ink">
            {previewAverages.length} categories
          </span>
        </div>

        {/* List of generated budgets */}
        <div>
          <label className="mb-2 block text-[13px] font-medium text-nv-muted">Preview</label>
          {previewAverages.length === 0 ? (
            <div className="rounded-nv-tile bg-nv-inset p-6 text-center text-sm text-nv-muted">
              No spending history found in the selected period.
            </div>
          ) : (
            <ul className="divide-y divide-nv-line rounded-nv-tile border border-nv-line bg-nv-surface">
              {previewAverages.map(item => {
                const look = data.lookOf(item.categoryName);
                return (
                  <li key={item.categoryName} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <CategoryDisc
                        name={item.categoryName}
                        color={look?.color}
                        icon={look?.icon}
                        size={36}
                      />
                      <div>
                        <p className="text-[14px] font-medium text-nv-ink">{item.categoryName}</p>
                        <p className="text-[11px] text-nv-muted">
                          Avg: <Money amount={item.avg} currency={data.displayCurrency} />
                          {item.current !== undefined && (
                            <span> · Current: <Money amount={item.current} currency={data.displayCurrency} /></span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[15px] font-semibold text-nv-ink">
                        <Money amount={item.proposed} currency={data.displayCurrency} />
                      </p>
                      <span className="text-[11px] text-nv-muted">proposed</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  );
};

/* ── 3. Suggestions Sheet ────────────────────────────────────────────────── */

export const SuggestionsSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: Suggestion[];
  data: BudgetData;
  onApplied?: () => void;
}> = ({ open, onOpenChange, suggestions, data, onApplied }) => {
  const handleApplySingle = (s: Suggestion) => {
    const res = data.applySuggestions([s]);
    toast.undo(`Updated ${s.categoryName} budget`, res.undo);
    onApplied?.();
  };

  const handleApplyAll = () => {
    const res = data.applySuggestions(suggestions);
    toast.undo(`Applied ${suggestions.length} recommendations`, res.undo);
    onOpenChange(false);
    onApplied?.();
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Budget Recommendations"
      description={`Based on your spending over the last ${data.suggestionMonths} months`}
      footer={
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1">
            Close
          </Button>
          {suggestions.length > 0 && (
            <Button variant="cta" onClick={handleApplyAll} className="flex-1">
              Apply all ({suggestions.length})
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {suggestions.length === 0 ? (
          <div className="rounded-nv-tile bg-nv-tile p-8 text-center text-sm text-nv-muted">
            All your budgets match your recent spending trends well. No changes recommended!
          </div>
        ) : (
          suggestions.map(s => {
            const look = data.lookOf(s.categoryName);
            const isNew = s.kind === 'new';
            const isRaise = s.kind === 'raise';
            return (
              <div
                key={s.categoryName}
                className="flex items-center justify-between rounded-nv-tile border border-nv-line bg-nv-surface p-4"
              >
                <div className="flex items-center gap-3">
                  <CategoryDisc
                    name={s.categoryName}
                    color={look?.color}
                    icon={look?.icon}
                    size={40}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-medium text-nv-ink">{s.categoryName}</p>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          isNew
                            ? 'bg-nv-sky-soft text-nv-sky-text'
                            : isRaise
                            ? 'bg-nv-orange-soft text-nv-orange-text'
                            : 'bg-nv-green-soft text-nv-green-text'
                        )}
                      >
                        {isNew ? 'New' : isRaise ? 'Raise' : 'Lower'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-nv-muted">
                      Avg: <Money amount={s.average} currency={data.displayCurrency} />
                      {s.current !== undefined && (
                        <span> · Currently: <Money amount={s.current} currency={data.displayCurrency} /></span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[15px] font-semibold text-nv-ink">
                      <Money amount={s.suggested} currency={data.displayCurrency} />
                    </p>
                    <span className="text-[11px] text-nv-muted">recommended</span>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => handleApplySingle(s)}>
                    Apply
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Drawer>
  );
};

/* ── 4. Unbudgeted Spending Sheet ────────────────────────────────────────── */

export const UnbudgetedSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unbudgetedList: { name: string; spent: number }[];
  data: BudgetData;
  onAddBudget: (categoryName: string, suggestedAmount: number) => void;
}> = ({ open, onOpenChange, unbudgetedList, data, onAddBudget }) => {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Unbudgeted spending"
      description="Categories that had expenses this month but do not have an active budget limit"
    >
      <div className="space-y-3">
        {unbudgetedList.length === 0 ? (
          <div className="rounded-nv-tile bg-nv-tile p-8 text-center text-sm text-nv-muted">
            All spending this month falls under budgeted categories.
          </div>
        ) : (
          unbudgetedList.map(item => {
            const look = data.lookOf(item.name);
            return (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-nv-tile border border-nv-line bg-nv-surface p-3.5"
              >
                <div className="flex items-center gap-3">
                  <CategoryDisc
                    name={item.name}
                    color={look?.color}
                    icon={look?.icon}
                    size={38}
                  />
                  <div>
                    <p className="text-[14px] font-medium text-nv-ink">{item.name}</p>
                    <p className="text-[12px] text-nv-muted">
                      Spent this month: <Money amount={item.spent} currency={data.displayCurrency} />
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  icon="add"
                  onClick={() => {
                    onOpenChange(false);
                    onAddBudget(item.name, friendlyAmount(item.spent));
                  }}
                >
                  Set budget
                </Button>
              </div>
            );
          })
        )}
      </div>
    </Drawer>
  );
};
