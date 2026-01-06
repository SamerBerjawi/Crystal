
import React, { useEffect, useMemo, useState } from 'react';
import { Page } from '../types';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, SELECT_STYLE } from '../constants';
import { useAccountsContext, usePreferencesContext, usePreferencesSelector, useTransactionsContext } from '../contexts/DomainProviders';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';
import { fuzzySearch, convertToEur, formatCurrency, parseLocalDate } from '../utils';

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
}

const RenameModal = ({ 
    isOpen, 
    onClose, 
    entity, 
    onSave 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    entity: EntityItem | null; 
    onSave: (oldName: string, newName: string, type: EntityType) => void;
}) => {
    const [newName, setNewName] = useState('');

    useEffect(() => {
        setNewName(entity?.originalName || '');
    }, [entity]);

    if (!isOpen || !entity) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newName && newName !== entity.originalName) {
            onSave(entity.originalName, newName, entity.type);
        }
        onClose();
    };

    return (
        <Modal onClose={onClose} title={`Rename ${entity.type}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    This will update {entity.count} {entity.type === 'Merchant' ? 'transactions' : 'accounts'} currently labeled as <strong>{entity.originalName}</strong>.
                </p>
                <div>
                    <label className="block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5">
                        New Name
                    </label>
                    <input 
                        type="text" 
                        value={newName} 
                        onChange={e => setNewName(e.target.value)} 
                        className={INPUT_BASE_STYLE}
                        autoFocus
                    />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                    <button type="submit" className={BTN_PRIMARY_STYLE}>Save Changes</button>
                </div>
            </form>
        </Modal>
    );
};

const Merchants: React.FC<MerchantsProps> = ({ setCurrentPage }) => {
  const { transactions, saveTransaction } = useTransactionsContext();
  const { accounts, saveAccount } = useAccountsContext();
  const { setPreferences } = usePreferencesContext();
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const persistedOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'count' | 'value' | 'recent'>('count');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>(persistedOverrides);
  const [logoLoadErrors, setLogoLoadErrors] = useState<Record<string, boolean>>({});
  
  const [editingEntity, setEditingEntity] = useState<EntityItem | null>(null);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);

  useEffect(() => {
    setOverrideDrafts(persistedOverrides);
  }, [persistedOverrides]);

  // Aggregation Logic
  const analyticsAccounts = useMemo(() => accounts.filter(acc => acc.includeInAnalytics ?? true), [accounts]);
  const accountLookup = useMemo(() => new Map(accounts.map(acc => [acc.id, acc])), [accounts]);
  const analyticsTransactions = useMemo(
    () => transactions.filter(tx => {
        const account = accountLookup.get(tx.accountId);
        return account ? (account.includeInAnalytics ?? true) : true;
    }),
    [transactions, accountLookup]
  );

  const entities = useMemo(() => {
    const map = new Map<string, EntityItem>();

    // 1. Process Merchants from Transactions
    analyticsTransactions.forEach(tx => {
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
        map.set(mapKey, { 
            id: mapKey, 
            logoKey: key,
            name: tx.merchant.trim(), 
            type: 'Merchant', 
            count: 1, 
            originalName: tx.merchant,
            totalValue: val,
            lastActivity: tx.date,
            currency: tx.currency
        });
      }
    });

    // 2. Process Financial Institutions from Accounts
    analyticsAccounts.forEach(acc => {
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
            map.set(mapKey, { 
                id: mapKey, 
                logoKey: key,
                name: acc.financialInstitution.trim(), 
                type: 'Institution', 
                count: 1, 
                originalName: acc.financialInstitution,
                totalValue: val,
                lastActivity: undefined, // Accounts don't easily track "last activity" without expensive lookups
                currency: acc.currency
            });
        }
    });

    return Array.from(map.values());
  }, [analyticsTransactions, analyticsAccounts]);

  // Filtering & Sorting
  const filteredEntities = useMemo(() => {
      let result = entities;
      
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
  }, [entities, searchTerm, sortBy]);


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
  
  const handleWipe = (logoKey: string, currentName: string) => {
    // 1. Strip known TLDs from the name to create a "clean" name
    let cleanName = currentName.toLowerCase();
    // Regex matches common TLDs at the end of the string
    cleanName = cleanName.replace(/\.(com|net|org|co\.uk|be|de|fr)$/i, '');
    // Fallback: If it still has dots, take the first part
    if (cleanName.includes('.')) {
        cleanName = cleanName.split('.')[0];
    }
    // Remove non-alphanumeric chars to be safe/clean
    cleanName = cleanName.replace(/[^a-z0-9 ]/g, '').trim();

    // 2. Set this clean name as the override
    // Because it lacks a dot, buildMerchantIdentifier will return null, forcing a lettermark.
    const key = normalizeMerchantKey(logoKey) || logoKey;
    
    setOverrideDrafts(prev => ({ ...prev, [key]: cleanName }));
    
    setPreferences(prev => {
        const nextOverrides = { ...(prev.merchantLogoOverrides || {}) };
        if (cleanName) {
            nextOverrides[key] = cleanName;
        } else {
            delete nextOverrides[key];
        }
        return { ...prev, merchantLogoOverrides: nextOverrides };
    });
  };

  const getPreviewUrl = (merchantName: string) =>
    getMerchantLogoUrl(merchantName, brandfetchClientId, overrideDrafts, { fallback: 'lettermark', type: 'icon', width: 128, height: 128 });

  const handleLogoError = (url: string) => setLogoLoadErrors(prev => ({ ...prev, [url]: true }));

  const handleRename = (oldName: string, newName: string, type: EntityType) => {
      const normalizedNewName = newName.trim();
      if (!normalizedNewName) return;

      if (type === 'Merchant') {
          const toUpdate = transactions.filter(t => t.merchant === oldName);
          const updatedTxs = toUpdate.map(t => ({ ...t, merchant: normalizedNewName }));
          if (updatedTxs.length > 0) {
              saveTransaction(updatedTxs);
          }
      } else {
          const toUpdate = accounts.filter(a => a.financialInstitution === oldName);
          toUpdate.forEach(acc => {
              saveAccount({ ...acc, financialInstitution: normalizedNewName });
          });
      }
      
      const oldKey = normalizeMerchantKey(oldName);
      const newKey = normalizeMerchantKey(normalizedNewName);
      
      if (oldKey && newKey && oldKey !== newKey && persistedOverrides[oldKey]) {
          const brandingValue = persistedOverrides[oldKey];
          setPreferences(prev => {
             const next = { ...prev.merchantLogoOverrides };
             delete next[oldKey];
             next[newKey] = brandingValue;
             return { ...prev, merchantLogoOverrides: next };
          });
      }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-8 animate-fade-in-up">
      {isRenameModalOpen && (
          <RenameModal 
            isOpen={isRenameModalOpen}
            onClose={() => setIsRenameModalOpen(false)}
            entity={editingEntity}
            onSave={handleRename}
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
          subtitle="Manage branding, names, and view aggregate volume for all entities."
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
          </div>
      ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredEntities.map(entity => {
              const previewUrl = getPreviewUrl(entity.name);
              const hasLogo = Boolean(previewUrl && !logoLoadErrors[previewUrl]);
              const draftValue = overrideDrafts[entity.logoKey] || '';
              const initialLetter = entity.name.charAt(0).toUpperCase();
              
              const isPositive = entity.totalValue >= 0;
              
              // Institutions usually show positive Balance (Green/Blue). Merchants usually show Expenses (Red/Gray).
              const accentColor = entity.type === 'Institution' 
                  ? (entity.totalValue >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500')
                  : 'text-light-text dark:text-dark-text';

              return (
                <Card key={entity.id} className="flex flex-col gap-4 group relative overflow-visible hover:border-primary-500/30 transition-colors">
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
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${entity.type === 'Institution' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                            {entity.type === 'Institution' ? 'Bank' : 'Merch'}
                        </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between group/name mb-1">
                            <h3 className="font-bold text-lg text-light-text dark:text-dark-text truncate" title={entity.name}>{entity.name}</h3>
                            <button 
                                onClick={() => { setEditingEntity(entity); setIsRenameModalOpen(true); }}
                                className="p-1 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/10 opacity-0 group-hover/name:opacity-100 transition-opacity"
                                title="Rename"
                            >
                                <span className="material-symbols-outlined text-sm">edit</span>
                            </button>
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
                            {entity.lastActivity && (
                                <div className="text-right">
                                     <p className="text-[10px] uppercase font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-wider mb-0.5">Last Seen</p>
                                     <p className="text-xs font-medium text-light-text dark:text-dark-text">
                                         {parseLocalDate(entity.lastActivity).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                                     </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Branding Override */}
                    <div className="pt-3 border-t border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] -mx-6 -mb-6 px-6 py-3 rounded-b-xl">
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider whitespace-nowrap">Brand Domain</label>
                            <input
                              type="text"
                              value={draftValue}
                              placeholder="e.g. amazon.com"
                              onChange={e => handleOverrideChange(entity.logoKey, e.target.value)}
                              onBlur={() => persistOverride(entity.logoKey)}
                              className="w-full bg-transparent border-b border-dashed border-black/20 dark:border-white/20 text-xs py-0.5 focus:border-primary-500 outline-none text-right placeholder-gray-400 dark:placeholder-gray-600"
                              disabled={!brandfetchClientId}
                            />
                            {/* Wipe Button */}
                            <button
                                onClick={() => handleWipe(entity.logoKey, entity.name)}
                                className="text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500 transition-colors p-1 -mr-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                                title="Wipe branding (revert to icon)"
                            >
                                <span className="material-symbols-outlined text-sm">ink_eraser</span>
                            </button>
                        </div>
                    </div>
                </Card>
              );
            })}
          </div>
      ) : (
          <Card className="p-0 overflow-hidden">
              <table className="w-full text-left text-sm">
                  <thead className="bg-light-bg dark:bg-white/5 border-b border-black/5 dark:border-white/5 text-xs uppercase font-bold text-light-text-secondary dark:text-dark-text-secondary tracking-wider">
                      <tr>
                          <th className="px-6 py-3">Entity</th>
                          <th className="px-6 py-3">Type</th>
                          <th className="px-6 py-3 text-right">Count</th>
                          <th className="px-6 py-3 text-right">Last Activity</th>
                          <th className="px-6 py-3 text-right">Total Value</th>
                          <th className="px-6 py-3 w-20"></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                      {filteredEntities.map(entity => {
                          const previewUrl = getPreviewUrl(entity.name);
                          const hasLogo = Boolean(previewUrl && !logoLoadErrors[previewUrl]);
                          const initialLetter = entity.name.charAt(0).toUpperCase();

                          return (
                              <tr key={entity.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                                  <td className="px-6 py-3">
                                      <div className="flex items-center gap-3">
                                           <div className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10 shadow-sm ${hasLogo ? 'bg-white dark:bg-dark-card' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                                {hasLogo && previewUrl ? (
                                                    <img src={previewUrl} alt="logo" className="w-full h-full object-cover" onError={() => handleLogoError(previewUrl)} />
                                                ) : (
                                                    <span className="font-bold text-xs">{initialLetter}</span>
                                                )}
                                           </div>
                                           <span className="font-bold text-light-text dark:text-dark-text truncate max-w-[200px]">{entity.name}</span>
                                      </div>
                                  </td>
                                  <td className="px-6 py-3">
                                       <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${entity.type === 'Institution' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                            {entity.type === 'Institution' ? 'Bank' : 'Merch'}
                                        </span>
                                  </td>
                                  <td className="px-6 py-3 text-right font-medium text-light-text-secondary dark:text-dark-text-secondary">
                                      {entity.count}
                                  </td>
                                  <td className="px-6 py-3 text-right text-light-text-secondary dark:text-dark-text-secondary text-xs">
                                      {entity.lastActivity ? parseLocalDate(entity.lastActivity).toLocaleDateString() : '—'}
                                  </td>
                                  <td className={`px-6 py-3 text-right font-mono font-bold ${entity.totalValue >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-light-text dark:text-dark-text'}`}>
                                      {formatCurrency(entity.totalValue, 'EUR')}
                                  </td>
                                  <td className="px-6 py-3 text-right">
                                       <button 
                                            onClick={() => { setEditingEntity(entity); setIsRenameModalOpen(true); }}
                                            className="p-1.5 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/10 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Rename"
                                        >
                                            <span className="material-symbols-outlined text-lg">edit</span>
                                        </button>
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
