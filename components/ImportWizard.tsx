// This is a new file: components/ImportWizard.tsx
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Account, Category, Transaction, Currency, AccountType } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_WRAPPER_STYLE, SELECT_ARROW_STYLE, CURRENCIES, ALL_ACCOUNT_TYPES } from '../constants';
import { flattenCategories } from '../utils';


// --- Helper Functions ---

// Helper function for fuzzy matching (Levenshtein distance)
const levenshteinDistance = (s1: string, s2: string): number => {
    const track = Array(s2.length + 1).fill(null).map(() =>
        Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) {
        track[0][i] = i;
    }
    for (let j = 0; j <= s2.length; j += 1) {
        track[j][0] = j;
    }
    for (let j = 1; j <= s2.length; j += 1) {
        for (let i = 1; i <= s1.length; i += 1) {
            const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j][i - 1] + 1, // deletion
                track[j - 1][i] + 1, // insertion
                track[j - 1][i - 1] + indicator, // substitution
            );
        }
    }
    return track[s2.length][s1.length];
};

const calculateMatchScore = (header: string, keywords: string[]): number => {
    let maxScore = 0;
    const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normalizedHeader) return 0;

    for (const keyword of keywords) {
        let currentScore = 0;
        const normalizedKeyword = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!normalizedKeyword) continue;

        // 1. Exact match = 100
        if (normalizedHeader === normalizedKeyword) {
            currentScore = 100;
        } 
        // 2. Contains match = 70-90
        else if (normalizedHeader.includes(normalizedKeyword)) {
            const lengthRatio = normalizedKeyword.length / normalizedHeader.length;
            currentScore = 70 + (20 * lengthRatio);
        }
        // 3. Levenshtein distance = up to 70
        else {
            const distance = levenshteinDistance(normalizedHeader, normalizedKeyword);
            const similarity = 1 - (distance / Math.max(normalizedHeader.length, normalizedKeyword.length));
            if (similarity > 0.6) { // Only consider if reasonably similar
                currentScore = similarity * 70;
            }
        }
        
        if (currentScore > maxScore) {
            maxScore = currentScore;
        }
    }
    return maxScore;
};


const parseCSV = (csvText: string, delimiter: string): { headers: string[], data: Record<string, any>[] } => {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 1) return { headers: [], data: [] };

    const headers = lines.shift()!.split(delimiter).map(h => h.trim().replace(/"/g, ''));
    const data: Record<string, any>[] = [];

    const escapedDelimiter = delimiter.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const valueRegex = new RegExp(`(".*?"|[^"${escapedDelimiter}]+)(?=\\s*${escapedDelimiter}|\\s*$)`, 'g');


    lines.forEach(line => {
        // Guard against empty lines
        if (!line.trim()) return;

        const values = line.match(valueRegex) || [];
        if (values.length > 0) {
            const obj = headers.reduce((acc, header, index) => {
                let value = (values[index] || '').trim();
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1).replace(/""/g, '"');
                }
                acc[header] = value;
                return acc;
            }, {} as Record<string, any>);
            data.push(obj);
        }
    });
    return { headers, data };
};

const parseDate = (dateStr: string, format: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.match(/(\d+)/g);
    if (!parts || parts.length < 3) return new Date(dateStr); // Fallback
    
    const [p1, p2, p3] = parts.map(Number);
    
    try {
        let year, month, day;
        switch(format) {
            case 'YYYY-MM-DD': [year, month, day] = [p1, p2, p3]; break;
            case 'MM/DD/YYYY': [month, day, year] = [p1, p2, p3]; break;
            case 'DD/MM/YYYY': [day, month, year] = [p1, p2, p3]; break;
            default: return new Date(dateStr);
        }
        
        if (String(year).length === 2) {
            year += 2000;
        }

        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
            return date;
        }
        return null;
    } catch (e) {
        return null;
    }
}

