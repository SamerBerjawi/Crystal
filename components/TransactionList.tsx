import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useWidgetBox } from './ui/WidgetGrid';
import { Category, DisplayTransaction, Tag, Account } from '../types';
import { convertToMain, parseLocalDate, formatDate as formatSharedDate, getMainCurrency } from '../utils';
import { useThrottledCallback } from '../hooks/useThrottledCallback';
import { useAccountsContext, usePreferencesSelector } from '../contexts/DomainProviders';
import { useTagsContext } from '../contexts/FinancialDataContext';
import { EntityGlyph, MerchantLogo } from './EntityIcon';
import Icon from './ui/Icon';
import { Amount } from './ui/Money';
import { EmptyState } from './ui/States';

interface TransactionListProps {
  transactions: DisplayTransaction[];
  allCategories: Category[];
  onTransactionClick?: (transaction: DisplayTransaction) => void;
  density?: 'default' | 'high';
  maxItems?: number;
  size?: 's' | 'm' | 'l';
  className?: string;
}

const buildCategoryDetailsMap = (categories: Category[]) => {
  const detailsMap = new Map<string, { icon?: string; color?: string }>();
  const walk = (nodes: Category[], parentIcon?: string, parentColor?: string) => {
    nodes.forEach(node => {
      detailsMap.set(node.name, { icon: node.icon || parentIcon, color: node.color || parentColor });
      if (node.subCategories.length > 0) walk(node.subCategories, node.icon || parentIcon, node.color || parentColor);
    });
  };
  walk(categories);
  return detailsMap;
};

