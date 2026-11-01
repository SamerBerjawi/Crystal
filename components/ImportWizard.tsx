import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Account, AccountType, Category, Currency, Transaction } from '../types';
import { ALL_ACCOUNT_TYPES, CURRENCIES } from '../constants';
import { useIsMobile } from '../hooks/useIsMobile';
import { cn } from '../lib/utils';
import { flattenCategories, safeRound, toLocalISOString } from '../utils';
import {
  calculateMatchScore,
  detectAmountFormat,
  detectDateFormat,
  levenshteinDistance,
  parseCSV,
  parseDate,
  RowFilter,
  rowMatchesFilters,
} from '../utils/importParsing';
import { parseAmount } from '../utils/parseAmount';
import { Button } from './ui/Actions';
import { Checkbox, controlStyles } from './ui/Fields';
import Icon from './ui/Icon';
import { FullPanel } from './ui/Overlays';
import { Combobox, PickerOption, Select } from './ui/Pickers';
import SegmentedControl from './ui/SegmentedControl';
import { Banner } from './ui/States';

// --- Wizard Props ---
interface ImportWizardProps {
    importType: 'transactions' | 'accounts';
    onClose: () => void;
    onPublish: (items: any[], dataType: 'transactions' | 'accounts', fileName: string, originalData: Record<string, any>[], errors: Record<number, Record<string, string>>, newAccounts?: Account[]) => void;
    existingAccounts: Account[];
    allCategories: Category[];
}

