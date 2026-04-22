
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Page, Account, Transaction } from '../types';
import { NAV_ITEMS } from '../constants';

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  setCurrentPage: (page: Page) => void;
  accounts: Account[];
  transactions: Transaction[];
  onOpenAccount: (id: string) => void;
  togglePrivacyMode: () => void;
  isPrivacyMode: boolean;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

const CommandCenter: React.FC<CommandCenterProps> = ({
  isOpen,
  onClose,
  setCurrentPage,
  accounts,
  transactions,
  onOpenAccount,
  togglePrivacyMode,
  isPrivacyMode,
  theme,
  setTheme
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    
    const items: { type: 'page' | 'account' | 'action' | 'transaction'; id: string; title: string; subtitle?: string; icon: string; action: () => void }[] = [];

    // Pages
    NAV_ITEMS.forEach(item => {
      if (!q || item.name.toLowerCase().includes(q)) {
        items.push({
          type: 'page',
          id: `page-${item.name}`,
          title: item.name,
          icon: item.icon,
          action: () => { setCurrentPage(item.name); onClose(); }
        });
      }
    });

    // Accounts
    accounts.forEach(acc => {
      if (!q || acc.name.toLowerCase().includes(q) || acc.bankName?.toLowerCase().includes(q)) {
        items.push({
          type: 'account',
          id: `acc-${acc.id}`,
          title: acc.name,
          subtitle: acc.bankName || acc.type,
          icon: 'account_balance',
          action: () => { onOpenAccount(acc.id); onClose(); }
        });
      }
    });

    // Actions
    if (!q || 'privacy'.includes(q) || 'incognito'.includes(q)) {
      items.push({
        type: 'action',
        id: 'action-privacy',
        title: isPrivacyMode ? 'Disable Privacy Mode' : 'Enable Privacy Mode',
        subtitle: 'Toggle visibility of sensitive amounts',
        icon: isPrivacyMode ? 'visibility' : 'visibility_off',
        action: () => { togglePrivacyMode(); onClose(); }
      });
    }

    if (!q || 'dark'.includes(q) || 'theme'.includes(q)) {
      items.push({
        type: 'action',
        id: 'action-theme-dark',
        title: 'Switch to Dark Mode',
        icon: 'dark_mode',
        action: () => { setTheme('dark'); onClose(); }
      });
    }
    
    if (!q || 'light'.includes(q) || 'theme'.includes(q)) {
      items.push({
        type: 'action',
        id: 'action-theme-light',
        title: 'Switch to Light Mode',
        icon: 'light_mode',
        action: () => { setTheme('light'); onClose(); }
      });
    }

    return items.slice(0, 8); // Limit results for speed/focus
  }, [query, accounts, setCurrentPage, onClose, onOpenAccount, togglePrivacyMode, isPrivacyMode, setTheme]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      if (results[selectedIndex]) {
        results[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-2xl z-[101] border border-black/5 dark:border-white/10 overflow-hidden"
          >
            <div className="p-4 border-b border-black/5 dark:border-white/10 flex items-center gap-3">
              <span className="material-symbols-outlined text-gray-400">search</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search pages, accounts, actions..."
                className="flex-1 bg-transparent border-none outline-none text-light-text dark:text-dark-text text-lg placeholder-gray-400"
              />
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded border border-black/10 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[10px] font-mono text-gray-400">ESC</kbd>
              </div>
            </div>

            <div ref={scrollRef} className="max-h-[400px] overflow-y-auto py-2">
              {results.length > 0 ? (
                results.map((item, index) => (
                  <div
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-colors ${
                      index === selectedIndex ? 'bg-primary-500/10 dark:bg-primary-500/20' : 'hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                         index === selectedIndex ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-500'
                      }`}>
                        <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${index === selectedIndex ? 'text-primary-600 dark:text-primary-400' : 'text-light-text dark:text-dark-text'}`}>
                          {item.title}
                        </p>
                        {item.subtitle && (
                          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{item.subtitle}</p>
                        )}
                      </div>
                    </div>
                    {index === selectedIndex && (
                      <span className="text-[10px] font-mono text-primary-500 font-bold uppercase tracking-widest">Enter</span>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-6 py-12 text-center">
                  <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">search_off</span>
                  <p className="text-gray-400 text-sm">No results found for "{query}"</p>
                </div>
              )}
            </div>

            <div className="p-3 bg-gray-50 dark:bg-white/5 border-t border-black/5 dark:border-white/10 flex justify-between items-center px-5">
               <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded border border-black/10 dark:border-white/10 bg-white dark:bg-black/20 text-[10px] font-mono text-gray-500">↑↓</kbd>
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">Navigate</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded border border-black/10 dark:border-white/10 bg-white dark:bg-black/20 text-[10px] font-mono text-gray-500">Enter</kbd>
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">Select</span>
                  </div>
               </div>
               <div className="text-[10px] text-gray-400 font-medium italic">
                  Tip: Press <kbd className="font-mono">⌘ K</kbd> anywhere
               </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CommandCenter;
