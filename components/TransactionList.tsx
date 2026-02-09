import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { Category, DisplayTransaction } from '../types';
import { formatCurrency, convertToEur, parseLocalDate } from '../utils';
import { useThrottledCallback } from '../hooks/useThrottledCallback';
import { usePreferencesSelector } from '../contexts/DomainProviders';
import { getMerchantLogoUrl, normalizeMerchantKey } from '../utils/brandfetch';

interface TransactionListProps {
  transactions: DisplayTransaction[];
  allCategories: Category[];
  onTransactionClick?: (transaction: DisplayTransaction) => void;
}

const findCategoryDetails = (name: string, categories: Category[]): { icon?: string; parentIcon?: string; color?: string } => {
    for (const cat of categories) {
        if (cat.name === name) return { icon: cat.icon, color: cat.color };
        if (cat.subCategories.length > 0) {
            const found = findCategoryDetails(name, cat.subCategories);
            if (found.icon) return { icon: found.icon, parentIcon: cat.icon, color: found.color || cat.color };
        }
    }
    return {};
};

const TransactionList: React.FC<TransactionListProps> = ({ transactions, allCategories, onTransactionClick }) => {
  const brandfetchClientId = usePreferencesSelector(p => (p.brandfetchClientId || '').trim());
  const merchantLogoOverrides = usePreferencesSelector(p => p.merchantLogoOverrides || {});
  const merchantRules = usePreferencesSelector(p => p.merchantRules || {});
  const [logoLoadErrors, setLogoLoadErrors] = useState<Record<string, boolean>>({});

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
    setLogoLoadErrors(prev => (prev[logoUrl] ? prev : { ...prev, [logoUrl]: true }));
  }, []);

  const formatDate = (dateString: string) => {
    return parseLocalDate(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const preparedTransactions = useMemo(
    () =>
      transactions.map((tx) => {
        const isTransfer = tx.isTransfer;
        const description = isTransfer ? `${tx.fromAccountName} → ${tx.toAccountName}` : tx.description;
        const amountDisplay = isTransfer
          ? formatCurrency(tx.amount, tx.currency)
          : formatCurrency(convertToEur(tx.amount, tx.currency), 'EUR');
        
        const catDetails = findCategoryDetails(tx.category, allCategories);
        const icon = isTransfer ? 'swap_horiz' : (catDetails.icon || catDetails.parentIcon || 'sell');
        const categoryColor = isTransfer ? '#64748B' : (catDetails.color || '#A0AEC0');
        
        const merchantKey = normalizeMerchantKey(tx.merchant);
        const merchantLogoUrl = merchantKey ? getMerchantLogoUrl(tx.merchant, brandfetchClientId, effectiveMerchantLogoOverrides, { fallback: 'lettermark', type: 'icon', width: 80, height: 80 }) : null;
        const showMerchantLogo = Boolean(merchantLogoUrl && !logoLoadErrors[merchantLogoUrl]);
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
          showMerchantLogo,
          merchantInitial
        };
      }),
    [transactions, allCategories, brandfetchClientId, effectiveMerchantLogoOverrides, logoLoadErrors]
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
          {visibleTransactions.map(({ tx, description, amountDisplay, icon, categoryColor, isTransfer, formattedDate, spareAmountEur, merchantLogoUrl, showMerchantLogo, merchantInitial }) => {
            return (
              <li
                key={tx.id}
                className="flex items-center justify-between group cursor-pointer hover:bg-light-fill dark:hover:bg-dark-fill p-2 rounded-lg transition-all duration-200 hover:shadow-sm"
                onClick={() => onTransactionClick?.(tx)}
              >
                <div className="flex items-center min-w-0">
                  <div 
                    className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center overflow-hidden shadow-sm ${showMerchantLogo ? 'bg-white dark:bg-dark-card' : 'border border-black/5 dark:border-white/10'}`}
                    style={showMerchantLogo ? undefined : { backgroundColor: isTransfer ? undefined : categoryColor }}
                  >
                    {showMerchantLogo && merchantLogoUrl ? (
                      <img
                        src={merchantLogoUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={() => handleLogoError(merchantLogoUrl)}
                      />
                    ) : merchantInitial && !isTransfer ? (
                      <span className="text-sm font-bold text-white uppercase">{merchantInitial}</span>
                    ) : (
                      <span className={`material-symbols-outlined ${isTransfer ? 'text-light-text-secondary dark:text-dark-text-secondary' : 'text-white'}`}>
                        {icon}
                      </span>
                    )}
                  </div>
                  <div className="ml-4 min-w-0">
                    <p className="text-base font-medium text-light-text dark:text-dark-text flex items-center gap-2 truncate">
                        {description}
                        {tx.isMarketAdjustment && <span className="text-[10px] uppercase font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded shrink-0">Market</span>}
                    </p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{formattedDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right shrink-0">
                  <div>
                    <p
                      className={`text-base font-semibold privacy-blur ${
                        isTransfer ? 'text-light-text dark:text-dark-text' : (tx.type === 'income' ? 'text-semantic-green' : 'text-semantic-red')
                      }`}
                    >
                      {amountDisplay}
                    </p>
                    {spareAmountEur && (
                      <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary flex items-center justify-end gap-0.5 opacity-80">
                        <span className="material-symbols-outlined text-[12px]">savings</span>
                        {spareAmountEur}
                      </p>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-light-text-secondary dark:text-dark-text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
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