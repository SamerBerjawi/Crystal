import React, { useState } from 'react';
import { Account } from '../types';
import { currencySign, parseLocalDate, round2, toLocalISOString } from '../utils';
import { parseAmountInput } from '../utils/scheduleModel';
import { DetailList } from './AccountFrame';
import { Button, IconButton } from './ui/Actions';
import { AmountInput, DateInput } from './ui/Fields';
import { Amount } from './ui/Money';
import { SidePanel } from './ui/Overlays';

interface PropertyValuationModalProps {
  onClose: () => void;
  onSave: (newValue: number, date: string) => void;
  onDeleteEntry?: (date: string) => void;
  account: Account;
}

const PropertyValuationModal: React.FC<PropertyValuationModalProps> = ({ onClose, onSave, onDeleteEntry, account }) => {
  const [newValue, setNewValue] = useState(String(account.balance));
  const [date, setDate] = useState(toLocalISOString(new Date()));

  const value = parseAmountInput(newValue);
  const isValid = !Number.isNaN(value);
  const change = isValid ? round2(value - account.balance) : 0;
  const percent = account.balance > 0 ? (change / account.balance) * 100 : 0;
  const history = [...(account.priceHistory ?? [])].reverse();

  const save = () => {
    onSave(value, date);
    onClose();
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title="Update value"
      description={account.name}
      isDirty={change !== 0}
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button isDisabled={!isValid} onPress={save}>Save value</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <AmountInput autoFocus label="New value" help="Net worth and equity use this value." currency={currencySign(account.currency)} value={newValue} onChange={setNewValue} />
        <DateInput label="Valued on" value={date} onChange={setDate} isRequired />
        <DetailList items={[
          { label: 'Current value', value: <Amount value={account.balance} currency={account.currency} /> },
          { label: 'Change', value: <><Amount value={change} currency={account.currency} tone="flow" /> ({percent >= 0 ? '+' : '−'}{Math.abs(percent).toFixed(1)}%)</> },
        ]} />
        {history.length > 0 && (
          <section>
            <h3 className="type-card-title mb-1 text-ink">Past values</h3>
            <ul className="divide-y divide-line">
              {history.map(entry => {
                const day = parseLocalDate(entry.date).toLocaleDateString(undefined, { dateStyle: 'medium' });
                return (
                  <li key={entry.date} className="flex items-center gap-1 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="type-body-strong text-ink"><Amount value={entry.price} currency={account.currency} /></p>
                      <p className="type-caption text-muted">{day}</p>
                    </div>
                    <IconButton icon="edit" label={`Load the value from ${day}`} tooltipPlacement="left" onPress={() => { setNewValue(String(entry.price)); setDate(entry.date); }} />
                    {onDeleteEntry && <IconButton icon="delete" label={`Delete the value from ${day}`} tooltipPlacement="left" onPress={() => onDeleteEntry(entry.date)} />}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </SidePanel>
  );
};

export default PropertyValuationModal;
