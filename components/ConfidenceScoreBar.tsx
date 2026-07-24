import React from 'react';

interface ConfidenceScoreBarProps {
  score: number; // 0 to 100
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  varianceText?: string;
}

export const ConfidenceScoreBar: React.FC<ConfidenceScoreBarProps> = ({
  score,
  showLabel = true,
  size = 'md',
  varianceText,
}) => {
  const normalizedScore = Math.min(100, Math.max(0, Math.round(score)));

  let colorClass = 'bg-emerald-500 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
  let badgeBg = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  let levelText = 'High Match';

  if (normalizedScore < 50) {
    colorClass = 'bg-rose-500 text-rose-600 dark:text-rose-400 border-rose-500/30';
    badgeBg = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
    levelText = 'Low Confidence';
  } else if (normalizedScore < 80) {
    colorClass = 'bg-amber-500 text-amber-600 dark:text-amber-400 border-amber-500/30';
    badgeBg = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    levelText = 'Review Needed';
  }

  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5',
  };

  return (
    <div className="w-full space-y-1.5">
      {showLabel && (
        <div className="flex items-center justify-between text-xs font-bold gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${badgeBg}`}>
              {normalizedScore}% Match
            </span>
            <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary font-medium">
              ({levelText})
            </span>
          </div>

          {varianceText && (
            <span className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary truncate">
              {varianceText}
            </span>
          )}
        </div>
      )}

      {/* Progress Bar Container */}
      <div className={`w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden p-0.5 ${heights[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${colorClass.split(' ')[0]} shadow-sm`}
          style={{ width: `${normalizedScore}%` }}
        />
      </div>
    </div>
  );
};

export default ConfidenceScoreBar;
