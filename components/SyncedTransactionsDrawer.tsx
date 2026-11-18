import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Category, Page, Transaction } from '../types';
import { parseLocalDate } from '../utils';
import { getCategoryDetails } from '../utils/categories';
import { isUncategorised, suggestCategories } from '../utils/overviewSummary';
import { filingFor } from '../utils/rules';
import { groupUnreviewedByAccount } from '../utils/syncedReviewModel';
import { useAccountsContext, usePreferencesSelector, useTransactionsContext } from '../contexts/DomainProviders';
import { useCategoryContext, useTagsContext } from '../contexts/FinancialDataContext';
import { useReview } from '../contexts/ReviewContext';
import { accountIcon } from './AccountCard';
import AddTransactionModal from './AddTransactionModal';
import CategoryPicker from './CategoryPicker';
import { MerchantLogo } from './EntityIcon';
import TransactionDetailModal from './TransactionDetailModal';
import { Button, IconButton } from './ui/Actions';
import { Badge } from './ui/Display';
import Icon from './ui/Icon';
import { Amount } from './ui/Money';
import { Popover, SidePanel } from './ui/Overlays';
import SegmentedControl from './ui/SegmentedControl';
import { EmptyState } from './ui/States';
import { cn } from '../lib/utils';

interface SyncedTransactionsDrawerProps {
  setCurrentPage: (page: Page, tab?: string | null) => void;
}

const shortDate = (iso: string) =>
  parseLocalDate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * Persistent drawer experience highlighting newly synced bank transactions grouped by account,
 * supporting quick inline categorization, inspection, and batch or per-item "Mark as Reviewed".
 */