const detectDateFormat = (data: Record<string, any>[], dateColumn: string): string => {
    if (!dateColumn || data.length === 0) return 'YYYY-MM-DD';

    const samples = data.map(row => row[dateColumn]).filter(Boolean).slice(0, 20);
    if (samples.length === 0) return 'YYYY-MM-DD';

    const scores = { 'YYYY-MM-DD': 0, 'MM/DD/YYYY': 0, 'DD/MM/YYYY': 0 };
    let isLikelyDMY = false;
    let isLikelyMDY = false;

    const formats = [
        { name: 'YYYY-MM-DD', regex: /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/ },
        { name: 'slashed', regex: /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/ },
    ];

    samples.forEach(sample => {
        if (formats[0].regex.test(sample)) {
            scores['YYYY-MM-DD']++;
        } else if (formats[1].regex.test(sample)) {
            const parts = sample.split(/[-/]/).map(Number);
            if (parts.length === 3) {
                const [p1, p2] = parts;
                if (p1 > 12) isLikelyDMY = true;
                if (p2 > 12) isLikelyMDY = true;
                if (p1 >= 1 && p1 <= 12) scores['MM/DD/YYYY']++;
                if (p2 >= 1 && p2 <= 12) scores['DD/MM/YYYY']++;
            }
        }
    });

    if (isLikelyDMY && !isLikelyMDY) return 'DD/MM/YYYY';
    if (isLikelyMDY && !isLikelyDMY) return 'MM/DD/YYYY';

    const maxScore = Math.max(scores['YYYY-MM-DD'], scores['MM/DD/YYYY'], scores['DD/MM/YYYY']);
    const bestFormats = Object.keys(scores).filter(key => scores[key as keyof typeof scores] === maxScore);

    if (bestFormats.length === 1) return bestFormats[0];
    if (bestFormats.includes('YYYY-MM-DD')) return 'YYYY-MM-DD';
    if (bestFormats.includes('MM/DD/YYYY')) return 'MM/DD/YYYY';
    
    return 'DD/MM/YYYY'; // Common default
};

const detectAmountFormat = (mapping: Record<string, string>): string => {
    if (mapping.amountIn && mapping.amountOut) {
        return 'double_entry';
    }
    return 'single_signed';
};

// --- Wizard Props ---
interface ImportWizardProps {
    importType: 'transactions' | 'accounts';
    onClose: () => void;
    onPublish: (items: any[], dataType: 'transactions' | 'accounts', fileName: string, originalData: Record<string, any>[], errors: Record<number, Record<string, string>>) => void;
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
            ? ['date', 'amount', 'amountIn', 'amountOut', 'name', 'account', 'category', 'currency']
            : ['name', 'balance', 'type', 'currency'];
    
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
    
