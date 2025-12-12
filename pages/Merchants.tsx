import React, { useEffect, useMemo, useState } from 'react';
import { Page } from '../types';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import { BTN_PRIMARY_STYLE, INPUT_BASE_STYLE } from '../constants';
import { usePreferencesContext, usePreferencesSelector, useTransactionSelector } from '../contexts/DomainProviders';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';

interface MerchantsProps {
  setCurrentPage: (page: Page) => void;
}

const Merchants: React.FC<MerchantsProps> = ({ setCurrentPage }) => {
  const transactions = useTransactionSelector(txs => txs);
  const { setPreferences } = usePreferencesContext();
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const persistedOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});

  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>(persistedOverrides);
  const [logoLoadErrors, setLogoLoadErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOverrideDrafts(persistedOverrides);
  }, [persistedOverrides]);

  const merchants = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number }>();
    transactions.forEach(tx => {
      if (!tx.merchant) return;
      const key = normalizeMerchantKey(tx.merchant);
      if (!key) return;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { key, name: tx.merchant.trim(), count: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [transactions]);

  const handleOverrideChange = (key: string, value: string) => {
    setOverrideDrafts(prev => ({ ...prev, [key]: value }));
  };

  const persistOverride = (key: string) => {
    const value = overrideDrafts[key]?.trim();
    setPreferences(prev => {
      const nextOverrides = { ...(prev.merchantLogoOverrides || {}) };
      if (value) {
        nextOverrides[key] = value;
      } else {
        delete nextOverrides[key];
      }
      return { ...prev, merchantLogoOverrides: nextOverrides };
    });
  };

  const getPreviewUrl = (merchantName: string) =>
    getMerchantLogoUrl(merchantName, brandfetchClientId, overrideDrafts, { fallback: 'lettermark', type: 'icon', width: 128, height: 128 });

  const handleLogoError = (url: string) => setLogoLoadErrors(prev => ({ ...prev, [url]: true }));

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-8 animate-fade-in-up">
      <header className="space-y-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentPage('Settings')}
            className="text-light-text-secondary dark:text-dark-text-secondary p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
            <span onClick={() => setCurrentPage('Settings')} className="hover:underline cursor-pointer">Settings</span>
            <span className="mx-2">/</span>
            <span className="text-light-text dark:text-dark-text font-medium">Merchants</span>
          </div>
        </div>
        <PageHeader
          markerIcon="store"
          markerLabel="Branding"
          title="Merchant Logos"
          subtitle="Review detected merchants and override their Brandfetch identifiers when needed."
        />
        {!brandfetchClientId && (
          <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-xl px-4 py-3 text-sm flex items-start gap-2 dark:bg-amber-900/20 dark:text-amber-100 dark:border-amber-900/40">
            <span className="material-symbols-outlined text-base mt-[2px]">info</span>
            <p className="leading-relaxed">
              Add your Brandfetch Client ID in Preferences to enable logo fetching.
            </p>
          </div>
        )}
      </header>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Detected merchants</h3>
          <button
            onClick={() => setCurrentPage('Preferences')}
            className={`${BTN_PRIMARY_STYLE} !py-2 !px-3 flex items-center gap-2`}
          >
            <span className="material-symbols-outlined text-base">tune</span>
            Preferences
          </button>
        </div>

        {merchants.length === 0 ? (
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">No merchants detected yet.</p>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {merchants.map(merchant => {
              const previewUrl = getPreviewUrl(merchant.name);
              const hasLogo = Boolean(previewUrl && !logoLoadErrors[previewUrl]);
              const draftValue = overrideDrafts[merchant.key] || '';
              const initialLetter = merchant.name.charAt(0).toUpperCase();
              return (
                <div key={merchant.key} className="py-4 flex items-center gap-4 flex-wrap">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10 ${hasLogo ? 'bg-white dark:bg-dark-card' : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200'}`}
                  >
                    {hasLogo && previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={`${merchant.name} logo`}
                        className="w-full h-full object-contain rounded-full p-1"
                        onError={() => handleLogoError(previewUrl)}
                      />
                    ) : (
                      <span className="text-sm font-semibold">{initialLetter}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <p className="font-semibold text-light-text dark:text-dark-text">{merchant.name}</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{merchant.count} transaction{merchant.count === 1 ? '' : 's'}</p>
                    {draftValue && (
                      <p className="text-[11px] text-primary-600 dark:text-primary-300 mt-1">Override: {draftValue}</p>
                    )}
                  </div>

                  <div className="w-full md:w-64 flex flex-col gap-2">
                    <label className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">Brandfetch identifier override</label>
                    <input
                      type="text"
                      value={draftValue}
                      placeholder={brandfetchClientId ? 'e.g., amazon.com or id_0dwKPKT' : 'Set a Client ID first'}
                      onChange={e => handleOverrideChange(merchant.key, e.target.value)}
                      onBlur={() => persistOverride(merchant.key)}
                      className={INPUT_BASE_STYLE}
                      disabled={!brandfetchClientId}
                    />
                    <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                      Leave blank to auto-detect from the merchant name.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Merchants;