import React, { useMemo, useState } from 'react';
import { RuleExecutionLog, RuleRunBackup, Transaction, TransactionRule } from '../types';
import { formatCurrency, getMainCurrency } from '../utils';
import { applyRules } from '../utils/rules';
import { useAccountsContext } from '../contexts/DomainProviders';
import { accountNameOf, describeChange, previewChanges, RuleChange } from '../utils/rulesModel';
import { Button, IconButton } from './ui/Actions';
import { Badge, ShowMore } from './ui/Display';
import { Checkbox, controlStyles } from './ui/Fields';
import { ConfirmDialog } from './ui/Overlays';
import { Select } from './ui/Pickers';
import { EmptyState } from './ui/States';
import SegmentedControl from './ui/SegmentedControl';
import { Amount } from './ui/Money';
import { MerchantLogo } from './EntityIcon';
import Icon from './ui/Icon';
import { cn } from '../lib/utils';

export interface RulesAdvancedProps {
  rules: TransactionRule[];
  transactions: Transaction[];
  runs: RuleRunBackup[];
  logs: RuleExecutionLog[];
  onApply: (changes: RuleChange[]) => void;
  onUndo: (run: RuleRunBackup) => void;
  onClearLog: () => void;
  onCreateRule?: (initial?: Partial<TransactionRule>) => void;
}

const PAGE = 25;

const Section: React.FC<{
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, actions, children }) => (
  <section className="surface-card min-w-0 rounded-[var(--radius-xl)] p-5 shadow-sm">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 basis-56">
        <h2 className="type-card-title text-ink">{title}</h2>
        {description && <p className="type-body mt-1 text-muted">{description}</p>}
      </div>
      {actions}
    </div>
    {children}
  </section>
);

