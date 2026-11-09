import { v4 as uuidv4 } from 'uuid';
import { Account, AccountType, Category, Currency, Transaction } from '../types';
import { ALL_ACCOUNT_TYPES, CURRENCIES } from '../constants';
import { flattenCategories, getMainCurrency, safeRound, toLocalISOString } from '../utils';
import {
  calculateMatchScore,
  levenshteinDistance,
  parseDate,
} from './importParsing';
import { parseAmount } from './parseAmount';

export type ImportType = 'transactions' | 'accounts';

export function autoMapImportColumns(headers: string[], importType: ImportType): Record<string, string> {
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

    if (bestMatch.header && bestMatch.score > 40) {
      mapping[field] = bestMatch.header;
      const headerIndex = availableHeaders.indexOf(bestMatch.header);
      if (headerIndex > -1) {
        availableHeaders.splice(headerIndex, 1);
      }
    }
  }

  return mapping;
}

export interface ProcessConfiguredDataParams {
  parsedData: Record<string, any>[];
  columnMap: Record<string, string>;
  importType: ImportType;
  dateFormat: string;
  amountConfig: string;
  accountSource: 'column' | 'single';
  selectedSingleAccountId: string;
  existingAccounts: Account[];
}

export function processConfiguredImportData({
  parsedData,
  columnMap,
  importType,
  dateFormat,
  amountConfig,
  accountSource,
  selectedSingleAccountId,
  existingAccounts,
}: ProcessConfiguredDataParams): {
  cleaned: any[];
  errors: Record<number, Record<string, string>>;
} {
  const errors: Record<number, Record<string, string>> = {};
  const cleaned: any[] = [];

  const existingAccountsById = new Map<string, Account>(existingAccounts.map(a => [a.id, a]));
  const existingAccountsByName = new Map<string, Account>(
    existingAccounts.map(a => [a.name.toLowerCase().trim(), a])
  );
  const singleAccount = selectedSingleAccountId ? existingAccountsById.get(selectedSingleAccountId) : undefined;
  const singleAccountCurrency = singleAccount?.currency || getMainCurrency();

  parsedData.forEach((row, index) => {
    const newRow: any = { originalIndex: index };
    let rowHasErrors = false;
    const errorDetails: Record<string, string> = {};

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
        errorDetails.date = 'Date is missing';
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
      } else {
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
          errorDetails.account = 'Account is missing';
          rowHasErrors = true;
        }
      }

      ['name', 'category'].forEach(field => {
        newRow[field] = row[columnMap[field]] || '';
      });

      const currencyVal = row[columnMap.currency];
      if (columnMap.currency && currencyVal) {
        newRow.currency = currencyVal.toUpperCase();
      } else if (accountSource === 'single' && selectedSingleAccountId) {
        newRow.currency = singleAccountCurrency;
      } else if (accountSource === 'column' && columnMap.account) {
        const accountName = String(row[columnMap.account] || '').toLowerCase().trim();
        const existingAccount = existingAccountsByName.get(accountName);
        newRow.currency = existingAccount ? existingAccount.currency : getMainCurrency();
      } else {
        newRow.currency = getMainCurrency();
      }
    } else {
      newRow.name = row[columnMap.name];
      newRow.type = row[columnMap.type];
      newRow.currency = row[columnMap.currency] || getMainCurrency();

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

    if (rowHasErrors) {
      errors[index] = errorDetails;
    } else {
      cleaned.push(newRow);
    }
  });

  return { cleaned, errors };
}

