
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
  const showBalanceAdjustments = usePreferencesSelector(p => p.showBalanceAdjustments ?? true);
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
      if (!showBalanceAdjustments && tx.isBalanceAdjustment) return;
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
    <div className="w-full pb-12 space-y-12 animate-fade-in-up px-4">
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
      
       {/* Navigation & Header */}
       <div className="space-y-6">
        <nav className="flex items-center gap-3">
            <button 
              onClick={() => setCurrentPage('Settings')} 
              className="group flex items-center gap-2 text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest hover:text-primary-500 transition-colors"
            >
                <div className="w-6 h-6 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-primary-500 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                </div>
                <span>Back to Control Center</span>
            </button>
        </nav>
        
        <PageHeader
          markerIcon="store"
          markerLabel="Entity Intelligence"
          title="Merchants & Institutions"
          subtitle="Refine metadata, oversee branding assets, and configure automated classification logic for your telemetry."
        />

        {!brandfetchClientId && (
          <div className="bg-amber-100/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-900/30 rounded-2xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
               <span className="material-symbols-outlined text-xl">brand_awareness</span>
            </div>
            <p className="text-xs font-bold text-amber-800/80 dark:text-amber-200/80 leading-relaxed">
              Automatic branding enrichment is offline. Add a Brandfetch Access Key in Preferences to restore merchant telemetry.
            </p>
          </div>
        )}
      </div>
      
      {/* Metrics Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Merchants" value={stats.totalMerchants} icon="shopping_bag" colorClass="bg-blue-500 text-white shadow-blue-500/20" />
          <StatCard title="Institutions" value={stats.totalInstitutions} icon="hub" colorClass="bg-indigo-500 text-white shadow-indigo-500/20" />
          <StatCard title="Aggr. Volume" value={formatCurrency(stats.totalVolume, 'EUR')} icon="equalizer" colorClass="bg-emerald-500 text-white shadow-emerald-500/20" />
          <StatCard title="Ambiguous" value={stats.missingCount} icon="psychology_alt" colorClass="bg-orange-500 text-white shadow-orange-500/20" />
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-6 justify-between items-center px-2">
           <div className="relative w-full md:max-w-md group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary opacity-40 group-focus-within:text-primary-500 group-focus-within:opacity-100 transition-all">database_search</span>
                </div>
                <input 
                    type="text" 
                    placeholder="Query entities..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-2xl pl-12 pr-4 py-4 text-xs font-bold uppercase tracking-widest placeholder:text-light-text-secondary/30 dark:placeholder:text-dark-text-secondary/30 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all shadow-sm"
                />
           </div>
           
           <div className="flex items-center gap-6 w-full md:w-auto">
               <label className="flex items-center gap-3 cursor-pointer group select-none">
                   <div className="relative">
                      <input 
                          type="checkbox" 
                          checked={showHidden} 
                          onChange={(e) => setShowHidden(e.target.checked)} 
                          className="sr-only peer" 
                      />
                      <div className="w-10 h-6 bg-black/5 dark:bg-white/5 rounded-full peer-checked:bg-primary-500 transition-colors"></div>
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform shadow-sm"></div>
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary group-hover:text-primary-500 transition-colors">Show Hidden</span>
               </label>

               <div className="h-8 w-px bg-black/5 dark:bg-white/5"></div>

               <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl">
                   <button 
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-500 scale-110' : 'text-light-text-secondary/40 dark:text-dark-text-secondary/40 hover:text-primary-500'}`}
                   >
                       <span className="material-symbols-outlined text-lg">grid_view</span>
                   </button>
                   <button 
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-500 scale-110' : 'text-light-text-secondary/40 dark:text-dark-text-secondary/40 hover:text-primary-500'}`}
                   >
                       <span className="material-symbols-outlined text-lg">view_list</span>
                   </button>
               </div>
               
               <div className="relative group">
                   <select 
                        value={sortBy} 
                        onChange={(e) => setSortBy(e.target.value as any)} 
                        className="appearance-none bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-xl pl-4 pr-10 py-3 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all shadow-sm cursor-pointer"
                   >
                       <option value="count">Most Frequent</option>
                       <option value="value">Highest Volume</option>
                       <option value="recent">Recently Active</option>
                       <option value="name">Identifier</option>
                   </select>
                   <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center text-light-text-secondary opacity-40">
                      <span className="material-symbols-outlined text-sm">unfold_more</span>
                   </div>
               </div>
           </div>
      </div>

      {filteredEntities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white/50 dark:bg-dark-card/30 rounded-3xl border border-dashed border-black/5 dark:border-white/5">
              <div className="w-16 h-16 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-3xl opacity-20">search_off</span>
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-light-text-secondary dark:text-dark-text-secondary opacity-40">Zero Results Found</p>
              {stats.missingCount > 0 && (
                  <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mt-4">
                    Audit required: {stats.missingCount} ambiguous records detected.
                  </p>
              )}
          </div>
      ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredEntities.map(entity => {
              const previewUrl = getPreviewUrl(entity.name, entity.rule);
              const hasLogo = Boolean(previewUrl && !logoLoadErrors[previewUrl]);
              const initialLetter = entity.name.charAt(0).toUpperCase();
              const isHidden = entity.rule?.isHidden;
              
              const accentColor = entity.type === 'Institution' 
                  ? (entity.totalValue >= 0 ? 'text-primary-500' : 'text-red-500')
                  : 'text-light-text dark:text-dark-text';

              return (
                <div 
                    key={entity.id} 
                    onClick={() => { setEditingEntity(entity); setIsDetailModalOpen(true); }}
                    className={`relative group bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-3xl p-6 cursor-pointer hover:border-primary-500/20 hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300 ${isHidden ? 'opacity-40 grayscale-[0.8] hover:opacity-100 hover:grayscale-0' : ''}`}
                >
                    <div className="flex justify-between items-start mb-6">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10 shadow-sm ${hasLogo ? 'bg-white' : 'bg-gradient-to-br from-black/[0.02] to-black/[0.1] dark:from-white/[0.02] dark:to-white/[0.1]'}`}>
                            {hasLogo && previewUrl ? (
                              <img src={previewUrl} className="w-full h-full object-cover" onError={() => handleLogoError(previewUrl)} alt="" />
                            ) : (
                              <span className="text-xl font-black text-light-text-secondary/40">{initialLetter}</span>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${entity.type === 'Institution' ? 'bg-indigo-500 text-white' : 'bg-primary-500 text-white'}`}>
                                {entity.type === 'Institution' ? 'Core' : 'Merch'}
                            </span>
                            {entity.rule?.category && (
                                <span className="text-[9px] font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-60 uppercase tracking-tighter truncate max-w-[100px]">
                                    {entity.rule.category}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h3 className="font-black text-lg text-light-text dark:text-dark-text truncate leading-tight group-hover:text-primary-500 transition-colors">{entity.name}</h3>
                            <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-40 uppercase tracking-widest">
                                {entity.count} Observed Events
                            </p>
                        </div>
                        
                        <div className="pt-4 border-t border-black/5 dark:border-white/5">
                            <p className="text-[9px] font-black text-light-text-secondary dark:text-dark-text-secondary opacity-40 uppercase tracking-widest mb-1">
                                Cumulative
                            </p>
                            <p className={`font-mono font-black text-xl tracking-tighter ${accentColor}`}>
                                {formatCurrency(entity.totalValue, 'EUR')}
                            </p>
                        </div>
                    </div>
                </div>
              );
            })}
          </div>
      ) : (
          <div className="bg-white dark:bg-dark-card rounded-3xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                  <thead>
                      <tr className="bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5">
                          <th className="px-8 py-5 text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">Identifier</th>
                          <th className="px-8 py-5 text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">Classification</th>
                          <th className="px-8 py-5 text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest text-right">Frequency</th>
                          <th className="px-8 py-5 text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest text-right">Last Sync</th>
                          <th className="px-8 py-5 text-[10px] font-black text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest text-right">Total Exposure</th>
                          <th className="px-8 py-5 w-20"></th>
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
                                className={`group hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors cursor-pointer ${isHidden ? 'opacity-40 grayscale' : ''}`}
                              >
                                  <td className="px-8 py-5">
                                      <div className="flex items-center gap-4">
                                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10 shadow-sm ${hasLogo ? 'bg-white' : 'bg-black/5 dark:bg-white/5'}`}>
                                                {hasLogo && previewUrl ? (
                                                    <img src={previewUrl} className="w-full h-full object-cover" onError={() => handleLogoError(previewUrl)} alt="" />
                                                ) : (
                                                    <span className="font-black text-xs text-light-text-secondary/40">{initialLetter}</span>
                                                )}
                                           </div>
                                           <div className="flex items-center gap-2">
                                              <span className="font-black text-sm text-light-text dark:text-dark-text group-hover:text-primary-500 transition-colors uppercase tracking-tight">{entity.name}</span>
                                              {isHidden && <span className="material-symbols-outlined text-sm text-gray-400">visibility_off</span>}
                                           </div>
                                      </div>
                                  </td>
                                  <td className="px-8 py-5">
                                      {entity.rule?.category ? (
                                          <span className="inline-flex px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary border border-black/5 dark:border-white/5">
                                              {entity.rule.category}
                                          </span>
                                      ) : (
                                          <span className="text-[10px] font-bold text-light-text-secondary/30 dark:text-dark-text-secondary/30 uppercase tracking-[0.2em] italic">Unclassified</span>
                                      )}
                                  </td>
                                  <td className="px-8 py-5 text-right font-black text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-60 uppercase tracking-widest">
                                      {entity.count} Events
                                  </td>
                                  <td className="px-8 py-5 text-right text-light-text-secondary dark:text-dark-text-secondary text-[10px] font-black uppercase tracking-widest opacity-40">
                                      {entity.lastActivity ? parseLocalDate(entity.lastActivity).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' }) : 'INF'}
                                  </td>
                                  <td className={`px-8 py-5 text-right font-mono font-black text-base tracking-tighter ${entity.totalValue >= 0 ? 'text-primary-500' : 'text-light-text dark:text-dark-text'}`}>
                                      {formatCurrency(entity.totalValue, 'EUR')}
                                  </td>
                                  <td className="px-8 py-5 text-right">
                                       <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                           <button 
                                                onClick={(e) => handleToggleHidden(entity, e)}
                                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10 transition-all shadow-sm"
                                                title={isHidden ? "Activate" : "Deactivate"}
                                            >
                                                <span className="material-symbols-outlined text-lg">
                                                    {isHidden ? 'notifications_active' : 'notifications_off'}
                                                </span>
                                            </button>
                                           <button 
                                                onClick={(e) => { e.stopPropagation(); setEditingEntity(entity); setIsDetailModalOpen(true); }}
                                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary-500/10 text-primary-500 hover:bg-primary-500 hover:text-white transition-all shadow-sm"
                                                title="Protocol Configuration"
                                            >
                                                <span className="material-symbols-outlined text-lg">tune</span>
                                            </button>
                                       </div>
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      )}
    </div>
  );
};

export default Merchants;
