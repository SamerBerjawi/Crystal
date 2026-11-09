import React, { useMemo, useRef, useState } from 'react';
import { Account, Category } from '../../types';
import { ALL_ACCOUNT_TYPES, CURRENCIES } from '../../constants';
import { cn } from '../../lib/utils';
import { flattenCategories, safeRound } from '../../utils';
import { RowFilter, rowMatchesFilters } from '../../utils/importParsing';
import { parseAmount } from '../../utils/parseAmount';
import { Button } from '../ui/Actions';
import { Checkbox, controlStyles } from '../ui/Fields';
import Icon from '../ui/Icon';
import { Combobox, PickerOption, Select } from '../ui/Pickers';
import SegmentedControl from '../ui/SegmentedControl';
import { Banner } from '../ui/States';

export const FIELD_LABELS: Record<string, string> = {
  date: 'Date',
  name: 'Description',
  amount: 'Amount',
  amountIn: 'Money in',
  amountOut: 'Money out',
  category: 'Category',
  currency: 'Currency',
  balance: 'Balance',
  type: 'Type',
  account: 'Account',
};

const NO_COLUMN = '__none';

export const StepHeading: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="mb-5">
    <h2 className="type-card-title text-ink">{title}</h2>
    <p className="type-body mt-1 text-muted">{description}</p>
  </div>
);

const cellStyles = 'whitespace-nowrap px-3 py-2 text-left';
const tableInput = cn(controlStyles, 'h-8 min-w-24 px-2 text-xs');

export const StepUpload: React.FC<{ setRawCSV: (csv: string) => void; setFileName: (name: string) => void; fileName: string }> = ({ setRawCSV, setFileName, fileName }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = event => setRawCSV(event.target?.result as string);
    reader.readAsText(file);
  };
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files?.[0]) handleFile(event.dataTransfer.files[0]);
  };

  return (
    <>
      <StepHeading title="Choose a CSV file" description="Next you’ll match its columns and check the rows." />
      <div
        onDragOver={event => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={event => { event.preventDefault(); setIsDragging(false); }}
        onDrop={handleDrop}
        className={cn('flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed p-10 text-center transition-colors', isDragging ? 'border-primary bg-inset' : 'border-line-strong')}
      >
        <Icon name="upload_file" size={32} className="text-muted" />
        <p className="type-body text-ink">{fileName || 'Drop a file here'}</p>
        <Button variant="secondary" onPress={() => fileInput.current?.click()}>{fileName ? 'Choose another file' : 'Choose file'}</Button>
        <input ref={fileInput} type="file" accept=".csv" aria-label="CSV file" className="sr-only" tabIndex={-1} onChange={event => event.target.files?.[0] && handleFile(event.target.files[0])} />
      </div>
    </>
  );
};

export const StepColumns: React.FC<{
  headers: string[]; columnMap: Record<string, string>; setColumnMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  importType: string; dateFormat: string; setDateFormat: (value: string) => void; amountConfig: string; setAmountConfig: (value: string) => void;
  delimiter: string; setDelimiter: (value: string) => void; accountSource: 'column' | 'single'; setAccountSource: (source: 'column' | 'single') => void;
  selectedSingleAccountId: string; setSelectedSingleAccountId: (id: string) => void; existingAccounts: Account[];
}> = ({ headers, columnMap, setColumnMap, importType, dateFormat, setDateFormat, amountConfig, setAmountConfig, delimiter, setDelimiter, accountSource, setAccountSource, selectedSingleAccountId, setSelectedSingleAccountId, existingAccounts }) => {
  const isTransactions = importType === 'transactions';
  const required = isTransactions ? ['account', 'date', 'name', ...(amountConfig === 'double_entry' ? ['amountIn', 'amountOut'] : ['amount'])] : ['name', 'balance'];
  const optional = isTransactions ? ['category', 'currency'] : ['type', 'currency'];
  const columnOptions = useMemo<PickerOption[]>(() => [{ id: NO_COLUMN, label: 'No column' }, ...headers.map(header => ({ id: header, label: header }))], [headers]);

  const columnSelect = (field: string) => (
    <Select
      key={field}
      label={`${FIELD_LABELS[field]}${required.includes(field) ? '' : ' (optional)'}`}
      options={columnOptions}
      value={columnMap[field] || null}
      onChange={id => setColumnMap(prev => ({ ...prev, [field]: id === NO_COLUMN ? '' : id }))}
      placeholder="Choose a column"
    />
  );

  return (
    <>
      <StepHeading title="Match the columns" description="Crystal has guessed. Change anything that looks wrong." />
      <div className="grid gap-4 md:grid-cols-2">
        {isTransactions && (
          <div className="md:col-span-2">
            <p className="type-label mb-1.5 text-ink">Account</p>
            <SegmentedControl
              className="mb-2"
              items={[{ id: 'column', label: 'From a column' }, { id: 'single', label: 'One account' }]}
              activeId={accountSource}
              onChange={id => setAccountSource(id as 'column' | 'single')}
            />
            {accountSource === 'column'
              ? columnSelect('account')
              : <Select label="Account for every row" options={existingAccounts.map(account => ({ id: account.id, label: account.name }))} value={selectedSingleAccountId || null} onChange={setSelectedSingleAccountId} />}
          </div>
        )}
        {[...required, ...optional].filter(field => field !== 'account').map(columnSelect)}
        {isTransactions && (
          <>
            <Select label="Date format" options={['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY'].map(id => ({ id, label: id }))} value={dateFormat} onChange={setDateFormat} />
            <Select label="Amounts" options={[{ id: 'single_signed', label: 'One column with + and −' }, { id: 'double_entry', label: 'Two columns, in and out' }]} value={amountConfig} onChange={setAmountConfig} />
          </>
        )}
        <Select label="Separator" options={[{ id: ',', label: 'Comma (,)' }, { id: ';', label: 'Semicolon (;)' }]} value={delimiter} onChange={setDelimiter} />
      </div>
    </>
  );
};

