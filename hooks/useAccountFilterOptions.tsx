import React, { useMemo } from 'react';
import type { Account, MerchantRule } from '../types';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { buildEffectiveMerchantLogoOverrides, getAccountBrandfetchUrl, getMerchantLogoUrl, isCashAccount } from '../utils/brandfetch';
import { accountIcon } from '../components/AccountCard';
import { LogoTile } from '../components/EntityIcon';
import type { FilterOption, QuickFilter } from '../components/FilterList';

const ACCOUNT_TYPE_ORDER = ['Checking', 'Savings', 'Investment', 'Property', 'Vehicle', 'Other Assets', 'Lending', 'Credit Card', 'Loan', 'Other Liabilities'];
const DEBT = ['Credit Card', 'Loan', 'Other Liabilities'];
const LIQUID = ['Checking', 'Savings', 'Credit Card'];

/** Accounts for a FilterList: grouped by type with their logo, closed ones last, plus the quick filters (D-127). */
export const useAccountFilterOptions = (accounts: Account[]): { options: FilterOption[]; quick: QuickFilter[] } => {
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {}) as Record<string, MerchantRule>;
  const overrides = useMemo(() => buildEffectiveMerchantLogoOverrides(merchantLogoOverrides, merchantRules), [merchantLogoOverrides, merchantRules]);

  const options = useMemo(() => {
    const rank = (type: string) => {
      const i = ACCOUNT_TYPE_ORDER.indexOf(type);
      return i === -1 ? ACCOUNT_TYPE_ORDER.length : i;
    };
    const toOption = (a: Account, group: string): FilterOption => {
      const logoUrl = isCashAccount(a) ? null : (a.imageUrl
        || getAccountBrandfetchUrl(a, brandfetchClientId, overrides)
        || (a.financialInstitution ? getMerchantLogoUrl(a.financialInstitution, brandfetchClientId, overrides) : null));
      return {
        id: a.id,
        label: a.name,
        hint: a.last4 ? `•••• ${a.last4}` : a.type,
        group,
        visual: <LogoTile url={logoUrl} label={a.name} size={26} fallbackIcon={accountIcon(a)} />,
      };
    };
    const open = accounts.filter(a => a.status !== 'closed').sort((a, b) => rank(a.type) - rank(b.type));
    return [
      ...open.map(a => toOption(a, a.type)),
      ...accounts.filter(a => a.status === 'closed').map(a => toOption(a, 'Closed')),
    ];
  }, [accounts, brandfetchClientId, overrides]);

  const quick = useMemo(() => {
    const open = accounts.filter(a => a.status !== 'closed');
    const ids = (keep: (a: Account) => boolean) => open.filter(keep).map(a => a.id);
    return [
      { label: 'All accounts', ids: ids(() => true) },
      { label: 'Liquid only', ids: ids(a => LIQUID.includes(a.type)) },
      { label: 'All assets', ids: ids(a => !DEBT.includes(a.type)) },
      { label: 'All liabilities', ids: ids(a => DEBT.includes(a.type)) },
      { label: 'Investments', ids: ids(a => a.type === 'Investment') },
    ].filter(preset => preset.ids.length > 0);
  }, [accounts]);

  return { options, quick };
};
