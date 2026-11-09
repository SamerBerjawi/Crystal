import React from 'react';
import { Button } from './ui/Actions';
import { Badge } from './ui/Display';
import Icon from './ui/Icon';

export interface UnifiedPendingMatcherCardProps {
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
    <section
      aria-label="Pending matches"
      className="relative overflow-hidden surface-card rounded-[var(--radius-xl)] border border-primary/20 bg-primary-soft/25 p-5 max-md:p-4 transition-all"
    >
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Left block */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Icon name="sync_alt" size={22} />
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="type-card-title text-ink">
                {hasBoth
                  ? 'Reconciliation matches detected'
                  : transferCount > 0
                  ? 'Potential transfers detected'
                  : 'Synced bill matches detected'}
              </h3>

              <Badge tone="attention">{totalCount} new</Badge>

              {hasBoth && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onReview('transfer')}
                    className="cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                  >
                    <span>{transferCount} {transferCount === 1 ? 'transfer' : 'transfers'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onReview('bill')}
                    className="cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 transition-colors"
                  >
                    <span>{billCount} {billCount === 1 ? 'bill' : 'bills'}</span>
                  </button>
                </div>
              )}
            </div>

            <p className="type-caption text-muted max-w-2xl">
              {hasBoth
                ? `We identified ${totalCount} matching transactions (${transferCount} internal ${transferCount === 1 ? 'transfer' : 'transfers'} and ${billCount} planned ${billCount === 1 ? 'bill' : 'bills'}). Reconciling them keeps net worth and cash flow diagrams precise.`
                : transferCount > 0
                ? `We identified ${transferCount} potential matching ${transferCount === 1 ? 'transaction' : 'transactions'} across your accounts. Reconciling as transfers keeps net worth and cash flow precise.`
                : `We identified ${billCount} synced bank ${billCount === 1 ? 'transaction' : 'transactions'} matching planned bills. Reconcile them as paid to update your bill schedule.`}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-line">
          <Button
            size="sm"
            variant="ghost"
            onPress={onDismissAll}
            className="flex-1 sm:flex-initial"
          >
            Dismiss all
          </Button>

          {highConfidenceCount > 0 && onQuickReconcileHighConfidence && (
            <Button
              size="sm"
              variant="soft"
              onPress={onQuickReconcileHighConfidence}
              className="flex-1 sm:flex-initial"
            >
              Approve likely ({highConfidenceCount})
            </Button>
          )}

          <Button
            size="sm"
            variant="primary"
            onPress={() => onReview('all')}
            className="flex-1 sm:flex-initial"
          >
            Review matches
          </Button>
        </div>
      </div>
    </section>
  );
};

export default UnifiedPendingMatcherCard;
