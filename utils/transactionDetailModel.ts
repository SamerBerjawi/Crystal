import { Budget, Category, Transaction } from '../types';
import { convertToMain, parseLocalDate } from '../utils';

export interface DetailCategoryGroupItem {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  level: number;
  parent?: string;
}

export interface DetailCategoryGroup {
  name: string;
  icon?: string;
  color?: string;
  items: DetailCategoryGroupItem[];
}

export const longFormattedDate = (dateStr: string): string => {
  try {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const fullDate = (date: string): string =>
  parseLocalDate(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

export const nameOf = (tx: Transaction): string =>
  tx.merchant || tx.description || 'Transaction';

export const hasPlace = (tx: Transaction): boolean =>
  Number.isFinite(tx.latitude) && Number.isFinite(tx.longitude);

export const mapsUrl = (tx: Transaction): string =>
  `https://www.google.com/maps/search/?api=1&query=${
    hasPlace(tx)
      ? `${tx.latitude},${tx.longitude}`
      : encodeURIComponent(tx.address || tx.placeName || tx.city || '')
  }`;

export const placeName = (tx: Transaction): string =>
  tx.locationLabel ||
  tx.placeName ||
  tx.city ||
  tx.address?.split(',')[0] ||
  (hasPlace(tx) ? 'Pinned location' : '');

export const buildGroupedCategoriesForDetail = (
  txType: Transaction['type'],
  incomeCategories: Category[],
  expenseCategories: Category[]
): DetailCategoryGroup[] => {
  const isTxIncome = txType === 'income';
  const primaryCats = isTxIncome ? incomeCategories : expenseCategories;
  const secondaryCats = isTxIncome ? expenseCategories : incomeCategories;
  const primaryLabel = isTxIncome ? 'Income' : 'Expenses';
  const secondaryLabel = isTxIncome ? 'Expenses' : 'Income';

  const build = (cats: Category[], defaultKindLabel: string): DetailCategoryGroup[] => {
    const groups: DetailCategoryGroup[] = [];
    const standalone: DetailCategoryGroupItem[] = [];

    cats.forEach(cat => {
      if (cat.subCategories && cat.subCategories.length > 0) {
        const items: DetailCategoryGroupItem[] = [
          {
            id: cat.name,
            label: cat.name,
            icon: cat.icon,
            color: cat.color,
            level: 0,
          },
          ...cat.subCategories.map(sub => ({
            id: sub.name,
            label: sub.name,
            icon: sub.icon || cat.icon,
            color: sub.color || cat.color,
            level: 1,
            parent: cat.name,
          })),
        ];
        groups.push({
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          items,
        });
      } else {
        standalone.push({
          id: cat.name,
          label: cat.name,
          icon: cat.icon,
          color: cat.color,
          level: 0,
        });
      }
    });

    if (standalone.length > 0) {
      groups.push({
        name: defaultKindLabel,
        items: standalone,
      });
    }

    return groups;
  };

  return [...build(primaryCats, primaryLabel), ...build(secondaryCats, secondaryLabel)];
};

export const filterCategoryGroupsForDetail = (
  groupedCategories: DetailCategoryGroup[],
  catSearch: string
): DetailCategoryGroup[] => {
  const q = catSearch.trim().toLowerCase();
  if (!q) return groupedCategories;
  return groupedCategories
    .map(group => {
      const matchesGroup = group.name.toLowerCase().includes(q);
      const filteredItems = group.items.filter(
        item =>
          matchesGroup ||
          item.label.toLowerCase().includes(q) ||
          (item.parent && item.parent.toLowerCase().includes(q))
      );
      return {
        ...group,
        items: filteredItems,
      };
    })
    .filter(group => group.items.length > 0);
};

export const resolveSpareChangeAmount = (
  tx: Transaction,
  allTransactions: Transaction[]
): number => {
  const spareTx = allTransactions.find(
    t =>
      t.transferId === `spare-${tx.id}` ||
      (tx.transferId && t.transferId === `spare-${tx.transferId}`)
  );
  if (spareTx) return Math.abs(spareTx.amount);
  if (
    'spareChangeAmount' in tx &&
    typeof (tx as Record<string, unknown>).spareChangeAmount === 'number'
  ) {
    return Math.abs((tx as Record<string, unknown>).spareChangeAmount as number);
  }
  return 0;
};

export const computeCategoryBudgetInsight = (
  tx: Transaction,
  isTransfer: boolean,
  allTransactions: Transaction[],
  budgets: Budget[]
): { spent: number; limit: number; pct: number } | null => {
  if (tx.type !== 'expense' || isTransfer || !tx.category || tx.category === 'Uncategorized') {
    return null;
  }
  const monthPrefix = tx.date.slice(0, 7);
  const catTxs = allTransactions.filter(
    t =>
      t.category === tx.category &&
      t.type === 'expense' &&
      t.date.startsWith(monthPrefix) &&
      !t.parentTransactionId &&
      !t.transferId
  );
  const spent = catTxs.reduce((sum, t) => sum + Math.abs(convertToMain(t.amount, t.currency)), 0);
  const budget = budgets.find(b => b.categoryName === tx.category);
  const limit = budget && budget.amount > 0 ? budget.amount : Math.max(spent * 1.35, 100);
  const pct = Math.min(100, Math.round((spent / limit) * 100));
  return { spent, limit, pct };
};
