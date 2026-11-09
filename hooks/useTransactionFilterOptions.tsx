import React, { useMemo } from 'react';
import type { Account, Category, Tag, Transaction, User } from '../types';
import { getMainCurrency } from '../utils';
import { getMerchantLogoUrl } from '../utils/brandfetch';
import { formatTransactionLocation } from '../utils/locationFormat';
import { EntityGlyph, LogoTile } from '../components/EntityIcon';
import { FilterList, type FilterOption } from '../components/FilterList';
import { AmountInput, DateInput, Radio, RadioGroup } from '../components/ui/Fields';
import Icon from '../components/ui/Icon';
import { useAccountFilterOptions } from './useAccountFilterOptions';

export const TYPE_FILTER_OPTIONS: { label: string; value: 'all' | 'income' | 'expense' | 'transfer' }[] = [
  { label: 'All Types', value: 'all' },
  { label: 'Expenses', value: 'expense' },
  { label: 'Income', value: 'income' },
  { label: 'Transfers', value: 'transfer' },
];

interface UseTransactionFilterOptionsParams {
  accounts: Account[];
  transactions: Transaction[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  tags: Tag[];
  user?: User;
  brandfetchClientId: string;
  effectiveMerchantLogoOverrides: Record<string, string>;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  merchantFilter: string;
  setMerchantFilter: React.Dispatch<React.SetStateAction<string>>;
  selectedAccountIds: string[];
  setSelectedAccountIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedCategoryNames: string[];
  setSelectedCategoryNames: React.Dispatch<React.SetStateAction<string[]>>;
  selectedLocations: string[];
  setSelectedLocations: React.Dispatch<React.SetStateAction<string[]>>;
  selectedTagIds: string[];
  setSelectedTagIds: React.Dispatch<React.SetStateAction<string[]>>;
  typeFilter: 'all' | 'income' | 'expense' | 'transfer';
  setTypeFilter: React.Dispatch<React.SetStateAction<'all' | 'income' | 'expense' | 'transfer'>>;
  minAmount: string;
  setMinAmount: (val: string) => void;
  maxAmount: string;
  setMaxAmount: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
}

export function useTransactionFilterOptions({
  accounts,
  transactions,
  expenseCategories,
  incomeCategories,
  tags,
  user,
  brandfetchClientId,
  effectiveMerchantLogoOverrides,
  searchTerm,
  setSearchTerm,
  merchantFilter,
  setMerchantFilter,
  selectedAccountIds,
  setSelectedAccountIds,
  selectedCategoryNames,
  setSelectedCategoryNames,
  selectedLocations,
  setSelectedLocations,
  selectedTagIds,
  setSelectedTagIds,
  typeFilter,
  setTypeFilter,
  minAmount,
  setMinAmount,
  maxAmount,
  setMaxAmount,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: UseTransactionFilterOptionsParams) {
  const { options: accountFilterOptions, quick: accountQuickFiltersList } = useAccountFilterOptions(accounts);

  const categoryFilterOptionsList: FilterOption[] = useMemo(() => {
    const txCounts = new Map<string, number>();
    transactions.forEach(t => {
      if (t.category) {
        txCounts.set(t.category, (txCounts.get(t.category) ?? 0) + 1);
      }
    });

    const seen = new Set<string>();
    const buildList = (cats: Category[], group: string): FilterOption[] => {
      const res: FilterOption[] = [];
      cats.forEach(c => {
        if (!seen.has(c.name)) {
          seen.add(c.name);
          const count = txCounts.get(c.name);
          res.push({
            id: c.name,
            label: c.name,
            hint: count ? String(count) : undefined,
            color: c.color,
            group,
            level: 0,
            visual: <EntityGlyph icon={c.icon} label={c.name} color={c.color} size={18} />,
          });
        }
        (c.subCategories || []).forEach(sub => {
          if (!seen.has(sub.name)) {
            seen.add(sub.name);
            const count = txCounts.get(sub.name);
            res.push({
              id: sub.name,
              label: sub.name,
              hint: count ? String(count) : undefined,
              color: sub.color || c.color,
              group,
              level: 1,
              visual: <EntityGlyph icon={sub.icon || c.icon} label={sub.name} color={sub.color || c.color} size={18} />,
            });
          }
        });
      });
      return res;
    };

    return [
      ...buildList(expenseCategories, 'Expenses'),
      ...buildList(incomeCategories, 'Income'),
    ];
  }, [transactions, expenseCategories, incomeCategories]);

  const tagFilterOptionsList: FilterOption[] = useMemo(() => {
    const tagCounts = new Map<string, number>();
    transactions.forEach(t => {
      (t.tagIds || []).forEach(id => {
        tagCounts.set(id, (tagCounts.get(id) ?? 0) + 1);
      });
    });
    return tags.map(t => {
      const count = tagCounts.get(t.id);
      return {
        id: t.id,
        label: t.name,
        hint: count ? String(count) : undefined,
        color: t.color,
        visual: <EntityGlyph icon={t.icon} label={t.name} color={t.color} size={18} />,
      };
    });
  }, [tags, transactions]);

  const merchantOptionsList: FilterOption[] = useMemo(() => {
    const merchantCounts = new Map<string, number>();
    transactions.forEach(t => {
      const m = t.merchant?.trim();
      if (m) {
        merchantCounts.set(m, (merchantCounts.get(m) ?? 0) + 1);
      }
    });
    const sorted = [...merchantCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 150);

    return sorted.map(([name, count]) => {
      const logo = getMerchantLogoUrl(name, brandfetchClientId, effectiveMerchantLogoOverrides, {
        fallback: 'lettermark',
        type: 'icon',
        width: 64,
        height: 64,
      });
      return {
        id: name,
        label: name,
        hint: String(count),
        visual: <LogoTile url={logo} label={name} size={26} fallbackIcon="wallet" />,
      };
    });
  }, [transactions, brandfetchClientId, effectiveMerchantLogoOverrides]);

  const locationFilterOptionsList: FilterOption[] = useMemo(() => {
    const counts = new Map<string, { count: number; flag: string }>();
    transactions.forEach(t => {
      const loc = formatTransactionLocation(t, user);
      if (loc.hasLocation && loc.city) {
        const existing = counts.get(loc.city);
        counts.set(loc.city, {
          count: (existing?.count ?? 0) + 1,
          flag: existing?.flag || loc.flag || '',
        });
      }
    });
    return [...counts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([city, { count, flag }]) => ({
        id: city,
        label: city,
        hint: String(count),
        visual: flag ? <span className="text-[17px] leading-none shrink-0 select-none" aria-hidden>{flag}</span> : undefined,
      }));
  }, [transactions, user]);

  const columnFilters = useMemo(() => ({
    description: {
      count: (searchTerm.trim() ? 1 : 0) + (merchantFilter.trim() ? 1 : 0),
      title: 'Details and merchant',
      content: (
        <FilterList
          title="Details and merchant"
          label="Merchants"
          searchPlaceholder="Search merchants"
          headerContent={
            <div className="space-y-1.5 mb-2">
              <label className="text-xs font-medium text-muted block">Description</label>
              <div className="relative">
                <Icon name="search" size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search description"
                  className="h-11 w-full rounded-full border border-line bg-inset pl-10 pr-4 text-sm text-ink outline-none placeholder:text-muted focus:border-primary"
                />
              </div>
              <label className="text-xs font-medium text-muted pt-1 block">Merchant</label>
            </div>
          }
          options={merchantOptionsList}
          selected={merchantFilter ? [merchantFilter] : []}
          onChange={ids => setMerchantFilter(ids[ids.length - 1] || '')}
          maxHeightClass="max-h-60"
        />
      ),
    },
    account: {
      count: selectedAccountIds.length,
      title: 'Accounts',
      content: (
        <FilterList
          title="Accounts"
          label="Accounts"
          searchPlaceholder="Search accounts"
          quick={accountQuickFiltersList}
          options={accountFilterOptions}
          selected={selectedAccountIds}
          onChange={setSelectedAccountIds}
          maxHeightClass="max-h-72"
        />
      ),
    },
    category: {
      count: selectedCategoryNames.length,
      title: 'Categories',
      content: (
        <FilterList
          title="Categories"
          label="Categories"
          searchPlaceholder="Search categories"
          options={categoryFilterOptionsList}
          selected={selectedCategoryNames}
          onChange={setSelectedCategoryNames}
          maxHeightClass="max-h-72"
        />
      ),
    },
    location: {
      count: selectedLocations.length,
      title: 'Locations',
      content: (
        <FilterList
          title="Locations"
          label="Locations"
          searchPlaceholder="Search locations"
          options={locationFilterOptionsList}
          selected={selectedLocations}
          onChange={setSelectedLocations}
          maxHeightClass="max-h-72"
        />
      ),
    },
    tags: {
      count: selectedTagIds.length,
      title: 'Tags',
      content: (
        <FilterList
          title="Tags"
          label="Tags"
          searchPlaceholder="Search tags"
          options={tagFilterOptionsList}
          selected={selectedTagIds}
          onChange={setSelectedTagIds}
          maxHeightClass="max-h-72"
        />
      ),
    },
    amount: {
      count: (typeFilter !== 'all' ? 1 : 0) + (minAmount ? 1 : 0) + (maxAmount ? 1 : 0),
      title: 'Amount',
      content: (
        <div className="w-80 max-w-[88vw] space-y-3">
          <h3 className="type-card-title text-base font-bold text-ink">Amount</h3>
          <RadioGroup label="Type" value={typeFilter} onChange={value => setTypeFilter(value as typeof typeFilter)}>
            {TYPE_FILTER_OPTIONS.map(option => <Radio key={option.value} value={option.value}>{option.label}</Radio>)}
          </RadioGroup>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <AmountInput label="At least" currency={getMainCurrency()} value={minAmount} onChange={setMinAmount} />
            <AmountInput label="At most" currency={getMainCurrency()} value={maxAmount} onChange={setMaxAmount} />
          </div>
        </div>
      ),
    },
  }), [
    searchTerm, setSearchTerm, merchantFilter, setMerchantFilter, merchantOptionsList,
    selectedAccountIds, setSelectedAccountIds, accountQuickFiltersList, accountFilterOptions,
    selectedCategoryNames, setSelectedCategoryNames, categoryFilterOptionsList,
    selectedLocations, setSelectedLocations, locationFilterOptionsList,
    selectedTagIds, setSelectedTagIds, tagFilterOptionsList,
    typeFilter, setTypeFilter, minAmount, setMinAmount, maxAmount, setMaxAmount,
  ]);

  const filterSections = useMemo(() => [
    {
      id: 'type', label: 'Type', count: typeFilter !== 'all' ? 1 : 0,
      content: (
        <RadioGroup label="Show" value={typeFilter} onChange={value => setTypeFilter(value as typeof typeFilter)}>
          {TYPE_FILTER_OPTIONS.map(option => <Radio key={option.value} value={option.value}>{option.label}</Radio>)}
        </RadioGroup>
      ),
    },
    { id: 'accounts', label: 'Accounts', count: selectedAccountIds.length, content: columnFilters.account.content },
    { id: 'categories', label: 'Categories', count: selectedCategoryNames.length, content: columnFilters.category.content },
    { id: 'tags', label: 'Tags', count: selectedTagIds.length, content: columnFilters.tags.content },
    {
      id: 'merchant', label: 'Merchant', count: merchantFilter ? 1 : 0,
      content: (
        <FilterList
          label="Merchants"
          options={merchantOptionsList}
          selected={merchantFilter ? [merchantFilter] : []}
          onChange={ids => setMerchantFilter(ids[ids.length - 1] || '')}
        />
      ),
    },
    {
      id: 'location', label: 'Location', count: selectedLocations.length,
      content: columnFilters.location.content,
    },
    {
      id: 'dates', label: 'Dates', count: (startDate ? 1 : 0) + (endDate ? 1 : 0),
      content: (
        <div className="grid w-64 gap-3 max-md:w-full">
          <DateInput label="From" value={startDate} onChange={setStartDate} />
          <DateInput label="To" value={endDate} onChange={setEndDate} />
        </div>
      ),
    },
    {
      id: 'amount', label: 'Amount', count: (minAmount ? 1 : 0) + (maxAmount ? 1 : 0),
      content: columnFilters.amount.content,
    },
  ], [
    typeFilter, setTypeFilter,
    selectedAccountIds.length,
    selectedCategoryNames.length,
    selectedTagIds.length,
    merchantFilter, merchantOptionsList, setMerchantFilter,
    selectedLocations.length,
    startDate, setStartDate, endDate, setEndDate,
    minAmount, maxAmount,
    columnFilters,
  ]);

  return {
    columnFilters,
    filterSections,
  };
}
