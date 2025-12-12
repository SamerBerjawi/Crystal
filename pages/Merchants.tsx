
import React, { useEffect, useMemo, useState } from 'react';
import { Page, Transaction, Account } from '../types';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE } from '../constants';
import { useAccountsContext, usePreferencesContext, usePreferencesSelector, useTransactionsContext } from '../contexts/DomainProviders';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';
import { fuzzySearch } from '../utils';

interface MerchantsProps {
  setCurrentPage: (page: Page) => void;
}

type EntityType = 'Merchant' | 'Institution';

interface EntityItem {
    id: string; // normalized key
    name: string;
    type: EntityType;
    count: number;
    originalName: string; // Case sensitive
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
  const [sortBy, setSortBy] = useState<'name' | 'count'>('count');
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>(persistedOverrides);
  const [logoLoadErrors, setLogoLoadErrors] = useState<Record<string, boolean>>({});
  
  const [editingEntity, setEditingEntity] = useState<EntityItem | null>(null);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);

  useEffect(() => {
    setOverrideDrafts(persistedOverrides);
  }, [persistedOverrides]);

  // Aggregation Logic
  const entities = useMemo(() => {
    const map = new Map<string, EntityItem>();

    // 1. Process Merchants from Transactions
    transactions.forEach(tx => {
      if (!tx.merchant) return;
      const key = normalizeMerchantKey(tx.merchant);
      if (!key) return;
      
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { id: key, name: tx.merchant.trim(), type: 'Merchant', count: 1, originalName: tx.merchant });
      }
    });

    // 2. Process Financial Institutions from Accounts
    accounts.forEach(acc => {
        if (!acc.financialInstitution) return;
        const key = normalizeMerchantKey(acc.financialInstitution);
        if (!key) return;

        const existing = map.get(key);
        if (existing) {
            // If exists (rare collision between merchant and bank name), just count it or prioritize Institution labeling?
            // Let's keep them separate by appending a suffix if needed, but for now assuming distinct namespaces mostly.
            // Actually, let's treat them as distinct entities if possible, but map key collision merges them.
            // If a collision happens (e.g. "Chase" merchant vs "Chase" bank), merging is visually cleaner.
            existing.count += 1;
            // Upgrade type to Institution if matched, or keep mixed. 
            if (existing.type === 'Merchant') existing.type = 'Institution'; 
        } else {
            map.set(key, { id: key, name: acc.financialInstitution.trim(), type: 'Institution', count: 1, originalName: acc.financialInstitution });
        }
    });

    return Array.from(map.values());
  }, [transactions, accounts]);

  // Filtering & Sorting
  const filteredEntities = useMemo(() => {
      let result = entities;
      
      if (searchTerm) {
          result = result.filter(e => fuzzySearch(searchTerm, e.name));
      }
      
      return result.sort((a, b) => {
          if (sortBy === 'count') {
              return b.count - a.count;
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
      
      // Also migrate branding override if it exists
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
    <div className="max-w-6xl mx-auto pb-12 space-y-8 animate-fade-in-up">
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
          subtitle="Manage branding, names, and view transaction counts for all entities in your ledger."
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
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-dark-card p-2 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
           <div className="relative w-full sm:max-w-xs">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary">search</span>
                <input 
                    type="text" 
                    placeholder="Search entities..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className={`${INPUT_BASE_STYLE} pl-10 border-none bg-transparent shadow-none focus:ring-0`}
                />
           </div>
           
           <div className="flex items-center gap-2 w-full sm:w-auto">
               <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary whitespace-nowrap px-2">Sort by:</span>
               <div className={`${SELECT_WRAPPER_STYLE} !w-auto`}>
                   <select 
                        value={sortBy} 
                        onChange={(e) => setSortBy(e.target.value as 'name' | 'count')} 
                        className={`${INPUT_BASE_STYLE} pr-8 !py-1.5 h-9 text-sm`}
                   >
                       <option value="count">Count (High-Low)</option>
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
      ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredEntities.map(entity => {
              const previewUrl = getPreviewUrl(entity.name);
              const hasLogo = Boolean(previewUrl && !logoLoadErrors[previewUrl]);
              const draftValue = overrideDrafts[entity.id] || '';
              const initialLetter = entity.name.charAt(0).toUpperCase();

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
                        <div className="flex items-center justify-between group/name">
                            <h3 className="font-bold text-lg text-light-text dark:text-dark-text truncate" title={entity.name}>{entity.name}</h3>
                            <button 
                                onClick={() => { setEditingEntity(entity); setIsRenameModalOpen(true); }}
                                className="p-1 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/10 opacity-0 group-hover/name:opacity-100 transition-opacity"
                                title="Rename"
                            >
                                <span className="material-symbols-outlined text-sm">edit</span>
                            </button>
                        </div>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">
                            {entity.count} {entity.type === 'Merchant' ? 'transactions' : 'accounts'}
                        </p>
                    </div>

                    {/* Branding Override */}
                    <div className="pt-3 border-t border-black/5 dark:border-white/5">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Logo ID</label>
                            <input
                              type="text"
                              value={draftValue}
                              placeholder="Auto-detected"
                              onChange={e => handleOverrideChange(entity.id, e.target.value)}
                              onBlur={() => persistOverride(entity.id)}
                              className={`${INPUT_BASE_STYLE} !py-1 !px-2 !text-xs !h-7 bg-gray-50 dark:bg-black/20 border-transparent focus:bg-white dark:focus:bg-black/40`}
                              disabled={!brandfetchClientId}
                            />
                        </div>
                    </div>
                </Card>
              );
            })}
          </div>
      )}
    </div>
  );
};

export default Merchants;
