import React from 'react';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';
import Icon from './ui/Icon';

interface UnifiedPendingMatcherCardProps {
  transferCount: number;
  billCount: number;
  highConfidenceCount?: number;
  onReview: (filter?: 'all' | 'transfer' | 'bill') => void;
  onDismissAll: () => void;
  onQuickReconcileHighConfidence?: () => void;
}

export const UnifiedPendingMatcherCard: React.FC<UnifiedPendingMatcherCardProps> = ({
  transferCount,
  billCount,
  highConfidenceCount = 0,
  onReview,
  onDismissAll,
  onQuickReconcileHighConfidence,
}) => {
  const totalCount = transferCount + billCount;
  if (totalCount === 0) return null;

  const hasBoth = transferCount > 0 && billCount > 0;

  return (
    <div className="relative overflow-hidden mb-6 p-5 sm:p-6 rounded-[2rem] glass-section border border-indigo-500/20 dark:border-indigo-400/20 shadow-[4px_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[4px_6px_20px_rgba(0,0,0,0.3)] animate-fade-in-up flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 bg-gradient-to-r from-indigo-500/[0.04] via-emerald-500/[0.03] to-indigo-500/[0.04]">
      {/* Background ambient glow */}
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Left content block */}
      <div className="flex items-start sm:items-center gap-4 relative z-10 min-w-0">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-emerald-500/15 dark:from-indigo-400/20 dark:to-emerald-400/20 flex items-center justify-center text-primary-600 dark:text-primary-400 border border-indigo-500/25 shrink-0 shadow-inner">
          <Icon name="file_check" className="text-2xl animate-pulse" />
        </div>

        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h4 className="font-bold text-base sm:text-lg text-gray-900 dark:text-white tracking-tight">
              {hasBoth
                ? 'Pending Reconciliation Matches'
                : transferCount > 0
                ? 'Potential Transfers Detected'
                : 'Synced Bill Matches Detected'}
            </h4>

            {/* Total pill */}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-primary-500 text-white shadow-xs">
              {totalCount} New
            </span>

            {/* Type breakdown pills */}
            {hasBoth && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onReview('transfer')}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-all cursor-pointer"
                  title="Click to view transfer matches"
                >
                  <Icon name="sync_alt" className="text-xs" />
                  <span>{transferCount} Transfer{transferCount > 1 ? 's' : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onReview('bill')}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer"
                  title="Click to view bill matches"
                >
                  <Icon name="receipt_long" className="text-xs" />
                  <span>{billCount} Bill{billCount > 1 ? 's' : ''}</span>
                </button>
              </div>
            )}
          </div>

          <p className="text-xs sm:text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed max-w-2xl">
            {hasBoth
              ? `We identified ${totalCount} matching transactions across your accounts (${transferCount} internal transfer${transferCount > 1 ? 's' : ''} and ${billCount} synced recurring bill${billCount > 1 ? 's' : ''}). Reconciling them keeps your net worth and cash flow diagrams precise.`
              : transferCount > 0
              ? `We identified ${transferCount} potential matching transaction${transferCount > 1 ? 's' : ''} across your accounts. Reconciling as transfers keeps net worth and cash flow precise.`
              : `We identified ${billCount} synced bank transaction${billCount > 1 ? 's' : ''} matching planned bills. Reconcile them as Posted / Paid to update your bill schedule.`}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto shrink-0 relative z-10 pt-2 lg:pt-0 border-t lg:border-t-0 border-black/5 dark:border-white/5">
        <button
          type="button"
          onClick={onDismissAll}
          className={`${BTN_SECONDARY_STYLE} flex-1 sm:flex-initial !py-2 !px-4 text-xs font-semibold uppercase tracking-wider border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer`}
        >
          Dismiss All
        </button>

        {highConfidenceCount > 0 && onQuickReconcileHighConfidence && (
          <button
            type="button"
            onClick={onQuickReconcileHighConfidence}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer shadow-xs"
            title="Instantly reconcile all high-confidence matches (≥80%)"
          >
            <Icon name="check_circle" className="text-sm" />
            <span>Approve High-Confidence ({highConfidenceCount})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onReview('all')}
          className={`${BTN_PRIMARY_STYLE} flex-1 sm:flex-initial !py-2 !px-5 text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary-500/25 cursor-pointer flex items-center justify-center gap-1.5`}
        >
          <span>Review Matches</span>
          <Icon name="arrow_forward" className="text-sm" />
        </button>
      </div>
    </div>
  );
};

export default UnifiedPendingMatcherCard;
