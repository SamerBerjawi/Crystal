import React, { useRef, useState } from 'react';
import { FinancialData } from '../types';
import { RestoreStrategy } from '../utils/dataTransfer';
import { validateBackup } from '../utils/validateBackup';
import { Button } from './ui/Actions';
import { Checkbox } from './ui/Fields';
import { SidePanel } from './ui/Overlays';
import { SmoothTab, type SwipeTabItem } from './ui/smooth-tab';
import { Banner } from './ui/States';

const RESTORE_STRATEGY_TABS: SwipeTabItem[] = [
  { id: 'merge', title: 'Merge' },
  { id: 'replace', title: 'Replace' },
];

interface SmartRestoreModalProps {
  onClose: () => void;
  onRestore: (data: FinancialData, strategy: Record<string, RestoreStrategy>) => void;
  currentData: FinancialData;
}

type SectionKey = keyof FinancialData;

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'userProfile', label: 'Profile' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'invoices', label: 'Quotes and invoices' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'financialGoals', label: 'Goals' },
  { key: 'predictions', label: 'Predictions' },
  { key: 'recurringTransactions', label: 'Recurring items' },
  { key: 'recurringTransactionOverrides', label: 'Schedule changes' },
  { key: 'billsAndPayments', label: 'Bills' },
  { key: 'memberships', label: 'Loyalty cards' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'investmentTransactions', label: 'Investment trades' },
  { key: 'warrants', label: 'Warrants and grants' },
  { key: 'manualWarrantPrices', label: 'Manual prices' },
  { key: 'priceHistory', label: 'Price history' },
  { key: 'loanPaymentOverrides', label: 'Loan changes' },
  { key: 'tags', label: 'Tags' },
  { key: 'incomeCategories', label: 'Income categories' },
  { key: 'expenseCategories', label: 'Expense categories' },
  { key: 'userStats', label: 'Challenge stats' },
  { key: 'preferences', label: 'Preferences' },
];

/** These hold settings, not lists, so there's nothing to merge item by item. */
const SINGLE_RECORD_SECTIONS: SectionKey[] = ['preferences', 'manualWarrantPrices', 'priceHistory', 'loanPaymentOverrides', 'userStats', 'userProfile'];

const countItems = (value: unknown) => {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return 0;
};

const SmartRestoreModal: React.FC<SmartRestoreModalProps> = ({ onClose, onRestore }) => {
  const [isOpen, setOpen] = useState(true);
  const [fileName, setFileName] = useState('');
  const [backup, setBackup] = useState<FinancialData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [strategies, setStrategies] = useState<Record<string, RestoreStrategy>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  const sections = backup ? SECTIONS.filter(section => countItems(backup[section.key]) > 0) : [];

  const loadBackup = (json: FinancialData) => {
    const found = SECTIONS.filter(section => countItems(json[section.key]) > 0);
    setBackup(json);
    setIncluded(Object.fromEntries(found.map(section => [section.key, true])));
    setStrategies(Object.fromEntries(found.map(section => [section.key, 'replace' as RestoreStrategy])));
    setError(null);
  };

  const readFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = loaded => {
      try {
        const json = JSON.parse(loaded.target?.result as string);
        if (!json || typeof json !== 'object') throw new Error('Not an object');
        const problems = validateBackup(json);
        if (problems.length > 0) {
          setBackup(null);
          setError(`This backup can’t be restored: ${problems.join('; ')}`);
          return;
        }
        loadBackup(json);
      } catch {
        setBackup(null);
        setError('This file isn’t a Crystal backup.');
      }
    };
    reader.readAsText(file);
  };

  const setAll = (strategy: RestoreStrategy) => {
    setIncluded(Object.fromEntries(sections.map(section => [section.key, true])));
    setStrategies(Object.fromEntries(sections.map(section => [section.key, SINGLE_RECORD_SECTIONS.includes(section.key) ? 'replace' : strategy])));
  };

  const close = () => { setOpen(false); onClose(); };
  const restore = () => {
    if (!backup) return;
    const chosen = sections.filter(section => included[section.key]);
    onRestore(
      Object.fromEntries(chosen.map(section => [section.key, backup[section.key]])) as unknown as FinancialData,
      Object.fromEntries(chosen.map(section => [section.key, strategies[section.key]])),
    );
    close();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={close}
      width={640}
      title="Restore a backup"
      description={backup ? fileName : 'Choose a .json file exported from Crystal.'}
      footer={
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button isDisabled={!backup || !sections.some(section => included[section.key])} onPress={restore}>Restore</Button>
        </div>
      }
    >
      <input ref={fileInput} type="file" accept=".json" aria-label="Backup file" className="sr-only" tabIndex={-1} onChange={readFile} />
      <div className="space-y-4">
        {error && <Banner tone="error">{error}</Banner>}
        {!backup ? (
          <Button variant="secondary" icon="upload_file" onPress={() => fileInput.current?.click()}>Choose file</Button>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onPress={() => setAll('merge')}>Merge all</Button>
              <Button variant="secondary" size="sm" onPress={() => setAll('replace')}>Replace all</Button>
              <Button variant="ghost" size="sm" className="ml-auto" onPress={() => fileInput.current?.click()}>Choose another file</Button>
            </div>
            <p className="type-caption text-muted">Merge keeps what’s here and adds what’s new. Replace removes what’s here first.</p>
            <ul className="divide-y divide-line border-y border-line">
              {sections.map(section => {
                const isIncluded = !!included[section.key];
                const isSingle = SINGLE_RECORD_SECTIONS.includes(section.key);
                return (
                  <li key={section.key} className="flex min-h-14 flex-wrap items-center justify-between gap-2 py-1.5">
                    <Checkbox isSelected={isIncluded} onChange={isOn => setIncluded(prev => ({ ...prev, [section.key]: isOn }))}>
                      <span className="type-body text-ink">{section.label}</span>
                      <span className="type-caption ml-2 text-muted">{countItems(backup[section.key])}</span>
                    </Checkbox>
                    {isIncluded && (isSingle ? (
                      <span className="type-caption text-muted">Replaces what’s here</span>
                    ) : (
                      <SmoothTab
                        items={RESTORE_STRATEGY_TABS}
                        value={strategies[section.key]}
                        onChange={id => setStrategies(prev => ({ ...prev, [section.key]: id as RestoreStrategy }))}
                        label={`Restore strategy for ${section.label}`}
                      />
                    ))}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </SidePanel>
  );
};

export default SmartRestoreModal;