export function buildInitialImportEntityMaps(params: {
  cleanedData: any[];
  excludedRows: Set<number>;
  importType: ImportType;
  accountSource: 'column' | 'single';
  allCategories: Category[];
  existingAccounts: Account[];
}): {
  currencyMap: Record<string, string>;
  categoryMap: Record<string, string>;
  accountMap: Record<string, string>;
  accountTypeMap: Record<string, string>;
} {
  const { cleanedData, excludedRows, importType, accountSource, allCategories, existingAccounts } = params;
  const validData = cleanedData.filter(row => !excludedRows.has(row.originalIndex));

  const findBestMatch = (value: string, options: readonly string[]) => {
    let bestMatch = '';
    let bestScore = 0.5;
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
  const currenciesSet = new Set(CURRENCIES);
  const unrecognizedCurrencies = Array.from(uniqueCurrencies).filter(c => !currenciesSet.has(c as Currency));

  const currencyMap = unrecognizedCurrencies.reduce((acc, curr: string) => {
    acc[curr] = findBestMatch(curr, CURRENCIES);
    return acc;
  }, {} as Record<string, string>);

  let categoryMap: Record<string, string> = {};
  let accountMap: Record<string, string> = {};
  let accountTypeMap: Record<string, string> = {};

  if (importType === 'transactions') {
    const flatAllCategories = flattenCategories(allCategories);
    const uniqueCategories = new Set(validData.map(d => d.category).filter(Boolean));
    categoryMap = Array.from(uniqueCategories).reduce((acc, catString) => {
      const cat = (catString as string).trim();
      const existing = flatAllCategories.find(c => c.name.toLowerCase() === cat.toLowerCase());
      acc[cat] = existing ? existing.name : `_CREATE_NEW_:${cat}`;
      return acc;
    }, {} as Record<string, string>);

    if (accountSource === 'column') {
      const uniqueAccounts = new Set(validData.map(d => d.account).filter(Boolean));
      accountMap = Array.from(uniqueAccounts).reduce((acc, accNameString) => {
        const accName = accNameString as string;
        const existing = existingAccounts.find(a => a.name.toLowerCase() === accName.toLowerCase());
        acc[accName] = existing ? existing.id : `_CREATE_NEW_:${accName}`;
        return acc;
      }, {} as Record<string, string>);
    }
  } else if (importType === 'accounts') {
    const uniqueTypes = new Set(validData.map(d => d.type).filter(Boolean));
    accountTypeMap = Array.from(uniqueTypes).reduce((acc, typeString) => {
      const typeName = typeString as string;
      acc[typeName] = findBestMatch(typeName, ALL_ACCOUNT_TYPES) || '_UNASSIGNED_';
      return acc;
    }, {} as Record<string, string>);
  }

  return { currencyMap, categoryMap, accountMap, accountTypeMap };
}

export function normalizeCleanedCell(params: {
  field: string;
  value: string;
  dateFormat?: string;
  importType?: ImportType;
}): {
  normalizedValue: any;
  error?: string;
} {
  const { field, value, dateFormat = 'YYYY-MM-DD', importType = 'transactions' } = params;
  const trimmed = String(value ?? '').trim();

  if (field === 'amount' || field === 'balance') {
    if (!trimmed) {
      return { normalizedValue: '', error: `${field === 'amount' ? 'Amount' : 'Balance'} is required` };
    }
    const num = parseAmount(trimmed);
    if (!Number.isFinite(num) || Number.isNaN(num)) {
      return { normalizedValue: trimmed, error: `Invalid number: "${trimmed}"` };
    }
    return { normalizedValue: safeRound(num, 2) };
  }

  if (field === 'date' && importType === 'transactions') {
    if (!trimmed) {
      return { normalizedValue: '', error: 'Date is required' };
    }
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (isoMatch) {
      const d = new Date(`${trimmed}T00:00:00Z`);
      if (!Number.isNaN(d.getTime())) {
        return { normalizedValue: trimmed };
      }
    }
    const parsed = parseDate(trimmed, dateFormat);
    if (parsed && !Number.isNaN(parsed.getTime())) {
      return { normalizedValue: toLocalISOString(parsed) };
    }
    return { normalizedValue: trimmed, error: `Invalid date: "${trimmed}"` };
  }

  if (field === 'name') {
    if (!trimmed) {
      return { normalizedValue: '', error: 'Name is required' };
    }
    return { normalizedValue: trimmed };
  }

  return { normalizedValue: trimmed };
}

export function buildImportPublishPayload(params: {
  importType: ImportType;
  accountSource: 'column' | 'single';
  cleanedData: any[];
  excludedRows: Set<number>;
  accountMap: Record<string, string>;
  categoryMap: Record<string, string>;
  accountTypeMap: Record<string, string>;
  currencyMap: Record<string, string>;
}): {
  dataToPublish: any[];
  newAccountsToCreate: Account[];
} {
  const { importType, accountSource, cleanedData, excludedRows, accountMap, categoryMap, accountTypeMap, currencyMap } = params;
  const newAccountsToCreate: Account[] = [];
  const newAccountNameMap: Record<string, string> = {};

  if (importType === 'transactions' && accountSource === 'column') {
    const sampleRowByAccount = new Map<string, any>();
    for (const row of cleanedData) {
      if (row.account && !sampleRowByAccount.has(row.account)) {
        sampleRowByAccount.set(row.account, row);
      }
    }
    Object.entries(accountMap).forEach(([csvName, mappedValue]) => {
      const val = mappedValue as string;
      if (val.startsWith('_CREATE_NEW_:')) {
        const newAccountName = val.replace('_CREATE_NEW_:', '');
        const newId = `new-${uuidv4()}`;
        newAccountNameMap[csvName] = newId;

        const sampleRow = sampleRowByAccount.get(csvName);
        const accCurrency = sampleRow?.currency || getMainCurrency();

        newAccountsToCreate.push({
          id: newId,
          name: newAccountName,
          type: 'Checking',
          balance: 0,
          currency: accCurrency,
          status: 'open',
        } as Account);
      }
    });
  }

  const dataToPublish = cleanedData
    .filter(row => !excludedRows.has(row.originalIndex))
    .map(row => {
      const originalCurrency = row.currency;
      let finalCurrency = originalCurrency;
      if (Object.prototype.hasOwnProperty.call(currencyMap, originalCurrency)) {
        const mappedValue = currencyMap[originalCurrency];
        if (mappedValue === '_SKIP_' || !mappedValue) return null;
        finalCurrency = mappedValue;
      }
      if (!CURRENCIES.includes(finalCurrency as Currency)) return null;

      if (importType === 'transactions') {
        let accountId: string | undefined;
        if (accountSource === 'single') {
          accountId = row.account;
        } else {
          const accountValue = accountMap[row.account];
          if (!accountValue || accountValue === '_UNASSIGNED_') return null;
          accountId = accountValue.startsWith('_CREATE_NEW_:')
            ? newAccountNameMap[row.account]
            : accountValue;
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

        const numericAmount = typeof row.amount === 'number' ? row.amount : parseAmount(String(row.amount ?? ''));
        if (!Number.isFinite(numericAmount) || Number.isNaN(numericAmount)) return null;
        if (!row.date || typeof row.date !== 'string' || Number.isNaN(new Date(row.date).getTime())) return null;

        const newTx: Omit<Transaction, 'id'> = {
          accountId,
          date: row.date,
          description: row.name || 'Imported Transaction',
          merchant: row.name,
          amount: safeRound(numericAmount, 2),
          category: finalCategory,
          type: numericAmount >= 0 ? 'income' : 'expense',
          currency: finalCurrency as Currency,
        };
        return newTx;
      } else {
        const typeValue = accountTypeMap[row.type];
        if (!typeValue || typeValue === '_UNASSIGNED_') return null;
        const numericBalance = typeof row.balance === 'number' ? row.balance : parseAmount(String(row.balance ?? ''));
        if (!Number.isFinite(numericBalance) || Number.isNaN(numericBalance)) return null;
        if (!row.name || typeof row.name !== 'string' || !row.name.trim()) return null;

        const newAcc: Omit<Account, 'id'> = {
          name: row.name.trim(),
          type: typeValue as AccountType,
          balance: safeRound(numericBalance, 2),
          currency: finalCurrency as Currency,
          status: 'open',
        };
        return newAcc;
      }
    })
    .filter(Boolean);

  return { dataToPublish, newAccountsToCreate };
}
