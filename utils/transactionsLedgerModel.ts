import type { SortDescriptor } from 'react-aria-components';
import type { Account, Category, DisplayTransaction, Transaction, User } from '../types';
import type { LedgerItem } from '../components/LedgerTable';
import { convertToMain, fuzzySearch, parseLocalDate, safeRound } from '../utils';
import { formatTransactionLocation } from './locationFormat';
import { resolveTransferInfo } from './transferDetails';

export interface IndexedDisplayTransaction {
  tx: DisplayTransaction;
  amountEur: number;
  amountAbsEur: number;
  searchText: string;
  merchantText: string;
}

export function buildDisplayTransactions(
  transactions: Transaction[],
  accountMap: Record<string, Account>,
  accounts: Account[],
): DisplayTransaction[] {
  const processedTransferIds = new Set<string>();
  const result: DisplayTransaction[] = [];

  const sortedTransactions = [...transactions].sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : 0));

  const normalizeDescription = (description?: string, isTransfer?: boolean) =>
    (description?.trim() || (isTransfer ? 'transfer' : 'transaction')).toLowerCase();

  const getSpareChangeKey = (accountId: string, date: string, description?: string, isTransfer?: boolean) =>
    `${accountId}|${date}|${normalizeDescription(description, isTransfer)}`;

  const spareChangeByParentId = new Map<string, number>();
  const legacySpareChangeLookup = new Map<string, number[]>();

  const txIdSet = new Set<string>();
  const transferIdSet = new Set<string>();
  sortedTransactions.forEach(t => {
    txIdSet.add(t.id);
    if (t.transferId) transferIdSet.add(t.transferId);
  });

  sortedTransactions.forEach(tx => {
    if (!tx.transferId?.startsWith('spare-') || tx.amount >= 0) return;

    const match = tx.transferId.match(/^spare-(.+)$/);
    const embeddedId = match ? match[1] : null;
    const isBoundToTx = embeddedId ? (txIdSet.has(embeddedId) || transferIdSet.has(embeddedId)) : false;

    if (isBoundToTx && embeddedId) {
      spareChangeByParentId.set(embeddedId, Math.abs(tx.amount));
    } else {
      const baseDescription = tx.description?.replace(/^Spare change (for|from)\s*/i, '').trim();
      const key = getSpareChangeKey(tx.accountId, tx.date, baseDescription, false);
      const currentAmounts = legacySpareChangeLookup.get(key) || [];
      currentAmounts.push(Math.abs(tx.amount));
      legacySpareChangeLookup.set(key, currentAmounts);
    }
  });

  const transferLookup = sortedTransactions.reduce((map, tx) => {
    if (!tx.transferId || tx.transferId.startsWith('spare-')) return map;
    const current = map.get(tx.transferId) || { income: undefined as Transaction | undefined, expense: undefined as Transaction | undefined };
    if (tx.amount >= 0) {
      current.income = tx;
    } else {
      current.expense = tx;
    }
    map.set(tx.transferId, current);
    return map;
  }, new Map<string, { income?: Transaction; expense?: Transaction }>());

  const getSpareChangeForTx = (txId?: string, accountId?: string, date?: string, description?: string, isTransfer?: boolean, txAmount?: number) => {
    if (txId && spareChangeByParentId.has(txId)) {
      return spareChangeByParentId.get(txId);
    }
    if (!accountId || !date) return undefined;

    const key = getSpareChangeKey(accountId, date, description, isTransfer);
    const amounts = legacySpareChangeLookup.get(key);
    if (!amounts || amounts.length === 0) return undefined;

    let bestIndex = 0;
    if (txAmount !== undefined) {
      const absAmt = Math.abs(txAmount);
      const remainder = absAmt % 1;
      const expected = parseFloat((remainder === 0 ? 1.00 : (1.00 - remainder)).toFixed(2));
      const idx = amounts.findIndex(a => Math.abs(a - expected) < 0.005);
      if (idx !== -1) bestIndex = idx;
    }

    const amount = amounts[bestIndex];
    amounts.splice(bestIndex, 1);
    if (amounts.length === 0) legacySpareChangeLookup.delete(key);
    return amount;
  };

  for (const tx of sortedTransactions) {
    if (tx.transferId?.startsWith('spare-')) continue;

    if (tx.transferId) {
      if (processedTransferIds.has(tx.transferId)) continue;

      const pair = transferLookup.get(tx.transferId);
      processedTransferIds.add(tx.transferId);

      if (pair?.expense && pair?.income) {
        const spareChangeAmount = getSpareChangeForTx(
          pair.expense.id || pair.expense.transferId,
          pair.expense.accountId,
          pair.expense.date,
          pair.expense.description,
          true,
          pair.expense.amount,
        );
        const transferInfo = resolveTransferInfo(pair.expense, accounts, pair.income);

        result.push({
          ...pair.expense,
          id: `transfer-${pair.expense.transferId}`,
          originalId: pair.expense.id,
          amount: Math.abs(pair.expense.amount),
          isTransfer: true,
          type: 'expense',
          fromAccountId: pair.expense.accountId,
          toAccountId: pair.income.accountId,
          fromAccountName: accountMap[pair.expense.accountId]?.name,
          toAccountName: accountMap[pair.income.accountId]?.name,
          transferKind: transferInfo?.kind,
          transferLabel: transferInfo?.label,
          merchant: pair.expense.merchant || pair.income.merchant,
          category: 'Transfer',
          description: pair.expense.description || (transferInfo ? transferInfo.label : 'Account Transfer'),
          spareChangeAmount,
          transferExpenseAmount: Math.abs(pair.expense.amount),
          transferExpenseCurrency: pair.expense.currency,
          transferIncomeAmount: Math.abs(pair.income.amount),
          transferIncomeCurrency: pair.income.currency,
        });
      } else {
        const spareChangeAmount = getSpareChangeForTx(tx.id, tx.accountId, tx.date, tx.description, false, tx.amount);
        const transferInfo = tx.transferId ? resolveTransferInfo(tx, accounts) : null;
        result.push({
          ...tx,
          accountName: accountMap[tx.accountId]?.name,
          spareChangeAmount,
          transferKind: transferInfo?.kind,
          transferLabel: transferInfo?.label,
        });
      }
    } else {
      const spareChangeAmount = getSpareChangeForTx(tx.id, tx.accountId, tx.date, tx.description, false, tx.amount);
      result.push({ ...tx, accountName: accountMap[tx.accountId]?.name, spareChangeAmount });
    }
  }
  return result;
}