    useEffect(() => {
        if (rawCSV && currentStep >= 2) {
            handleProcessUpload();
        }
    }, [handleProcessUpload, rawCSV, currentStep]);

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
                        newRow.date = parsed.toISOString().split('T')[0];
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
                    if (columnMap.amount && amountVal && !isNaN(parseFloat(amountVal))) {
                        newRow.amount = parseFloat(amountVal);
                    } else {
                        errorDetails.amount = `Invalid amount: ${amountVal || 'missing'}`;
                        rowHasErrors = true;
                    }
                } else { // double_entry
                    const inVal = row[columnMap.amountIn] || 0;
                    const outVal = row[columnMap.amountOut] || 0;
                    const inNum = parseFloat(String(inVal).replace(/,/g, ''));
                    const outNum = parseFloat(String(outVal).replace(/,/g, ''));
                    
                    if (isNaN(inNum) || isNaN(outNum)) {
                        errorDetails.amount = `Invalid amounts: In=${inVal}, Out=${outVal}`;
                        rowHasErrors = true;
                    } else {
                        newRow.amount = inNum - outNum;
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
                if (columnMap.balance && balanceVal !== undefined && !isNaN(parseFloat(balanceVal))) {
                    newRow.balance = parseFloat(balanceVal);
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
                handleProcessUpload();
            }
            if (currentStep === 2) processConfiguredData();
            if (currentStep === 4) handleProcessCleaning();
        }
        setCurrentStep(step);
    };

    const handlePublish = () => {
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
                      accountId = accountValue.startsWith('_CREATE_NEW_:') ? `new-${row.account}` : accountValue;
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
                      amount: row.amount,
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
        onPublish(dataToPublish as any[], importType, fileName, parsedData, dataErrors);
        setTimeout(() => onClose(), 2000);
    };

    const renderContent = () => {
        if (isPublishing) return <StepPublishing />;
        switch (currentStep) {
            case 1: return <Step1Upload setRawCSV={setRawCSV} setFileName={setFileName} fileName={fileName} />;
            case 2: return <Step2Configure headers={csvHeaders} columnMap={columnMap} setColumnMap={setColumnMap} importType={importType} dateFormat={dateFormat} setDateFormat={setDateFormat} amountConfig={amountConfig} setAmountConfig={setAmountConfig} delimiter={delimiter} setDelimiter={setDelimiter} accountSource={accountSource} setAccountSource={setAccountSource} selectedSingleAccountId={selectedSingleAccountId} setSelectedSingleAccountId={setSelectedSingleAccountId} existingAccounts={existingAccounts} />;
            case 3: return <Step3Preview parsedData={parsedData} cleanedData={cleanedData} dataErrors={dataErrors} columnMap={columnMap} importType={importType} />;
            case 4: return <Step4Clean data={cleanedData} setData={setCleanedData} errors={dataErrors} excludedRows={excludedRows} setExcludedRows={setExcludedRows} importType={importType} />;
            case 5: return <Step5Map importType={importType} categories={Object.keys(categoryMap)} setCategoryMap={setCategoryMap} categoryMap={categoryMap} allCategories={allCategories} accounts={Object.keys(accountMap)} setAccountMap={setAccountMap} accountMap={accountMap} existingAccounts={existingAccounts} accountTypes={Object.keys(accountTypeMap)} accountTypeMap={accountTypeMap} setAccountTypeMap={setAccountTypeMap} currencies={Object.keys(currencyMap)} setCurrencyMap={setCurrencyMap} currencyMap={currencyMap} />;
            case 6: return <Step6Confirm data={cleanedData.filter(row => !excludedRows.has(row.originalIndex))} importType={importType} />;
            default: return null;
        }
    };
    
    return (
        <div className="fixed inset-0 bg-light-card dark:bg-dark-bg z-[60] flex flex-col">
            <header className="flex items-center justify-between p-4 border-b border-black/10 dark:border-white/10">
                <button onClick={() => currentStep > 1 ? goToStep(currentStep - 1) : onClose()} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"><span className="material-symbols-outlined">arrow_back</span></button>
                <nav aria-label="Import Steps" className="flex-grow">
                    <ol className="flex items-center justify-center w-full max-w-3xl mx-auto">
                        {STEPS.map((step, index) => {
                            const isCompleted = currentStep > step.number;
                            const isCurrent = currentStep === step.number;
                            return (
                                <li key={step.number} className="flex items-center w-full">
                                    <div className="flex flex-col items-center text-center">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${isCompleted ? 'bg-primary-500 text-white' : isCurrent ? 'bg-primary-100 dark:bg-primary-800/50 border-2 border-primary-500 text-primary-600 dark:text-primary-200' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                                            {isCompleted ? <span className="material-symbols-outlined">check</span> : step.number}
                                        </div>
                                        <p className={`mt-2 text-xs md:text-sm font-semibold w-20 ${isCurrent ? 'text-light-text dark:text-dark-text' : 'text-gray-500'}`}>{step.name}</p>
                                    </div>
                                    {index < STEPS.length - 1 && (
                                        <div className={`flex-auto border-t-2 transition-colors duration-300 ${isCompleted ? 'border-primary-500' : 'border-gray-200 dark:border-gray-700'}`}></div>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                </nav>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"><span className="material-symbols-outlined">close</span></button>
            </header>
            <main className="flex-1 overflow-y-auto bg-light-bg dark:bg-dark-bg p-4 md:p-8">{renderContent()}</main>
            {!isPublishing && <footer className="p-4 border-t border-black/10 dark:border-white/10 flex justify-end">
                {currentStep < 6 ? <button onClick={() => goToStep(currentStep + 1)} className={BTN_PRIMARY_STYLE} disabled={currentStep === 1 && !rawCSV}>Next Step</button> : <button onClick={handlePublish} className={BTN_PRIMARY_STYLE}>Publish Import</button>}
            </footer>}
        </div>
    );
};

// --- Step Components ---
const Step1Upload: React.FC<{ setRawCSV: (csv: string) => void, setFileName: (name: string) => void, fileName: string }> = ({ setRawCSV, setFileName, fileName }) => {
    const [isDragging, setIsDragging] = useState(false);
    const handleFile = (file: File) => { setFileName(file.name); const reader = new FileReader(); reader.onload = (e) => setRawCSV(e.target?.result as string); reader.readAsText(file); };
    const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };
    return (<div className="max-w-2xl mx-auto text-center"><h2 className="text-3xl font-bold mb-2">Import your data</h2><p className="text-light-text-secondary dark:text-dark-text-secondary mb-8">Upload your CSV file below. The next steps will guide you through mapping and cleaning.</p><div onDragOver={(e)=>{e.preventDefault();setIsDragging(true)}} onDragLeave={(e)=>{e.preventDefault();setIsDragging(false)}} onDrop={handleDrop} className={`p-10 border-2 border-dashed rounded-lg transition-colors ${isDragging ? 'border-primary-500 bg-primary-500/10' : 'border-gray-300 dark:border-gray-600'}`}><span className="material-symbols-outlined text-5xl text-gray-400">upload_file</span><p className="mt-2 font-semibold">Drag & drop your CSV file here</p><p className="text-sm text-gray-500">{fileName || "or"}</p><label className={`${BTN_PRIMARY_STYLE} mt-4 inline-block cursor-pointer`}>Browse Files<input type="file" className="hidden" accept=".csv" onChange={(e) => e.target.files && e.target.files[0] && handleFile(e.target.files[0])} /></label></div></div>);
};

const Step2Configure: React.FC<{ headers: string[], columnMap: any, setColumnMap: any, importType: string, dateFormat: string, setDateFormat: any, amountConfig: string, setAmountConfig: any, delimiter: string, setDelimiter: any, accountSource: 'column' | 'single', setAccountSource: (source: 'column' | 'single') => void, selectedSingleAccountId: string, setSelectedSingleAccountId: (id: string) => void, existingAccounts: Account[] }> = ({ headers, columnMap, setColumnMap, importType, dateFormat, setDateFormat, amountConfig, setAmountConfig, delimiter, setDelimiter, accountSource, setAccountSource, selectedSingleAccountId, setSelectedSingleAccountId, existingAccounts }) => {
    
    const fields = useMemo(() => {
        if (importType === 'transactions') {
            const baseRequired = ['date', 'name'];
            if (accountSource === 'column') {
                baseRequired.push('account');
            }
            const baseOptional = ['category', 'currency'];

            if (amountConfig === 'double_entry') {
                return { required: [...baseRequired, 'amountIn', 'amountOut'], optional: baseOptional };
            }
            return { required: [...baseRequired, 'amount'], optional: baseOptional };
        }
        return { required: ['name', 'balance'], optional: ['type', 'currency'] };
    }, [importType, amountConfig, accountSource]);
    
    const handleMappingChange = (field: string, csvHeader: string) => setColumnMap((prev: any) => ({ ...prev, [field]: csvHeader }));
    const allFields = [...fields.required, ...fields.optional];
    const regularFields = allFields.filter(f => !(importType === 'transactions' && f === 'account'));

    return (
        <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-2 text-center">Configure Columns</h2>
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-8 text-center">Match the columns from your CSV to the required fields. We've tried to guess for you.</p>
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-light-card dark:bg-dark-card rounded-lg">
                    {importType === 'transactions' && (
                         <div className="md:col-span-2">
                             <label className="font-semibold mb-2 block">Account Source *</label>
                             <div className="flex bg-light-bg dark:bg-dark-bg p-1 rounded-lg shadow-inner mb-2">
                                 <button type="button" onClick={() => setAccountSource('column')} className={`w-full text-center text-sm font-semibold py-1.5 px-3 rounded-md transition-all ${accountSource === 'column' ? 'bg-light-card dark:bg-dark-card shadow-sm' : 'text-light-text-secondary'}`}>From File Column</button>
                                 <button type="button" onClick={() => setAccountSource('single')} className={`w-full text-center text-sm font-semibold py-1.5 px-3 rounded-md transition-all ${accountSource === 'single' ? 'bg-light-card dark:bg-dark-card shadow-sm' : 'text-light-text-secondary'}`}>Assign Single Account</button>
                             </div>
                             {accountSource === 'column' ? (
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select value={columnMap['account'] || ''} onChange={(e) => handleMappingChange('account', e.target.value)} className={INPUT_BASE_STYLE}><option value="">Select column for Account</option>{headers.map(header => <option key={header} value={header}>{header}</option>)}</select>
                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                             ) : (
                                <div className={SELECT_WRAPPER_STYLE}>
                                    <select value={selectedSingleAccountId} onChange={e => setSelectedSingleAccountId(e.target.value)} className={INPUT_BASE_STYLE}><option value="">Select an account</option>{existingAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}</select>
                                    <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                                </div>
                             )}
                         </div>
                    )}

                    {regularFields.map(field => (
                        <div key={field}>
                            <label className="font-semibold capitalize mb-1 block">{field.replace('amountIn', 'Amount In (Credit)').replace('amountOut', 'Amount Out (Debit)')} {fields.required.includes(field) && '*'}</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select value={columnMap[field] || ''} onChange={(e) => handleMappingChange(field, e.target.value)} className={INPUT_BASE_STYLE}>
                                    <option value="">Select column</option>
                                    {headers.map(header => <option key={header} value={header}>{header}</option>)}
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-light-card dark:bg-dark-card rounded-lg">
                    {importType === 'transactions' && <>
                        <div>
                            <label className="font-semibold mb-1 block">Date Format</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select value={dateFormat} onChange={e => setDateFormat(e.target.value)} className={INPUT_BASE_STYLE}>
                                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                        </div>
                        <div>
                            <label className="font-semibold mb-1 block">Amount Format</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select value={amountConfig} onChange={e => setAmountConfig(e.target.value)} className={INPUT_BASE_STYLE}>
                                    <option value="single_signed">Single column with +/-</option>
                                    <option value="double_entry">Two columns (In/Out)</option>
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                        </div>
                    </>}
                     <div>
                        <label className="font-semibold mb-1 block">Delimiter</label>
                        <div className={SELECT_WRAPPER_STYLE}>
                            <select value={delimiter} onChange={e => setDelimiter(e.target.value)} className={INPUT_BASE_STYLE}>
                                <option value=",">Comma (,)</option>
                                <option value=";">Semicolon (;)</option>
                            </select>
                            <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Step3Preview: React.FC<{ parsedData: any[], cleanedData: any[], dataErrors: any, columnMap: any, importType: 'accounts' | 'transactions' }> = ({ parsedData, cleanedData, dataErrors, columnMap, importType }) => {
    const transactionHeaders = ['date', 'account', 'name', 'category', 'amount', 'currency'];
    const accountHeaders = ['name', 'type', 'balance', 'currency'];
    const previewHeaders = importType === 'transactions' ? transactionHeaders : accountHeaders;
     return (
        <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold mb-2 text-center">Preview Processed Data</h2>
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-8 text-center">
                This is a preview of how your data will be interpreted. Rows with errors are highlighted in red.
                If anything looks wrong, go back to the 'Configure' step to adjust your settings.
            </p>
            <div className="overflow-x-auto bg-light-card dark:bg-dark-card p-4 rounded-lg max-h-[60vh]">
                <table className="w-full text-sm table-auto">
                    <thead>
                        <tr className="border-b border-black/10 dark:border-white/10">
                            <th className="p-2 font-semibold text-left w-12">Row #</th>
                            {previewHeaders.map(header => (
                                <th key={header} className="p-2 font-semibold text-left capitalize">{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {parsedData.map((originalRow, index) => {
                            const errors = dataErrors[index];
                            const processedRow = cleanedData.find(cr => cr.originalIndex === index);

                            return (
                                <tr key={index} className={`border-b border-black/5 dark:border-white/5 last:border-b-0 ${errors ? 'bg-red-500/10' : ''}`}>
                                    <td className="p-2 font-mono text-gray-500">{index + 2}</td>
                                    {previewHeaders.map(field => {
                                        const cellError = errors?.[field];
                                        let cellValue;

                                        if (processedRow) {
                                            cellValue = processedRow[field];
                                        } else { // This is an error row
                                            if (field === 'amount') {
                                                cellValue = originalRow[columnMap.amount] || `${originalRow[columnMap.amountIn] || '?'} / ${originalRow[columnMap.amountOut] || '?'}`;
                                            } else {
                                                cellValue = originalRow[columnMap[field]];
                                            }
                                        }
                                        
                                        return (
                                            <td key={field} className={`p-2 relative group ${cellError ? 'bg-red-500/20' : ''}`}>
                                                {String(cellValue ?? '')}
                                                {cellError && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-dark-bg text-dark-text text-xs rounded py-1 px-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                        {cellError}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const Step4Clean: React.FC<{ data: any[], setData: any, errors: any, excludedRows: any, setExcludedRows: any, importType: 'accounts' | 'transactions' }> = ({ data, setData, errors, excludedRows, setExcludedRows, importType }) => {
    const [filters, setFilters] = useState<Record<string, { type: string, value: string }>>({});
    const [activePopover, setActivePopover] = useState<string | null>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setActivePopover(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleFilterChange = (header: string, type: string, value: string) => {
        setFilters(prev => {
            const newFilters = { ...prev };
            if (value) newFilters[header] = { type, value };
            else delete newFilters[header];
            return newFilters;
        });
    };

    const filteredData = useMemo(() => {
        return data.filter(row => Object.entries(filters).every(([header, filter]: [string, any]) => {
            if (!filter.value) return true;
            const rowValue = row[header];
            if (header === 'date') {
                try {
                    const rowDate = new Date(rowValue);
                    if (isNaN(rowDate.getTime())) return false;
                    const filterDate = new Date(filter.value);
                    switch (filter.type) {
                        case 'exact': return rowDate.toISOString().split('T')[0] === filter.value;
                        case 'before': return rowDate < filterDate;
                        case 'after': return rowDate > filterDate;
                        case 'year': return rowDate.getFullYear() === parseInt(filter.value);
                        case 'month': return (rowDate.getMonth() + 1) === parseInt(filter.value);
                        case 'day': return rowDate.getDate() === parseInt(filter.value);
                        default: return true;
                    }
                } catch { return false; }
            } else if (header === 'amount' || header === 'balance') {
                const rowAmount = parseFloat(rowValue);
                const filterAmount = parseFloat(filter.value);
                if (isNaN(rowAmount) || isNaN(filterAmount)) return true;
                switch (filter.type) {
                    case 'gt': return rowAmount > filterAmount;
                    case 'lt': return rowAmount < filterAmount;
                    case 'eq': return rowAmount === filterAmount;
                    default: return true;
                }
            } else {
                return String(rowValue).toLowerCase().includes(String(filter.value).toLowerCase());
            }
        }));
    }, [data, filters]);

    const handleCellChange = (index: number, field: string, value: string) => setData((prev: any[]) => prev.map(row => row.originalIndex === index ? { ...row, [field]: value } : row));
    const toggleExclude = (index: number) => setExcludedRows((prev: Set<number>) => { const next = new Set(prev); if (next.has(index)) next.delete(index); else next.add(index); return next; });
    const headers = data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'originalIndex') : [];

    const DateFilterPopover: React.FC<{header: string}> = ({header}) => {
        const [type, setType] = useState(filters[header]?.type || 'exact');
        const [value, setValue] = useState(filters[header]?.value || '');
        const apply = () => { handleFilterChange(header, type, value); setActivePopover(null); };
        return (
            <div ref={popoverRef} className="absolute top-full left-0 mt-1 w-64 bg-light-card dark:bg-dark-card p-3 rounded-lg shadow-lg border border-black/10 dark:border-white/10 z-10 space-y-2">
                <select value={type} onChange={e => setType(e.target.value)} className={`${INPUT_BASE_STYLE} text-sm py-1`}><option value="exact">Exact Date</option><option value="before">Before</option><option value="after">After</option><option value="year">Year is</option><option value="month">Month is (1-12)</option><option value="day">Day is (1-31)</option></select>
                <input type={type === 'exact' || type === 'before' || type === 'after' ? 'date' : 'number'} value={value} onChange={e => setValue(e.target.value)} className={`${INPUT_BASE_STYLE} text-sm py-1`} />
                <div className="flex justify-end gap-2"><button onClick={()=>{handleFilterChange(header,'',''); setActivePopover(null)}} className={BTN_SECONDARY_STYLE + " py-1 px-2 text-xs"}>Clear</button><button onClick={apply} className={BTN_PRIMARY_STYLE + " py-1 px-2 text-xs"}>Apply</button></div>
            </div>
        );
    };

    return (<div className="max-w-7xl mx-auto"><h2 className="text-3xl font-bold mb-2 text-center">Review & Clean Data</h2><p className="text-light-text-secondary dark:text-dark-text-secondary mb-8 text-center">Correct any errors and exclude rows you don't want to import.</p><div className="overflow-x-auto bg-light-card dark:bg-dark-card p-4 rounded-lg"><table className="w-full text-sm table-fixed"><thead><tr className="border-b border-black/10 dark:border-white/10"><th className="p-2 font-semibold text-left w-12">Skip</th>{headers.map(h => <th key={h} className="p-2 font-semibold text-left capitalize">{h}</th>)}</tr><tr className="border-b border-black/10 dark:border-white/10"><th className="p-1"></th>{headers.map(h => (<th key={h} className="p-1 align-top font-normal"><div className="relative">{h==='date'?<button onClick={()=>setActivePopover(h)} className={`${INPUT_BASE_STYLE} text-xs py-1 text-left w-full flex justify-between items-center`}><span>{filters[h]?`${filters[h].type}: ${filters[h].value}`:'Filter date...'}</span><span className="material-symbols-outlined text-sm">filter_list</span></button> : (h==='amount' || h === 'balance')?<div className="flex"><select value={filters[h]?.type||'eq'} onChange={e=>handleFilterChange(h, e.target.value, filters[h]?.value||'')} className={`${INPUT_BASE_STYLE} text-xs py-1 rounded-r-none w-1/3`}><option value="eq">=</option><option value="gt">&gt;</option><option value="lt">&lt;</option></select><input type="number" placeholder="Value" value={filters[h]?.value||''} onChange={e=>handleFilterChange(h, filters[h]?.type||'eq', e.target.value)} className={`${INPUT_BASE_STYLE} text-xs py-1 rounded-l-none`}/></div>:<input type="text" placeholder={`Filter ${h}...`} value={filters[h]?.value||''} onChange={e=>handleFilterChange(h, 'contains', e.target.value)} className={`${INPUT_BASE_STYLE} text-xs py-1`}/>}{activePopover === h && h === 'date' && <DateFilterPopover header={h}/>}</div></th>))}</tr></thead><tbody>{filteredData.map(row => (<tr key={row.originalIndex} className={`border-b border-black/5 dark:border-white/5 last:border-b-0 ${excludedRows.has(row.originalIndex) ? 'opacity-40 bg-gray-100 dark:bg-gray-800' : ''}`}><td className="p-2 text-center"><input type="checkbox" checked={excludedRows.has(row.originalIndex)} onChange={() => toggleExclude(row.originalIndex)} className="w-4 h-4 rounded text-primary-500 bg-transparent border-gray-400 focus:ring-primary-500" /></td>{headers.map(header => { const hasError = errors[row.originalIndex]?.[header]; return <td key={header} className="p-0"><input value={row[header]} onChange={e => handleCellChange(row.originalIndex, header, e.target.value)} className={`w-full h-full p-2 bg-transparent focus:outline-none focus:bg-primary-500/10 ${hasError ? 'bg-red-500/20 text-red-800 dark:text-red-200' : ''}`} title={hasError || ''} /></td> })}</tr>))}</tbody></table></div></div>);
};

const RecursiveCategoryOptions: React.FC<{ categories: Category[], level: number }> = ({ categories, level }) => {
    const indent = '\u00A0\u00A0'.repeat(level * 2);
    return (
        <>
            {categories.map(cat => (
                <React.Fragment key={cat.id}>
                    <option value={cat.name}>{indent}{cat.name}</option>
                    {cat.subCategories && cat.subCategories.length > 0 && (
                        <RecursiveCategoryOptions categories={cat.subCategories} level={level + 1} />
                    )}
                </React.Fragment>
            ))}
        </>
    );
};

const CategoryOptionsGroup: React.FC<{ categories: Category[], label: string }> = ({ categories, label }) => (
    <optgroup label={label}>
        <RecursiveCategoryOptions categories={categories} level={0} />
    </optgroup>
);


const Step5Map: React.FC<{
    importType: 'accounts' | 'transactions',
    categories: string[], setCategoryMap: any, categoryMap: any, allCategories: Category[],
    accounts: string[], setAccountMap: any, accountMap: any, existingAccounts: Account[],
    accountTypes: string[], setAccountTypeMap: any, accountTypeMap: any,
    currencies: string[], setCurrencyMap: any, currencyMap: any
}> = ({
    importType,
    categories, setCategoryMap, categoryMap, allCategories,
    accounts, setAccountMap, accountMap, existingAccounts,
    accountTypes, setAccountTypeMap, accountTypeMap,
    currencies, setCurrencyMap, currencyMap
}) => (
    <div className="max-w-3xl mx-auto space-y-8">
        {importType === 'transactions' && categories.length > 0 && <div><h2 className="text-2xl font-bold mb-2 text-center">Map Categories</h2><p className="text-light-text-secondary dark:text-dark-text-secondary mb-4 text-center">Assign imported categories to your existing ones, or create new ones.</p><div className="space-y-2 p-4 bg-light-card dark:bg-dark-card rounded-lg">{categories.map(cat => (<div key={cat} className="grid grid-cols-2 gap-4 items-center p-2 rounded"><p>{cat}</p><div className={SELECT_WRAPPER_STYLE}><select value={categoryMap[cat]} onChange={e => setCategoryMap((p:any) => ({...p, [cat]: e.target.value}))} className={INPUT_BASE_STYLE}><option value="_UNASSIGNED_">Uncategorized (Skip)</option><option value={`_CREATE_NEW_:${cat}`}>Create new category '{cat}'</option><CategoryOptionsGroup categories={allCategories.filter(c => c.classification === 'expense')} label="--- EXPENSES ---" /><CategoryOptionsGroup categories={allCategories.filter(c => c.classification === 'income')} label="--- INCOME ---" /></select><div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div></div></div>))}</div></div>}
        {importType === 'transactions' && accounts.length > 0 && <div><h2 className="text-2xl font-bold mb-2 text-center">Map Accounts</h2><p className="text-light-text-secondary dark:text-dark-text-secondary mb-4 text-center">Assign imported accounts to your existing ones, or create new ones.</p><div className="space-y-2 p-4 bg-light-card dark:bg-dark-card rounded-lg">{accounts.map(acc => (<div key={acc} className="grid grid-cols-2 gap-4 items-center p-2 rounded"><p>{acc}</p><div className={SELECT_WRAPPER_STYLE}><select value={accountMap[acc]} onChange={e => setAccountMap((p:any) => ({...p, [acc]: e.target.value}))} className={INPUT_BASE_STYLE}><option value="_UNASSIGNED_">Unassigned (Skip rows)</option><option value={`_CREATE_NEW_:${acc}`}>Create new account '{acc}'</option>{existingAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select><div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div></div></div>))}</div></div>}
        {importType === 'accounts' && accountTypes.length > 0 && <div><h2 className="text-2xl font-bold mb-2 text-center">Map Account Types</h2><p className="text-light-text-secondary dark:text-dark-text-secondary mb-4 text-center">Match the account types from your file to Finaura's types.</p><div className="space-y-2 p-4 bg-light-card dark:bg-dark-card rounded-lg">{accountTypes.map(type => (<div key={type} className="grid grid-cols-2 gap-4 items-center p-2 rounded"><p>{type}</p><div className={SELECT_WRAPPER_STYLE}><select value={accountTypeMap[type]} onChange={e => setAccountTypeMap((p:any) => ({...p, [type]: e.target.value}))} className={INPUT_BASE_STYLE}><option value="_UNASSIGNED_">Unassigned (Skip)</option>{ALL_ACCOUNT_TYPES.map(a => <option key={a} value={a}>{a}</option>)}</select><div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div></div></div>))}</div></div>}
        {currencies.length > 0 && (
            <div>
                <h2 className="text-2xl font-bold mb-2 text-center">Map Currencies</h2>
                <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4 text-center">
                    Some currency codes in your file were not recognized. Map them to a supported currency or choose to skip those rows.
                </p>
                <div className="space-y-2 p-4 bg-light-card dark:bg-dark-card rounded-lg">
                    {currencies.map(curr => (
                        <div key={curr} className="grid grid-cols-2 gap-4 items-center p-2 rounded">
                            <p className="font-mono bg-light-bg dark:bg-dark-bg px-2 py-1 rounded-md text-center">{curr}</p>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select 
                                    value={currencyMap[curr] || ''} 
                                    onChange={e => setCurrencyMap((p: any) => ({ ...p, [curr]: e.target.value }))} 
                                    className={INPUT_BASE_STYLE}
                                >
                                    <option value="">Select a currency...</option>
                                    <option value="_SKIP_">Skip these rows</option>
                                    <optgroup label="--- Supported Currencies ---">
                                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </optgroup>
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
);

const Step6Confirm: React.FC<{ data: any[], importType: 'accounts' | 'transactions' }> = ({ data, importType }) => (
    <div className="max-w-xl mx-auto text-center"><h2 className="text-3xl font-bold mb-2">Confirm Import</h2><p className="text-light-text-secondary dark:text-dark-text-secondary mb-8">Review the summary before publishing to your account.</p>
        <div className="p-4 bg-light-card dark:bg-dark-card rounded-lg text-left">
            <div className="flex justify-between items-center p-2 border-b border-black/10 dark:border-white/10 font-semibold"><p>Item</p><p>Count</p></div>
            <div className="flex justify-between items-center p-2">
                <p className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary-500">{importType === 'transactions' ? 'receipt_long' : 'wallet'}</span>
                    {importType === 'transactions' ? 'Transactions to Import' : 'Accounts to Import'}
                </p>
                <p className="font-bold text-lg">{data.length}</p>
            </div>
        </div>
    </div>
);

const StepPublishing = () => (
    <div className="flex flex-col items-center justify-center p-8 text-center h-[50vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div><h3 className="text-2xl font-bold">Import in progress...</h3><p className="text-light-text-secondary dark:text-dark-text-secondary mt-2">Your data is being imported. You can close this window.</p></div>
);

export default ImportWizard;