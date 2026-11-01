import { useMemo } from 'react';
import { usePreferencesContext } from '../contexts/DomainProviders';
import { DEFAULT_MATCHER_CONFIG, MatcherConfig, normalizeMatcherConfig } from '../utils/matcherConfig';

export { DEFAULT_MATCHER_CONFIG };
export type { MatcherConfig };

export const useMatcherConfig = () => {
  const { preferences, setPreferences } = usePreferencesContext();
  const config = useMemo(() => normalizeMatcherConfig(preferences.matcherConfig), [preferences.matcherConfig]);

  const updateConfig = (updates: Partial<MatcherConfig>) => {
    setPreferences(prev => ({ ...prev, matcherConfig: { ...normalizeMatcherConfig(prev.matcherConfig), ...updates } }));
  };

  const resetConfig = () => {
    setPreferences(prev => ({ ...prev, matcherConfig: DEFAULT_MATCHER_CONFIG }));
  };

  return { config, updateConfig, resetConfig };
};
