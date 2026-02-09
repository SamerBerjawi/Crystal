
import React, { useEffect, useMemo, useState } from 'react';
import { Page, MerchantRule, Category } from '../types';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import { INPUT_BASE_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, SELECT_STYLE, CHECKBOX_STYLE } from '../constants';
import { useAccountsContext, usePreferencesContext, usePreferencesSelector, useTransactionsContext } from '../contexts/DomainProviders';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';
import { fuzzySearch, convertToEur, formatCurrency, parseLocalDate } from '../utils';
import MerchantDetailModal from '../components/MerchantDetailModal';
import { useCategoryContext } from '../contexts/FinancialDataContext';

interface MerchantsProps {
  setCurrentPage: (page: Page) => void;
}

type EntityType = 'Merchant' | 'Institution';

interface EntityItem {
    id: string; // unique key
    logoKey: string; // normalized key for branding overrides
    name: string;
    type: EntityType;
    count: number; // Transactions count or Accounts count
    originalName: string; // Case sensitive
    totalValue: number; // EUR value (Balance for Inst, Sum for Merch)
    lastActivity?: string; // ISO Date
    currency?: string; // Dominant currency (optional/cosmetic)
    rule?: MerchantRule;
}

const StatCard: React.FC<{ title: string; value: string | number; icon: string; colorClass: string }> = ({ title, value, icon, colorClass }) => (
    <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-black/5 dark:border-white/5 shadow-sm flex items-center justify-between">
        <div>
            <p className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-1">{title}</p>
            <p className="text-2xl font-bold text-light-text dark:text-dark-text">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClass}`}>
            <span className="material-symbols-outlined text-2xl">{icon}</span>
        </div>
    </div>
);

const Merchants: React.FC<MerchantsProps> = ({ setCurrentPage }) => {
  const { transactions } = useTransactionsContext();
  const { accounts } = useAccountsContext();
  const { incomeCategories, expenseCategories } = useCategoryContext();
  const { preferences, setPreferences } = usePreferencesContext();
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  
  // Migrate old overrides or rules if needed (simplified: just read both)
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {});
  const legacyOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const hiddenMerchants = usePreferencesSelector(p => p.hiddenMerchants || []);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'count' | 'value' | 'recent'>('count');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list'); // Default to list for better management view
  const [showHidden, setShowHidden] = useState(false);
  const [logoLoadErrors, setLogoLoadErrors] = useState<Record<string, boolean>>({});
  
  const [editingEntity, setEditingEntity] = useState<EntityItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const effectiveMerchantRules = useMemo(() => {
    const migratedRules = { ...merchantRules };

    hiddenMerchants.forEach(merchantName => {
      const merchantKey = normalizeMerchantKey(merchantName);
      if (!merchantKey) return;

      migratedRules[merchantKey] = {
        ...(migratedRules[merchantKey] || {}),
        isHidden: true,
      };
    });

    return migratedRules;
  }, [merchantRules, hiddenMerchants]);

  useEffect(() => {
    if (!hiddenMerchants.length) return;

    const needsMigration = hiddenMerchants.some(merchantName => {
      const merchantKey = normalizeMerchantKey(merchantName);
      return merchantKey && !merchantRules[merchantKey]?.isHidden;
    });

    if (!needsMigration) return;

    setPreferences(prev => {
      const nextRules = { ...(prev.merchantRules || {}) };
      hiddenMerchants.forEach(merchantName => {
        const merchantKey = normalizeMerchantKey(merchantName);
        if (!merchantKey) return;
        nextRules[merchantKey] = {
          ...(nextRules[merchantKey] || {}),
          isHidden: true,
        };
      });

      return {
        ...prev,
        merchantRules: nextRules,
      };
    });
  }, [hiddenMerchants, merchantRules, setPreferences]);

  const missingMerchantCount = useMemo(() => 
    transactions.filter(tx => !tx.merchant || !tx.merchant.trim()).length,
  [transactions]);

  const entities = useMemo(() => {
    const map = new Map<string, EntityItem>();

    // 1. Process Merchants from ALL Transactions
    transactions.forEach(tx => {
      if (!tx.merchant) return;
      const key = normalizeMerchantKey(tx.merchant);
      if (!key) return;
      const mapKey = `merchant:${key}`;
      
      const val = convertToEur(tx.amount, tx.currency);
      const existing = map.get(mapKey);

      if (existing) {
        existing.count += 1;
        existing.totalValue += val;
        if (tx.date > (existing.lastActivity || '')) {
            existing.lastActivity = tx.date;
        }
      } else {
        // Construct effective rule by merging legacy overrides if rule doesn't exist
        // This ensures backward compatibility
        const effectiveRule = effectiveMerchantRules[key] || (legacyOverrides[key] ? { logo: legacyOverrides[key] } : undefined);

        map.set(mapKey, { 
            id: mapKey, 
            logoKey: key,
            name: tx.merchant.trim(), 
            type: 'Merchant', 
            count: 1, 
            originalName: tx.merchant,
            totalValue: val,
            lastActivity: tx.date,
            currency: tx.currency,
            rule: effectiveRule
        });
      }
    });

    // 2. Process Financial Institutions from ALL Accounts
    accounts.forEach(acc => {
        if (!acc.financialInstitution) return;
        const key = normalizeMerchantKey(acc.financialInstitution);
        if (!key) return;
        const mapKey = `institution:${key}`;

        const val = convertToEur(acc.balance, acc.currency);
        const existing = map.get(mapKey);

        if (existing) {
            existing.count += 1;
            existing.totalValue += val;
        } else {
            const effectiveRule = effectiveMerchantRules[key] || (legacyOverrides[key] ? { logo: legacyOverrides[key] } : undefined);

            map.set(mapKey, { 
                id: mapKey, 
                logoKey: key,
                name: acc.financialInstitution.trim(), 
                type: 'Institution', 
                count: 1, 
                originalName: acc.financialInstitution,
                totalValue: val,
                lastActivity: undefined, 
                currency: acc.currency,
                rule: effectiveRule
            });
        }
    });

    return Array.from(map.values());
  }, [transactions, accounts, effectiveMerchantRules, legacyOverrides]);

  // Filtering & Sorting
  const filteredEntities = useMemo(() => {
      let result = entities;

      if (!showHidden) {
          result = result.filter(e => !e.rule?.isHidden);
      }
      
      if (searchTerm) {
          result = result.filter(e => fuzzySearch(searchTerm, e.name));
      }
      
      return result.sort((a, b) => {
          if (sortBy === 'count') return b.count - a.count;
          if (sortBy === 'value') return Math.abs(b.totalValue) - Math.abs(a.totalValue);
          if (sortBy === 'recent') {
              if (!a.lastActivity) return 1;
              if (!b.lastActivity) return -1;
              return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
          }
          return a.name.localeCompare(b.name);
      });
  }, [entities, searchTerm, sortBy, showHidden]);

  const handleSaveRule = (key: string, rule: MerchantRule) => {
      setPreferences(prev => ({
          ...prev,
          merchantRules: {
              ...prev.merchantRules,
              [key]: rule
          }
      }));
  };

  const handleToggleHidden = (entity: EntityItem, e: React.MouseEvent) => {
      e.stopPropagation();
      const newHidden = !entity.rule?.isHidden;
      
      const newRule: MerchantRule = {
          ...(entity.rule || {}),
          isHidden: newHidden
      };
      
      handleSaveRule(entity.logoKey, newRule);
  };

  const getPreviewUrl = (merchantName: string, rule?: MerchantRule) => {
      // Prioritize rule logo, fallback to legacy override logic inside getMerchantLogoUrl if needed, but here we pass specific override
      const overrides = rule?.logo ? { [normalizeMerchantKey(merchantName)!]: rule.logo } : {};
      return getMerchantLogoUrl(merchantName, brandfetchClientId, overrides, { fallback: 'lettermark', type: 'icon', width: 128, height: 128 });
  };

  const handleLogoError = (url: string) => setLogoLoadErrors(prev => ({ ...prev, [url]: true }));

  const stats = useMemo(() => {
      const totalVolume = entities.reduce((sum, e) => sum + Math.abs(e.totalValue), 0);
      return {
          totalMerchants: entities.filter(e => e.type === 'Merchant').length,
          totalInstitutions: entities.filter(e => e.type === 'Institution').length,
          totalVolume,
          missingCount: missingMerchantCount
      };
  }, [entities, missingMerchantCount]);

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-8 animate-fade-in-up">
      {isDetailModalOpen && editingEntity && (
          <MerchantDetailModal 
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            merchantName={editingEntity.originalName}
            logoKey={editingEntity.logoKey}
            initialRule={editingEntity.rule}
            onSave={handleSaveRule}
            incomeCategories={incomeCategories}
            expenseCategories={expenseCategories}
            transactions={transactions}
            brandfetchClientId={brandfetchClientId}
          />
      )}
      
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
            <span className="text-light-text dark:text-dark-text font-medium">Merchants & Institutions</span>
          </div>
        </div>
        <PageHeader
          markerIcon="store"
          markerLabel="Entity Management"
          title="Merchants & Institutions"
          subtitle="Manage defaults, branding, and visibility for your frequent transaction partners."
        />
        {!brandfetchClientId && (
          <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-xl px-4 py-3 text-sm flex items-start gap-2 dark:bg-amber-900/20 dark:text-amber-100 dark:border-amber-900/40">
            <span className="material-symbols-outlined text-base mt-[2px]">info</span>
            <p className="leading-relaxed">
              Add your Brandfetch Client ID in Preferences to enable automatic logo fetching.
            </p>
          </div>
        )}
      </header>
      
      {/* Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Merchants" value={stats.totalMerchants} icon="store" colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
          <StatCard title="Total Banks" value={stats.totalInstitutions} icon="account_balance" colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
          <StatCard title="Total Volume" value={formatCurrency(stats.totalVolume, 'EUR')} icon="payments" colorClass="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
          <StatCard title="Unidentified Txns" value={stats.missingCount} icon="help_outline" colorClass="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-dark-card p-2 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
           <div className="relative w-full md:max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">search</span>
                <input 
                    type="text" 
                    placeholder="Search entities..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className={`${INPUT_BASE_STYLE} pl-10 border-none bg-transparent shadow-none focus:ring-0`}
                />
           </div>
           
           <div className="flex items-center gap-3 w-full md:w-auto px-1 md:px-0">
               <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text transition-colors">
                   <input 
                       type="checkbox" 
                       checked={showHidden} 
                       onChange={(e) => setShowHidden(e.target.checked)} 
                       className={CHECKBOX_STYLE} 
                   />
                   Show Hidden
               </label>
               <div className="h-6 w-px bg-black/10 dark:bg-white/10 mx-1"></div>
               <div className="flex bg-light-fill dark:bg-dark-fill p-1 rounded-lg">
                   <button 
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-dark-card shadow text-primary-500' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                   >
                       <span className="material-symbols-outlined text-xl">grid_view</span>
                   </button>
                   <button 
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-dark-card shadow text-primary-500' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'}`}
                   >
                       <span className="material-symbols-outlined text-xl">view_list</span>
                   </button>
               </div>
               
               <div className={`${SELECT_WRAPPER_STYLE} !w-auto`}>
                   <select 
                        value={sortBy} 
                        onChange={(e) => setSortBy(e.target.value as any)} 
                        className={`${SELECT_STYLE} pr-8 !py-2 h-10 text-sm font-medium`}
                   >
                       <option value="count">Most Frequent</option>
                       <option value="value">Highest Value</option>
                       <option value="recent">Recently Active</option>
                       <option value="name">Name (A-Z)</option>
                   </select>
                   <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined text-sm">expand_more</span></div>
               </div>
           </div>
      </div>

      {filteredEntities.length === 0 ? (
          <div className="text-center py-20 bg-light-card/50 dark:bg-dark-card/30 rounded-3xl border border-dashed border-black/10 dark:border-white/10">
              <span className="material-symbols-outlined text-5xl text-gray-300 dark:text-gray-600 mb-4">store_off</span>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">No entities found.</p>
              {stats.missingCount > 0 && (
                  <p className="text-xs text-orange-500 mt-2">
                      Tip: You have {stats.missingCount} transactions without a merchant name assigned.
                  </p>
              )}
          </div>
      ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredEntities.map(entity => {
              const previewUrl = getPreviewUrl(entity.name, entity.rule);
              const hasLogo = Boolean(previewUrl && !logoLoadErrors[previewUrl]);
              const initialLetter = entity.name.charAt(0).toUpperCase();
              const isHidden = entity.rule?.isHidden;
              
              const accentColor = entity.type === 'Institution' 
                  ? (entity.totalValue >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500')
                  : 'text-light-text dark:text-dark-text';

              return (
                <Card 
                    key={entity.id} 
                    className={`flex flex-col gap-4 group relative overflow-visible hover:border-primary-500/30 transition-all duration-200 cursor-pointer ${isHidden ? 'opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0' : ''}`}
                    onClick={() => { setEditingEntity(entity); setIsDetailModalOpen(true); }}
                >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                         <div
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10 shadow-sm ${hasLogo ? 'bg-white dark:bg-dark-card' : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 text-gray-500 dark:text-gray-400'}`}
                         >
                            {hasLogo && previewUrl ? (
                              <img
                                src={previewUrl}
                                alt={`${entity.name} logo`}
                                className="w-full h-full object-cover"
                                onError={() => handleLogoError(previewUrl)}
                              />
                            ) : (
                              <span className="text-xl font-bold">{initialLetter}</span>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${entity.type === 'Institution' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                {entity.type === 'Institution' ? 'Bank' : 'Merch'}
                            </span>
                            {entity.rule?.category && (
                                <span className="text-[10px] font-medium bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-light-text-secondary dark:text-dark-text-secondary truncate max-w-[80px]">
                                    {entity.rule.category}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between group/name mb-1">
                            <h3 className="font-bold text-lg text-light-text dark:text-dark-text truncate" title={entity.name}>{entity.name}</h3>
                        </div>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium mb-3">
                            {entity.count} {entity.type === 'Merchant' ? 'transactions' : 'accounts'}
                        </p>
                        
                        <div className="flex justify-between items-end border-t border-black/5 dark:border-white/5 pt-3">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-0.5">
                                    {entity.type === 'Institution' ? 'Assets' : 'Volume'}
                                </p>
                                <p className={`font-mono font-bold text-base ${accentColor}`}>
                                    {formatCurrency(entity.totalValue, 'EUR')}
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>
              );
            })}
          </div>
      ) : (
          <Card className="!p-0 overflow-hidden">
              <table className="w-full text-left text-sm">
                  <thead className="bg-light-bg dark:bg-white/5 border-b border-black/5 dark:border-white/5 text-xs uppercase font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-wider">
                      <tr>
                          <th className="px-4 py-3">Entity</th>
                          <th className="px-4 py-3">Default Category</th>
                          <th className="px-4 py-3 text-right">Count</th>
                          <th className="px-4 py-3 text-right">Last Activity</th>
                          <th className="px-4 py-3 text-right">Total Value</th>
                          <th className="px-4 py-3 w-20"></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                      {filteredEntities.map(entity => {
                          const previewUrl = getPreviewUrl(entity.name, entity.rule);
                          const hasLogo = Boolean(previewUrl && !logoLoadErrors[previewUrl]);
                          const initialLetter = entity.name.charAt(0).toUpperCase();
                          const isHidden = entity.rule?.isHidden;

                          return (
                              <tr 
                                key={entity.id} 
                                onClick={() => { setEditingEntity(entity); setIsDetailModalOpen(true); }}
                                className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group ${isHidden ? 'opacity-60 bg-gray-50 dark:bg-white/5' : ''}`}
                              >
                                  <td className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                           <div className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10 shadow-sm ${hasLogo ? 'bg-white dark:bg-dark-card' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                                {hasLogo && previewUrl ? (
                                                    <img src={previewUrl} alt="logo" className="w-full h-full object-cover" onError={() => handleLogoError(previewUrl)} />
                                                ) : (
                                                    <span className="font-bold text-xs">{initialLetter}</span>
                                                )}
                                           </div>
                                           <span className="font-bold text-light-text dark:text-dark-text truncate max-w-[200px]">{entity.name}</span>
                                           {isHidden && <span className="material-symbols-outlined text-xs text-gray-400">visibility_off</span>}
                                      </div>
                                  </td>
                                  <td className="px-4 py-3">
                                      {entity.rule?.category ? (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-white/10 text-light-text dark:text-dark-text">
                                              {entity.rule.category}
                                          </span>
                                      ) : (
                                          <span className="text-light-text-secondary dark:text-dark-text-secondary text-xs italic">None</span>
                                      )}
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium text-light-text-secondary dark:text-dark-text-secondary">
                                      {entity.count}
                                  </td>
                                  <td className="px-4 py-3 text-right text-light-text-secondary dark:text-dark-text-secondary text-xs">
                                      {entity.lastActivity ? parseLocalDate(entity.lastActivity).toLocaleDateString() : '—'}
                                  </td>
                                  <td className={`px-4 py-3 text-right font-mono font-bold ${entity.totalValue >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-light-text dark:text-dark-text'}`}>
                                      {formatCurrency(entity.totalValue, 'EUR')}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                       <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                           <button 
                                                onClick={(e) => handleToggleHidden(entity, e)}
                                                className="p-1.5 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10"
                                                title={isHidden ? "Show" : "Hide"}
                                            >
                                                <span className="material-symbols-outlined text-lg">
                                                    {isHidden ? 'visibility' : 'visibility_off'}
                                                </span>
                                            </button>
                                           <button 
                                                onClick={(e) => { e.stopPropagation(); setEditingEntity(entity); setIsDetailModalOpen(true); }}
                                                className="p-1.5 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10"
                                                title="Edit"
                                            >
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                       </div>
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </Card>
      )}
    </div>
  );
};

export default Merchants;