export function indexDisplayTransactions(displayTransactions: DisplayTransaction[]): IndexedDisplayTransaction[] {
  return displayTransactions.map(tx => {
    const amountEur = convertToMain(tx.amount, tx.currency);
    const amountAbsEur = Math.abs(amountEur);
    const searchText = [
      tx.description,
      tx.category,
      tx.transferLabel,
      tx.accountName,
      tx.fromAccountName,
      tx.toAccountName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const merchantText = (tx.merchant || '').toLowerCase();
    return { tx, amountEur, amountAbsEur, searchText, merchantText };
  });
}

export interface FilterScatterTransactionsParams {
  indexedTransactions: IndexedDisplayTransaction[];
  debouncedSearchTerm: string;
  merchantFilter: string;
  minAmount: string;
  maxAmount: string;
  selectedAccountIds: string[];
  accountMapByName: Record<string, Account>;
  typeFilter: 'all' | 'income' | 'expense' | 'transfer';
  startDate: string;
  endDate: string;
  selectedTagIds: string[];
  selectedCategoryNames: string[];
  parentCategoryByName: Map<string, string>;
  selectedLocations: string[];
  user?: User;
  showBalanceAdjustments: boolean;
  sortBy?: string;
}

export function filterAndSortScatterTransactions({
  indexedTransactions,
  debouncedSearchTerm,
  merchantFilter,
  minAmount,
  maxAmount,
  selectedAccountIds,
  accountMapByName,
  typeFilter,
  startDate,
  endDate,
  selectedTagIds,
  selectedCategoryNames,
  parentCategoryByName,
  selectedLocations,
  user,
  showBalanceAdjustments,
  sortBy,
}: FilterScatterTransactionsParams): DisplayTransaction[] {
  const normalizedSearchTerm = debouncedSearchTerm.trim().toLowerCase();
  const normalizedMerchantFilter = merchantFilter.trim().toLowerCase();
  const min = parseFloat(minAmount);
  const max = parseFloat(maxAmount);
  const hasMin = !isNaN(min);
  const hasMax = !isNaN(max);

  const filteredIndexed = indexedTransactions.filter(({ tx, amountAbsEur, searchText, merchantText }) => {
    const matchAccount = selectedAccountIds.length === 0 ||
      (tx.isTransfer
        ? selectedAccountIds.includes(tx.fromAccountId || accountMapByName[tx.fromAccountName!]?.id) || selectedAccountIds.includes(tx.toAccountId || accountMapByName[tx.toAccountName!]?.id)
        : selectedAccountIds.includes(tx.accountId));

    const matchSearch = !normalizedSearchTerm || fuzzySearch(normalizedSearchTerm, searchText);
    const matchMerchant = !normalizedMerchantFilter || fuzzySearch(normalizedMerchantFilter, merchantText);

    let matchType = true;
    if (typeFilter === 'expense') matchType = !tx.isTransfer && tx.type === 'expense';
    else if (typeFilter === 'income') matchType = !tx.isTransfer && tx.type === 'income';
    else if (typeFilter === 'transfer') matchType = !!tx.isTransfer;

    const txDateIso = tx.date.slice(0, 10);
    const matchStartDate = !startDate || txDateIso >= startDate;
    const matchEndDate = !endDate || txDateIso <= endDate;

    const matchTag = selectedTagIds.length === 0 || (tx.tagIds && tx.tagIds.some(tagId => selectedTagIds.includes(tagId)));
    const matchCategory = selectedCategoryNames.length === 0 || selectedCategoryNames.includes(tx.category) || selectedCategoryNames.includes(parentCategoryByName.get(tx.category) || '');

    const matchMinAmount = !hasMin || amountAbsEur >= min;
    const matchMaxAmount = !hasMax || amountAbsEur <= max;

    const matchLocation = selectedLocations.length === 0 || (() => {
      const loc = formatTransactionLocation(tx, user);
      if (!loc.hasLocation) return false;
      return selectedLocations.includes(loc.city) || selectedLocations.includes(loc.country);
    })();

    const matchBalanceAdjustment = showBalanceAdjustments || !tx.isBalanceAdjustment;

    return matchAccount && matchTag && matchSearch && matchType && matchStartDate && matchEndDate && matchCategory && matchMinAmount && matchMaxAmount && matchMerchant && matchLocation && matchBalanceAdjustment;
  });

  if (sortBy && sortBy !== 'none') {
    filteredIndexed.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc': return a.tx.date < b.tx.date ? -1 : a.tx.date > b.tx.date ? 1 : 0;
        case 'amount-desc': return b.amountAbsEur - a.amountAbsEur;
        case 'amount-asc': return a.amountAbsEur - b.amountAbsEur;
        case 'merchant-asc': return a.merchantText.localeCompare(b.merchantText);
        case 'merchant-desc': return b.merchantText.localeCompare(a.merchantText);
        case 'category-asc': return a.tx.category.localeCompare(b.tx.category);
        case 'category-desc': return b.tx.category.localeCompare(a.tx.category);
        case 'date-desc': default: return b.tx.date < a.tx.date ? -1 : b.tx.date > a.tx.date ? 1 : 0;
      }
    });
  }

  return filteredIndexed.map(({ tx }) => tx);
}