/** A short, virtualised list of transactions for Overview and the account page. Logos follow the Merchants rule (D-127). */
const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  allCategories,
  onTransactionClick,
  density = 'default',
  maxItems,
  size,
  className = ''
}) => {
  // Inside a widget the list fills the room it is given and scrolls, so the widget decides how many rows show.
  const inWidget = useWidgetBox().height > 0;
  const effectiveMaxItems = inWidget ? undefined : size ? (size === 's' ? 4 : size === 'm' ? 8 : (maxItems ?? 15)) : maxItems;
  const { tags } = useTagsContext();
  const { accounts } = useAccountsContext();
  const userDateFormat = usePreferencesSelector(p => p.dateFormat);

  const accountMap = useMemo(() => accounts.reduce((acc, a) => {
    acc[a.id] = a;
    if (a.name) acc[a.name] = a;
    return acc;
  }, {} as Record<string, Account>), [accounts]);

  const categoryDetailsMap = useMemo(() => buildCategoryDetailsMap(allCategories), [allCategories]);

  const preparedTransactions = useMemo(() => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const formatDate = (dateString: string) => {
      if (!dateString) return '';
      const date = parseLocalDate(dateString);
      if (date.toDateString() === today.toDateString()) return 'Today';
      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return formatSharedDate(date, { format: userDateFormat, style: 'short' });
    };

    const list = effectiveMaxItems ? transactions.slice(0, effectiveMaxItems) : transactions;
    return list.map(tx => {
      const isTransfer = !!tx.isTransfer;
      const category = categoryDetailsMap.get(tx.category) || {};
      return {
        tx,
        isTransfer,
        description: isTransfer ? (tx.transferLabel || tx.description || `${tx.fromAccountName} → ${tx.toAccountName}`) : tx.description,
        account: (tx.accountId ? accountMap[tx.accountId] : null) || (tx.accountName ? accountMap[tx.accountName] : null),
        category,
        formattedDate: formatDate(tx.date),
        txTags: (tx.tagIds || []).map(id => tags.find(t => t.id === id)).filter(Boolean) as Tag[],
      };
    });
  }, [transactions, categoryDetailsMap, effectiveMaxItems, tags, accountMap, userDateFormat]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(960);

  const ROW_HEIGHT = density === 'high' ? 60 : 68;
  const OVERSCAN = 8;

  const handleScroll = useThrottledCallback((position: number) => setScrollTop(position), 100);
  const handleResize = useThrottledCallback((height: number) => setViewportHeight(height), 100);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const onScroll = () => handleScroll(node.scrollTop);
    const resizeObserver = new ResizeObserver(entries => handleResize(entries[0].contentRect.height));
    node.addEventListener('scroll', onScroll);
    resizeObserver.observe(node);
    return () => {
      node.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
    };
  }, [handleResize, handleScroll]);

  if (preparedTransactions.length === 0) {
    return <EmptyState icon="invoice-03" title="No transactions" description="Nothing to show for this view yet." className={`py-8 ${className}`} />;
  }

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(preparedTransactions.length, startIndex + Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2);
  const visibleTransactions = preparedTransactions.slice(startIndex, endIndex);
  const mainCurrency = getMainCurrency();

  return (
    <div
      ref={containerRef}
      className={`no-scrollbar relative -mx-2 w-full overflow-y-auto ${className} ${effectiveMaxItems ? '' : 'h-full'}`}
      style={effectiveMaxItems ? { maxHeight: `${effectiveMaxItems * ROW_HEIGHT}px` } : {}}
    >
      <div style={{ height: preparedTransactions.length * ROW_HEIGHT }} aria-hidden />
      <ul className="absolute inset-x-0 top-0" style={{ transform: `translateY(${startIndex * ROW_HEIGHT}px)` }}>
        {visibleTransactions.map(({ tx, isTransfer, description, account, category, formattedDate, txTags }) => (
          <li key={tx.id} style={{ height: ROW_HEIGHT }}>
            <button
              type="button"
              onClick={() => onTransactionClick?.(tx)}
              className={`flex h-full w-full items-center gap-3 rounded-[var(--radius-md)] px-2 text-left transition-colors hover:bg-inset focus-visible:outline-2 focus-visible:outline-[var(--focus)] ${tx.parentTransactionId ? 'pl-6' : ''}`}
            >
              {tx.parentTransactionId && <Icon name="CornerDownRight" size={16} className="-ml-4 shrink-0 text-muted" />}
              <MerchantLogo merchant={tx.merchant} description={tx.description} name={tx.toAccountName || tx.fromAccountName} isTransfer={isTransfer} account={account} size={density === 'high' ? 32 : 36} />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="type-body-strong truncate text-ink">{description}</span>
                  {tx.isSplitParent && <span className="type-caption shrink-0 rounded-full bg-inset px-1.5 text-muted">Split</span>}
                  {tx.isCombinedParent && <span className="type-caption shrink-0 rounded-full bg-inset px-1.5 text-muted">Combined</span>}
                  {tx.isMarketAdjustment && <span className="type-caption shrink-0 rounded-full bg-inset px-1.5 text-muted">Market</span>}
                  {tx.recurringSourceId && <Icon name="repeat" size={14} className="shrink-0 text-muted" aria-label="Repeats" />}
                  {tx.notes && <Icon name="note" size={14} className="shrink-0 text-muted" aria-label="Has a note" />}
                </span>
                <span className="type-caption mt-0.5 flex min-w-0 items-center gap-1.5 text-muted">
                  {!isTransfer && <EntityGlyph icon={category.icon} label={tx.category || 'Uncategorised'} color={category.color} size={14} />}
                  <span className="truncate">{isTransfer ? 'Transfer' : tx.category || 'Uncategorised'}</span>
                  {tx.accountName && <span className="hidden max-w-[120px] truncate sm:inline">· {tx.accountName}</span>}
                  {formattedDate && <span className="shrink-0">· {formattedDate}</span>}
                  {txTags.slice(0, 2).map(tag => (
                    <span key={tag.id} className="hidden shrink-0 items-center gap-1 sm:inline-flex">
                      <EntityGlyph icon={tag.icon} label={tag.name} color={tag.color} size={12} />
                      {tag.name}
                    </span>
                  ))}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                {isTransfer
                  ? <Amount value={tx.amount} currency={tx.currency} className="type-figure-row text-ink" />
                  : <Amount value={convertToMain(tx.amount, tx.currency)} currency={mainCurrency} tone="flow" className="type-figure-row text-ink" />}
                {tx.spareChangeAmount ? (
                  <span className="type-caption flex items-center gap-1 text-muted">
                    <Icon name="piggy-bank" size={12} aria-label="Round-up" />
                    <Amount value={convertToMain(Math.abs(tx.spareChangeAmount), tx.currency)} currency={mainCurrency} />
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default React.memo(TransactionList);
