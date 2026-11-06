import { useMemo } from 'react';
import type { Account } from '../types';
import { buildEffectiveMerchantLogoOverrides, getMerchantLogoUrl } from '../utils/brandfetch';
import { institutionDomain } from '../utils/institutionLogos';
import { usePreferencesSelector } from '../contexts/DomainProviders';

/** The logo of the institution an account is with, or `null` when there is no domain to look up or no Brandfetch ID is set. */
export const useAccountLogo = (account: Pick<Account, 'website' | 'financialInstitution' | 'name'>, size = 80): string | null => {
  const clientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const overrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const rules = usePreferencesSelector(p => p.merchantRules || {}) as Record<string, { logo?: string }>;
  const institution = account.financialInstitution || account.name;
  return useMemo(() => {
    const effective = buildEffectiveMerchantLogoOverrides(overrides, rules);
    // A logo the user set for the institution wins; then one found from its domain.
    return getMerchantLogoUrl(institution, clientId, effective, { type: 'icon', fallback: 'lettermark', width: size * 2, height: size * 2 })
      ?? getMerchantLogoUrl(institutionDomain(account), clientId, undefined, { type: 'icon', fallback: 'lettermark', width: size * 2, height: size * 2 });
  }, [institution, account.website, account.financialInstitution, account.name, clientId, overrides, rules, size]);
};
