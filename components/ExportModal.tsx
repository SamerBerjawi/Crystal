import React, { useState } from 'react';
import { Account } from '../types';
import { ExportConfig } from '../utils/dataTransfer';
import { Button } from './ui/Actions';
import { Checkbox, DateInput } from './ui/Fields';
import { SidePanel } from './ui/Overlays';
import { MultiSelect } from './ui/Pickers';
import SegmentedControl from './ui/SegmentedControl';

interface ExportModalProps {
  onClose: () => void;
  onExport: (config: ExportConfig) => void;
  accounts: Account[];
  initialFormat?: 'json' | 'csv';
}

const DATA_TYPES = [
  { id: 'accounts', label: 'Accounts' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'invoices', label: 'Quotes and invoices' },
  { id: 'schedule', label: 'Schedule and bills' },
  { id: 'memberships', label: 'Loyalty cards' },
  { id: 'goals', label: 'Goals and predictions' },
  { id: 'investments', label: 'Investments' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'categories', label: 'Categories' },
  { id: 'tags', label: 'Tags' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'userStats', label: 'Challenge stats' },
];

const ExportModal: React.FC<ExportModalProps> = ({ onClose, onExport, accounts, initialFormat = 'csv' }) => {
  const [isOpen, setOpen] = useState(true);
  const [format, setFormat] = useState<'json' | 'csv'>(initialFormat);
  const [selected, setSelected] = useState<string[]>(DATA_TYPES.map(type => type.id));
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isAll = selected.length === DATA_TYPES.length;
  const toggle = (id: string, isOn: boolean) => setSelected(prev => (isOn ? [...prev, id] : prev.filter(item => item !== id)));

  const close = () => { setOpen(false); onClose(); };
  const submit = () => {
    onExport({
      format,
      dataTypes: selected,
      dateRange: startDate && endDate ? { start: startDate, end: endDate } : undefined,
      accountIds: accountIds.length > 0 ? accountIds : undefined,
    });
    close();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={close}
      title={format === 'json' ? 'Back up data' : 'Export data'}
      footer={
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button icon="download" isDisabled={selected.length === 0} onPress={submit}>
            {format === 'json' ? 'Download backup' : `Export ${selected.length}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="type-label mb-1.5 text-ink">Format</p>
          <SegmentedControl items={[{ id: 'csv', label: 'CSV tables' }, { id: 'json', label: 'JSON backup' }]} activeId={format} onChange={id => setFormat(id as 'json' | 'csv')} />
        </div>

        <div>
          <Checkbox
            isSelected={isAll}
            isIndeterminate={!isAll && selected.length > 0}
            onChange={isOn => setSelected(isOn ? DATA_TYPES.map(type => type.id) : [])}
          >
            <span className="type-body-strong">All data</span>
          </Checkbox>
          <div className="grid gap-x-3 sm:grid-cols-2">
            {DATA_TYPES.map(type => (
              <Checkbox key={type.id} isSelected={selected.includes(type.id)} onChange={isOn => toggle(type.id, isOn)}>{type.label}</Checkbox>
            ))}
          </div>
        </div>

        {selected.includes('transactions') && (
          <div className="grid gap-4 sm:grid-cols-2">
            <DateInput label="Transactions from" value={startDate} onChange={setStartDate} />
            <DateInput label="Transactions to" value={endDate} onChange={setEndDate} />
            <MultiSelect
              label="Accounts"
              className="sm:col-span-2"
              options={accounts.map(account => ({ id: account.id, label: account.name }))}
              value={accountIds}
              onChange={setAccountIds}
              placeholder="All accounts"
            />
          </div>
        )}
      </div>
    </SidePanel>
  );
};

export default ExportModal;