export function sortLedgerTransactions(
  filteredTransactions: DisplayTransaction[],
  sortDescriptor: SortDescriptor,
  accountMap: Record<string, Account>,
  accountMapByName: Record<string, Account>,
  user?: User,
): DisplayTransaction[] {
  if (filteredTransactions.length <= 1) return [...filteredTransactions];

  const col = String(sortDescriptor.column || 'date');
  const isDesc = sortDescriptor.direction === 'descending';

  // Fast path for date (ISO YYYY-MM-DD string comparison): O(1) comparison, 0 allocation
  if (col === 'date') {
    const list = [...filteredTransactions];
    return list.sort((a, b) => {
      const cmp = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      return isDesc ? -cmp : cmp;
    });
  }

  // Fast path for amount: Schwartzian transform precalculates main-currency floats once (O(N) vs O(N log N))
  if (col === 'amount') {
    const mapped = filteredTransactions.map(tx => ({
      tx,
      val: Math.abs(convertToMain(tx.amount, tx.currency)),
    }));
    mapped.sort((a, b) => (isDesc ? b.val - a.val : a.val - b.val));
    return mapped.map(item => item.tx);
  }

  // Precalculated string keys for text columns to avoid repeated object lookups or formatters
  const getKey: (tx: DisplayTransaction) => string = (() => {
    switch (col) {
      case 'description':
        return tx => tx.description || '';
      case 'account':
        return tx => accountMap[tx.accountId]?.name || accountMapByName[tx.accountName || '']?.name || tx.accountName || '';
      case 'category':
        return tx => tx.category || '';
      case 'location':
        return tx => {
          const loc = formatTransactionLocation(tx, user);
          return loc.hasLocation ? loc.city : '';
        };
      default:
        return tx => tx.date || '';
    }
  })();

  const mapped = filteredTransactions.map(tx => ({ tx, key: getKey(tx) }));
  mapped.sort((a, b) => {
    const cmp = a.key.localeCompare(b.key);
    return isDesc ? -cmp : cmp;
  });
  return mapped.map(item => item.tx);
}

