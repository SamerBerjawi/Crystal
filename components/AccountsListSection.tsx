import React, { useEffect, useMemo, useState } from 'react';
import { Account, AccountType, Transaction } from '../types';
import AccountCard from './AccountCard';
import SwipeableRow from './SwipeableRow';
import { convertToEur } from '../utils';
import { DEBT_TYPES } from '../constants';
import Icon from './ui/Icon';
import { IconButton } from './ui/Actions';
import { CountPill } from './ui/Display';
import type { MenuAction } from './ui/Menu';
import { Amount } from './ui/Money';
import { useIsMobile } from '../hooks/useIsMobile';
import { cn } from '../lib/utils';

interface AccountsListSectionProps {
  title: string;
  accounts: Account[];
  transactionsByAccount: Record<string, Transaction[]>;
  linkedEnableBankingAccountIds: Set<string>;
  onAccountClick: (id: string) => void;
  menuFor: (account: Account) => MenuAction[];
  onEditClick: (account: Account) => void;
  onAdjustBalanceClick: (account: Account) => void;
  onOverviewClick: (account: Account) => void;
  sortBy: 'name' | 'balance' | 'manual';
  accountOrder?: string[];
  setAccountOrder?: React.Dispatch<React.SetStateAction<string[]>>;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  layoutMode: 'stacked' | 'columns';
  viewStyle?: 'detailed' | 'minimal';
}

