import React from 'react';
import { BTN_PRIMARY_STYLE, BTN_SECONDARY_STYLE } from '../constants';

interface TransactionMatcherCardProps {
  suggestionsCount: number;
  onReview: () => void;
  onDismiss: () => void;
}

export const TransactionMatcherCard: React.FC<TransactionMatcherCardProps> = ({
  suggestionsCount,
  onReview,
  onDismiss,
}) => {
  return (
    <div className="relative overflow-hidden mb-6 p-5 rounded-[2rem] bg-gradient-to-r from-primary-500/10 via-primary-500/5 to-transparent border border-primary-500/20 shadow-sm animate-fade-in-up flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      {/* Background radial glow */}
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary-500/10 blur-3xl rounded-full pointer-events-none" />
      
      <div className="flex items-center gap-4 relative z-10">
        <div className="h-12 w-12 rounded-2xl bg-primary-100 dark:bg-primary-950/40 flex items-center justify-center text-primary-600 dark:text-primary-400 border border-primary-500/20 shrink-0">
          <span className="material-symbols-outlined text-2.5xl animate-pulse">flowsheet</span>
        </div>
        <div>
          <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
            Potential Transfers Detected
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-500 text-white animate-bounce">
              {suggestionsCount} New
            </span>
          </h4>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-0.5 max-w-2xl">
            We identified {suggestionsCount} potential matching transactions across your accounts. Reconciling them as transfers will keep your net worth calculations and cash flow diagrams precise.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto shrink-0 relative z-10">
        <button
          onClick={onDismiss}
          className={`${BTN_SECONDARY_STYLE} w-full md:w-auto !py-2 !px-4 text-[10px] font-bold tracking-wider uppercase border border-black/10 dark:border-white/10`}
        >
          Dismiss All
        </button>
        <button
          onClick={onReview}
          className={`${BTN_PRIMARY_STYLE} w-full md:w-auto !py-2 !px-4 text-[10px] font-bold tracking-wider uppercase shadow-lg shadow-primary-500/20`}
        >
          Review Matches
        </button>
      </div>
    </div>
  );
};

export default TransactionMatcherCard;
