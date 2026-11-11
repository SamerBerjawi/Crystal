import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppPreferences, Category, Page, RuleRunBackup, Transaction, TransactionRule } from '../types';
import RuleBuilder from '../components/RuleBuilder';
import RuleRow, { RuleSentence } from '../components/RuleRow';
import RulesAdvanced from '../components/RulesAdvanced';
import PageHeader from '../components/PageHeader';
import { Button, IconButton } from '../components/ui/Actions';
import { Badge, ShowMore } from '../components/ui/Display';
import { controlStyles } from '../components/ui/Fields';
import { ConfirmDialog } from '../components/ui/Overlays';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';
import Icon from '../components/ui/Icon';
import { cn } from '../lib/utils';
import { isAlwaysFile, ordinaryRules, ruleMatches } from '../utils/rules';
import { useAccountsContext } from '../contexts/DomainProviders';
import { accountNameOf, buildRevert, buildRun, moveRule, previewChanges, RuleChange, ruleSuggestions, sentenceText, shiftRule } from '../utils/rulesModel';

interface RulesProps {
  preferences: AppPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<AppPreferences>>;
  transactions: Transaction[];
  saveTransaction: (updatedTxs: any[], transactionsToDelete?: string[], options?: any) => void;
  incomeCategories: Category[];
  expenseCategories: Category[];
  setCurrentPage: (page: Page) => void;
}

const MAX_LOGS = 500;
const MAX_RUNS = 10;
const FILING_PAGE = 25;
const SUGGESTION_PAGE = 5;
const EMPTY_RULES: TransactionRule[] = [];

type RuleFilterTab = 'all' | 'always' | 'custom' | 'inactive';

const RuleGroup: React.FC<{
  title: string;
  description: string;
  count?: number;
  children: React.ReactNode;
}> = ({ title, description, count, children }) => (
  <section className="min-w-0 space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h2 className="type-card-title text-ink">{title}</h2>
        {count !== undefined && (
          <span className="type-caption rounded-full bg-inset px-2 py-0.5 font-semibold text-muted">
            {count}
          </span>
        )}
      </div>
    </div>
    <p className="type-body text-muted">{description}</p>
    <ul className="surface-card min-w-0 divide-y divide-line rounded-[var(--radius-xl)] px-4 py-1 shadow-sm">
      {children}
    </ul>
  </section>
);

