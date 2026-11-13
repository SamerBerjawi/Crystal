import React, { useCallback, useMemo } from 'react';
import type { Account, MerchantRule } from '../types';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { formatCurrency } from '../utils';
import { buildEffectiveMerchantLogoOverrides, getAccountBrandfetchUrl, getMerchantLogoUrl, isCashAccount } from '../utils/brandfetch';
import { accountIcon } from '../components/AccountCard';
import { LogoTile } from '../components/EntityIcon';
import type { PickerOption } from '../components/ui/Pickers';

const ACCOUNT_TYPE_ORDER = ['Checking', 'Savings', 'Investment', 'Property', 'Vehicle', 'Other Assets', 'Lending', 'Credit Card', 'Loan', 'Other Liabilities'];
const rank = (type: string) => {
  const i = ACCOUNT_TYPE_ORDER.indexOf(type);
  return i === -1 ? ACCOUNT_TYPE_ORDER.length : i;
};

/**
 * Accounts as picker rows: logo (or the account's icon), institution and balance, grouped by type,
 * closed accounts last and only when one of them is the current choice.
 */
export const useAccountPickerOptions = (accounts: Account[]) => {
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {}) as Record<string, MerchantRule>;
  const overrides = useMemo(() => buildEffectiveMerchantLogoOverrides(merchantLogoOverrides, merchantRules), [merchantLogoOverrides, merchantRules]);

  return useCallback((options: { exclude?: (account: Account) => boolean; selected?: string } = {}): PickerOption[] => {
    const filtered = accounts.filter(item => !options.exclude?.(item) && (item.status !== 'closed' || item.id === options.selected));
    const open = filtered.filter(a => a.status !== 'closed').sort((a, b) => rank(a.type) - rank(b.type));
    const closed = filtered.filter(a => a.status === 'closed');

    return [...open, ...closed].map(item => {
      const logoUrl = isCashAccount(item) ? null : (item.imageUrl
        || getAccountBrandfetchUrl(item, brandfetchClientId, overrides)
        || (item.financialInstitution ? getMerchantLogoUrl(item.financialInstitution, brandfetchClientId, overrides) : null));
      return {
        id: item.id,
        label: item.name,
        description: `${item.financialInstitution || item.type}, ${formatCurrency(item.balance, item.currency)}`,
        group: item.status === 'closed' ? 'Closed' : item.type,
        visual: <LogoTile url={logoUrl} label={item.name} size={24} fallbackIcon={accountIcon(item)} />,
      };
    });
  }, [accounts, brandfetchClientId, overrides]);
};
