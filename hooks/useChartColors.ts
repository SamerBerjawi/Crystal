import { useMemo } from 'react';

export interface ChartThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  gridColor: string;
  tooltipBg: string;
  tooltipText: string;
  palette: string[];
}

export const useChartColors = (accentColorName: string = 'indigo'): ChartThemeColors => {
  return useMemo(() => {
    const isDark =
      typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    const accentMap: Record<string, { primary: string; secondary: string }> = {
      indigo: { primary: '#6366f1', secondary: '#818cf8' },
      emerald: { primary: '#10b981', secondary: '#34d399' },
      amber: { primary: '#f59e0b', secondary: '#fbbf24' },
      purple: { primary: '#a855f7', secondary: '#c084fc' },
      cyan: { primary: '#06b6d4', secondary: '#22d3ee' },
      teal: { primary: '#14b8a6', secondary: '#2dd4bf' },
      rose: { primary: '#f43f5e', secondary: '#fb7185' },
      blue: { primary: '#3b82f6', secondary: '#60a5fa' },
      orange: { primary: '#f97316', secondary: '#fb923c' },
      violet: { primary: '#8b5cf6', secondary: '#a78bfa' },
      slate: { primary: '#64748b', secondary: '#94a3b8' },
      lime: { primary: '#84cc16', secondary: '#a3e635' },
      sky: { primary: '#0ea5e9', secondary: '#38bdf8' },
      pink: { primary: '#ec4899', secondary: '#f472b6' },
    };

    const colors = accentMap[accentColorName] || accentMap.indigo;

    return {
      primary: colors.primary,
      secondary: colors.secondary,
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#f43f5e',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? '#171717' : '#ffffff',
      tooltipText: isDark ? '#ffffff' : '#171717',
      palette: [
        colors.primary,
        '#10b981',
        '#f59e0b',
        '#3b82f6',
        '#a855f7',
        '#ec4899',
        '#06b6d4',
        '#84cc16',
      ],
    };
  }, [accentColorName]);
};
