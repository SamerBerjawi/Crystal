
import React, { useState, useMemo, useEffect } from 'react';
import { Account, Transaction, Warrant, AccountType } from '../types';
import AccountRow from './AccountRow';
import { convertToEur, formatCurrency } from '../utils';
import { ACCOUNT_TYPE_ACCENT_STYLES } from '../constants';

interface AccountsListSectionProps {
    title: string;
    headerIcon?: React.ReactNode;
    headerSubtitle?: string;
    accounts: Account[];
    transactionsByAccount: Record<string, Transaction[]>;
    warrants: Warrant[];
    linkedEnableBankingAccountIds: Set<string>;
    onAccountClick: (id: string) => void;
    onEditClick: (account: Account) => void;
    onAdjustBalanceClick: (account: Account) => void;
    sortBy: 'name' | 'balance' | 'manual';
    accountOrder?: string[];
    setAccountOrder?: React.Dispatch<React.SetStateAction<string[]>>;
    onContextMenu: (event: React.MouseEvent, account: Account) => void;
    isCollapsible?: boolean;
    defaultExpanded?: boolean;
    layoutMode: 'stacked' | 'columns';
    showCollapseAll?: boolean;
}

const AccountsListSection: React.FC<AccountsListSectionProps> = ({ 
    title, 
    headerIcon,
    headerSubtitle,
    accounts, 
    transactionsByAccount, 
    warrants, 
    linkedEnableBankingAccountIds, 
    onAccountClick, 
    onEditClick, 
    onAdjustBalanceClick, 
    sortBy, 
    accountOrder = [], 
    setAccountOrder, 
    onContextMenu, 
    isCollapsible = true, 
    defaultExpanded = true, 
    layoutMode,
    showCollapseAll = false
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    const sortedAccounts = useMemo(() => {
        const accountsToSort = [...accounts];
        if (sortBy === 'manual') {
            return accountsToSort.sort((a,b) => {
                const aIndex = accountOrder.indexOf(a.id);
                const bIndex = accountOrder.indexOf(b.id);
                if (aIndex === -1 && bIndex === -1) return 0;
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;
                return aIndex - bIndex;
            });
        }
        if (sortBy === 'name') {
            return accountsToSort.sort((a,b) => a.name.localeCompare(b.name));
        }
        if (sortBy === 'balance') {
            return accountsToSort.sort((a,b) => convertToEur(b.balance, b.currency) - convertToEur(a.balance, a.currency));
        }
        return accountsToSort;
    }, [accounts, sortBy, accountOrder]);


    const groupedAccounts = useMemo(() => sortedAccounts.reduce((acc, account) => {
        (acc[account.type] = acc[account.type] || []).push(account);
        return acc;
    }, {} as Record<AccountType, Account[]>), [sortedAccounts]);

    const groupOrder = useMemo(() => Object.keys(groupedAccounts).sort(), [groupedAccounts]);

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    useEffect(() => {
        setExpandedGroups(prev => {
            const next: Record<string, boolean> = {};
            groupOrder.forEach(key => {
                next[key] = prev[key] ?? true;
            });
            return next;
        });
    }, [groupOrder]);

    const toggleGroup = (groupName: string) => setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));

    const isAnyExpanded = Object.values(expandedGroups).some(Boolean);
    const toggleAll = () => {
        const next: Record<string, boolean> = {};
        groupOrder.forEach(key => {
            next[key] = !isAnyExpanded;
        });
        setExpandedGroups(next);
    };

    const handleDragStart = (e: React.DragEvent, accountId: string) => { if (sortBy === 'manual') setDraggedId(accountId); };
    const handleDragOver = (e: React.DragEvent, accountId: string) => { if (sortBy === 'manual') { e.preventDefault(); if (draggedId && draggedId !== accountId) setDragOverId(accountId); }};
    const handleDragLeave = () => setDragOverId(null);
    const handleDragEnd = () => { setDraggedId(null); setDragOverId(null); };
    const handleDrop = (e: React.DragEvent, targetAccountId: string) => {
        e.preventDefault();
        if (sortBy !== 'manual' || !draggedId || draggedId === targetAccountId || !setAccountOrder) return;

        const newOrder = [...accountOrder];
        const draggedIndex = newOrder.indexOf(draggedId);
        const targetIndex = newOrder.indexOf(targetAccountId);

        if (draggedIndex > -1 && targetIndex > -1) {
            const [draggedItem] = newOrder.splice(draggedIndex, 1);
            newOrder.splice(targetIndex, 0, draggedItem);
            setAccountOrder(newOrder);
        }
        handleDragEnd();
    };

    if (accounts.length === 0) {
        return null;
    }
    
    // Updated grid classes to achieve 2-4 columns total when combined with the parent layout in Accounts.tsx
    const gridClasses = layoutMode === 'columns' 
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2' 
        : 'grid-cols-1';

    return (
        <section className="animate-fade-in-up h-full flex flex-col">
            {isCollapsible ? (
                <div 
                    onClick={() => setIsExpanded(prev => !prev)} 
                    className="flex justify-between items-center mb-6 group cursor-pointer py-2 select-none"
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-white/50 dark:bg-white/5 flex items-center justify-center transition-colors group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 border border-black/5 dark:border-white/5`}>
                             <span className={`material-symbols-outlined transition-transform duration-300 text-light-text-secondary dark:text-dark-text-secondary group-hover:text-primary-500 ${isExpanded ? 'rotate-180' : ''}`}>
                                expand_more
                            </span>
                        </div>
                        <h3 className="text-m font-black text-light-text dark:text-dark-text uppercase tracking-[0.2em]">{title}</h3>
                        <span className="bg-primary-100 dark:bg-primary-900/30 text-[10px] font-black px-2 py-0.5 rounded-full text-primary-700 dark:text-primary-300">{accounts.length}</span>
                    </div>
                    <div className="h-px flex-grow bg-black/5 dark:bg-white/5 ml-4 mr-4"></div>
                    {showCollapseAll && groupOrder.length > 1 && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); toggleAll(); }}
                            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 border border-transparent hover:border-black/5 dark:hover:border-white/5 text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500"
                            title={isAnyExpanded ? 'Collapse All Categories' : 'Expand All Categories'}
                        >
                            <span className="material-symbols-outlined text-base">{isAnyExpanded ? 'unfold_less' : 'unfold_more'}</span>
                        </button>
                    )}
                </div>
            ) : (headerIcon || title) ? (
                <div className="flex justify-between items-center mb-6 px-2 select-none">
                    <div className="flex items-center gap-3">
                        {headerIcon}
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-light-text-secondary dark:text-dark-text-secondary">{title}</h3>
                            {headerSubtitle && <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-60">{headerSubtitle}</p>}
                        </div>
                    </div>
                    {showCollapseAll && groupOrder.length > 1 && (
                        <button 
                            onClick={toggleAll}
                            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 border border-transparent hover:border-black/5 dark:hover:border-white/5 text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-500"
                            title={isAnyExpanded ? 'Collapse All Categories' : 'Expand All Categories'}
                        >
                            <span className="material-symbols-outlined text-base">{isAnyExpanded ? 'unfold_less' : 'unfold_more'}</span>
                        </button>
                    )}
                </div>
            ) : null}
            
            {isExpanded && (
                <div className="space-y-6 flex-1">
                    {groupOrder.length > 0 ? groupOrder.map(groupName => {
                        const accountsInGroup = groupedAccounts[groupName as AccountType];
                        const groupTotal = accountsInGroup
                            .filter(acc => acc.includeInAnalytics ?? true)
                            .reduce((sum, acc) => sum + convertToEur(acc.balance, acc.currency), 0);
                        return (
                            <div key={groupName} className="space-y-4">
                                <div onClick={() => toggleGroup(groupName)} className="flex justify-between items-center cursor-pointer group select-none px-2 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-1.5 h-4 rounded-full ${ACCOUNT_TYPE_ACCENT_STYLES[groupName as AccountType]?.bar || 'bg-primary-500'} transition-all duration-300 ${expandedGroups[groupName] ? 'h-4' : 'h-2 opacity-50'}`}></div>
                                        <h4 className="font-bold text-light-text dark:text-dark-text text-m tracking-tight">{groupName}</h4>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-mono text-m font-bold px-2 py-0.5 rounded-full transition-colors ${ACCOUNT_TYPE_ACCENT_STYLES[groupName as AccountType]?.pill || 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'}`}>
                                            {formatCurrency(groupTotal, 'EUR')}
                                        </span>
                                         <span className={`material-symbols-outlined text-m text-light-text-secondary dark:text-dark-text-secondary transition-transform duration-200 ${expandedGroups[groupName] ? 'rotate-0' : '-rotate-90'}`}>expand_more</span>
                                    </div>
                                </div>
                                
                                {expandedGroups[groupName] && (
                                    <div className={`grid gap-6 ${gridClasses}`}>
                                        {accountsInGroup.map(acc => (
                                            <AccountRow
                                                key={acc.id}
                                                account={acc}
                                                transactions={transactionsByAccount[acc.id] || []}
                                                warrants={warrants}
                                                isLinkedToEnableBanking={linkedEnableBankingAccountIds.has(acc.id)}
                                                onClick={() => onAccountClick(acc.id)}
                                                onEdit={() => onEditClick(acc)}
                                                onAdjustBalance={() => onAdjustBalanceClick(acc)}
                                                isDraggable={sortBy === 'manual'}
                                                isBeingDragged={draggedId === acc.id}
                                                isDragOver={dragOverId === acc.id}
                                                onDragStart={(e) => handleDragStart(e, acc.id)}
                                                onDragOver={(e) => handleDragOver(e, acc.id)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, acc.id)}
                                                onDragEnd={handleDragEnd}
                                                onContextMenu={(e) => onContextMenu(e, acc)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    }) : (
                        <div className="text-center py-16 bg-light-card/50 dark:bg-dark-card/30 rounded-3xl border-2 border-dashed border-black/5 dark:border-white/5 text-light-text-secondary dark:text-dark-text-secondary text-sm">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-30">account_balance_wallet</span>
                            <p className="font-medium">No {title.toLowerCase()} found.</p>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

export default AccountsListSection;