export const StepPreview: React.FC<{ parsedData: any[]; cleanedData: any[]; dataErrors: Record<number, Record<string, string>>; columnMap: Record<string, string>; importType: 'accounts' | 'transactions' }> = ({ parsedData, cleanedData, dataErrors, columnMap, importType }) => {
  const headers = importType === 'transactions' ? ['date', 'account', 'name', 'category', 'amount', 'currency'] : ['name', 'type', 'balance', 'currency'];
  const errorCount = Object.keys(dataErrors).length;
  const cleanedByIndex = useMemo(
    () => new Map(cleanedData.map(row => [row.originalIndex, row])),
    [cleanedData]
  );

  return (
    <>
      <StepHeading title="Check the rows" description="If something looks wrong, go back and change the columns." />
      {errorCount > 0 && <Banner tone="attention" className="mb-4">{errorCount} {errorCount === 1 ? 'row has a problem and won’t' : 'rows have problems and won’t'} be imported.</Banner>}
      <div className="max-h-[60vh] overflow-auto rounded-[var(--radius-md)] border border-line">
        <table className="type-caption min-w-full text-ink">
          <thead className="sticky top-0 bg-solid text-muted">
            <tr>
              <th className={cellStyles}>Row</th>
              {headers.map(header => <th key={header} className={cellStyles}>{FIELD_LABELS[header]}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {parsedData.map((originalRow, index) => {
              const errors = dataErrors[index];
              const processedRow = cleanedByIndex.get(index);
              return (
                <tr key={index} className={errors ? 'bg-money-out-soft' : undefined}>
                  <td className={cellStyles}>{index + 2}</td>
                  {headers.map(field => {
                    const value = processedRow
                      ? processedRow[field]
                      : field === 'amount'
                        ? originalRow[columnMap.amount] || `${originalRow[columnMap.amountIn] || '?'} / ${originalRow[columnMap.amountOut] || '?'}`
                        : originalRow[columnMap[field]];
                    return (
                      <td key={field} className={cellStyles}>
                        {String(value ?? '')}
                        {errors?.[field] && <span className="block text-ink">{errors[field]}</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

const DATE_FILTERS = [
  { id: 'exact', label: 'On' },
  { id: 'before', label: 'Before' },
  { id: 'after', label: 'After' },
  { id: 'year', label: 'Year' },
  { id: 'month', label: 'Month' },
  { id: 'day', label: 'Day' },
];

export const StepClean: React.FC<{ data: any[]; setData: React.Dispatch<React.SetStateAction<any[]>>; excludedRows: Set<number>; setExcludedRows: React.Dispatch<React.SetStateAction<Set<number>>>; isSimple: boolean }> = ({ data, setData, excludedRows, setExcludedRows, isSimple }) => {
  const [filters, setFilters] = useState<Record<string, RowFilter>>({});

  const setFilter = (header: string, type: string, value: string) => setFilters(prev => ({ ...prev, [header]: { type, value } }));
  const rows = useMemo(() => data.filter(row => rowMatchesFilters(row, filters)), [data, filters]);
  const headers = data.length > 0 ? Object.keys(data[0]).filter(key => key !== 'originalIndex') : [];

  const changeCell = (index: number, field: string, value: string) => setData(prev => prev.map(row => (row.originalIndex === index ? { ...row, [field]: value } : row)));
  const normalizeNumericCell = (index: number, field: string) => {
    if (field !== 'amount' && field !== 'balance') return;
    setData(prev => prev.map(row => {
      if (row.originalIndex !== index) return row;
      const parsed = typeof row[field] === 'number' ? row[field] : parseAmount(String(row[field] ?? ''));
      return Number.isFinite(parsed) ? { ...row, [field]: safeRound(parsed, 2) } : row;
    }));
  };
  const toggleSkip = (index: number) => setExcludedRows(prev => {
    const next = new Set(prev);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    return next;
  });

  if (isSimple) {
    return (
      <>
        <StepHeading title="Skip what you don’t want" description="To edit rows, use a larger screen." />
        <ul className="divide-y divide-line">
          {rows.map(row => (
            <li key={row.originalIndex}>
              <Checkbox isSelected={excludedRows.has(row.originalIndex)} onChange={() => toggleSkip(row.originalIndex)}>
                <span className="type-body block truncate text-ink">{row.name}</span>
                <span className="type-caption block text-muted">{[row.date, row.amount ?? row.balance, row.currency].filter(value => value !== undefined).join(' · ')}</span>
              </Checkbox>
            </li>
          ))}
        </ul>
      </>
    );
  }

  const filterControl = (header: string) => {
    const current = filters[header];
    if (header === 'date') {
      const type = current?.type || 'exact';
      return (
        <div className="flex gap-1">
          <select aria-label="Date filter" value={type} onChange={event => setFilter(header, event.target.value, current?.value || '')} className={tableInput}>
            {DATE_FILTERS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <input aria-label="Date filter value" type={['exact', 'before', 'after'].includes(type) ? 'date' : 'number'} value={current?.value || ''} onChange={event => setFilter(header, type, event.target.value)} className={tableInput} />
        </div>
      );
    }
    if (header === 'amount' || header === 'balance') {
      const type = current?.type || 'eq';
      return (
        <div className="flex gap-1">
          <select aria-label={`${FIELD_LABELS[header]} filter`} value={type} onChange={event => setFilter(header, event.target.value, current?.value || '')} className={cn(tableInput, 'min-w-12')}>
            <option value="eq">=</option>
            <option value="gt">&gt;</option>
            <option value="lt">&lt;</option>
          </select>
          <input aria-label={`${FIELD_LABELS[header]} filter value`} type="number" value={current?.value || ''} onChange={event => setFilter(header, type, event.target.value)} className={tableInput} />
        </div>
      );
    }
    return <input aria-label={`${FIELD_LABELS[header] ?? header} filter`} placeholder="Filter" value={current?.value || ''} onChange={event => setFilter(header, 'contains', event.target.value)} className={tableInput} />;
  };

  return (
    <>
      <StepHeading title="Clean the rows" description="Fix any cell, and skip rows you don’t want." />
      <div className="max-h-[60vh] overflow-auto rounded-[var(--radius-md)] border border-line">
        <table className="type-caption min-w-full text-ink">
          <thead className="sticky top-0 z-10 bg-solid text-muted">
            <tr>
              <th className={cellStyles}>Skip</th>
              {headers.map(header => <th key={header} className={cellStyles}>{FIELD_LABELS[header] ?? header}</th>)}
            </tr>
            <tr>
              <th aria-hidden="true" />
              {headers.map(header => <th key={header} className="px-3 pb-2 font-normal">{filterControl(header)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(row => {
              const isSkipped = excludedRows.has(row.originalIndex);
              return (
                <tr key={row.originalIndex} className={isSkipped ? 'opacity-50' : undefined}>
                  <td className="px-3 py-1">
                    <Checkbox aria-label={`Skip row ${row.originalIndex + 2}`} isSelected={isSkipped} onChange={() => toggleSkip(row.originalIndex)}>{' '}</Checkbox>
                  </td>
                  {headers.map(header => (
                    <td key={header} className="px-3 py-1">
                      <input aria-label={`${FIELD_LABELS[header] ?? header}, row ${row.originalIndex + 2}`} value={row[header] ?? ''} onChange={event => changeCell(row.originalIndex, header, event.target.value)} onBlur={() => normalizeNumericCell(row.originalIndex, header)} className={tableInput} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

const MapList: React.FC<{ title: string; description: string; keys: string[]; options: (key: string) => PickerOption[]; value: Record<string, string>; onChange: (key: string, value: string) => void; placeholder?: string }> = ({ title, description, keys, options, value, onChange, placeholder }) => (
  <section className="mb-8">
    <StepHeading title={title} description={description} />
    <div className="grid gap-4 md:grid-cols-2">
      {keys.map(key => <Combobox key={key} label={key} options={options(key)} value={value[key] || null} onChange={id => id && onChange(key, id)} placeholder={placeholder} />)}
    </div>
  </section>
);

export const StepMap: React.FC<{
  importType: 'accounts' | 'transactions'; allCategories: Category[]; existingAccounts: Account[];
  categoryMap: Record<string, string>; setCategoryMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  accountMap: Record<string, string>; setAccountMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  accountTypeMap: Record<string, string>; setAccountTypeMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  currencyMap: Record<string, string>; setCurrencyMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}> = ({ importType, allCategories, existingAccounts, categoryMap, setCategoryMap, accountMap, setAccountMap, accountTypeMap, setAccountTypeMap, currencyMap, setCurrencyMap }) => {
  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    return flattenCategories(allCategories)
      .filter(category => !seen.has(category.name) && !!seen.add(category.name))
      .map(category => ({ id: category.name, label: category.name, description: category.classification === 'income' ? 'Income' : 'Expense' }));
  }, [allCategories]);
  const assign = (setter: React.Dispatch<React.SetStateAction<Record<string, string>>>) => (key: string, value: string) => setter(prev => ({ ...prev, [key]: value }));
  const categories = Object.keys(categoryMap);
  const accounts = Object.keys(accountMap);
  const accountTypes = Object.keys(accountTypeMap);
  const currencies = Object.keys(currencyMap);

  if (![categories, accounts, accountTypes, currencies].some(list => list.length > 0)) {
    return <StepHeading title="Nothing to match" description="Everything in this file already fits Crystal." />;
  }

  return (
    <>
      {importType === 'transactions' && categories.length > 0 && (
        <MapList
          title="Match categories"
          description="Use one of yours or create it."
          keys={categories}
          value={categoryMap}
          onChange={assign(setCategoryMap)}
          options={key => [{ id: '_UNASSIGNED_', label: 'Uncategorized' }, { id: `_CREATE_NEW_:${key}`, label: `Create “${key}”` }, ...categoryOptions]}
        />
      )}
      {importType === 'transactions' && accounts.length > 0 && (
        <MapList
          title="Match accounts"
          description="Use one of yours or create it."
          keys={accounts}
          value={accountMap}
          onChange={assign(setAccountMap)}
          options={key => [{ id: '_UNASSIGNED_', label: 'Skip these rows' }, { id: `_CREATE_NEW_:${key}`, label: `Create “${key}”` }, ...existingAccounts.map(account => ({ id: account.id, label: account.name }))]}
        />
      )}
      {importType === 'accounts' && accountTypes.length > 0 && (
        <MapList
          title="Match account types"
          description="Choose Crystal’s type for each one."
          keys={accountTypes}
          value={accountTypeMap}
          onChange={assign(setAccountTypeMap)}
          options={() => [{ id: '_UNASSIGNED_', label: 'Skip these rows' }, ...ALL_ACCOUNT_TYPES.map(type => ({ id: type, label: type }))]}
        />
      )}
      {currencies.length > 0 && (
        <MapList
          title="Match currencies"
          description="Crystal doesn’t recognise these codes. Rows left unmatched are skipped."
          keys={currencies}
          value={currencyMap}
          onChange={assign(setCurrencyMap)}
          placeholder="Choose a currency"
          options={() => [{ id: '_SKIP_', label: 'Skip these rows' }, ...CURRENCIES.map(currency => ({ id: currency, label: currency }))]}
        />
      )}
    </>
  );
};

export const StepConfirm: React.FC<{ count: number; importType: 'accounts' | 'transactions'; errorCount: number }> = ({ count, importType, errorCount }) => (
  <>
    <StepHeading title="Ready to import" description="You can delete an import of transactions later from History." />
    <p className="type-figure-lg text-ink">{count}</p>
    <p className="type-body text-muted">{importType === 'transactions' ? 'transactions' : 'accounts'} to import{errorCount > 0 ? `, ${errorCount} left out because of problems` : ''}</p>
  </>
);