const AccountsListSection: React.FC<AccountsListSectionProps> = ({
  title,
  accounts,
  transactionsByAccount,
  linkedEnableBankingAccountIds,
  onAccountClick,
  menuFor,
  onEditClick,
  onAdjustBalanceClick,
  onOverviewClick,
  sortBy,
  accountOrder = [],
  setAccountOrder,
  isCollapsible = false,
  defaultExpanded = true,
  layoutMode,
  viewStyle = 'detailed',
}) => {
  const isPhone = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const sortedAccounts = useMemo(() => {
    const list = [...accounts];
    if (sortBy === 'manual') {
      return list.sort((a, b) => {
        const aIndex = accountOrder.indexOf(a.id);
        const bIndex = accountOrder.indexOf(b.id);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }
    if (sortBy === 'name') return list.sort((a, b) => a.name.localeCompare(b.name));
    return list.sort((a, b) => convertToEur(b.balance, b.currency) - convertToEur(a.balance, a.currency));
  }, [accounts, sortBy, accountOrder]);

  const groupedAccounts = useMemo(() => sortedAccounts.reduce((groups, account) => {
    (groups[account.type] = groups[account.type] || []).push(account);
    return groups;
  }, {} as Record<AccountType, Account[]>), [sortedAccounts]);

  const groupNames = useMemo(() => Object.keys(groupedAccounts).sort(), [groupedAccounts]);

  useEffect(() => {
    setExpandedGroups(prev => Object.fromEntries(groupNames.map(name => [name, prev[name] ?? true])));
  }, [groupNames]);

  const moveAccount = (id: string, target: string | undefined) => {
    if (!setAccountOrder || !target) return;
    const order = [...accountOrder];
    [id, target].forEach(item => { if (!order.includes(item)) order.push(item); });
    const from = order.indexOf(id);
    order.splice(from, 1);
    order.splice(order.indexOf(target) + (from > order.indexOf(target) ? 0 : 1), 0, id);
    setAccountOrder(order);
  };

  const dragProps = (account: Account): React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean } | undefined => (
    sortBy === 'manual' && !isPhone ? {
      draggable: true,
      onDragStart: () => setDraggedId(account.id),
      onDragOver: e => { e.preventDefault(); if (draggedId && draggedId !== account.id) setDragOverId(account.id); },
      onDragLeave: () => setDragOverId(null),
      onDragEnd: () => { setDraggedId(null); setDragOverId(null); },
      onDrop: e => {
        e.preventDefault();
        if (draggedId && draggedId !== account.id) moveAccount(draggedId, account.id);
        setDraggedId(null);
        setDragOverId(null);
      },
    } : undefined
  );

  if (accounts.length === 0) return null;

  const layout = isPhone || viewStyle === 'minimal' ? 'row' : 'card';
  const grid = layout === 'row' || layoutMode === 'stacked' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2';

  return (
    <section className="space-y-4">
      {title && (
        <div className="flex items-center gap-2">
          {isCollapsible ? (
            <button type="button" aria-expanded={isExpanded} onClick={() => setIsExpanded(open => !open)} className="flex min-h-11 cursor-pointer items-center gap-2 text-ink">
              <Icon name="expand_more" size={20} className={cn('transition-transform duration-[var(--duration-base)]', !isExpanded && '-rotate-90')} />
              <h2 className="type-section-title">{title}</h2>
            </button>
          ) : <h2 className="type-section-title text-ink">{title}</h2>}
          <CountPill count={accounts.length} />
        </div>
      )}

      {isExpanded && groupNames.map(groupName => {
        const group = groupedAccounts[groupName as AccountType];
        const isDebt = DEBT_TYPES.includes(groupName as AccountType);
        const total = group
          .filter(account => account.includeInAnalytics ?? true)
          .reduce((sum, account) => sum + convertToEur(account.balance, account.currency) * (isDebt ? -Math.sign(account.balance || 1) : 1), 0);

        return (
          <div key={groupName} className="space-y-3">
            <button
              type="button"
              aria-expanded={expandedGroups[groupName]}
              onClick={() => setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }))}
              className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-md)] text-left"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon name="expand_more" size={16} className={cn('shrink-0 text-muted transition-transform duration-[var(--duration-base)]', !expandedGroups[groupName] && '-rotate-90')} />
                <h3 className="type-label truncate text-muted">{groupName}</h3>
              </span>
              <span className="type-figure-row text-ink"><Amount value={isDebt ? -Math.abs(total) : total} currency="EUR" /></span>
            </button>

            {expandedGroups[groupName] && (
              <div className={cn('grid gap-3 md:gap-4', grid)}>
                {group.map((account, index) => {
                  const canReorder = isPhone && sortBy === 'manual';
                  const card = (
                    <AccountCard
                      account={account}
                      transactions={transactionsByAccount[account.id] || []}
                      layout={layout}
                      isLinked={linkedEnableBankingAccountIds.has(account.id)}
                      menuItems={menuFor(account)}
                      onOpen={() => onAccountClick(account.id)}
                      dragProps={dragProps(account)}
                      dragState={draggedId === account.id ? 'dragged' : dragOverId === account.id ? 'over' : null}
                      reorder={canReorder ? (
                        <>
                          <IconButton icon="arrow_upward" label={`Move ${account.name} up`} isDisabled={index === 0} onPress={() => moveAccount(account.id, group[index - 1]?.id)} />
                          <IconButton icon="arrow_downward" label={`Move ${account.name} down`} isDisabled={index === group.length - 1} onPress={() => moveAccount(account.id, group[index + 1]?.id)} />
                        </>
                      ) : undefined}
                    />
                  );
                  return isPhone ? (
                    <SwipeableRow
                      key={account.id}
                      leftActions={[
                        { icon: 'visibility', label: 'Overview', bgClass: 'bg-primary-soft', colorClass: 'text-ink', onAction: () => onOverviewClick(account) },
                        { icon: 'tune', label: 'Adjust', bgClass: 'bg-inset', colorClass: 'text-ink', onAction: () => onAdjustBalanceClick(account) },
                      ]}
                      rightActions={[{ icon: 'edit', label: 'Edit', bgClass: 'bg-inset', colorClass: 'text-ink', onAction: () => onEditClick(account) }]}
                    >
                      {card}
                    </SwipeableRow>
                  ) : <React.Fragment key={account.id}>{card}</React.Fragment>;
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
};

export default AccountsListSection;