const SyncedTransactionsDrawer: React.FC<SyncedTransactionsDrawerProps> = ({ setCurrentPage }) => {
  const review = useReview();
  const { accounts } = useAccountsContext();
  const { transactions, saveTransaction } = useTransactionsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { tags } = useTagsContext();
  const transactionRules = usePreferencesSelector(p => p.transactionRules);

  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'uncategorised'>('all');
  const [inspectingTx, setInspectingTx] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const allCategories = useMemo(() => [...expenseCategories, ...incomeCategories], [expenseCategories, incomeCategories]);
  const summary = useMemo(
    () => groupUnreviewedByAccount(review.newlySynced, accounts),
    [review.newlySynced, accounts],
  );

  const effectiveAccountId = selectedAccountId === 'all' || summary.groups.some(g => g.accountId === selectedAccountId)
    ? selectedAccountId
    : 'all';

  const visibleGroups = useMemo(() => {
    return summary.groups
      .filter(group => effectiveAccountId === 'all' || group.accountId === effectiveAccountId)
      .map(group => ({
        ...group,
        transactions: statusFilter === 'uncategorised'
          ? group.transactions.filter(isUncategorised)
          : group.transactions,
      }))
      .filter(group => group.transactions.length > 0);
  }, [effectiveAccountId, statusFilter, summary.groups]);

  const applyCategoryAndReview = (tx: Transaction, categoryName: string): Transaction => {
    const findCat = (cats: Category[]): Category | undefined => {
      for (const c of cats) {
        if (c.name === categoryName) return c;
        const sub = c.subCategories ? findCat(c.subCategories) : undefined;
        if (sub) return sub;
      }
      return undefined;
    };
    const matched = findCat(allCategories);
    const nextType = matched?.classification || tx.type;
    const nextAmount = nextType === 'income' ? Math.abs(tx.amount) : -Math.abs(tx.amount);
    return { ...tx, category: categoryName, type: nextType, amount: nextAmount, needsReview: false };
  };

  const fileTxCategory = (tx: Transaction, categoryName: string, close?: () => void) => {
    const previous = { ...tx };
    const updated = applyCategoryAndReview(tx, categoryName);
    saveTransaction([updated], [], { skipRules: true });
    close?.();
    toast.success(`Filed as ${categoryName}`, {
      action: {
        label: 'Undo',
        onClick: () => saveTransaction([previous], [], { skipRules: true }),
      },
    });
  };

  const markWithUndo = (targets: Transaction[], label: string) => {
    if (targets.length === 0) return;
    const originals = targets.map(tx => ({ ...tx }));
    review.markReviewed(targets.map(tx => tx.id));
    toast.success(label, {
      action: {
        label: 'Undo',
        onClick: () => saveTransaction(originals, [], { skipRules: true }),
      },
    });
  };

  return (
    <>
      <SidePanel
        isOpen={review.isSyncReviewOpen}
        onClose={() => review.setSyncReviewOpen(false)}
        width={560}
        title="Newly synced transactions"
        description={
          summary.totalCount > 0
            ? `${summary.totalCount} ${summary.totalCount === 1 ? 'transaction' : 'transactions'} waiting across ${summary.groups.length} ${summary.groups.length === 1 ? 'account' : 'accounts'}`
            : 'No unreviewed bank transactions'
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onPress={() => {
                review.setSyncReviewOpen(false);
                setCurrentPage('Transactions', 'review');
              }}
            >
              Open in Review Queue
            </Button>
            {summary.totalCount > 0 && (
              <Button
                icon="tick-02"
                onPress={() => markWithUndo(review.newlySynced, `Marked ${summary.totalCount} transactions as reviewed`)}
              >
                Mark all as reviewed
              </Button>
            )}
          </div>
        }
      >
        {summary.totalCount === 0 ? (
          <EmptyState
            icon="tick-02"
            title="All synced transactions reviewed"
            description="New bank transactions will stay highlighted here and in your Ledger until you mark them as reviewed."
            actionLabel="View Ledger"
            onAction={() => {
              review.setSyncReviewOpen(false);
              setCurrentPage('Transactions', null);
            }}
          />
        ) : (
          <div className="space-y-4">
            {/* Compact Status Bar */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[var(--radius-lg)] border border-line bg-inset px-3 py-2.5">
                <p className="type-caption text-muted">To review</p>
                <p className="type-figure-row text-ink tabular-nums">{summary.totalCount}</p>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-line bg-inset px-3 py-2.5">
                <p className="type-caption text-muted">Accounts</p>
                <p className="type-figure-row text-ink tabular-nums">{summary.groups.length}</p>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-line bg-inset px-3 py-2.5">
                <p className="type-caption text-muted">Uncategorized</p>
                <p className="type-figure-row text-ink tabular-nums">{summary.uncategorisedCount}</p>
              </div>
            </div>

            {/* Filter controls */}
            {(summary.groups.length > 1 || summary.uncategorisedCount > 0) && (
              <div className="space-y-2.5">
                {summary.uncategorisedCount > 0 && (
                  <SegmentedControl
                    items={[
                      { id: 'all', label: 'All new', badge: summary.totalCount },
                      { id: 'uncategorised', label: 'Needs category', badge: summary.uncategorisedCount },
                    ]}
                    activeId={statusFilter}
                    onChange={id => setStatusFilter(id as 'all' | 'uncategorised')}
                  />
                )}
                {summary.groups.length > 1 && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by account">
                    <button
                      type="button"
                      onClick={() => setSelectedAccountId('all')}
                      className={cn(
                        'cursor-pointer rounded-full border px-3 py-1 type-caption transition-colors',
                        effectiveAccountId === 'all'
                          ? 'border-pill bg-pill text-on-pill'
                          : 'border-line bg-inset text-muted hover:text-ink',
                      )}
                    >
                      All accounts ({summary.totalCount})
                    </button>
                    {summary.groups.map(g => (
                      <button
                        key={g.accountId}
                        type="button"
                        onClick={() => setSelectedAccountId(g.accountId)}
                        className={cn(
                          'cursor-pointer rounded-full border px-3 py-1 type-caption transition-colors',
                          effectiveAccountId === g.accountId
                            ? 'border-pill bg-pill text-on-pill'
                            : 'border-line bg-inset text-muted hover:text-ink',
                        )}
                      >
                        {g.accountName} ({g.transactions.length})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Account Groups */}
            {visibleGroups.length === 0 ? (
              <EmptyState
                icon="tick-02"
                title="No uncategorized transactions"
                description="All remaining newly synced items already have a category."
                actionLabel="Show all new"
                onAction={() => setStatusFilter('all')}
              />
            ) : (
              <div className="space-y-4">
                {visibleGroups.map(group => (
                  <section
                    key={group.accountId}
                    className="overflow-hidden rounded-[var(--radius-xl)] border border-line bg-solid"
                  >
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-inset px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line bg-solid text-muted">
                          <Icon name={group.account ? accountIcon(group.account) : 'bank'} size={15} />
                        </span>
                        <div className="min-w-0">
                          <h3 className="type-body-strong truncate text-ink">
                            {group.accountName}
                            <span className="ml-1.5 type-caption font-normal text-muted">({group.transactions.length})</span>
                          </h3>
                          <p className="type-caption text-muted">
                            Net <Amount value={group.netAmount} currency={group.currency} tone="flow" />
                            {group.uncategorisedCount > 0 ? ` · ${group.uncategorisedCount} uncategorized` : ''}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="tick-02"
                        onPress={() => markWithUndo(group.transactions, `Reviewed ${group.transactions.length} in ${group.accountName}`)}
                      >
                        Mark reviewed
                      </Button>
                    </header>

                    <ul className="divide-y divide-line">
                      {group.transactions.map(tx => {
                        const uncat = isUncategorised(tx);
                        const catStyle = getCategoryDetails(tx.category, allCategories);
                        const filing = filingFor(tx.merchant, transactionRules);
                        const suggestions = suggestCategories(
                          tx,
                          transactions,
                          filing?.actions.find(a => a.field === 'category')?.value,
                        );
                        const pickerCategories = tx.type === 'income'
                          ? [...incomeCategories, ...expenseCategories]
                          : [...expenseCategories, ...incomeCategories];

                        return (
                          <li key={tx.id} className="flex items-center gap-3 px-4 py-3">
                            <MerchantLogo merchant={tx.merchant} description={tx.description} size={36} className="shrink-0" />

                            <div className="min-w-0 flex-1 space-y-1">
                              <button
                                type="button"
                                onClick={() => setInspectingTx(tx)}
                                className="block max-w-full cursor-pointer truncate text-left type-body-strong text-ink hover:underline"
                              >
                                {tx.merchant || tx.description || 'Transaction'}
                              </button>

                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="type-caption text-muted">{shortDate(tx.date)}</span>
                                <Popover
                                  title="Assign category"
                                  trigger={
                                    <button
                                      type="button"
                                      className={cn(
                                        'inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 type-caption transition-colors',
                                        uncat
                                          ? 'border-line-strong bg-amber-soft text-attention-text'
                                          : 'border-line bg-inset text-ink hover:border-line-strong',
                                      )}
                                    >
                                      {uncat ? (
                                        <>
                                          <Icon name="tag" size={12} />
                                          <span>Categorize</span>
                                        </>
                                      ) : (
                                        <>
                                          <span
                                            className="size-1.5 rounded-full"
                                            style={{ backgroundColor: catStyle.color || 'var(--muted)' }}
                                          />
                                          <span className="max-w-[140px] truncate">{tx.category}</span>
                                        </>
                                      )}
                                    </button>
                                  }
                                >
                                  {close => (
                                    <div className="w-72">
                                      <CategoryPicker
                                        categories={pickerCategories}
                                        suggestions={suggestions}
                                        value={tx.category || null}
                                        onChange={cat => fileTxCategory(tx, cat, close)}
                                      />
                                    </div>
                                  )}
                                </Popover>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              <Amount value={tx.amount} currency={tx.currency} tone="flow" className="type-figure-row" />
                              <IconButton
                                icon="tick-02"
                                label={`Mark "${tx.merchant || tx.description}" as reviewed`}
                                onPress={() => markWithUndo([tx], 'Transaction marked as reviewed')}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </SidePanel>

      {inspectingTx && (
        <TransactionDetailModal
          isOpen={Boolean(inspectingTx)}
          onClose={() => setInspectingTx(null)}
          transactions={[inspectingTx]}
          accounts={accounts}
          tags={tags}
          onEdit={tx => {
            setInspectingTx(null);
            setEditingTx(tx);
          }}
          onRecategorize={(tx, cat) => {
            fileTxCategory(tx, cat);
            setInspectingTx(null);
          }}
        />
      )}

      {editingTx && (
        <AddTransactionModal
          onClose={() => setEditingTx(null)}
          onSave={(toSave, toDelete) => {
            saveTransaction(toSave, toDelete);
            setEditingTx(null);
            toast.success('Transaction updated');
          }}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          transactionToEdit={editingTx}
          transactions={transactions}
          tags={tags}
        />
      )}
    </>
  );
};

export default SyncedTransactionsDrawer;
