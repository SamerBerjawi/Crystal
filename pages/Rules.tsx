import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppPreferences, Category, Page, RuleRunBackup, Transaction, TransactionRule } from '../types';
import RuleBuilder from '../components/RuleBuilder';
import RuleRow, { RuleSentence } from '../components/RuleRow';
import RulesAdvanced from '../components/RulesAdvanced';
import PageHeader from '../components/PageHeader';
import { Button } from '../components/ui/Actions';
import { ShowMore } from '../components/ui/Display';
import { TextInput } from '../components/ui/Fields';
import { ConfirmDialog } from '../components/ui/Overlays';
import SegmentedControl from '../components/ui/SegmentedControl';
import { EmptyState } from '../components/ui/States';
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
const FILING_PAGE = 20;
const SUGGESTION_PAGE = 5;
const EMPTY_RULES: TransactionRule[] = [];

const RuleGroup: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <section className="min-w-0">
    <h2 className="type-card-title text-ink">{title}</h2>
    <p className="type-body mb-2 mt-1 text-muted">{description}</p>
    <ul className="surface-card min-w-0 divide-y divide-line rounded-[var(--radius-xl)] px-4">{children}</ul>
  </section>
);

const Rules: React.FC<RulesProps> = ({ preferences, setPreferences, transactions, saveTransaction, incomeCategories, expenseCategories }) => {
  const rules = preferences.transactionRules ?? EMPTY_RULES;
  const { accounts } = useAccountsContext();
  const nameOf = useMemo(() => accountNameOf(accounts), [accounts]);
  const [tab, setTab] = useState<'rules' | 'advanced'>('rules');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ rule: TransactionRule | null } | null>(null);
  const [deleting, setDeleting] = useState<TransactionRule | null>(null);
  const [visibleFilings, setVisibleFilings] = useState(FILING_PAGE);
  const [visibleSuggestions, setVisibleSuggestions] = useState(SUGGESTION_PAGE);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; edge: 'before' | 'after' } | null>(null);

  const setRules = (update: (current: TransactionRule[]) => TransactionRule[]) =>
    setPreferences(prev => ({ ...prev, transactionRules: update(prev.transactionRules ?? []) }));

  const matchCounts = useMemo(() => {
    const items = transactions.map(tx => ({ ...tx, amount: Number(tx.amount) || 0 }));
    return new Map(rules.map(rule => [rule.id, items.filter(tx => ruleMatches(tx, rule)).length]));
  }, [rules, transactions]);
  const suggestions = useMemo(() => ruleSuggestions(transactions, rules), [rules, transactions]);

  const matchesSearch = (rule: TransactionRule) => sentenceText(rule, nameOf).toLowerCase().includes(search.toLowerCase().trim());
  const filings = rules.filter(rule => isAlwaysFile(rule) && matchesSearch(rule)).sort((a, b) => a.name.localeCompare(b.name));
  const ordered = ordinaryRules(rules).filter(matchesSearch);

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

  const endDrag = () => { setDraggedId(null); setDropTarget(null); };
  const drop = () => {
    if (draggedId && dropTarget) setRules(current => moveRule(current, draggedId, dropTarget.id, dropTarget.edge));
    endDrag();
  };

  const toggle = (id: string, isActive: boolean) => setRules(current => current.map(rule => (rule.id === id ? { ...rule, isActive } : rule)));
  const commonItems = (rule: TransactionRule) => [
    { id: 'edit', label: 'Edit', icon: 'pencil-edit-02', onAction: () => setEditing({ rule }) },
    { id: 'delete', label: 'Delete', icon: 'delete-02', isDestructive: true, startsGroup: true, onAction: () => setDeleting(rule) },
  ];

  const hasNoRules = rules.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rules"
        stats={[
          { label: 'Rules on', icon: 'flash', value: rules.filter(rule => rule.isActive).length, badge: `of ${rules.length}`, badgeTone: 'pine' },
          { label: 'Always file', icon: 'folder-01', value: rules.filter(isAlwaysFile).length },
          { label: 'Suggestions', icon: 'magic-wand-01', value: suggestions.length },
        ]}
        actions={<Button icon="add-01" onPress={() => setEditing({ rule: null })}>New rule</Button>}
      />

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
      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) setRules(current => current.filter(rule => rule.id !== deleting.id)); setDeleting(null); }}
        title="Delete this rule?"
        message="Past transactions stay as they are."
        confirmLabel="Delete rule"
        isDestructive
      />

      <SegmentedControl items={[{ id: 'rules', label: 'Rules' }, { id: 'advanced', label: 'Advanced' }]} activeId={tab} onChange={id => setTab(id as 'rules' | 'advanced')} />

      {tab === 'advanced' ? (
        <RulesAdvanced
          rules={rules}
          transactions={transactions}
          runs={preferences.ruleExecutionHistory ?? []}
          logs={preferences.ruleExecutionLogs ?? []}
          onApply={applyChanges}
          onUndo={undoRun}
          onClearLog={() => setPreferences(prev => ({ ...prev, ruleExecutionLogs: [] }))}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            {!hasNoRules && <TextInput label="Find a rule" value={search} onChange={setSearch} />}
            {hasNoRules && (
              <EmptyState icon="flash" title="No rules yet" description="Rules file transactions for you as they arrive." actionLabel="New rule" onAction={() => setEditing({ rule: null })} />
            )}
            {filings.length > 0 && (
              <RuleGroup title="Always file" description="These run first and always win for what they set.">
                {filings.slice(0, visibleFilings).map(rule => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    matchCount={matchCounts.get(rule.id) ?? 0}
                    menuItems={commonItems(rule)}
                    onToggle={isActive => toggle(rule.id, isActive)}
                    onOpen={() => setEditing({ rule })}
                  />
                ))}
                {filings.length > visibleFilings && <li className="py-2"><ShowMore remaining={filings.length - visibleFilings} onPress={() => setVisibleFilings(count => count + FILING_PAGE)} /></li>}
              </RuleGroup>
            )}
            {ordered.length > 0 && (
              <RuleGroup title="Your rules" description="From the top down, the first that fits fills what's left.">
                {ordered.map(rule => (
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
            {!hasNoRules && search && filings.length === 0 && ordered.length === 0 && <EmptyState icon="search-01" title="No rules match" description="Try another word." />}
          </div>

          {suggestions.length > 0 && (
            <aside aria-label="Suggestions" className="min-w-0">
              <h2 className="type-card-title text-ink">Worth making</h2>
              <p className="type-body mb-2 mt-1 text-muted">Patterns in your transactions.</p>
              <ul className="space-y-2">
                {suggestions.slice(0, visibleSuggestions).map(suggestion => (
                  <li key={suggestion.id} className="surface-card min-w-0 rounded-[var(--radius-xl)] p-4">
                    <RuleSentence rule={suggestion.rule} />
                    <p className="type-caption mt-1 text-muted">{suggestion.reason}</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onPress={() => saveRule(suggestion.rule)}>Add</Button>
                      <Button size="sm" variant="ghost" onPress={() => setEditing({ rule: suggestion.rule })}>Edit first</Button>
                    </div>
                  </li>
                ))}
              </ul>
              {suggestions.length > visibleSuggestions && <ShowMore remaining={suggestions.length - visibleSuggestions} onPress={() => setVisibleSuggestions(count => count + SUGGESTION_PAGE)} className="mt-2" />}
            </aside>
          )}
        </div>
      )}
    </div>
  );
};

export default Rules;
