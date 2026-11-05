import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Page, Account, Transaction } from '../types';
import { HUBS } from '../utils/navigation';
import { formatCurrency } from '../utils';
import Icon from './ui/Icon';
import ActionSearchBar, { type CommandItem } from './ui/action-search-bar';

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  setCurrentPage: (page: Page, tab?: string | null) => void;
  accounts: Account[];
  transactions: Transaction[];
  onOpenAccount: (id: string) => void;
  togglePrivacyMode: () => void;
  isPrivacyMode: boolean;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  onCreateTransaction?: () => void;
  onSyncBanks?: () => void;
  onLock?: () => void;
  onOpenShortcuts?: () => void;
  onOpenSetupWizard?: () => void;
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
  onCreateTransaction,
  onSyncBanks,
  onLock,
  onOpenShortcuts,
  onOpenSetupWizard,
}) => {
  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [];
    const seenPages = new Set<string>();

    // Pages from all 7 navigation hubs (including Goals, Profile, Preferences, etc.)
    HUBS.forEach(hub => {
      if (hub.tabs.length === 0) {
        seenPages.add(hub.home);
        list.push({
          id: `page-${hub.home}`,
          label: hub.label,
          group: 'Pages',
          icon: <Icon name={hub.icon} size={16} />,
          keywords: ['navigate', 'page', 'go to', hub.label.toLowerCase(), hub.home.toLowerCase()],
        });
      } else {
        hub.tabs.forEach(tab => {
          const key = tab.tab ? `${tab.page}?tab=${tab.tab}` : tab.page;
          if (seenPages.has(key)) return;
          seenPages.add(key);
          list.push({
            id: `page-${key}`,
            label: `${hub.label} › ${tab.label}`,
            group: 'Pages',
            icon: <Icon name={tab.icon || hub.icon} size={16} />,
            keywords: ['navigate', 'page', 'go to', hub.label.toLowerCase(), tab.label.toLowerCase(), tab.page.toLowerCase()],
          });
        });
      }
    });

    // Quick Actions
    if (onCreateTransaction) {
      list.push({
        id: 'action-new-tx',
        label: 'Add Transaction',
        group: 'Actions',
        icon: <Icon name="add-01" size={16} />,
        keywords: ['create', 'add', 'new', 'transaction', 'expense', 'income', 'transfer'],
        shortcut: ['N'],
      });
    }

    if (onSyncBanks) {
      list.push({
        id: 'action-sync-banks',
        label: 'Sync Connected Banks',
        group: 'Actions',
        icon: <Icon name="sync_banks" size={16} />,
        keywords: ['sync', 'bank', 'refresh', 'enable banking', 'fetch'],
      });
    }

    list.push({
      id: 'action-privacy',
      label: isPrivacyMode ? 'Disable Privacy Mode' : 'Enable Privacy Mode',
      group: 'Actions',
      icon: <Icon name={isPrivacyMode ? 'visibility' : 'visibility_off'} size={16} />,
      keywords: ['privacy', 'incognito', 'hide', 'show', 'amounts'],
      shortcut: ['⇧', 'P'],
    });

    if (onLock) {
      list.push({
        id: 'action-lock',
        label: 'Lock Crystal',
        group: 'Actions',
        icon: <Icon name="lock" size={16} />,
        keywords: ['lock', 'pin', 'security', 'screen'],
        shortcut: ['L'],
      });
    }

    if (onOpenShortcuts) {
      list.push({
        id: 'action-shortcuts',
        label: 'Keyboard Shortcuts',
        group: 'Actions',
        icon: <Icon name="keyboard" size={16} />,
        keywords: ['shortcuts', 'hotkeys', 'keys', 'help'],
        shortcut: ['?'],
      });
    }

    if (onOpenSetupWizard) {
      list.push({
        id: 'action-onboarding',
        label: 'Run Setup Wizard',
        group: 'Actions',
        icon: <Icon name="compass-01" size={16} />,
        keywords: ['onboarding', 'setup', 'wizard', 'getting started', 'currency'],
      });
    }

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

    // Accounts
    accounts.forEach(acc => {
      list.push({
        id: `acc-${acc.id}`,
        label: acc.name,
        group: 'Accounts',
        icon: <Icon name="bank" size={16} />,
        keywords: ['account', acc.type, acc.financialInstitution || '', acc.currency || ''],
      });
    });

    // Recent Transactions
    transactions.slice(0, 8).forEach(tx => {
      const title = tx.merchant || tx.description || 'Transaction';
      const isOutflow = tx.type === 'expense' || tx.amount < 0;
      const formattedAmount = isPrivacyMode
        ? '••••'
        : `${isOutflow ? '−' : '+'}${formatCurrency(Math.abs(tx.amount), tx.currency || 'EUR')}`;
      list.push({
        id: `tx-${tx.id}`,
        label: `${title} (${formattedAmount})`,
        group: 'Recent Transactions',
        icon: <Icon name="receipt" size={16} />,
        keywords: ['transaction', tx.merchant || '', tx.description || '', tx.category || ''],
      });
    });

    return list;
  }, [accounts, isPrivacyMode, onCreateTransaction, onLock, onOpenSetupWizard, onOpenShortcuts, onSyncBanks, theme, transactions]);

  const handleSelect = (item: CommandItem) => {
    if (item.id.startsWith('page-')) {
      const raw = item.id.replace('page-', '');
      const [pageName, queryPart] = raw.split('?tab=');
      setCurrentPage(pageName as Page, queryPart ?? null);
      onClose();
      return;
    }
    if (item.id === 'action-new-tx') {
      onClose();
      onCreateTransaction?.();
      return;
    }
    if (item.id === 'action-sync-banks') {
      onClose();
      onSyncBanks?.();
      return;
    }
    if (item.id === 'action-lock') {
      onClose();
      onLock?.();
      return;
    }
    if (item.id === 'action-shortcuts') {
      onClose();
      onOpenShortcuts?.();
      return;
    }
    if (item.id === 'action-onboarding') {
      onClose();
      onOpenSetupWizard?.();
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
