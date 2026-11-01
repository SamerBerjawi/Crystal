export interface MatcherConfig {
  amountVariancePercent: number; // e.g. 10 (%)
  dateVarianceDays: number; // e.g. 3 (days)
  lookbackDays: number; // e.g. 10 (days)
  /** Minimum confidence score (0-100) required to surface a suggestion. Default: 50 */
  minMatchScore: number;
  /** If true, bill/recurring suggestions with very low name similarity are suppressed. Default: false */
  requireNameMatch: boolean;
}

export const DEFAULT_MATCHER_CONFIG: MatcherConfig = {
  amountVariancePercent: 10,
  dateVarianceDays: 4,
  lookbackDays: 30,
  minMatchScore: 45,
  requireNameMatch: false,
};

const MIN_LOOKBACK_DAYS = 14;
const MIN_DATE_VARIANCE_DAYS = 4;

/** Fills gaps and lifts values older versions allowed below today's minimums. */
export const normalizeMatcherConfig = (saved?: Partial<MatcherConfig> | null): MatcherConfig => {
  const defaults = DEFAULT_MATCHER_CONFIG;
  return {
    amountVariancePercent: typeof saved?.amountVariancePercent === 'number' ? saved.amountVariancePercent : defaults.amountVariancePercent,
    dateVarianceDays: typeof saved?.dateVarianceDays === 'number' && saved.dateVarianceDays >= MIN_DATE_VARIANCE_DAYS ? saved.dateVarianceDays : defaults.dateVarianceDays,
    lookbackDays: typeof saved?.lookbackDays === 'number' && saved.lookbackDays >= MIN_LOOKBACK_DAYS ? saved.lookbackDays : defaults.lookbackDays,
    minMatchScore: typeof saved?.minMatchScore === 'number' ? saved.minMatchScore : defaults.minMatchScore,
    requireNameMatch: typeof saved?.requireNameMatch === 'boolean' ? saved.requireNameMatch : defaults.requireNameMatch,
  };
};