/** Preview and selectively apply active rules to existing ledger transactions */
const PreviewAndApply: React.FC<Pick<RulesAdvancedProps, 'rules' | 'transactions' | 'onApply'>> = ({
  rules,
  transactions,
  onApply,
}) => {
  const changes = useMemo(() => previewChanges(transactions, rules), [rules, transactions]);
  const { accounts } = useAccountsContext();
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
  const nameOf = useMemo(() => accountNameOf(accounts), [accounts]);

  const [search, setSearch] = useState('');
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(PAGE);
  const [isConfirming, setConfirming] = useState(false);

  const shown = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return changes;
    return changes.filter(change =>
      `${change.transaction.description} ${change.transaction.merchant} ${change.ruleName}`
        .toLowerCase()
        .includes(query)
    );
  }, [changes, search]);

  const chosen = changes.filter(change => !unticked.has(change.transaction.id));
  const isAllSelected = changes.length > 0 && unticked.size === 0;

  const toggleAll = () => {
    if (isAllSelected) {
      setUnticked(new Set(changes.map(c => c.transaction.id)));
    } else {
      setUnticked(new Set());
    }
  };

  const toggle = (id: string, isOn: boolean) =>
    setUnticked(prev => {
      const next = new Set(prev);
      if (isOn) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Section
      title="Preview and apply"
      description="Scan past transactions against your current rules. Select changes to apply to your ledger with automatic backup."
      actions={
        changes.length > 0 && (
          <Button
            isDisabled={chosen.length === 0}
            icon="tick-02"
            onPress={() => setConfirming(true)}
          >
            Apply {chosen.length} {chosen.length === 1 ? 'change' : 'changes'}
          </Button>
        )
      }
    >
      <ConfirmDialog
        isOpen={isConfirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          onApply(chosen);
          setConfirming(false);
          setUnticked(new Set());
        }}
        title={`Update ${chosen.length} ${chosen.length === 1 ? 'transaction' : 'transactions'}?`}
        message="A backup of their original state will be saved in History so you can roll back anytime."
        confirmLabel="Apply rules"
      />

      {changes.length === 0 ? (
        <EmptyState
          icon="tick-02"
          title="All transactions match rules"
          description="None of your existing transactions require updates based on your current rules."
        />
      ) : (
        <div className="space-y-3">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <Checkbox
              isSelected={isAllSelected}
              isIndeterminate={unticked.size > 0 && unticked.size < changes.length}
              onChange={toggleAll}
              aria-label="Select all changes"
            >
              <span className="type-label text-ink">Select all ({changes.length})</span>
            </Checkbox>

            <div className="relative min-w-0 flex-1 md:max-w-xs">
              <Icon name="search-01" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                aria-label="Find a change"
                placeholder="Search transactions, rules..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={cn(controlStyles, 'h-10 pl-9 pr-3 text-[.9375rem] max-md:h-12 max-md:text-base')}
              />
            </div>
          </div>

          {/* Changes List */}
          <ul className="min-w-0 divide-y divide-line">
            {shown.slice(0, visible).map(change => {
              const tx = change.transaction;
              const accountName = accountMap.get(tx.accountId);
              const isSelected = !unticked.has(tx.id);

              return (
                <li
                  key={tx.id}
                  className={cn(
                    'flex items-center gap-3 py-3 transition-colors',
                    isSelected ? 'bg-primary-soft/30 -mx-2 px-2 rounded-[var(--radius-md)]' : 'opacity-70'
                  )}
                >
                  <Checkbox
                    isSelected={isSelected}
                    onChange={isOn => toggle(tx.id, isOn)}
                    aria-label={`Select ${tx.merchant || tx.description}`}
                  >
                    {null}
                  </Checkbox>

                  <MerchantLogo
                    merchant={tx.merchant}
                    description={tx.description}
                    size={36}
                    className="shrink-0"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="type-body-strong truncate text-ink">
                        {tx.merchant || tx.description}
                      </span>
                      <Badge tone="blue">Rule: {change.ruleName}</Badge>
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-muted type-caption">
                      <span>{tx.date}</span>
                      {accountName && (
                        <>
                          <span>·</span>
                          <span className="truncate">{accountName}</span>
                        </>
                      )}
                    </div>

                    {/* Visual Diff Details */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {change.updates.category && (
                        <span className="inline-flex items-center gap-1 rounded bg-inset px-2 py-0.5 text-xs text-ink">
                          Category: <span className="text-muted line-through">{tx.category || 'Uncategorized'}</span>
                          <span className="font-semibold text-primary">→ {change.updates.category}</span>
                        </span>
                      )}
                      {change.updates.description && (
                        <span className="inline-flex items-center gap-1 rounded bg-inset px-2 py-0.5 text-xs text-ink">
                          Description: <span className="font-semibold text-primary">→ {change.updates.description}</span>
                        </span>
                      )}
                      {change.updates.merchant && (
                        <span className="inline-flex items-center gap-1 rounded bg-inset px-2 py-0.5 text-xs text-ink">
                          Merchant: <span className="font-semibold text-primary">→ {change.updates.merchant}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="type-figure-row shrink-0 text-ink">
                    <Amount value={tx.amount} currency={tx.currency} tone="flow" />
                  </span>
                </li>
              );
            })}
          </ul>

          {shown.length > visible && (
            <ShowMore
              remaining={shown.length - visible}
              onPress={() => setVisible(count => count + PAGE)}
              className="mt-3"
            />
          )}
        </div>
      )}
    </Section>
  );
};

/** Interactive Rule Test Bench / Sandbox */
const TryTransaction: React.FC<{
  rules: TransactionRule[];
  transactions: Transaction[];
  onCreateRule?: (initial?: Partial<TransactionRule>) => void;
}> = ({ rules, transactions, onCreateRule }) => {
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');

  const useReal = (id: string) => {
    const tx = transactions.find(item => item.id === id);
    if (!tx) return;
    setMerchant(tx.merchant || '');
    setDescription(tx.description || '');
    setAmount(String(Math.abs(Number(tx.amount) || 0)));
    setType(tx.type || 'expense');
  };

  const recent = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, PAGE)
        .map(tx => ({
          id: tx.id,
          label: `${tx.merchant || tx.description} (${tx.date})`,
          description: `${tx.category || 'Uncategorized'} · ${tx.amount}`,
        })),
    [transactions]
  );

  const hasInput = Boolean(merchant.trim() || description.trim());
  const result = hasInput
    ? applyRules(
        {
          merchant,
          description,
          category: '',
          amount: parseFloat(amount) || 0,
          type,
        },
        rules
      )
    : null;

  const matchedFilingRule = result?.filingRuleId ? rules.find(r => r.id === result.filingRuleId) : null;
  const matchedCustomRule = result?.appliedRuleId ? rules.find(r => r.id === result.appliedRuleId) : null;
  const isMatched = Boolean(matchedFilingRule || matchedCustomRule || (result && (result.category || result.description !== description || result.merchant !== merchant)));

  return (
    <Section
      title="Rule simulator"
      description="Type in a hypothetical transaction or select a recent one to test how your rules evaluate and classify it."
    >
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Input Parameters Form */}
        <div className="space-y-4 rounded-[var(--radius-lg)] bg-inset/60 p-4">
          <Select
            label="Load recent transaction"
            options={recent}
            value={null}
            onChange={useReal}
            placeholder="Select a transaction to test..."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="type-caption mb-1 block text-muted">Merchant</label>
              <input
                type="text"
                placeholder="e.g. Uber, Netflix, Starbucks"
                value={merchant}
                onChange={e => setMerchant(e.target.value)}
                className={cn(controlStyles, 'h-10 px-3 text-sm')}
              />
            </div>
            <div>
              <label className="type-caption mb-1 block text-muted">Description / Bank Memo</label>
              <input
                type="text"
                placeholder="e.g. UBR* TRIP 98271 LONDON"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className={cn(controlStyles, 'h-10 px-3 text-sm')}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="type-caption mb-1 block text-muted">Amount</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className={cn(controlStyles, 'h-10 px-3 text-sm')}
              />
            </div>
            <div>
              <Select
                label="Type"
                options={[
                  { id: 'expense', label: 'Expense' },
                  { id: 'income', label: 'Income' },
                ]}
                value={type}
                onChange={setType}
              />
            </div>
          </div>

          {hasInput && (
            <div className="flex justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                onPress={() => {
                  setMerchant('');
                  setDescription('');
                  setAmount('');
                }}
              >
                Clear inputs
              </Button>
            </div>
          )}
        </div>

        {/* Live Simulation Result Display */}
        <div className="space-y-4">
          {!hasInput ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-line p-6 text-center text-muted">
              <Icon name="flash" size={32} className="mb-2 text-muted/60" />
              <p className="type-body-strong text-ink">Simulator waiting</p>
              <p className="type-caption mt-1 max-w-xs text-muted">
                Type in merchant or description fields, or pick a recent transaction on the left to see live rule evaluations.
              </p>
            </div>
          ) : isMatched ? (
            <div className="space-y-3 rounded-[var(--radius-lg)] border border-primary/20 bg-primary-soft/20 p-5">
              <div className="flex items-center justify-between">
                <span className="type-body-strong font-semibold text-primary">
                  Rules applied successfully
                </span>
                <Badge tone="positive">Match Found</Badge>
              </div>

              <dl className="grid gap-3 rounded-[var(--radius-md)] bg-solid/80 p-3.5 sm:grid-cols-2 shadow-2xs">
                <div>
                  <dt className="type-caption text-muted">Category</dt>
                  <dd className="type-body font-bold text-primary">
                    {result?.category || 'Uncategorized'}
                  </dd>
                </div>
                <div>
                  <dt className="type-caption text-muted">Cleaned Merchant</dt>
                  <dd className="type-body font-semibold text-ink">
                    {result?.merchant || merchant || 'None'}
                  </dd>
                </div>
                <div>
                  <dt className="type-caption text-muted">Description</dt>
                  <dd className="type-body text-ink">
                    {result?.description || description || 'None'}
                  </dd>
                </div>
                <div>
                  <dt className="type-caption text-muted">Matched Rule</dt>
                  <dd className="type-body font-medium text-ink">
                    {matchedFilingRule?.name || matchedCustomRule?.name || 'Rule'}
                  </dd>
                </div>
              </dl>

              {matchedFilingRule && (
                <p className="type-caption text-muted">
                  Matches "Always file" merchant rule for <strong>{matchedFilingRule.name}</strong>.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 rounded-[var(--radius-lg)] border border-amber/20 bg-amber-soft/20 p-5">
              <div className="flex items-center justify-between">
                <span className="type-body-strong font-semibold text-attention-text">
                  No matching rules
                </span>
                <Badge tone="attention">No Match</Badge>
              </div>
              <p className="type-caption text-muted">
                None of your current active rules matched this transaction. In production, this transaction would remain unchanged and enter the Review Queue as uncategorized.
              </p>

              {onCreateRule && (
                <div className="pt-2">
                  <Button
                    size="sm"
                    icon="add-01"
                    onPress={() =>
                      onCreateRule({
                        name: merchant || description,
                        conditions: [
                          {
                            field: merchant ? 'merchant' : 'description',
                            operator: 'contains',
                            value: merchant || description,
                          },
                        ],
                      })
                    }
                  >
                    Create rule for this transaction
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
};

/** Execution History & Safe Rollback */
const History: React.FC<Pick<RulesAdvancedProps, 'runs' | 'logs' | 'onUndo' | 'onClearLog'>> = ({
  runs,
  logs,
  onUndo,
  onClearLog,
}) => {
  const [undoing, setUndoing] = useState<RuleRunBackup | null>(null);
  const [isClearing, setClearing] = useState(false);
  const [visible, setVisible] = useState(PAGE);

  return (
    <Section
      title="Execution history"
      description="Review changes applied by rules and safely roll back any batch run."
      actions={
        logs.length > 0 && (
          <Button variant="ghost" size="sm" onPress={() => setClearing(true)}>
            Clear audit log
          </Button>
        )
      }
    >
      <ConfirmDialog
        isOpen={Boolean(undoing)}
        onClose={() => setUndoing(null)}
        onConfirm={() => {
          if (undoing) onUndo(undoing);
          setUndoing(null);
        }}
        title="Undo this run?"
        message={`This will restore ${undoing?.transactions.length ?? 0} transactions back to their original state.`}
        confirmLabel="Undo run"
      />

      <ConfirmDialog
        isOpen={isClearing}
        onClose={() => setClearing(false)}
        onConfirm={() => {
          onClearLog();
          setClearing(false);
        }}
        title="Clear the audit log?"
        message="Your historical runs can still be undone."
        confirmLabel="Clear log"
      />

      {runs.length === 0 && logs.length === 0 ? (
        <EmptyState
          icon="history"
          title="No execution runs yet"
          description="Runs and audit logs appear here whenever you apply rules to your transactions."
        />
      ) : (
        <div className="space-y-6">
          {/* Past Batches */}
          {runs.length > 0 && (
            <div className="space-y-2">
              <h3 className="type-label text-ink">Past Runs</h3>
              <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-inset/40">
                {runs.map(run => (
                  <li
                    key={run.batchId ?? run.timestamp}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary-soft text-primary">
                        <Icon name="history" size={18} />
                      </div>
                      <div className="min-w-0">
                        <span className="type-body-strong block text-ink">
                          {run.transactions.length}{' '}
                          {run.transactions.length === 1 ? 'transaction' : 'transactions'} updated
                        </span>
                        <span className="type-caption block text-muted">
                          {new Date(run.timestamp).toLocaleString([], {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      icon="undo-left-round"
                      onPress={() => setUndoing(run)}
                    >
                      Undo run
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Audit Logs */}
          {logs.length > 0 && (
            <div className="space-y-2">
              <h3 className="type-label text-ink">Detailed Audit Log</h3>
              <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-inset/40">
                {logs.slice(0, visible).map(log => (
                  <li key={log.id} className="p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="type-body-strong min-w-0 truncate text-ink">
                        {log.txDescription || 'Transaction'}
                      </span>
                      <div className="flex items-center gap-2">
                        {log.isReverted ? (
                          <Badge tone="neutral">Undone</Badge>
                        ) : (
                          <Badge tone="positive">Applied</Badge>
                        )}
                        <span className="type-figure-row text-ink">
                          {formatCurrency(log.txAmount, getMainCurrency())}
                        </span>
                      </div>
                    </div>
                    <p className="type-caption mt-0.5 text-muted">
                      Rule: <strong className="text-ink">{log.ruleName}</strong> ·{' '}
                      {new Date(log.timestamp).toLocaleDateString()}
                    </p>
                    <p className="type-caption mt-0.5 text-muted">{log.changeDetails}</p>
                  </li>
                ))}
              </ul>

              {logs.length > visible && (
                <ShowMore
                  remaining={logs.length - visible}
                  onPress={() => setVisible(count => count + PAGE)}
                  className="mt-3"
                />
              )}
            </div>
          )}
        </div>
      )}
    </Section>
  );
};

/**
 * Enhanced Test & History view:
 * Provides structured tabs for Preview & Apply, Rule Simulator, and Run History with Undo.
 */
const RulesAdvanced: React.FC<RulesAdvancedProps> = ({
  rules,
  transactions,
  runs,
  logs,
  onApply,
  onUndo,
  onClearLog,
  onCreateRule,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'simulator' | 'history'>('preview');

  const changes = useMemo(() => previewChanges(transactions, rules), [rules, transactions]);

  return (
    <div className="space-y-5">
      {/* Tab Switcher */}
      <SegmentedControl
        scrollable
        items={[
          { id: 'preview', label: 'Preview & Apply', badge: changes.length || undefined },
          { id: 'simulator', label: 'Rule Simulator' },
          { id: 'history', label: 'History & Undo', badge: runs.length || undefined },
        ]}
        activeId={activeTab}
        onChange={id => setActiveTab(id as 'preview' | 'simulator' | 'history')}
      />

      {/* Focused View Content */}
      {activeTab === 'preview' && (
        <PreviewAndApply rules={rules} transactions={transactions} onApply={onApply} />
      )}
      {activeTab === 'simulator' && (
        <TryTransaction
          rules={rules}
          transactions={transactions}
          onCreateRule={onCreateRule}
        />
      )}
      {activeTab === 'history' && (
        <History runs={runs} logs={logs} onUndo={onUndo} onClearLog={onClearLog} />
      )}
    </div>
  );
};

export default RulesAdvanced;
