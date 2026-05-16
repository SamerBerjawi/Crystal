
import React, { useState } from 'react';
import Modal from './Modal';
import { Account, PriceHistoryEntry } from '../types';
import { INPUT_BASE_STYLE, BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import { formatCurrency, toLocalISOString, parseLocalDate } from '../utils';

interface PropertyValuationModalProps {
  onClose: () => void;
  onSave: (newValue: number, date: string) => void;
  onDeleteEntry?: (date: string) => void;
  account: Account;
}

const PropertyValuationModal: React.FC<PropertyValuationModalProps> = ({ onClose, onSave, onDeleteEntry, account }) => {
  const [newValue, setNewValue] = useState(String(account.balance));
  const [date, setDate] = useState(toLocalISOString(new Date()));
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newValue);
    if (!isNaN(val)) {
        onSave(val, date);
    }
  };
  
  const labelStyle = "block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1";
  
    return (
        <Modal onClose={onClose} title={`Value Update: ${account.name}`}>
            <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in-up">
                
                {/* Hero section for current and appreciation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-dark-card p-6 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm text-center relative overflow-hidden group">
                        <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary-500/5 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-700" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-50 mb-2">Current Benchmark</p>
                        <p className="text-2xl font-black tabular-nums tracking-tighter text-light-text dark:text-dark-text group-hover:text-primary-500 transition-colors">
                            {formatCurrency(account.balance, account.currency)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-dark-card p-6 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm text-center relative overflow-hidden group">
                        <div className={`absolute -top-12 -right-12 w-24 h-24 ${(parseFloat(newValue) - account.balance) >= 0 ? 'bg-emerald-500/5' : 'bg-rose-500/5'} blur-3xl rounded-full group-hover:scale-150 transition-transform duration-700`} />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary opacity-50 mb-2">Projected Appreciation</p>
                        <p className={`text-2xl font-black tabular-nums tracking-tighter ${(parseFloat(newValue) - account.balance) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {(parseFloat(newValue) - account.balance) >= 0 ? '+' : ''}{formatCurrency(parseFloat(newValue) - account.balance, account.currency)}
                        </p>
                    </div>
                </div>

                {/* Configuration Card */}
                <div className="bg-gray-50/50 dark:bg-white/[0.02] rounded-[2.5rem] border border-black/5 dark:border-white/5 p-8 space-y-8">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-orange-500 text-lg">assessment</span>
                            </div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-light-text-secondary dark:text-dark-text-secondary">Valuation Specifications</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                            <div className="md:col-span-3">
                                <label htmlFor="new-value" className="block text-[10px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-3 ml-1">Market Assessment</label>
                                <div className="relative group">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 font-black text-sm">{account.currency === 'EUR' ? '€' : account.currency === 'USD' ? '$' : account.currency}</span>
                                    <input
                                        id="new-value"
                                        type="number"
                                        step="any"
                                        value={newValue}
                                        onChange={(e) => setNewValue(e.target.value)}
                                        className="w-full bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-2xl pl-12 pr-6 h-14 text-lg font-black outline-none focus:ring-4 focus:ring-primary-500/10 transition-all"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <p className="mt-3 text-[10px] font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/40 italic ml-1 leading-relaxed">The equity statement will be adjusted to reflect this updated market position.</p>
                            </div>
                            
                            <div className="md:col-span-2">
                                <label htmlFor="valuation-date" className="block text-[10px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-3 ml-1">Effective Date</label>
                                <input
                                    id="valuation-date"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full bg-white dark:bg-dark-card border border-black/5 dark:border-white/5 rounded-2xl px-6 h-14 text-sm font-black outline-none focus:ring-4 focus:ring-primary-500/10 transition-all"
                                    required
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-4 p-2">
                    <button type="button" onClick={onClose} className="h-14 px-8 rounded-2xl text-[10px] uppercase font-black tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-all">Cancel</button>
                    <button type="submit" className={`${BTN_PRIMARY_STYLE} h-14 px-10 rounded-2xl text-[10px] uppercase font-black tracking-[0.2em] shadow-lg shadow-primary-500/20`}>Confirm New Valuation</button>
                </div>
            </form>

            {account.priceHistory && account.priceHistory.length > 0 && (
                <div className="mt-12 pt-12 border-t border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-3 mb-8 ml-2">
                        <div className="w-8 h-8 rounded-xl bg-gray-500/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-gray-500 text-lg">history_edu</span>
                        </div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-light-text-secondary dark:text-dark-text-secondary">Valuation History Ledger</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar p-2">
                        {[...account.priceHistory].reverse().map((entry, idx) => (
                            <div key={idx} className="group/entry bg-white dark:bg-dark-card p-5 rounded-[1.5rem] border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md hover:border-primary-500/20 transition-all flex justify-between items-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary-500 opacity-0 group-hover/entry:opacity-100 transition-opacity" />
                                <div className="space-y-1">
                                    <p className="text-base font-black text-light-text dark:text-dark-text tracking-tighter tabular-nums">{formatCurrency(entry.price, account.currency)}</p>
                                    <p className="text-[10px] font-bold text-light-text-secondary/40 dark:text-dark-text-secondary/40 uppercase tracking-widest">{parseLocalDate(entry.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setNewValue(String(entry.price));
                                            setDate(entry.date);
                                        }}
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-primary-500 hover:bg-primary-500/10 transition-all"
                                        title="Edit entry"
                                    >
                                        <span className="material-symbols-outlined text-lg">edit_note</span>
                                    </button>
                                    {onDeleteEntry && (
                                        <button 
                                            type="button"
                                            onClick={() => onDeleteEntry(entry.date)}
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-rose-500 hover:bg-rose-500/10 transition-all"
                                            title="Delete entry"
                                        >
                                            <span className="material-symbols-outlined text-lg">delete_sweep</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default PropertyValuationModal;
