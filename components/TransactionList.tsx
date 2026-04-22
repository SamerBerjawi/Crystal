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

const TransactionList: React.FC<TransactionListProps> = ({ transactions, allCategories, onTransactionClick }) => {
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
    () =>
      transactions.map((tx) => {
        const isTransfer = tx.isTransfer;
        const description = isTransfer ? `${tx.fromAccountName} → ${tx.toAccountName}` : tx.description;
        const amountDisplay = isTransfer
          ? formatCurrency(tx.amount, tx.currency)
          : formatCurrency(convertToEur(tx.amount, tx.currency), 'EUR');
        
        const catDetails = categoryDetailsMap.get(tx.category) || {};
        const icon = isTransfer ? 'swap_horiz' : (catDetails.icon || catDetails.parentIcon || 'sell');
        const categoryColor = isTransfer ? '#64748B' : (catDetails.color || '#A0AEC0');
        
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
          isTransfer, 
          formattedDate, 
          spareAmountEur,
          merchantLogoUrl,
          merchantInitial
        };
      }),
    [transactions, categoryDetailsMap, brandfetchClientId, effectiveMerchantLogoOverrides]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(640);
  const ROW_HEIGHT = 72;
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
      <div ref={containerRef} className="space-y-2 h-full w-full overflow-y-auto relative p-2" role="list">
        <div style={{ height: preparedTransactions.length * ROW_HEIGHT }} aria-hidden />
        <ul className="absolute inset-0" style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleTransactions.map(({ tx, description, amountDisplay, icon, categoryColor, isTransfer, formattedDate, spareAmountEur, merchantLogoUrl, merchantInitial }) => {
            const showMerchantLogo = Boolean(merchantLogoUrl && !logoLoadErrors.has(merchantLogoUrl));
            return (
              <li
                key={tx.id}
                className="flex items-center justify-between group cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-4 rounded-2xl transition-all duration-300 border border-transparent hover:border-black/5 dark:hover:border-white/5 mb-1"
                onClick={() => onTransactionClick?.(tx)}
                style={{ height: ROW_HEIGHT - 8 }}
              >
                <div className="flex items-center min-w-0">
                  <div 
                    className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center overflow-hidden shadow-lg transition-transform duration-500 group-hover:scale-110 ${showMerchantLogo ? 'bg-white dark:bg-dark-card border border-black/5' : 'border border-black/5 dark:border-white/10'}`}
                    style={showMerchantLogo ? undefined : { backgroundColor: isTransfer ? undefined : `${categoryColor}22` }}
                  >
                    {showMerchantLogo && merchantLogoUrl ? (
                      <img
                        src={merchantLogoUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={() => handleLogoError(merchantLogoUrl)}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span 
                        className={`material-symbols-outlined text-xl ${isTransfer ? 'text-light-text-secondary dark:text-dark-text-secondary' : ''}`}
                        style={isTransfer ? undefined : { color: categoryColor }}
                      >
                        {icon}
                      </span>
                    )}
                  </div>
                  <div className="ml-4 min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.1em] text-light-text dark:text-dark-text flex items-center gap-2 truncate opacity-80 group-hover:opacity-100 transition-opacity">
                        {description}
                        {tx.isMarketAdjustment && <span className="text-[8px] uppercase font-black bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded-lg border border-blue-500/20 shrink-0">Node Delta</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[9px] font-mono font-bold text-light-text-secondary dark:text-dark-text-secondary opacity-40">{formattedDate}</p>
                        <div className="w-1 h-1 rounded-full bg-black/10 dark:bg-white/10"></div>
                        <p className="text-[9px] font-mono font-black uppercase tracking-tighter opacity-20">{tx.category || 'System Node'}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right shrink-0">
                  <div className="flex flex-col items-end">
                    <p
                      className={`text-sm font-black font-mono tracking-tighter privacy-blur ${
                        isTransfer ? 'text-light-text dark:text-dark-text' : (tx.type === 'income' ? 'text-emerald-500' : 'text-rose-500')
                      }`}
                    >
                      {tx.type === 'income' && !isTransfer ? '+' : ''}{amountDisplay}
                    </p>
                    {spareAmountEur && (
                      <div className="flex items-center gap-1 opacity-20 group-hover:opacity-40 transition-opacity">
                        <span className="material-symbols-outlined text-[10px]">bolt</span>
                        <span className="text-[8px] font-black font-mono uppercase">{spareAmountEur} Harvest</span>
                      </div>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-sm text-light-text-secondary dark:text-dark-text-secondary opacity-0 group-hover:opacity-30 transition-all translate-x-2 group-hover:translate-x-0">
                    arrow_forward_ios
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
  );
};

export default React.memo(TransactionList);