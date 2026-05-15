import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { Category, DisplayTransaction, MerchantRule } from '../types';
import { formatCurrency, convertToEur, parseLocalDate } from '../utils';
import { useThrottledCallback } from '../hooks/useThrottledCallback';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';

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
    return parseLocalDate(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
        const icon = isTransfer ? 'swap_horiz' : (catDetails.icon || catDetails.parentIcon || 'sell');
        const categoryColor = isTransfer ? '#64748B' : (catDetails.color || '#A0AEC0');
        
        const accentColor = isTransfer 
          ? 'rgba(59, 130, 246, 0.4)' 
          : (tx.type === 'income' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)');

        const merchantKey = normalizeMerchantKey(tx.merchant);
        const merchantLogoUrl = merchantKey ? getMerchantLogoUrl(tx.merchant, brandfetchClientId, effectiveMerchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 80, height: 80 }) : null;
        const merchantInitial = tx.merchant?.trim().charAt(0)?.toUpperCase();

        const formattedDate = formatDate(tx.date);
        const spareAmountEur = tx.spareChangeAmount ? formatCurrency(convertToEur(Math.abs(tx.spareChangeAmount), tx.currency), 'EUR') : null;

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
          merchantInitial
        };
      });
    },
    [transactions, categoryDetailsMap, brandfetchClientId, effectiveMerchantLogoOverrides, maxItems]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(640);
  const ROW_HEIGHT = density === 'high' ? 68 : 80;
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

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const endIndex = Math.min(preparedTransactions.length, startIndex + visibleCount);
  const offsetY = startIndex * ROW_HEIGHT;
  const visibleTransactions = preparedTransactions.slice(startIndex, endIndex);

  return (
      <div 
        ref={containerRef} 
        className={`space-y-2 w-full overflow-y-auto relative p-2 ${className} ${maxItems ? '' : 'h-full'}`}
        style={maxItems ? { maxHeight: `${maxItems * ROW_HEIGHT + 24}px` } : {}}
        role="list"
      >
        <div style={{ height: preparedTransactions.length * ROW_HEIGHT }} aria-hidden />
        <ul className="absolute inset-0" style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleTransactions.map(({ tx, description, amountDisplay, icon, categoryColor, accentColor, isTransfer, spareAmountEur, merchantLogoUrl, merchantInitial }) => {
            const showMerchantLogo = Boolean(merchantLogoUrl && !logoLoadErrors.has(merchantLogoUrl));
            return (
              <li
                key={tx.id}
                className="flex items-center justify-between group cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] p-3 rounded-[1.5rem] transition-all duration-300 border border-transparent hover:border-black/5 dark:hover:border-white/5 relative"
                style={{ 
                    height: density === 'high' ? '60px' : '72px',
                    boxShadow: `hover: 0 10px 30px -10px ${accentColor.replace('0.4', '0.15')}`
                }}
                onClick={() => onTransactionClick?.(tx)}
              >
                {/* Glow Effect */}
                <div className="absolute inset-x-2 inset-y-1 pointer-events-none rounded-[1.5rem] overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0">
                    <div 
                        className="absolute inset-0"
                        style={{ 
                            background: `radial-gradient(circle at 50% 100%, ${accentColor.replace('0.4', '0.08')} 0%, transparent 60%)`,
                        }}
                    />
                </div>

                <div className="flex items-center min-w-0 flex-1 relative z-10">
                  <div 
                    className={`flex-shrink-0 ${density === 'high' ? 'h-9 w-9' : 'h-11 w-11'} rounded-2xl flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/10 ${showMerchantLogo ? 'bg-white' : ''}`}
                    style={showMerchantLogo ? undefined : { backgroundColor: isTransfer ? undefined : categoryColor }}
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
                      <span className={`material-symbols-outlined text-2xl ${isTransfer ? 'text-light-text-secondary dark:text-dark-text-secondary' : 'text-white'}`}>
                        {icon}
                      </span>
                    )}
                  </div>
                  <div className="ml-4 min-w-0 overflow-hidden flex-1">
                    <div className="flex items-center gap-2">
                        <p className={`${density === 'high' ? 'text-[14px]' : 'text-[16px]'} font-medium text-light-text dark:text-dark-text truncate tracking-tight`}>
                            {description}
                        </p>
                        {tx.isMarketAdjustment && <span className="text-[9px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded-full shrink-0">Market</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] px-2 py-0.5 rounded-lg font-medium tracking-tight flex items-center gap-1" style={{ backgroundColor: `${categoryColor}15`, color: categoryColor }}>
                            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: categoryColor }}></span>
                            {tx.category}
                        </span>
                        {tx.tagIds && tx.tagIds.length > 0 && (
                            <span className="text-[11px] bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-lg font-medium tracking-tight">
                                {tx.tagIds.length} tags
                            </span>
                        )}
                        {tx.accountName && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-black/5 dark:bg-white/5 rounded-lg opacity-60">
                                <span className="text-[10px] font-medium text-light-text-secondary dark:text-dark-text-secondary tracking-tight">
                                    {tx.accountName}
                                </span>
                            </div>
                        )}
                        {tx.notes && <span className="material-symbols-outlined text-[14px] text-primary-500/50">description</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right shrink-0 relative z-10">
                  <div className="flex flex-col items-end">
                    <p
                      className={`${density === 'high' ? 'text-[15px]' : 'text-[17px]'} font-medium tracking-tighter privacy-blur ${
                        isTransfer ? 'text-light-text dark:text-dark-text' : (tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')
                      }`}
                    >
                      {amountDisplay}
                    </p>
                    {spareAmountEur && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-[12px] text-emerald-500">savings</span>
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 tracking-tight">{spareAmountEur}</span>
                      </div>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary opacity-0 group-hover:opacity-40 transition-opacity">
                    chevron_right
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
  );
};

export default React.memo(TransactionList);