const Rules: React.FC<RulesProps> = ({
  preferences,
  setPreferences,
  transactions,
  saveTransaction,
  incomeCategories,
  expenseCategories,
}) => {
  const rules = preferences.transactionRules ?? EMPTY_RULES;
  const { accounts } = useAccountsContext();

  const accountMap = useMemo(() => new Map(accounts.map(acc => [acc.id, acc.name])), [accounts]);
  const nameOf = useCallback((id: string) => accountMap.get(id) ?? 'Account', [accountMap]);

  const [mainTab, setMainTab] = useState<'rules' | 'advanced'>('rules');
  const [filterTab, setFilterTab] = useState<RuleFilterTab>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ rule: TransactionRule | null } | null>(null);
  const [deleting, setDeleting] = useState<TransactionRule | null>(null);
  const [visibleFilings, setVisibleFilings] = useState(FILING_PAGE);
  const [visibleSuggestions, setVisibleSuggestions] = useState(SUGGESTION_PAGE);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; edge: 'before' | 'after' } | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  const setRules = (update: (current: TransactionRule[]) => TransactionRule[]) =>
    setPreferences(prev => ({ ...prev, transactionRules: update(prev.transactionRules ?? []) }));

  // Efficient match counts without intermediate object allocation
  const matchCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const rule of rules) {
      let count = 0;
      for (const tx of transactions) {
        if (ruleMatches(tx, rule)) count++;
      }
      counts.set(rule.id, count);
    }
    return counts;
  }, [rules, transactions]);

  // Rule suggestions from recurring transaction patterns
  const rawSuggestions = useMemo(() => ruleSuggestions(transactions, rules), [rules, transactions]);
  const suggestions = useMemo(
    () => rawSuggestions.filter(s => !dismissedSuggestions.has(s.id)),
    [rawSuggestions, dismissedSuggestions]
  );

  const query = search.toLowerCase().trim();

  const matchesSearch = useCallback(
    (rule: TransactionRule) => {
      if (!query) return true;
      if (rule.name.toLowerCase().includes(query)) return true;
      const merchantCondition = rule.conditions.find(c => c.field === 'merchant')?.value;
      if (merchantCondition && String(merchantCondition).toLowerCase().includes(query)) return true;
      const categoryAction = rule.actions.find(a => a.field === 'category')?.value;
      if (categoryAction && categoryAction.toLowerCase().includes(query)) return true;
      return sentenceText(rule, nameOf).toLowerCase().includes(query);
    },
    [query, nameOf]
  );

  const allFilings = useMemo(() => rules.filter(isAlwaysFile).sort((a, b) => a.name.localeCompare(b.name)), [rules]);
  const allOrdered = useMemo(() => ordinaryRules(rules), [rules]);
  const inactiveCount = useMemo(() => rules.filter(r => !r.isActive).length, [rules]);

  const filings = useMemo(() => {
    if (filterTab === 'custom') return [];
    return allFilings
      .filter(rule => filterTab !== 'inactive' || !rule.isActive)
      .filter(matchesSearch);
  }, [allFilings, filterTab, matchesSearch]);

  const ordered = useMemo(() => {
    if (filterTab === 'always') return [];
    return allOrdered
      .filter(rule => filterTab !== 'inactive' || !rule.isActive)
      .filter(matchesSearch);
  }, [allOrdered, filterTab, matchesSearch]);

  const saveRule = (rule: TransactionRule, replacesId?: string) => {
    setRules(current => {
      const idx = current.findIndex(item => item.id === rule.id || (replacesId && item.id === replacesId));
      if (idx >= 0) {
        const next = [...current];
        next[idx] = rule;
        return next.filter((item, i) => i === idx || (item.id !== rule.id && item.id !== replacesId));
      }
      return [...current, rule];
    });

    const pending = rule.isActive ? previewChanges(transactions, [rule]) : [];
    if (pending.length > 0) {
      toast.success(`Rule saved · matches ${pending.length} existing ${pending.length === 1 ? 'transaction' : 'transactions'}`, {
        action: { label: `Apply to ${pending.length}`, onClick: () => applyChanges(pending) },
      });
    } else {
      toast.success('Rule saved');
    }
  };

  const applyChanges = (changes: RuleChange[]) => {
    const { payload, backup, logs } = buildRun(changes, new Date().toISOString(), nameOf);
    setPreferences(prev => ({
      ...prev,
      lastRuleRunBackup: backup,
      ruleExecutionHistory: [backup, ...(prev.ruleExecutionHistory ?? [])].slice(0, MAX_RUNS),
      ruleExecutionLogs: [...logs, ...(prev.ruleExecutionLogs ?? [])].slice(0, MAX_LOGS),
    }));
    saveTransaction(payload, [], { skipRules: true });
    toast.success(`${payload.length} ${payload.length === 1 ? 'transaction' : 'transactions'} updated`);
  };

  const undoRun = (run: RuleRunBackup) => {
    const { payload, logs } = buildRevert(run, transactions, new Date().toISOString());
    if (payload.length === 0) return void toast.error('Those transactions no longer exist.');
    saveTransaction(payload, [], { skipRules: true });
    const runId = run.batchId ?? run.id ?? run.timestamp;
    setPreferences(prev => ({
      ...prev,
      lastRuleRunBackup: (prev.lastRuleRunBackup?.batchId ?? prev.lastRuleRunBackup?.timestamp) === runId ? undefined : prev.lastRuleRunBackup,
      ruleExecutionHistory: (prev.ruleExecutionHistory ?? []).filter(item => (item.batchId ?? item.id ?? item.timestamp) !== runId),
      ruleExecutionLogs: [...logs, ...(prev.ruleExecutionLogs ?? []).map(log => (log.batchId === run.batchId ? { ...log, isReverted: true } : log))].slice(0, MAX_LOGS),
    }));
    toast.success(`${payload.length} ${payload.length === 1 ? 'transaction' : 'transactions'} restored`);
  };

  const endDrag = () => {
    setDraggedId(null);
    setDropTarget(null);
  };

  const drop = () => {
    if (draggedId && dropTarget) {
      setRules(current => moveRule(current, draggedId, dropTarget.id, dropTarget.edge));
    }
    endDrag();
  };

  const toggle = (id: string, isActive: boolean) =>
    setRules(current => current.map(rule => (rule.id === id ? { ...rule, isActive } : rule)));

  const commonItems = (rule: TransactionRule) => [
    { id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onAction: () => setEditing({ rule }) },
    { id: 'delete', label: 'Delete', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => setDeleting(rule) },
  ];

  const hasNoRules = rules.length === 0;

  return (
    <div className="space-y-6">
      {/* Header with quick stats and primary actions */}
      <PageHeader
        title="Rules"
        subtitle="Automate transaction categorization, descriptions, and account tagging"
        stats={[
          { label: 'Active rules', icon: 'flash', value: rules.filter(rule => rule.isActive).length, badge: `of ${rules.length}`, badgeTone: 'pine', iconTone: 'positive' },
          { label: 'Always file', icon: 'folder-01', value: allFilings.length, iconTone: 'teal' },
          { label: 'Custom rules', icon: 'sliders-horizontal', value: allOrdered.length, iconTone: 'blue' },
          { label: 'Suggestions', icon: 'magic-wand-01', value: suggestions.length, iconTone: 'attention' },
        ]}
        actions={
          <>
            <Button variant="secondary" icon="play" onPress={() => setMainTab('advanced')}>
              Test & Preview
            </Button>
            <Button icon="add-01" onPress={() => setEditing({ rule: null })}>
              New rule
            </Button>
          </>
        }
      />

      {/* SidePanel modal for creating or editing rules */}
      {editing && (
        <RuleBuilder
          rule={editing.rule}
          rules={rules}
          transactions={transactions}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          accounts={accounts}
          onClose={() => setEditing(null)}
          onSave={saveRule}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) setRules(current => current.filter(rule => rule.id !== deleting.id));
          setDeleting(null);
        }}
        title="Delete this rule?"
        message="Past transactions will remain as they are."
        confirmLabel="Delete rule"
        isDestructive
      />

      {/* Primary Tab Navigation */}
      <SegmentedControl
        items={[
          { id: 'rules', label: 'Rules', badge: rules.length },
          { id: 'advanced', label: 'Test & History', badge: preferences.ruleExecutionHistory?.length || undefined },
        ]}
        activeId={mainTab}
        onChange={id => setMainTab(id as 'rules' | 'advanced')}
      />

      {mainTab === 'advanced' ? (
        <RulesAdvanced
          rules={rules}
          transactions={transactions}
          runs={preferences.ruleExecutionHistory ?? []}
          logs={preferences.ruleExecutionLogs ?? []}
          onApply={applyChanges}
          onUndo={undoRun}
          onClearLog={() => setPreferences(prev => ({ ...prev, ruleExecutionLogs: [] }))}
          onCreateRule={initial => setEditing({ rule: initial ? { id: '', name: initial.name || '', isActive: true, conditionLogic: 'AND', conditions: initial.conditions || [], actions: initial.actions || [] } : null })}
        />
      ) : (
        <div className="space-y-5">
          {/* Toolbar: Sub-filters and Search */}
          {!hasNoRules && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SegmentedControl
                scrollable
                items={[
                  { id: 'all', label: 'All', badge: rules.length },
                  { id: 'always', label: 'Always file', badge: allFilings.length },
                  { id: 'custom', label: 'Your rules', badge: allOrdered.length },
                  ...(inactiveCount > 0 ? [{ id: 'inactive', label: 'Inactive', badge: inactiveCount }] : []),
                ]}
                activeId={filterTab}
                onChange={id => setFilterTab(id as RuleFilterTab)}
              />

              <div className="relative min-w-0 flex-1 md:max-w-xs">
                <Icon name="search-01" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  aria-label="Search rules"
                  placeholder="Search rules, merchants, categories..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className={cn(controlStyles, 'h-10 pl-9 pr-3 text-[.9375rem] max-md:h-12 max-md:text-base')}
                />
              </div>
            </div>
          )}

          {hasNoRules ? (
            <EmptyState
              icon="flash"
              title="No rules configured"
              description="Rules file transactions for you automatically as they arrive from bank syncs or imports."
              actionLabel="Create your first rule"
              onAction={() => setEditing({ rule: null })}
            />
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              {/* Left Column: Rule Groups */}
              <div className="min-w-0 space-y-6">
                {filings.length > 0 && (
                  <RuleGroup
                    title="Always file"
                    description="These run first and automatically win for matching merchants."
                    count={filings.length}
                  >
                    {filings.slice(0, visibleFilings).map(rule => (
                      <RuleRow
                        key={rule.id}
                        rule={rule}
                        matchCount={matchCounts.get(rule.id) ?? 0}
                        menuItems={commonItems(rule)}
                        onToggle={isActive => toggle(rule.id, isActive)}
                        onOpen={() => setEditing({ rule })}
                        nameOf={nameOf}
                      />
                    ))}
                    {filings.length > visibleFilings && (
                      <li className="py-2.5">
                        <ShowMore
                          remaining={filings.length - visibleFilings}
                          onPress={() => setVisibleFilings(count => count + FILING_PAGE)}
                        />
                      </li>
                    )}
                  </RuleGroup>
                )}

                {ordered.length > 0 && (
                  <RuleGroup
                    title="Your rules"
                    description="Evaluated from top to bottom. The first matching rule fills any unset fields."
                    count={ordered.length}
                  >
                    {ordered.map((rule, index) => (
                      <RuleRow
                        key={rule.id}
                        rule={rule}
                        matchCount={matchCounts.get(rule.id) ?? 0}
                        menuItems={[
                          ...commonItems(rule).slice(0, 1),
                          { id: 'up', label: 'Move up', icon: 'arrow-up-02', startsGroup: true, onAction: () => setRules(current => shiftRule(current, rule.id, -1)) },
                          { id: 'down', label: 'Move down', icon: 'arrow-down-02', onAction: () => setRules(current => shiftRule(current, rule.id, 1)) },
                          ...commonItems(rule).slice(1),
                        ]}
                        onToggle={isActive => toggle(rule.id, isActive)}
                        onOpen={() => setEditing({ rule })}
                        onMoveUp={index > 0 ? () => setRules(current => shiftRule(current, rule.id, -1)) : undefined}
                        onMoveDown={index < ordered.length - 1 ? () => setRules(current => shiftRule(current, rule.id, 1)) : undefined}
                        isFirst={index === 0}
                        isLast={index === ordered.length - 1}
                        nameOf={nameOf}
                        drag={{
                          isDragging: draggedId === rule.id,
                          dropEdge: dropTarget?.id === rule.id ? dropTarget.edge : null,
                          onStart: () => setDraggedId(rule.id),
                          onOver: edge => { if (draggedId && draggedId !== rule.id) setDropTarget({ id: rule.id, edge }); },
                          onLeave: () => setDropTarget(null),
                          onDrop: drop,
                          onEnd: endDrag,
                        }}
                      />
                    ))}
                  </RuleGroup>
                )}

                {search && filings.length === 0 && ordered.length === 0 && (
                  <EmptyState
                    icon="search-01"
                    title="No matching rules"
                    description={`No rules match “${search}”.`}
                    actionLabel="Clear search"
                    onAction={() => { setSearch(''); setFilterTab('all'); }}
                  />
                )}
              </div>

              {/* Right Column: Rule Suggestions */}
              {suggestions.length > 0 && (
                <aside aria-label="Rule suggestions" className="min-w-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="type-card-title text-ink">Worth making</h2>
                      <p className="type-caption text-muted">Recurring transaction patterns</p>
                    </div>
                    <Badge tone="attention">{suggestions.length} new</Badge>
                  </div>

                  <ul className="space-y-3">
                    {suggestions.slice(0, visibleSuggestions).map(suggestion => (
                      <li key={suggestion.id} className="surface-card min-w-0 space-y-3 rounded-[var(--radius-xl)] p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <span className="type-body-strong text-ink">{suggestion.rule.name}</span>
                          <IconButton
                            icon="cancel-01"
                            label="Dismiss suggestion"
                            onPress={() => setDismissedSuggestions(prev => new Set([...prev, suggestion.id]))}
                          />
                        </div>

                        <RuleSentence rule={suggestion.rule} nameOf={nameOf} />

                        <p className="type-caption text-muted">{suggestion.reason}</p>

                        <div className="flex items-center gap-2 pt-1">
                          <Button size="sm" icon="add-01" onPress={() => saveRule(suggestion.rule)}>
                            Add rule
                          </Button>
                          <Button size="sm" variant="ghost" onPress={() => setEditing({ rule: suggestion.rule })}>
                            Edit first
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {suggestions.length > visibleSuggestions && (
                    <ShowMore
                      remaining={suggestions.length - visibleSuggestions}
                      onPress={() => setVisibleSuggestions(count => count + SUGGESTION_PAGE)}
                      className="mt-2"
                    />
                  )}
                </aside>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Rules;