export function buildDisplayItemsWithSubs(
  sortedTransactions: DisplayTransaction[],
  expandedParentIds: Set<string>,
  isFilterActive: boolean,
): DisplayTransaction[] {
  const subTxMap = new Map<string, DisplayTransaction[]>();
  const topLevelList: DisplayTransaction[] = [];

  sortedTransactions.forEach(tx => {
    if (tx.parentTransactionId) {
      const list = subTxMap.get(tx.parentTransactionId) || [];
      list.push({ ...tx, isSubTransaction: true });
      subTxMap.set(tx.parentTransactionId, list);
    } else {
      topLevelList.push(tx);
    }
  });

  const result: DisplayTransaction[] = [];
  topLevelList.forEach(tx => {
    const subTxs = subTxMap.get(tx.id) || [];
    result.push({
      ...tx,
      subItemCount: subTxs.length,
      isExpanded: expandedParentIds.has(tx.id),
    });

    const shouldExpand = expandedParentIds.has(tx.id) || isFilterActive;
    if (shouldExpand && subTxs.length > 0) {
      subTxs.forEach(sub => result.push(sub));
    }
  });

  return result;
}

export function formatLedgerDateHeader(dateString: string): string {
  if (!dateString) return 'No Date';
  const date = parseLocalDate(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (isToday) return `Today • ${weekday}, ${formattedDate}`;
  if (isYesterday) return `Yesterday • ${weekday}, ${formattedDate}`;
  return `${weekday}, ${formattedDate}`;
}

export function buildLedgerTableRenderItems(
  paginatedItems: DisplayTransaction[],
  selectedAccountIds: string[],
  resolveTransferDisplay: (tx: DisplayTransaction) => { amount: number; currency: DisplayTransaction['currency'] },
): LedgerItem[] {
  const items: LedgerItem[] = [];
  let currentDate = '';
  let currentGroupTxs: DisplayTransaction[] = [];

  const flushGroup = () => {
    if (currentDate && currentGroupTxs.length > 0) {
      let totalEur = 0;
      const groupTxIds: string[] = [];
      currentGroupTxs.forEach(t => {
        groupTxIds.push(t.id);
        if (t.isSubTransaction) return;
        if (t.isTransfer) {
          const fromSelected = selectedAccountIds.includes(t.fromAccountId || '');
          const toSelected = selectedAccountIds.includes(t.toAccountId || '');
          if (selectedAccountIds.length === 0 || (fromSelected && toSelected)) return;
        }
        const resolved = resolveTransferDisplay(t);
        totalEur += convertToMain(resolved.amount, resolved.currency);
      });

      items.push({
        isGroupHeader: true,
        id: `group-hdr-${currentDate}`,
        date: currentDate,
        formattedDate: formatLedgerDateHeader(currentDate),
        count: currentGroupTxs.length,
        totalEur,
        groupTxIds,
      });

      currentGroupTxs.forEach(t => {
        items.push({
          isGroupHeader: false,
          id: t.id,
          tx: t,
        });
      });
    }
  };

  paginatedItems.forEach(tx => {
    const d = tx.date || 'No Date';
    if (d !== currentDate) {
      flushGroup();
      currentDate = d;
      currentGroupTxs = [tx];
    } else {
      currentGroupTxs.push(tx);
    }
  });
  flushGroup();

  return items;
}

export function computeLedgerSummaryTotals(filteredTransactions: DisplayTransaction[]): {
  totalIncome: number;
  totalExpense: number;
  netFlow: number;
  topCategories: [string, number][];
} {
  let income = 0;
  let expense = 0;
  const categoryTotals = new Map<string, number>();

  filteredTransactions.forEach(tx => {
    if (tx.isTransfer) return;
    const amount = convertToMain(tx.amount, tx.currency);
    if (!tx.isSplitParent && !tx.isCombinedParent) {
      if (tx.type === 'income') income += amount;
      else expense += Math.abs(amount);
    }
    if (tx.type === 'expense') {
      const cat = tx.category || 'Uncategorised';
      categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + Math.abs(amount));
    }
  });

  const topCategories = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return {
    totalIncome: safeRound(income, 2),
    totalExpense: safeRound(expense, 2),
    netFlow: safeRound(income - expense, 2),
    topCategories,
  };
}

export function buildCategoryColorMap(allCategories: Category[]): Record<string, string> {
  const colors: Record<string, string> = {};
  const add = (categories: Category[], inherited?: string) =>
    categories.forEach(category => {
      const color = category.color || inherited;
      if (color) colors[category.name] = color;
      add(category.subCategories ?? [], color);
    });
  add(allCategories);
  return colors;
}
