import { useState, useEffect } from 'react';

export interface MatcherConfig {
  amountVariancePercent: number; // e.g. 10 (%)
  dateVarianceDays: number; // e.g. 3 (days)
  lookbackDays: number; // e.g. 10 (days)
}

export const DEFAULT_MATCHER_CONFIG: MatcherConfig = {
  amountVariancePercent: 10,
  dateVarianceDays: 3,
  lookbackDays: 7,
};

const STORAGE_KEY = 'synced_matcher_config_v1';

export const useMatcherConfig = () => {
  const [config, setConfig] = useState<MatcherConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          amountVariancePercent: typeof parsed.amountVariancePercent === 'number' ? parsed.amountVariancePercent : DEFAULT_MATCHER_CONFIG.amountVariancePercent,
          dateVarianceDays: typeof parsed.dateVarianceDays === 'number' ? parsed.dateVarianceDays : DEFAULT_MATCHER_CONFIG.dateVarianceDays,
          lookbackDays: typeof parsed.lookbackDays === 'number' ? parsed.lookbackDays : DEFAULT_MATCHER_CONFIG.lookbackDays,
        };
      }
    } catch (err) {
      console.warn('Failed to load matcher config from localStorage', err);
    }
    return DEFAULT_MATCHER_CONFIG;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (err) {
      console.warn('Failed to save matcher config to localStorage', err);
    }
  }, [config]);

  const updateConfig = (updates: Partial<MatcherConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const resetConfig = () => {
    setConfig(DEFAULT_MATCHER_CONFIG);
  };

  return {
    config,
    setConfig,
    updateConfig,
    resetConfig,
  };
};
