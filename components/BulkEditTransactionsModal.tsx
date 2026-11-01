import React, { useMemo, useState } from 'react';
import { Transaction, Account, Category, Tag } from '../types';
import { toLocalISOString } from '../utils';
import { applyBulkEdit, BulkField, BulkValues } from '../utils/bulkEdit';
import { categoryPickerOptions } from '../utils/categoryTree';
import AddressAutocomplete from './AddressAutocomplete';
import { Button } from './ui/Actions';
import { Checkbox, DateInput, TextInput } from './ui/Fields';
import { SidePanel } from './ui/Overlays';
import { Combobox, MultiSelect } from './ui/Pickers';

interface BulkEditTransactionsModalProps {
  onClose: () => void;
  onSave: (updatedTransactions: Transaction[], idsToDelete?: string[]) => void;
  transactionsToEdit: Transaction[];
  allTransactions?: Transaction[];
  accounts: Account[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  tags: Tag[];
}

const FieldToggle: React.FC<{ label: string; field: BulkField; chosen: Set<BulkField>; onToggle: (field: BulkField) => void; children: React.ReactNode }> = ({ label, field, chosen, onToggle, children }) => (
  <div className="space-y-2 py-3">
    <Checkbox isSelected={chosen.has(field)} onChange={() => onToggle(field)}>{label}</Checkbox>
    {chosen.has(field) && children}
  </div>
);

const BulkEditTransactionsModal: React.FC<BulkEditTransactionsModalProps> = ({ onClose, onSave, transactionsToEdit, allTransactions = [], accounts, incomeCategories, expenseCategories, tags }) => {
  const [chosen, setChosen] = useState<Set<BulkField>>(new Set());
  const [values, setValues] = useState<BulkValues>({
    date: toLocalISOString(new Date()),
    accountId: accounts[0]?.id ?? '',
    description: '',
    merchant: '',
    category: '',
    tagIds: [],
    locationText: '',
    location: {},
  });

  const update = (change: Partial<BulkValues>) => setValues(prev => ({ ...prev, ...change }));
  const toggle = (field: BulkField) => setChosen(prev => {
    const next = new Set(prev);
    if (!next.delete(field)) next.add(field);
    return next;
  });

  const categoryOptions = useMemo(() => categoryPickerOptions(expenseCategories, incomeCategories), [expenseCategories, incomeCategories]);
  const accountOptions = useMemo(() => accounts.map(account => ({ id: account.id, label: account.name })), [accounts]);
  const tagOptions = useMemo(() => tags.map(tag => ({ id: tag.id, label: tag.name })), [tags]);

  const count = transactionsToEdit.length;
  const isInvalid = chosen.size === 0 || (chosen.has('category') && !values.category) || (chosen.has('accountId') && !values.accountId);

  const save = () => {
    const { updated, idsToDelete } = applyBulkEdit(transactionsToEdit, allTransactions, chosen, values, [...expenseCategories, ...incomeCategories]);
    onSave(updated, idsToDelete);
    onClose();
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={`Edit ${count} ${count === 1 ? 'transaction' : 'transactions'}`}
      description="Only what you tick changes."
      isDirty={chosen.size > 0}
      footer={close => (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="ghost" onPress={close}>Cancel</Button>
          <Button isDisabled={isInvalid} onPress={save}>Save changes</Button>
        </div>
      )}
    >
      <div className="divide-y divide-line">
        <FieldToggle label="Date" field="date" chosen={chosen} onToggle={toggle}>
          <DateInput label="New date" value={values.date} onChange={date => update({ date })} />
        </FieldToggle>
        <FieldToggle label="Account" field="accountId" chosen={chosen} onToggle={toggle}>
          <Combobox label="Move to" options={accountOptions} value={values.accountId || null} onChange={id => update({ accountId: id ?? '' })} placeholder="Search accounts" />
        </FieldToggle>
        <FieldToggle label="Description" field="description" chosen={chosen} onToggle={toggle}>
          <TextInput label="New description" value={values.description} onChange={description => update({ description })} />
        </FieldToggle>
        <FieldToggle label="Merchant" field="merchant" chosen={chosen} onToggle={toggle}>
          <TextInput label="New merchant" value={values.merchant} onChange={merchant => update({ merchant })} />
        </FieldToggle>
        <FieldToggle label="Category" field="category" chosen={chosen} onToggle={toggle}>
          <Combobox
            label="New category"
            help="This also sets income or expense. A transfer becomes an ordinary transaction, and its other side is deleted."
            options={categoryOptions}
            value={values.category || null}
            onChange={id => update({ category: id ?? '' })}
            placeholder="Search categories"
          />
        </FieldToggle>
        <FieldToggle label="Tags" field="tags" chosen={chosen} onToggle={toggle}>
          <MultiSelect label="Replace tags with" options={tagOptions} value={values.tagIds} onChange={tagIds => update({ tagIds })} placeholder="No tags" />
        </FieldToggle>
        <FieldToggle label="Location" field="location" chosen={chosen} onToggle={toggle}>
          <AddressAutocomplete
            value={values.locationText}
            onChange={(text, data) => update({
              locationText: text,
              location: data
                ? { address: data.formattedAddress, placeName: data.placeName, street: data.street, city: data.city, postalCode: data.postalCode, state: data.state, country: data.country, lat: data.lat, lon: data.lon, locationLabel: data.placeName || data.title }
                : text.trim() ? { city: text.trim() } : {},
            })}
            placeholder="Search an address, shop or city"
          />
          <p className="type-caption text-muted">Leave it empty to clear the location.</p>
        </FieldToggle>
      </div>
    </SidePanel>
  );
};

export default BulkEditTransactionsModal;
