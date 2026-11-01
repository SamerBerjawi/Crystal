import React, { useMemo, useState } from 'react';
import { RuleExecutionLog, RuleRunBackup, Transaction, TransactionRule } from '../types';
import { formatCurrency } from '../utils';
import { applyRules } from '../utils/rules';
import { describeChange, previewChanges, RuleChange } from '../utils/rulesModel';
import { Button } from './ui/Actions';
import { Badge, ShowMore } from './ui/Display';
import { Checkbox, TextInput } from './ui/Fields';
import { ConfirmDialog } from './ui/Overlays';
import { Select } from './ui/Pickers';
import { EmptyState } from './ui/States';

interface RulesAdvancedProps {
  rules: TransactionRule[];
  transactions: Transaction[];
  runs: RuleRunBackup[];
  logs: RuleExecutionLog[];
  onApply: (changes: RuleChange[]) => void;
  onUndo: (run: RuleRunBackup) => void;
  onClearLog: () => void;
}

const PAGE = 25;

const Section: React.FC<{ title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }> = ({ title, description, actions, children }) => (
  <section className="surface-card min-w-0 p-5">
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

const PreviewAndApply: React.FC<Pick<RulesAdvancedProps, 'rules' | 'transactions' | 'onApply'>> = ({ rules, transactions, onApply }) => {
  const changes = useMemo(() => previewChanges(transactions, rules), [rules, transactions]);
  const [search, setSearch] = useState('');
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(PAGE);
  const [isConfirming, setConfirming] = useState(false);

  const shown = useMemo(() => {
    const query = search.toLowerCase().trim();
    return query ? changes.filter(change => `${change.transaction.description} ${change.transaction.merchant} ${change.ruleName}`.toLowerCase().includes(query)) : changes;
  }, [changes, search]);
  const chosen = changes.filter(change => !unticked.has(change.transaction.id));

  const toggle = (id: string, isOn: boolean) => setUnticked(prev => {
    const next = new Set(prev);
    if (isOn) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <Section
      title="Preview and apply"
      description="See what your rules would change in past transactions. Nothing changes until you apply."
      actions={changes.length > 0 && <Button isDisabled={chosen.length === 0} onPress={() => setConfirming(true)}>Apply {chosen.length}</Button>}
    >
      <ConfirmDialog
        isOpen={isConfirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => { onApply(chosen); setConfirming(false); setUnticked(new Set()); }}
        title={`Update ${chosen.length} ${chosen.length === 1 ? 'transaction' : 'transactions'}?`}
        message="You can undo this under History."
        confirmLabel="Apply rules"
      />
      {changes.length === 0 ? (
        <EmptyState icon="check_circle" title="Nothing to change" description="Past transactions already match your rules." />
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-end gap-3">
            <TextInput label="Find a change" className="min-w-0 flex-1 basis-56" value={search} onChange={setSearch} />
            <Button variant="ghost" size="sm" onPress={() => setUnticked(new Set())}>Select all</Button>
            <Button variant="ghost" size="sm" onPress={() => setUnticked(new Set(changes.map(change => change.transaction.id)))}>Clear</Button>
          </div>
          <ul className="divide-y divide-line">
            {shown.slice(0, visible).map(change => (
              <li key={change.transaction.id}>
                <Checkbox isSelected={!unticked.has(change.transaction.id)} onChange={isOn => toggle(change.transaction.id, isOn)}>
                  <span className="type-body block truncate text-ink">{change.transaction.merchant || change.transaction.description}</span>
                  <span className="type-caption block text-muted">{change.transaction.date} · {change.ruleName}</span>
                  <span className="type-caption block text-muted">{describeChange(change)}</span>
                </Checkbox>
              </li>
            ))}
          </ul>
          {shown.length > visible && <ShowMore remaining={shown.length - visible} onPress={() => setVisible(count => count + PAGE)} className="mt-3" />}
        </>
      )}
    </Section>
  );
};

const TryTransaction: React.FC<{ rules: TransactionRule[]; transactions: Transaction[] }> = ({ rules, transactions }) => {
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

  const recent = useMemo(() => [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, PAGE).map(tx => ({ id: tx.id, label: tx.merchant || tx.description || 'Transaction', description: tx.date })), [transactions]);
  const hasInput = !!(merchant.trim() || description.trim());
  const result = hasInput ? applyRules({ merchant, description, category: '', amount: parseFloat(amount) || 0, type }, rules) : null;
  const fired = [result?.filingRuleId, result?.appliedRuleId].map(id => rules.find(rule => rule.id === id)?.name).filter(Boolean);

  return (
    <Section title="Try a transaction" description="Type one in, or pick a recent one, to see what happens.">
      <div className="grid gap-4 md:grid-cols-2">
        <Select label="Recent transaction" className="md:col-span-2" options={recent} value={null} onChange={useReal} placeholder="Pick one" />
        <TextInput label="Merchant" value={merchant} onChange={setMerchant} />
        <TextInput label="Description" value={description} onChange={setDescription} />
        <TextInput label="Amount" inputMode="decimal" value={amount} onChange={setAmount} />
        <Select label="Type" options={[{ id: 'expense', label: 'Expense' }, { id: 'income', label: 'Income' }]} value={type} onChange={setType} />
      </div>
      {result && (
        <dl className="mt-4 grid gap-1 rounded-[var(--radius-md)] bg-inset p-3 sm:grid-cols-2">
          <div><dt className="type-caption text-muted">Category</dt><dd className="type-body text-ink">{result.category || 'None'}</dd></div>
          <div><dt className="type-caption text-muted">Merchant</dt><dd className="type-body text-ink">{result.merchant || 'None'}</dd></div>
          <div><dt className="type-caption text-muted">Description</dt><dd className="type-body text-ink">{result.description || 'None'}</dd></div>
          <div><dt className="type-caption text-muted">Rules used</dt><dd className="type-body text-ink">{fired.join(', ') || 'None'}</dd></div>
        </dl>
      )}
    </Section>
  );
};

const History: React.FC<Pick<RulesAdvancedProps, 'runs' | 'logs' | 'onUndo' | 'onClearLog'>> = ({ runs, logs, onUndo, onClearLog }) => {
  const [undoing, setUndoing] = useState<RuleRunBackup | null>(null);
  const [isClearing, setClearing] = useState(false);
  const [visible, setVisible] = useState(PAGE);

  return (
    <Section
      title="History"
      description="Undo a run, or check what changed."
      actions={logs.length > 0 && <Button variant="ghost" size="sm" onPress={() => setClearing(true)}>Clear log</Button>}
    >
      <ConfirmDialog
        isOpen={!!undoing}
        onClose={() => setUndoing(null)}
        onConfirm={() => { if (undoing) onUndo(undoing); setUndoing(null); }}
        title="Undo this run?"
        message={`This restores ${undoing?.transactions.length ?? 0} transactions to how they were.`}
        confirmLabel="Undo run"
      />
      <ConfirmDialog
        isOpen={isClearing}
        onClose={() => setClearing(false)}
        onConfirm={() => { onClearLog(); setClearing(false); }}
        title="Clear the log?"
        message="Your runs can still be undone."
        confirmLabel="Clear log"
      />
      {runs.length === 0 && logs.length === 0 ? (
        <EmptyState icon="history" title="No runs yet" description="Runs appear here after you apply your rules." />
      ) : (
        <>
          {runs.length > 0 && (
            <ul className="mb-4 divide-y divide-line">
              {runs.map(run => (
                <li key={run.batchId ?? run.timestamp} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="type-body block text-ink">{run.transactions.length} {run.transactions.length === 1 ? 'transaction' : 'transactions'} updated</span>
                    <span className="type-caption block text-muted">{new Date(run.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </span>
                  <Button variant="secondary" size="sm" onPress={() => setUndoing(run)}>Undo</Button>
                </li>
              ))}
            </ul>
          )}
          <ul className="divide-y divide-line">
            {logs.slice(0, visible).map(log => (
              <li key={log.id} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="type-body min-w-0 truncate text-ink">{log.txDescription || 'Transaction'}</span>
                  <span className="flex items-center gap-2">
                    {log.isReverted && <Badge tone="neutral">Undone</Badge>}
                    <span className="type-caption text-muted">{formatCurrency(log.txAmount, 'EUR')}</span>
                  </span>
                </div>
                <p className="type-caption text-muted">{log.ruleName} · {new Date(log.timestamp).toLocaleDateString()}</p>
                <p className="type-caption text-muted">{log.changeDetails}</p>
              </li>
            ))}
          </ul>
          {logs.length > visible && <ShowMore remaining={logs.length - visible} onPress={() => setVisible(count => count + PAGE)} className="mt-3" />}
        </>
      )}
    </Section>
  );
};

const RulesAdvanced: React.FC<RulesAdvancedProps> = ({ rules, transactions, runs, logs, onApply, onUndo, onClearLog }) => (
  <div className="space-y-6">
    <PreviewAndApply rules={rules} transactions={transactions} onApply={onApply} />
    <TryTransaction rules={rules} transactions={transactions} />
    <History runs={runs} logs={logs} onUndo={onUndo} onClearLog={onClearLog} />
  </div>
);

export default RulesAdvanced;
