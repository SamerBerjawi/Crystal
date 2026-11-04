import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Page, Account, Transaction } from '../types';
import { NAV_ITEMS } from '../constants';
import Icon from './ui/Icon';
import ActionSearchBar, { type CommandItem } from './ui/action-search-bar';

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
  setTheme,
}) => {
  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [];

    // Pages
    NAV_ITEMS.forEach(nav => {
      list.push({
        id: `page-${nav.name}`,
        label: nav.name,
        group: 'Pages',
        icon: <Icon name={nav.icon} size={16} />,
        keywords: ['navigate', 'page', 'go to', nav.name.toLowerCase()],
      });
    });

    // Accounts
    accounts.forEach(acc => {
      list.push({
        id: `acc-${acc.id}`,
        label: acc.name,
        group: 'Accounts',
        icon: <Icon name="account_balance" size={16} />,
        keywords: ['account', acc.type, acc.financialInstitution || '', acc.currency || ''],
      });
    });

    // Actions
    list.push({
      id: 'action-privacy',
      label: isPrivacyMode ? 'Disable Privacy Mode' : 'Enable Privacy Mode',
      group: 'Actions',
      icon: <Icon name={isPrivacyMode ? 'visibility' : 'visibility_off'} size={16} />,
      keywords: ['privacy', 'incognito', 'hide', 'show', 'amounts'],
      shortcut: ['⇧', 'P'],
    });

    list.push({
      id: 'action-theme',
      label: 'Change Theme',
      group: 'Actions',
      icon: <Icon name={theme === 'dark' ? 'dark_mode' : 'light_mode'} size={16} />,
      keywords: ['theme', 'appearance', 'dark', 'light', 'mode'],
      placeholder: 'Choose a theme…',
      children: [
        { id: 'theme-light', label: 'Light Mode', group: 'Theme', icon: <Icon name="light_mode" size={16} /> },
        { id: 'theme-dark', label: 'Dark Mode', group: 'Theme', icon: <Icon name="dark_mode" size={16} /> },
        { id: 'theme-system', label: 'Match System', group: 'Theme', icon: <Icon name="settings_suggest" size={16} /> },
      ],
    });

    // Recent Transactions
    transactions.slice(0, 8).forEach(tx => {
      const title = tx.merchant || tx.description || 'Transaction';
      list.push({
        id: `tx-${tx.id}`,
        label: `${title} (${tx.amount < 0 ? '−' : '+'}${Math.abs(tx.amount)} ${tx.currency})`,
        group: 'Recent Transactions',
        icon: <Icon name="receipt" size={16} />,
        keywords: ['transaction', tx.merchant || '', tx.description || '', tx.category || ''],
      });
    });

    return list;
  }, [accounts, isPrivacyMode, theme, transactions]);

  const handleSelect = (item: CommandItem) => {
    if (item.id.startsWith('page-')) {
      const pageName = item.id.replace('page-', '') as Page;
      setCurrentPage(pageName);
      onClose();
      return;
    }
    if (item.id.startsWith('acc-')) {
      const accId = item.id.replace('acc-', '');
      onOpenAccount(accId);
      onClose();
      return;
    }
    if (item.id.startsWith('tx-')) {
      const txId = item.id.replace('tx-', '');
      const tx = transactions.find(t => t.id === txId);
      if (tx?.accountId) {
        onOpenAccount(tx.accountId);
      } else {
        setCurrentPage('Transactions');
      }
      onClose();
      return;
    }
    if (item.id === 'action-privacy') {
      togglePrivacyMode();
      onClose();
      return;
    }
    if (item.id === 'theme-light') {
      setTheme('light');
      onClose();
      return;
    }
    if (item.id === 'theme-dark') {
      setTheme('dark');
      onClose();
      return;
    }
    if (item.id === 'theme-system') {
      setTheme('system');
      onClose();
      return;
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[var(--z-overlay)] flex items-start justify-center pt-[10vh] px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 scrim"
              onClick={onClose}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              className="relative z-10 w-full max-w-xl"
              onClick={e => e.stopPropagation()}
            >
              <ActionSearchBar
                defaultOpen={true}
                items={items}
                onSelect={handleSelect}
                onOpenChange={open => {
                  if (!open) onClose();
                }}
                placeholder="What are you looking for?"
                className="w-full max-w-xl"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CommandCenter;