// --- Main Wizard Component ---
const ImportWizard: React.FC<ImportWizardProps> = ({ importType, onClose, onPublish, existingAccounts, allCategories }) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [fileName, setFileName] = useState('');
    const [rawCSV, setRawCSV] = useState('');
    const [parsedData, setParsedData] = useState<Record<string, any>[]>([]);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [columnMap, setColumnMap] = useState<Record<string, string>>({});
    const [delimiter, setDelimiter] = useState(',');
    const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
    const [amountConfig, setAmountConfig] = useState('single_signed');
    const [accountSource, setAccountSource] = useState<'column' | 'single'>('column');
    const [selectedSingleAccountId, setSelectedSingleAccountId] = useState<string>(existingAccounts.length > 0 ? existingAccounts[0].id : '');
    const [cleanedData, setCleanedData] = useState<any[]>([]);
    const [dataErrors, setDataErrors] = useState<Record<number, Record<string, string>>>({});
    const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
    const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
    const [accountMap, setAccountMap] = useState<Record<string, string>>({});
    const [accountTypeMap, setAccountTypeMap] = useState<Record<string, string>>({});
    const [currencyMap, setCurrencyMap] = useState<Record<string, string>>({});
    const [isPublishing, setIsPublishing] = useState(false);
    const [isOpen, setOpen] = useState(true);
    const hasParsed = useRef(false);
    const isPhone = useIsMobile();

    const STEPS = [
        { number: 1, name: 'Upload' },
        { number: 2, name: 'Configure' },
        { number: 3, name: 'Preview' },
        { number: 4, name: 'Clean' },
        { number: 5, name: 'Map' },
        { number: 6, name: 'Confirm' },
    ];

    const autoMapColumns = useCallback((headers: string[]): Record<string, string> => {
        const mapping: Record<string, string> = {};
        const availableHeaders = [...headers];
    
        const keywords = importType === 'transactions' ? {
            date: ['date', 'transaction date', 'posting date', 'trans_date', 'tx_date', 'datum', 'fecha', 'data'],
            amount: ['amount', 'amt', 'value', 'sum', 'total', 'betrag', 'importo', 'montant', 'valeur'],
            account: ['account', 'acc', 'acct', 'account name', 'rekening', 'konto', 'compte', 'cuenta'],
            name: ['description', 'desc', 'payee', 'merchant', 'name', 'memo', 'details', 'narration', 'purpose', 'libellé', 'beschreibung', 'descrizione', 'descripción', 'counterparty', 'beneficiary'],
            category: ['category', 'cat', 'grouping', 'classification', 'catégorie', 'kategorie'],
            currency: ['currency', 'curr', 'devise', 'währung'],
            amountIn: ['credit', 'cr', 'in', 'inflow', 'deposit', 'income', 'credit amount', 'crédit', 'haben', 'credito'],
            amountOut: ['debit', 'dr', 'out', 'outflow', 'payment', 'expense', 'withdrawal', 'debit amount', 'débit', 'soll', 'debito'],
        } : {
            name: ['account name', 'name', 'nom du compte'],
            type: ['account type', 'type', 'type de compte', 'subtype'],
            balance: ['balance', 'current balance', 'amount', 'solde', 'saldo'],
            currency: ['currency', 'curr', 'devise', 'währung'],
        };
    
        const fieldPriority = importType === 'transactions' 
            ? ['date', 'amount', 'name', 'amountIn', 'amountOut', 'account', 'category', 'currency']
            : ['name', 'type', 'currency', 'balance'];
    
        for (const field of fieldPriority) {
            if (!keywords[field as keyof typeof keywords]) continue;
    
            let bestMatch = { header: '', score: 0 };
            
            for (const header of availableHeaders) {
                const score = calculateMatchScore(header, keywords[field as keyof typeof keywords]);
                if (score > bestMatch.score) {
                    bestMatch = { header, score };
                }
            }
    
            // Use a threshold to avoid bad matches
            if (bestMatch.header && bestMatch.score > 40) {
                mapping[field] = bestMatch.header;
                const headerIndex = availableHeaders.indexOf(bestMatch.header);
                if (headerIndex > -1) {
                    availableHeaders.splice(headerIndex, 1);
                }
            }
        }
        
        return mapping;
    }, [importType]);

    const handleProcessUpload = useCallback(() => {
        const { headers, data } = parseCSV(rawCSV, delimiter);
        setCsvHeaders(headers);
        setParsedData(data);
        const mapping = autoMapColumns(headers);
        setColumnMap(mapping);
    }, [rawCSV, autoMapColumns, delimiter]);
    
    // Only a new file or delimiter parses again, so manual column choices survive moving between steps.
    useEffect(() => {
        if (rawCSV && hasParsed.current) handleProcessUpload();
    }, [handleProcessUpload, rawCSV]);

    useEffect(() => {
        if (parsedData.length > 0) {
            if (importType === 'transactions') {
                const detectedDate = detectDateFormat(parsedData, columnMap.date);
                const detectedAmount = detectAmountFormat(columnMap);
                setDateFormat(detectedDate);
                setAmountConfig(detectedAmount);
            }
        }
    }, [parsedData, columnMap, importType]);


    const processConfiguredData = () => {
        const errors: Record<number, Record<string, string>> = {};
        const cleaned: any[] = [];
        const CURRENCIES_SET = new Set(CURRENCIES);

        parsedData.forEach((row, index) => {
            const newRow: any = { originalIndex: index };
            let rowHasErrors = false;
            let errorDetails: Record<string, string> = {};

            if (importType === 'transactions') {
                const dateVal = row[columnMap.date];
                if (columnMap.date && dateVal) {
                    const parsed = parseDate(dateVal, dateFormat);
                    if (parsed) {
                        newRow.date = toLocalISOString(parsed);
                    } else {
                        errorDetails.date = `Invalid date: ${dateVal}`;
                        rowHasErrors = true;
                    }
                } else {
                    errorDetails.date = `Date is missing`;
                    rowHasErrors = true;
                }

                if (amountConfig === 'single_signed') {
                    const amountVal = row[columnMap.amount];
                    if (columnMap.amount && amountVal && !isNaN(parseAmount(amountVal))) {
                        newRow.amount = safeRound(parseAmount(amountVal), 2);
                    } else {
                        errorDetails.amount = `Invalid amount: ${amountVal || 'missing'}`;
                        rowHasErrors = true;
                    }
                } else { // double_entry
                    const inVal = row[columnMap.amountIn] || 0;
                    const outVal = row[columnMap.amountOut] || 0;
                    const inNum = parseAmount(inVal);
                    const outNum = parseAmount(outVal);
                    
                    if (isNaN(inNum) || isNaN(outNum)) {
                        errorDetails.amount = `Invalid amounts: In=${inVal}, Out=${outVal}`;
                        rowHasErrors = true;
                    } else {
                        newRow.amount = safeRound(inNum - outNum, 2);
                    }
                }

                if (accountSource === 'single') {
                    newRow.account = selectedSingleAccountId;
                    if (!newRow.account) {
                        errorDetails.account = 'No single account selected for assignment';
                        rowHasErrors = true;
                    }
                } else {
                    const accountVal = row[columnMap.account];
                    if (columnMap.account && accountVal) {
                        newRow.account = accountVal;
                    } else {
                        errorDetails.account = `Account is missing`;
                        rowHasErrors = true;
                    }
                }
                
                ['name', 'category'].forEach(field => {
                    newRow[field] = row[columnMap[field]] || '';
                });

                const currencyVal = row[columnMap.currency];
                if (columnMap.currency && currencyVal) {
                    newRow.currency = currencyVal.toUpperCase();
                } else {
                    if (accountSource === 'single' && selectedSingleAccountId) {
                        const account = existingAccounts.find(a => a.id === selectedSingleAccountId);
                        newRow.currency = account?.currency || 'EUR';
                    } else if (accountSource === 'column' && columnMap.account) {
                        const accountName = row[columnMap.account];
                        const existingAccount = existingAccounts.find(a => a.name.toLowerCase() === accountName?.toLowerCase());
                        newRow.currency = existingAccount ? existingAccount.currency : 'EUR';
                    } else {
                         newRow.currency = 'EUR';
                    }
                }

            } else { // Account import logic
                newRow.name = row[columnMap.name];
                newRow.type = row[columnMap.type];
                newRow.currency = row[columnMap.currency] || 'EUR';
                
                const balanceVal = row[columnMap.balance];
                if (columnMap.balance && balanceVal !== undefined && !isNaN(parseAmount(balanceVal))) {
                    newRow.balance = parseAmount(balanceVal);
                } else {
                    errorDetails.balance = `Invalid balance: ${balanceVal || 'missing'}`;
                    rowHasErrors = true;
                }
                
                if (!newRow.name) {
                    errorDetails.name = 'Account name is missing';
                    rowHasErrors = true;
                }
            }


            if(rowHasErrors) {
                errors[index] = errorDetails;
            } else {
                cleaned.push(newRow);
            }
        });
        
        setDataErrors(errors);
        setCleanedData(cleaned);
        setCategoryMap({});
        setAccountMap({});
        setAccountTypeMap({});
        setCurrencyMap({});
    };
    
    const handleProcessCleaning = () => {
        const validData = cleanedData.filter(row => !excludedRows.has(row.originalIndex));
        
        const findBestMatch = (value: string, options: readonly string[]) => {
            let bestMatch = '';
            let bestScore = 0.5; // Threshold
            for (const option of options) {
                const distance = levenshteinDistance(value.toLowerCase().replace(/\s/g, ''), option.toLowerCase().replace(/\s/g, ''));
                const similarity = 1 - (distance / Math.max(value.length, option.length));
                if (similarity > bestScore) {
                    bestScore = similarity;
                    bestMatch = option;
                }
            }
            return bestMatch;
        };
        
        const uniqueCurrencies = new Set(validData.map(d => d.currency).filter(Boolean));
        const CURRENCIES_SET = new Set(CURRENCIES);
        const unrecognizedCurrencies = Array.from(uniqueCurrencies).filter(c => !CURRENCIES_SET.has(c as Currency));
        
        // FIX: Explicitly type `curr` as string to resolve 'unknown' type errors.
        const initialCurrencyMap = unrecognizedCurrencies.reduce((acc, curr: string) => {
            acc[curr] = findBestMatch(curr, CURRENCIES);
            return acc;
        }, {} as Record<string, string>);
        setCurrencyMap(initialCurrencyMap);

        if (importType === 'transactions') {
            const flatAllCategories = flattenCategories(allCategories);

            const uniqueCategories = new Set(validData.map(d => d.category).filter(Boolean));
            const initialCategoryMap = Array.from(uniqueCategories).reduce((acc, catString) => {
                const cat = (catString as string).trim();
                const existing = flatAllCategories.find(c => c.name.toLowerCase() === cat.toLowerCase());
                acc[cat] = existing ? existing.name : `_CREATE_NEW_:${cat}`;
                return acc;
            }, {} as Record<string, string>);
            setCategoryMap(initialCategoryMap);
            
            if (accountSource === 'column') {
                const uniqueAccounts = new Set(validData.map(d => d.account).filter(Boolean));
                const initialAccountMap = Array.from(uniqueAccounts).reduce((acc, accNameString) => {
                    const accName = accNameString as string;
                    const existing = existingAccounts.find(a => a.name.toLowerCase() === accName.toLowerCase());
                    acc[accName] = existing ? existing.id : `_CREATE_NEW_:${accName}`;
                    return acc;
                }, {} as Record<string, string>);
                setAccountMap(initialAccountMap);
            } else {
                setAccountMap({});
            }
        } else if (importType === 'accounts') {
            const uniqueTypes = new Set(validData.map(d => d.type).filter(Boolean));
            const initialAccountTypeMap = Array.from(uniqueTypes).reduce((acc, typeString) => {
                const typeName = typeString as string;
                acc[typeName] = findBestMatch(typeName, ALL_ACCOUNT_TYPES) || `_UNASSIGNED_`;
                return acc;
            }, {} as Record<string, string>);
            setAccountTypeMap(initialAccountTypeMap);
        }
    };
    
    const goToStep = (step: number) => {
        if (step > currentStep) { // Moving forward
            if (currentStep === 1) {
                if (!rawCSV) return;
                hasParsed.current = true;
                handleProcessUpload();
            }
            if (currentStep === 2) processConfiguredData();
            if (currentStep === 4) handleProcessCleaning();
        }
        setCurrentStep(step);
    };

    const handlePublish = () => {
        const newAccountsToCreate: Account[] = [];
        const newAccountNameMap: Record<string, string> = {};

        // Identify new accounts to be created
        if (importType === 'transactions' && accountSource === 'column') {
            Object.entries(accountMap).forEach(([csvName, mappedValue]) => {
                const val = mappedValue as string;
                if (val.startsWith('_CREATE_NEW_:')) {
                    const newAccountName = val.replace('_CREATE_NEW_:', '');
                    const newId = `new-${uuidv4()}`; // Temp ID, actual ID generated by handler/app
                    newAccountNameMap[csvName] = newId;
                    
                    // Attempt to guess currency from rows that use this account
                    // This is a simple guess, taking the first currency found
                    const sampleRow = cleanedData.find(row => row.account === csvName);
                    const accCurrency = sampleRow?.currency || 'EUR';
                    
                    newAccountsToCreate.push({
                        id: newId,
                        name: newAccountName,
                        type: 'Checking', // Default type
                        balance: 0, // Will be updated by transactions
                        currency: accCurrency,
                        status: 'open'
                    } as Account);
                }
            });
        }

        const dataToPublish = cleanedData
          .filter(row => !excludedRows.has(row.originalIndex))
          .map(row => {
              
              const originalCurrency = row.currency;
              let finalCurrency = originalCurrency;
              if (currencyMap.hasOwnProperty(originalCurrency)) {
                  const mappedValue = currencyMap[originalCurrency];
                  if (mappedValue === '_SKIP_' || !mappedValue) return null;
                  finalCurrency = mappedValue;
              }
              if (!CURRENCIES.includes(finalCurrency as Currency)) return null;

              if (importType === 'transactions') {
                  let accountId;
                  if (accountSource === 'single') {
                      accountId = row.account; // Already contains the ID
                  } else {
                      const accountValue = accountMap[row.account];
                      if (!accountValue || accountValue === '_UNASSIGNED_') return null;
                      
                      if (accountValue.startsWith('_CREATE_NEW_:')) {
                          accountId = newAccountNameMap[row.account]; // Use the temp ID we generated
                      } else {
                          accountId = accountValue;
                      }
                  }
                  
                  if (!accountId) return null;

                  const categoryValue = categoryMap[row.category];
                  let finalCategory = 'Uncategorized';
                  if (categoryValue) {
                      if (categoryValue.startsWith('_CREATE_NEW_:')) {
                          finalCategory = categoryValue.replace('_CREATE_NEW_:', '');
                      } else if (categoryValue !== '_UNASSIGNED_') {
                          finalCategory = categoryValue;
                      }
                  }

                  const newTx: Omit<Transaction, 'id'> = {
                      accountId: accountId,
                      date: row.date,
                      description: row.name || 'Imported Transaction',
                      merchant: row.name,
                      amount: safeRound(row.amount, 2),
                      category: finalCategory,
                      type: row.amount >= 0 ? 'income' : 'expense',
                      currency: finalCurrency as Currency,
                  };
                  return newTx;
              } else { // Accounts
                  const typeValue = accountTypeMap[row.type];
                  if (!typeValue || typeValue === '_UNASSIGNED_') return null;
                  
                  const newAcc: Omit<Account, 'id'> = {
                      name: row.name,
                      type: typeValue as AccountType,
                      balance: row.balance,
                      currency: finalCurrency as Currency,
                  };
                  return newAcc;
              }
          }).filter(Boolean);

        setIsPublishing(true);
        onPublish(dataToPublish as any[], importType, fileName, parsedData, dataErrors, newAccountsToCreate);
        setTimeout(() => onClose(), 2000);
    };

    const close = () => { setOpen(false); onClose(); };

    const renderContent = () => {
        if (isPublishing) return <p className="type-body py-12 text-center text-muted">Importing. You can close this panel.</p>;
        switch (currentStep) {
            case 1: return <StepUpload setRawCSV={setRawCSV} setFileName={setFileName} fileName={fileName} />;
            case 2: return <StepColumns headers={csvHeaders} columnMap={columnMap} setColumnMap={setColumnMap} importType={importType} dateFormat={dateFormat} setDateFormat={setDateFormat} amountConfig={amountConfig} setAmountConfig={setAmountConfig} delimiter={delimiter} setDelimiter={setDelimiter} accountSource={accountSource} setAccountSource={setAccountSource} selectedSingleAccountId={selectedSingleAccountId} setSelectedSingleAccountId={setSelectedSingleAccountId} existingAccounts={existingAccounts} />;
            case 3: return <StepPreview parsedData={parsedData} cleanedData={cleanedData} dataErrors={dataErrors} columnMap={columnMap} importType={importType} />;
            case 4: return <StepClean data={cleanedData} setData={setCleanedData} excludedRows={excludedRows} setExcludedRows={setExcludedRows} isSimple={isPhone} />;
            case 5: return <StepMap importType={importType} categoryMap={categoryMap} setCategoryMap={setCategoryMap} allCategories={allCategories} accountMap={accountMap} setAccountMap={setAccountMap} existingAccounts={existingAccounts} accountTypeMap={accountTypeMap} setAccountTypeMap={setAccountTypeMap} currencyMap={currencyMap} setCurrencyMap={setCurrencyMap} />;
            case 6: return <StepConfirm count={cleanedData.filter(row => !excludedRows.has(row.originalIndex)).length} importType={importType} errorCount={Object.keys(dataErrors).length} />;
            default: return null;
        }
    };

    return (
        <FullPanel
            isOpen={isOpen}
            onClose={close}
            isDirty={!!rawCSV && !isPublishing}
            title={importType === 'transactions' ? 'Import transactions' : 'Import accounts'}
            description={`Step ${currentStep} of ${STEPS.length}: ${STEPS[currentStep - 1].name}`}
            footer={!isPublishing && (
                <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
                    {currentStep > 1 && <Button variant="ghost" onPress={() => goToStep(currentStep - 1)}>Back</Button>}
                    {currentStep < STEPS.length
                        ? <Button isDisabled={currentStep === 1 && !rawCSV} onPress={() => goToStep(currentStep + 1)}>Next</Button>
                        : <Button onPress={handlePublish}>Import</Button>}
                </div>
            )}
        >
            <div className="mx-auto max-w-5xl">
                <ol aria-label="Import steps" className="mb-6 hidden gap-1 md:flex">
                    {STEPS.map(step => {
                        const isDone = currentStep > step.number;
                        const isCurrent = currentStep === step.number;
                        return (
                            <li key={step.number} aria-current={isCurrent ? 'step' : undefined} className="flex-1">
                                <span className={cn('block h-1 rounded-full', isDone || isCurrent ? 'bg-pine' : 'bg-inset')} />
                                <span className={cn('type-caption mt-1.5 block', isCurrent ? 'text-ink' : 'text-muted')}>{step.name}</span>
                            </li>
                        );
                    })}
                </ol>
                {renderContent()}
            </div>
        </FullPanel>
    );
};

