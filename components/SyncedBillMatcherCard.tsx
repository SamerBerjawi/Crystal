import React from 'react';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';

interface SyncedBillMatcherCardProps {
  suggestionsCount: number;
  onReview: () => void;
  onDismiss: () => void;
}

export const SyncedBillMatcherCard: React.FC<SyncedBillMatcherCardProps> = ({
  suggestionsCount,
  onReview,
  onDismiss,
}) => {
  return (
    <div className="relative overflow-hidden mb-6 p-5 rounded-[2rem] bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 shadow-sm animate-fade-in-up flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      {/* Background radial glow */}
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />

      <div className="flex items-center gap-4 relative z-10">
        <div className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
          <span className="material-symbols-outlined text-2.5xl animate-pulse">published_with_changes</span>
        </div>
        <div>
          <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
            Synced Bill Matches Detected
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white animate-bounce">
              {suggestionsCount} New
            </span>
          </h4>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-0.5 max-w-2xl">
            We identified {suggestionsCount} synced bank transaction{suggestionsCount > 1 ? 's' : ''} matching your planned recurring payments or bills (with minor date & amount variance). Reconcile them as Posted / Paid.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto shrink-0 relative z-10">
        <button
          onClick={onDismiss}
          className={`${BTN_SECONDARY_STYLE} w-full md:w-auto !py-2 !px-4 text-[10px] font-bold tracking-wider border border-black/10 dark:border-white/10`}
        >
          Dismiss All
        </button>
        <button
          onClick={onReview}
          className={`${BTN_PRIMARY_STYLE} w-full md:w-auto !py-2 !px-4 text-[10px] font-bold tracking-wider bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20`}
        >
          Review Matches
        </button>
      </div>
    </div>
  );
};

export default SyncedBillMatcherCard;
