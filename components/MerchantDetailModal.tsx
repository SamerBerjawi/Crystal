
import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { Category, MerchantRule } from '../types';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE, INPUT_BASE_STYLE, SELECT_ARROW_STYLE, SELECT_WRAPPER_STYLE, CHECKBOX_STYLE } from '../constants';
import { formatCurrency, parseLocalDate } from '../utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getMerchantLogoUrl } from '../utils/brandfetch';

interface MerchantDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    merchantName: string;
    logoKey: string;
    initialRule?: MerchantRule;
    onSave: (key: string, rule: MerchantRule) => void;
    incomeCategories: Category[];
    expenseCategories: Category[];
    transactions: any[]; // Passed to show simple stats
    brandfetchClientId?: string;
}

const CategoryOptions: React.FC<{ categories: Category[] }> = ({ categories }) => (
    <>
      <option value="">No Default</option>
      {categories.map(parentCat => (
        <optgroup key={parentCat.id} label={parentCat.name}>
          <option value={parentCat.name}>{parentCat.name}</option>
          {parentCat.subCategories.map(subCat => (
            <option key={subCat.id} value={subCat.name}>
              &nbsp;&nbsp;{subCat.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
);

const MerchantDetailModal: React.FC<MerchantDetailModalProps> = ({ 
    isOpen, 
    onClose, 
    merchantName, 
    logoKey, 
    initialRule, 
    onSave, 
    incomeCategories, 
    expenseCategories,
    transactions,
    brandfetchClientId
}) => {
    const [activeTab, setActiveTab] = useState<'settings' | 'stats'>('settings');
    const [category, setCategory] = useState(initialRule?.category || '');
    const [website, setWebsite] = useState(initialRule?.website || '');
    const [logo, setLogo] = useState(initialRule?.logo || '');
    const [isHidden, setIsHidden] = useState(initialRule?.isHidden || false);
    const [defaultDescription, setDefaultDescription] = useState(initialRule?.defaultDescription || '');
    const [notes, setNotes] = useState(initialRule?.notes || '');

    // Initialize with smart guesses if rule doesn't exist
    useEffect(() => {
        if (!initialRule) {
             // If no website set, try to guess from logo key if it looks like a domain
             if (logoKey.includes('.')) {
                 setWebsite(`https://${logoKey}`);
             }
        }
    }, [initialRule, logoKey]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(logoKey, {
            category: category || undefined,
            website: website || undefined,
            logo: logo || undefined,
            isHidden,
            defaultDescription: defaultDescription || undefined,
            notes: notes || undefined
        });
        onClose();
    };
    
    // Calculate basic stats for the merchant
    const stats = useMemo(() => {
        const merchantTxs = transactions.filter(t => t.merchant === merchantName);
        const totalCount = merchantTxs.length;
        const totalAmount = merchantTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;
        
        // Monthly trend (last 6 months)
        const today = new Date();
        const chartData = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthKey = d.toLocaleString('default', { month: 'short' });
            const start = new Date(d.getFullYear(), d.getMonth(), 1);
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            
            const monthTotal = merchantTxs
                .filter(t => {
                    const td = parseLocalDate(t.date);
                    return td >= start && td <= end;
                })
                .reduce((sum, t) => sum + Math.abs(t.amount), 0);
                
            chartData.push({ name: monthKey, value: monthTotal });
        }
        
        return { totalCount, totalAmount, averageAmount, chartData };
    }, [transactions, merchantName]);

    const allCategories = [...expenseCategories, ...incomeCategories];
    const previewLogoUrl = getMerchantLogoUrl(merchantName, brandfetchClientId, { [logoKey]: logo || logoKey }, { fallback: 'lettermark', type: 'icon', width: 80, height: 80 });

    const labelStyle = "block text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1.5";

    return (
        <Modal onClose={onClose} title="Merchant Details">
            <div className="flex flex-col gap-6">
                
                {/* Header */}
                <div className="flex items-center gap-4">
                     <div className="w-16 h-16 rounded-xl border border-black/5 dark:border-white/10 shadow-sm overflow-hidden flex items-center justify-center bg-white dark:bg-dark-card">
                         {previewLogoUrl ? (
                             <img src={previewLogoUrl} alt={merchantName} className="w-full h-full object-contain" />
                         ) : (
                             <span className="text-2xl font-bold text-gray-400">{merchantName.charAt(0)}</span>
                         )}
                     </div>
                     <div>
                         <h2 className="text-xl font-bold text-light-text dark:text-dark-text">{merchantName}</h2>
                         <div className="flex items-center gap-2 mt-1">
                             {website && (
                                 <a href={website} target="_blank" rel="noreferrer" className="text-xs text-primary-500 hover:underline flex items-center gap-1">
                                     {website.replace(/^https?:\/\//, '')} <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                                 </a>
                             )}
                             {isHidden && <span className="text-[10px] bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-gray-500 font-bold uppercase tracking-wide">Hidden</span>}
                         </div>
                     </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
                    <button 
                        type="button"
                        onClick={() => setActiveTab('settings')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'settings' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Settings
                    </button>
                    <button 
                        type="button"
                        onClick={() => setActiveTab('stats')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'stats' ? 'bg-white dark:bg-dark-card shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        History & Stats
                    </button>
                </div>

                {activeTab === 'settings' ? (
                    <form id="merchant-form" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className={labelStyle}>Default Category</label>
                            <div className={SELECT_WRAPPER_STYLE}>
                                <select 
                                    value={category} 
                                    onChange={e => setCategory(e.target.value)} 
                                    className={INPUT_BASE_STYLE}
                                >
                                    <CategoryOptions categories={allCategories} />
                                </select>
                                <div className={SELECT_ARROW_STYLE}><span className="material-symbols-outlined">expand_more</span></div>
                            </div>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                Automatically apply this category to future transactions from this merchant.
                            </p>
                        </div>
                        
                        <div>
                            <label className={labelStyle}>Default Description</label>
                             <input 
                                type="text" 
                                value={defaultDescription} 
                                onChange={e => setDefaultDescription(e.target.value)} 
                                className={INPUT_BASE_STYLE} 
                                placeholder="e.g. Monthly Subscription" 
                            />
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                Prefills the description field when creating a new transaction for this merchant.
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div>
                                <label className={labelStyle}>Brand Domain</label>
                                <input 
                                    type="text" 
                                    value={logo} 
                                    onChange={e => setLogo(e.target.value)} 
                                    className={INPUT_BASE_STYLE} 
                                    placeholder="e.g. netflix.com" 
                                />
                             </div>
                             <div>
                                <label className={labelStyle}>Website URL</label>
                                <input 
                                    type="text" 
                                    value={website} 
                                    onChange={e => setWebsite(e.target.value)} 
                                    className={INPUT_BASE_STYLE} 
                                    placeholder="https://..." 
                                />
                             </div>
                        </div>

                        <div>
                            <label className={labelStyle}>Notes</label>
                            <textarea 
                                value={notes} 
                                onChange={e => setNotes(e.target.value)} 
                                className={INPUT_BASE_STYLE} 
                                rows={2} 
                                placeholder="Contract details, support number, etc." 
                            />
                        </div>

                        <div className="pt-2">
                             <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-black/5 dark:hover:border-white/10">
                                <input 
                                    type="checkbox" 
                                    checked={isHidden} 
                                    onChange={e => setIsHidden(e.target.checked)} 
                                    className={CHECKBOX_STYLE} 
                                />
                                <span className="text-sm font-medium text-light-text dark:text-dark-text">Hide from merchant lists</span>
                            </label>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                             <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/5 text-center">
                                 <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1">Lifetime</p>
                                 <p className="text-lg font-bold text-light-text dark:text-dark-text">{formatCurrency(stats.totalAmount, 'EUR')}</p>
                             </div>
                             <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/5 text-center">
                                 <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1">Avg Ticket</p>
                                 <p className="text-lg font-bold text-light-text dark:text-dark-text">{formatCurrency(stats.averageAmount, 'EUR')}</p>
                             </div>
                             <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/5 text-center">
                                 <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-1">Transactions</p>
                                 <p className="text-lg font-bold text-light-text dark:text-dark-text">{stats.totalCount}</p>
                             </div>
                        </div>

                        <div className="h-48 w-full">
                            <h4 className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-2">Spending Trend (6mo)</h4>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.chartData}>
                                    <Tooltip 
                                        cursor={{fill: 'transparent'}}
                                        contentStyle={{ backgroundColor: 'var(--light-card)', borderColor: 'rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '12px' }}
                                        formatter={(val: number) => [formatCurrency(val, 'EUR'), 'Spent']}
                                    />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }} />
                                    <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="flex justify-end gap-3 pt-4 border-t border-black/5 dark:border-white/5">
                        <button type="button" onClick={onClose} className={BTN_SECONDARY_STYLE}>Cancel</button>
                        <button type="submit" form="merchant-form" className={BTN_PRIMARY_STYLE}>Save Changes</button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default MerchantDetailModal;
