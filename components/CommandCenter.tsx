import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Page, Account, Transaction } from '../types';
import { NAV_ITEMS } from '../constants';
import { APP_VERSION } from '../version';
import Icon from './ui/Icon';

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
      if (!q || acc.name.toLowerCase().includes(q) || acc.financialInstitution?.toLowerCase().includes(q)) {
        items.push({
          type: 'account',
          id: `acc-${acc.id}`,
          title: acc.name,
          subtitle: acc.financialInstitution || acc.type,
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
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            className="fixed top-[12%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-light-card dark:bg-dark-card backdrop-blur-2xl dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] text-light-text dark:text-dark-text rounded-3xl shadow-2xl z-[101] border border-black/10 dark:border-white/10 overflow-hidden flex flex-col"
          >
            <div className="p-4 sm:p-5 border-b border-black/5 dark:border-white/10 flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-primary-500/10 flex items-center justify-center">
                <Icon name="search" className="text-primary-500 text-2xl" />
              </div>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What are you looking for?"
                className="flex-1 bg-transparent border-none outline-none text-light-text dark:text-dark-text text-lg sm:text-xl font-bold tracking-tight placeholder-neutral-400 dark:placeholder-neutral-500"
              />
              <div className="hidden sm:flex items-center gap-2">
                <kbd className="px-2 py-1 rounded-xl border border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 text-xs font-mono font-medium text-gray-400">ESC</kbd>
              </div>
            </div>

            <div ref={scrollRef} className="max-h-[450px] overflow-y-auto pt-2 no-scrollbar">
              {results.length > 0 ? (
                <div className="px-2 pb-2">
                  {results.map((item, index) => (
                    <div
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`px-4 py-3 sm:py-4 cursor-pointer flex items-center justify-between rounded-2xl transition-all duration-200 group ${
                        index === selectedIndex ? 'bg-primary-500 shadow-lg shadow-primary-500/20 scale-[1.02]' : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-4 sm:gap-5">
                        <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 shadow-sm border border-black/5 dark:border-white/5 transition-colors ${
                           index === selectedIndex ? 'bg-white/20 text-white' : 'bg-white dark:bg-white/5 text-gray-500 group-hover:text-primary-500'
                        }`}>
                           <Icon name={item.icon} className="text-xl sm:text-2xl" />
                        </div>
                        <div className="min-w-0">
                          <p className={`font-semibold text-sm tracking-tight truncate ${index === selectedIndex ? 'text-white' : 'text-light-text dark:text-dark-text'}`}>
                            {item.title}
                          </p>
                          {item.subtitle && (
                            <p className={`text-xs font-normal truncate mt-0.5 ${index === selectedIndex ? 'text-white/80' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{item.subtitle}</p>
                          )}
                        </div>
                      </div>
                      {index === selectedIndex && (
                        <div className="hidden sm:flex items-center gap-2 pr-2">
                            <span className="text-xs font-medium text-white/70">Select</span>
                            <kbd className="px-2 py-1 rounded-lg bg-white/20 text-xs font-mono font-medium text-white">ENTER</kbd>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-20 text-center">
                  <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-6 scale-110">
                    <Icon name="search_off" className="text-4xl text-gray-300" />
                  </div>
                  <p className="text-light-text dark:text-dark-text font-bold text-lg mb-1">No Intelligence Found</p>
                  <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm font-normal">Unable to locate records for "{query}"</p>
                </div>
              )}
            </div>

            <div className="p-5 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/5 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
               <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 rounded-lg border border-black/5 dark:border-white/10 bg-white dark:bg-black/20 text-xs font-mono font-medium text-gray-500 shadow-sm">↑↓</kbd>
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">Navigate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 rounded-lg border border-black/5 dark:border-white/10 bg-white dark:bg-black/20 text-xs font-mono font-medium text-gray-500 shadow-sm">Enter</kbd>
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">Execute</span>
                  </div>
               </div>
               <div className="flex items-center gap-3 text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">
                  <span className="font-mono text-xs text-primary-500/80">{APP_VERSION}</span>
                  <span className="opacity-40">•</span>
                  <span className="opacity-60">Shortcut: <kbd className="font-mono text-primary-500">⌘ K</kbd></span>
               </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CommandCenter;