// --- Steps ---

const FIELD_LABELS: Record<string, string> = {
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

const StepHeading: React.FC<{ title: string; description: string }> = ({ title, description }) => (
    <div className="mb-5">
        <h2 className="type-card-title text-ink">{title}</h2>
        <p className="type-body mt-1 text-muted">{description}</p>
    </div>
);

const cellStyles = 'whitespace-nowrap px-3 py-2 text-left';
const tableInput = cn(controlStyles, 'h-8 min-w-24 px-2 text-xs');

const StepUpload: React.FC<{ setRawCSV: (csv: string) => void; setFileName: (name: string) => void; fileName: string }> = ({ setRawCSV, setFileName, fileName }) => {
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

const StepColumns: React.FC<{
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

const StepPreview: React.FC<{ parsedData: any[]; cleanedData: any[]; dataErrors: Record<number, Record<string, string>>; columnMap: Record<string, string>; importType: 'accounts' | 'transactions' }> = ({ parsedData, cleanedData, dataErrors, columnMap, importType }) => {
    const headers = importType === 'transactions' ? ['date', 'account', 'name', 'category', 'amount', 'currency'] : ['name', 'type', 'balance', 'currency'];
    const errorCount = Object.keys(dataErrors).length;

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
                            const processedRow = cleanedData.find(row => row.originalIndex === index);
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

const StepClean: React.FC<{ data: any[]; setData: React.Dispatch<React.SetStateAction<any[]>>; excludedRows: Set<number>; setExcludedRows: React.Dispatch<React.SetStateAction<Set<number>>>; isSimple: boolean }> = ({ data, setData, excludedRows, setExcludedRows, isSimple }) => {
    const [filters, setFilters] = useState<Record<string, RowFilter>>({});

    const setFilter = (header: string, type: string, value: string) => setFilters(prev => ({ ...prev, [header]: { type, value } }));
    const rows = useMemo(() => data.filter(row => rowMatchesFilters(row, filters)), [data, filters]);
    const headers = data.length > 0 ? Object.keys(data[0]).filter(key => key !== 'originalIndex') : [];

    const changeCell = (index: number, field: string, value: string) => setData(prev => prev.map(row => (row.originalIndex === index ? { ...row, [field]: value } : row)));
    const toggleSkip = (index: number) => setExcludedRows(prev => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
    });

    // Editing a wide table on a phone isn't practical, so phones only choose what to skip (D-030).
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
                                            <input aria-label={`${FIELD_LABELS[header] ?? header}, row ${row.originalIndex + 2}`} value={row[header] ?? ''} onChange={event => changeCell(row.originalIndex, header, event.target.value)} className={tableInput} />
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

const StepMap: React.FC<{
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

const StepConfirm: React.FC<{ count: number; importType: 'accounts' | 'transactions'; errorCount: number }> = ({ count, importType, errorCount }) => (
    <>
        <StepHeading title="Ready to import" description="You can delete an import of transactions later from History." />
        <p className="type-figure-lg text-ink">{count}</p>
        <p className="type-body text-muted">{importType === 'transactions' ? 'transactions' : 'accounts'} to import{errorCount > 0 ? `, ${errorCount} left out because of problems` : ''}</p>
    </>
);

export default ImportWizard;
