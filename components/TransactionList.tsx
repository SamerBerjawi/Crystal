import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { Category, DisplayTransaction, MerchantRule, Tag } from '../types';
import { formatCurrency, convertToEur, parseLocalDate } from '../utils';
import { useThrottledCallback } from '../hooks/useThrottledCallback';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';
import { useTagsContext } from '../contexts/FinancialDataContext';

interface TransactionListProps {
  transactions: DisplayTransaction[];
  allCategories: Category[];
  onTransactionClick?: (transaction: DisplayTransaction) => void;
  density?: 'default' | 'high';
  maxItems?: number;
  className?: string;
}

const buildCategoryDetailsMap = (categories: Category[]) => {
  const detailsMap = new Map<string, { icon?: string; parentIcon?: string; color?: string }>();

  const walk = (nodes: Category[], parentIcon?: string, parentColor?: string) => {
    nodes.forEach(node => {
      detailsMap.set(node.name, { icon: node.icon, parentIcon, color: node.color || parentColor });
      if (node.subCategories.length > 0) {
        walk(node.subCategories, node.icon || parentIcon, node.color || parentColor);
      }
    });
  };

  walk(categories);
  return detailsMap;
};

const TransactionList: React.FC<TransactionListProps> = ({ 
  transactions, 
  allCategories, 
  onTransactionClick, 
  density = 'default',
  maxItems,
  className = ""
}) => {
  const { tags } = useTagsContext();
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {}) as Record<string, MerchantRule>;
  const [logoLoadErrors, setLogoLoadErrors] = useState<Set<string>>(() => new Set());

  const effectiveMerchantLogoOverrides = useMemo(() => {
    const ruleLogoOverrides = Object.entries(merchantRules).reduce((acc, [merchantKey, rule]) => {
      if (rule?.logo) acc[merchantKey] = rule.logo;
      return acc;
    }, {} as Record<string, string>);

    return {
      ...merchantLogoOverrides,
      ...ruleLogoOverrides,
    };
  }, [merchantLogoOverrides, merchantRules]);

  const handleLogoError = useCallback((logoUrl: string) => {
    setLogoLoadErrors(prev => (prev.has(logoUrl) ? prev : new Set(prev).add(logoUrl)));
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = parseLocalDate(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const categoryDetailsMap = useMemo(() => buildCategoryDetailsMap(allCategories), [allCategories]);

  const preparedTransactions = useMemo(
    () => {
      const listToPrepare = maxItems ? transactions.slice(0, maxItems) : transactions;
      return listToPrepare.map((tx) => {
        const isTransfer = tx.isTransfer;
        const description = isTransfer ? `${tx.fromAccountName} → ${tx.toAccountName}` : tx.description;
        const amountDisplay = isTransfer
          ? formatCurrency(tx.amount, tx.currency)
          : formatCurrency(convertToEur(tx.amount, tx.currency), 'EUR');
        
        const catDetails = categoryDetailsMap.get(tx.category) || {};
        const icon = (isTransfer && (!tx.category || tx.category === 'Transfer')) ? 'swap_horiz' : (catDetails.icon || catDetails.parentIcon || 'sell');
        const categoryColor = (isTransfer && (!tx.category || tx.category === 'Transfer')) ? '#64748B' : (catDetails.color || '#3B82F6');
        
        const accentColor = isTransfer 
          ? 'rgba(59, 130, 246, 0.4)' 
          : (tx.type === 'income' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)');

        const merchantKey = normalizeMerchantKey(tx.merchant);
        const merchantLogoUrl = merchantKey ? getMerchantLogoUrl(tx.merchant, brandfetchClientId, effectiveMerchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 80, height: 80 }) : null;
        const merchantInitial = tx.merchant?.trim().charAt(0)?.toUpperCase();

        const formattedDate = formatDate(tx.date);
        const spareAmountEur = tx.spareChangeAmount ? formatCurrency(convertToEur(Math.abs(tx.spareChangeAmount), tx.currency), 'EUR') : null;

        const txTags = (tx.tagIds || []).map(id => tags.find(t => t.id === id)).filter(Boolean) as Tag[];

        return { 
          tx, 
          description, 
          amountDisplay, 
          icon, 
          categoryColor,
          accentColor,
          isTransfer, 
          formattedDate, 
          spareAmountEur,
          merchantLogoUrl,
          merchantInitial,
          txTags
        };
      });
    },
    [transactions, categoryDetailsMap, brandfetchClientId, effectiveMerchantLogoOverrides, maxItems, tags]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(960);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const ROW_HEIGHT = isMobile ? (density === 'high' ? 80 : 92) : (density === 'high' ? 68 : 80);
  const OVERSCAN = 8;

  const handleScroll = useThrottledCallback((position: number) => setScrollTop(position), 100);
  const handleResize = useThrottledCallback((height: number) => setViewportHeight(height), 100);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const onScroll = () => handleScroll(node.scrollTop);
    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      handleResize(entry.contentRect.height);
    });
    node.addEventListener('scroll', onScroll);
    resizeObserver.observe(node);
    return () => {
      node.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
    };
  }, [handleResize, handleScroll]);

  if (preparedTransactions.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 text-center bg-black/[0.01] dark:bg-white/[0.01] rounded-3xl border border-dashed border-black/10 dark:border-white/10 my-2 ${className}`}>
        <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary mb-2">
          <span className="material-symbols-outlined text-2xl opacity-60">receipt_long</span>
        </div>
        <p className="text-sm font-bold text-light-text dark:text-dark-text tracking-tight">No activity recorded</p>
        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 max-w-xs">
          There are no transactions listed for this view yet.
        </p>
      </div>
    );
  }

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const endIndex = Math.min(preparedTransactions.length, startIndex + visibleCount);
  const offsetY = startIndex * ROW_HEIGHT;
  const visibleTransactions = preparedTransactions.slice(startIndex, endIndex);

  return (
      <div 
        ref={containerRef} 
        className={`space-y-1 w-full overflow-y-auto relative p-1.5 ${className} ${maxItems ? '' : 'h-full'}`}
        style={maxItems ? { maxHeight: `${maxItems * ROW_HEIGHT + 20}px` } : {}}
        role="list"
      >
        <div style={{ height: preparedTransactions.length * ROW_HEIGHT }} aria-hidden />
        <ul className="absolute inset-0" style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleTransactions.map(({ tx, description, amountDisplay, icon, categoryColor, accentColor, isTransfer, formattedDate, spareAmountEur, merchantLogoUrl, txTags }) => {
            const showMerchantLogo = Boolean(merchantLogoUrl && !logoLoadErrors.has(merchantLogoUrl));
            return (
              <li
                key={tx.id}
                tabIndex={0}
                className="flex items-center justify-between group cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.025] px-3.5 py-2.5 rounded-[1.25rem] transition-all duration-200 border border-transparent hover:border-black/5 dark:hover:border-white/5 relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                style={{ 
                    height: `${ROW_HEIGHT - 8}px`,
                    marginBottom: '8px',
                    boxShadow: `hover: 0 8px 24px -8px ${accentColor.replace('0.4', '0.12')}`
                }}
                onClick={() => onTransactionClick?.(tx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onTransactionClick?.(tx);
                  }
                }}
              >
                {/* Glow Effect */}
                <div className="absolute inset-x-1 inset-y-1 pointer-events-none rounded-[1.25rem] overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0">
                    <div 
                        className="absolute inset-0"
                        style={{ 
                            background: `radial-gradient(circle at 100% 50%, ${accentColor.replace('0.4', '0.06')} 0%, transparent 60%)`,
                        }}
                    />
                </div>

                <div className="flex items-center min-w-0 flex-1 relative z-10">
                  <div 
                    className={`shrink-0 ${density === 'high' ? 'h-9 w-9 sm:h-9 sm:w-9' : 'h-10 w-10 sm:h-11 sm:w-11'} rounded-2xl flex items-center justify-center overflow-hidden ${showMerchantLogo ? 'bg-white dark:bg-white/10' : ''}`}
                    style={showMerchantLogo ? undefined : { backgroundColor: isTransfer ? '#64748B' : categoryColor }}
                  >
                    {showMerchantLogo && merchantLogoUrl ? (
                      <img
                        src={merchantLogoUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={() => handleLogoError(merchantLogoUrl)}
                      />
                    ) : (
                      <span className={`material-symbols-outlined ${density === 'high' ? 'text-lg' : 'text-xl'} text-white`}>
                        {icon}
                      </span>
                    )}
                  </div>
                  <div className="ml-3 sm:ml-3.5 min-w-0 overflow-hidden flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <p className={`${density === 'high' ? 'text-[13px] sm:text-[14px]' : 'text-[14px] sm:text-[15px]'} font-bold text-light-text dark:text-dark-text truncate tracking-tight`}>
                            {description}
                        </p>
                        {tx.isMarketAdjustment && (
                          <span className="text-[8px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md shrink-0 border border-blue-500/20">
                            MARKET
                          </span>
                        )}
                        {tx.recurringSourceId && (
                          <span className="material-symbols-outlined text-[13px] text-purple-500 shrink-0" title="Recurring Transaction">
                            repeat
                          </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden flex-wrap">
                        <span 
                          className="text-[10px] font-bold tracking-wider truncate"
                          style={{ color: isTransfer ? '#64748B' : categoryColor }}
                        >
                            {tx.category || 'Uncategorized'}
                        </span>
                        {tx.accountName && (
                            <span className="text-[10px] font-medium text-light-text-secondary/50 dark:text-dark-text-secondary/50 tracking-tight truncate max-w-[90px]">
                                • {tx.accountName}
                            </span>
                        )}
                        {formattedDate && (
                            <span className="text-[10px] font-medium text-light-text-secondary/50 dark:text-dark-text-secondary/50 tracking-tight shrink-0">
                                • {formattedDate}
                            </span>
                        )}
                        {txTags.length > 0 && (
                          <div className="hidden sm:flex items-center gap-1 shrink-0">
                            {txTags.slice(0, 2).map(tag => (
                              <span 
                                key={tag.id}
                                className="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.2 rounded-md bg-black/5 dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary"
                                style={tag.color ? { backgroundColor: `${tag.color}18`, color: tag.color } : undefined}
                              >
                                #{tag.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {tx.notes && (
                          <span className="material-symbols-outlined text-[12px] text-primary-500/60 shrink-0" title={tx.notes}>
                            description
                          </span>
                        )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 text-right shrink-0 relative z-10 pl-2">
                  <div className="flex flex-col items-end">
                    <p
                      className={`${density === 'high' ? 'text-[14px] sm:text-[15px]' : 'text-[15px] sm:text-[16px]'} font-extrabold tracking-tight privacy-blur ${
                        isTransfer 
                          ? 'text-light-text dark:text-dark-text' 
                          : (tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-light-text dark:text-dark-text')
                      }`}
                    >
                      {amountDisplay}
                    </p>
                    {spareAmountEur && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <span className="material-symbols-outlined text-[10px] text-emerald-500">savings</span>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">{spareAmountEur}</span>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
  );
};

export default React.memo(TransactionList);
