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
        const icon = (isTransfer && (!tx.category || tx.category === 'Transfer')) ? 'swap_horiz' : (catDetails.icon || catDetails.parentIcon || 'sell');
        const categoryColor = (isTransfer && (!tx.category || tx.category === 'Transfer')) ? '#64748B' : (catDetails.color || '#A0AEC0');
        
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

  const ROW_HEIGHT = isMobile ? (density === 'high' ? 96 : 110) : (density === 'high' ? 76 : 90);
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
          {visibleTransactions.map(({ tx, description, amountDisplay, icon, categoryColor, accentColor, isTransfer, spareAmountEur, merchantLogoUrl, merchantInitial, txTags }) => {
            const showMerchantLogo = Boolean(merchantLogoUrl && !logoLoadErrors.has(merchantLogoUrl));
            return (
              <li
                key={tx.id}
                className="flex items-center justify-between group cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] p-3 rounded-[1.5rem] transition-all duration-300 border border-transparent hover:border-black/5 dark:hover:border-white/5 relative"
                style={{ 
                    minHeight: density === 'high' ? '60px' : '72px',
                    height: 'auto',
                    marginBottom: '8px',
                    boxShadow: `hover: 0 10px 30px -10px ${accentColor.replace('0.4', '0.15')}`
                }}
                onClick={() => onTransactionClick?.(tx)}
              >
                {/* Glow Effect */}
                <div className="absolute inset-x-2 inset-y-1 pointer-events-none rounded-[1.5rem] overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0">
                    <div 
                        className="absolute inset-0"
                        style={{ 
                            background: `radial-gradient(circle at 100% 50%, ${accentColor.replace('0.4', '0.08')} 0%, transparent 60%)`,
                        }}
                    />
                </div>

                <div className="flex items-center min-w-0 flex-1 relative z-10">
                  <div 
                    className={`flex-shrink-0 ${density === 'high' ? 'h-9 w-9 sm:h-9 sm:w-9' : 'h-11 w-11 sm:h-11 sm:w-11'} rounded-2xl flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/10 ${showMerchantLogo ? 'bg-white' : ''}`}
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
                      <span className={`material-symbols-outlined ${density === 'high' ? 'text-xl' : 'text-2xl'} ${isTransfer ? 'text-light-text-secondary dark:text-dark-text-secondary' : 'text-white'}`}>
                        {icon}
                      </span>
                    )}
                  </div>
                  <div className="ml-3 sm:ml-4 min-w-0 overflow-hidden flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <p className={`${density === 'high' ? 'text-[13px] sm:text-[14px]' : 'text-[15px] sm:text-[16px]'} font-bold text-light-text dark:text-dark-text truncate tracking-tight`}>
                            {description}
                        </p>
                        {tx.isMarketAdjustment && <span className="text-[8px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1 py-0.5 rounded-full shrink-0">MARKET</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 overflow-hidden">
                        <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary opacity-60 truncate">
                            {tx.category}
                        </span>
                        {tx.accountName && (
                            <span className="text-[9px] sm:text-[10px] font-medium text-light-text-secondary/40 dark:text-dark-text-secondary/40 tracking-tight truncate max-w-[80px]">
                                • {tx.accountName}
                            </span>
                        )}
                        {tx.notes && <span className="material-symbols-outlined text-[12px] text-primary-500/30 shrink-0">description</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 text-right shrink-0 relative z-10 pl-2">
                  <div className="flex flex-col items-end">
                    <p
                      className={`${density === 'high' ? 'text-[14px] sm:text-[15px]' : 'text-[16px] sm:text-[17px]'} font-black tracking-tighter privacy-blur ${
                        isTransfer ? 'text-light-text dark:text-dark-text' : (tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500')
                      }`}
                    >
                      {amountDisplay}
                    </p>
                    {spareAmountEur && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <span className="material-symbols-outlined text-[10px] text-emerald-500">savings</span>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 tracking-tight">{spareAmountEur}</span>
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