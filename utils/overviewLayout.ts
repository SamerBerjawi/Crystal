import type { AppPreferences, WidgetConfig } from '../types';

export const OVERVIEW_LAYOUT_KEY = 'overview-v2';
export const OVERVIEW_PHONE_LAYOUT_KEY = 'overview-v2-phone';

export interface OverviewWidgetMeta {
  title: string;
  icon: string;
  /** Default width, in columns of six. */
  span: number;
  /** Height in units of 96 px. */
  rows: number;
  /** Fixed height on phones, for charts. Lists take the height they need. */
  phoneHeight?: number;
}

export const OVERVIEW_WIDGETS: Record<string, OverviewWidgetMeta> = {
  safeToSpend: { title: 'Safe to spend', icon: 'wallet', span: 2, rows: 3 },
  forecastHorizon: { title: 'Forecast', icon: 'fast_forward', span: 4, rows: 3 },
  accountsSummary: { title: 'Accounts', icon: 'nav_accounts', span: 2, rows: 4 },
  netWorthOverTime: { title: 'Net worth over time', icon: 'trending_up', span: 4, rows: 4, phoneHeight: 320 },
  todayWidget: { title: 'Today', icon: 'calendar_check', span: 2, rows: 4 },
  recentActivity: { title: 'Recent activity', icon: 'rows', span: 4, rows: 6 },
  outflowsByCategory: { title: 'Spending by category', icon: 'pie_chart', span: 3, rows: 4, phoneHeight: 400 },
  budgetOverview: { title: 'Budgets', icon: 'sliders', span: 3, rows: 4 },
  creditCardStatements: { title: 'Credit card statements', icon: 'credit_card', span: 6, rows: 3 },
  financialOverview: { title: 'This period', icon: 'Activity', span: 3, rows: 4 },
  overviewKpis: { title: 'Key ratios', icon: 'scale', span: 6, rows: 2 },
  assetAllocation: { title: 'Asset allocation', icon: 'circle_cut', span: 6, rows: 7 },
  netWorthBreakdown: { title: 'Assets and debts', icon: 'circle_cut', span: 3, rows: 4, phoneHeight: 360 },
  assetBreakdown: { title: 'Assets', icon: 'account_balance', span: 3, rows: 4 },
  liabilityBreakdown: { title: 'Debts', icon: 'bank_note', span: 3, rows: 4 },
  transactionMap: { title: 'Transaction map', icon: 'marker_pin', span: 3, rows: 4, phoneHeight: 360 },
  cashflowSankey: { title: 'Cash flow', icon: 'git_branch', span: 6, rows: 5, phoneHeight: 420 },
  financialRunway: { title: 'Runway', icon: 'hourglass', span: 3, rows: 4 },
  merchantPareto: { title: 'Top merchants', icon: 'shopping_bag', span: 3, rows: 4 },
  wealthVelocity: { title: 'Wealth velocity', icon: 'zap', span: 3, rows: 4 },
};

const DEFAULT_ORDER = ['safeToSpend', 'forecastHorizon', 'netWorthOverTime', 'todayWidget', 'recentActivity', 'accountsSummary', 'outflowsByCategory', 'budgetOverview', 'creditCardStatements'];
const DEFAULT_PHONE_ORDER = ['safeToSpend', 'forecastHorizon', 'accountsSummary', 'recentActivity', 'todayWidget', 'netWorthOverTime', 'outflowsByCategory', 'budgetOverview', 'creditCardStatements'];

/** The three old Dashboard tabs, in the order they appeared. */
const LEGACY_TABS: Record<string, string[]> = {
  overview: ['financialOverview', 'todayWidget', 'netWorthOverTime', 'forecastHorizon', 'creditCardStatements'],
  analysis: ['budgetOverview', 'financialRunway', 'wealthVelocity'],
  activity: ['transactionMap', 'outflowsByCategory', 'netWorthBreakdown', 'recentActivity', 'cashflowSankey'],
};

export const toConfig = (id: string, span: number, index: number): WidgetConfig => ({
  id,
  title: OVERVIEW_WIDGETS[id]?.title ?? id,
  x: index,
  y: 0,
  w: span,
  h: OVERVIEW_WIDGETS[id]?.rows ?? 3,
});

const fromOrder = (order: string[]) => order.map((id, index) => toConfig(id, OVERVIEW_WIDGETS[id].span, index));

const scaleSpan = (legacyWidth: number) => Math.max(2, Math.min(6, Math.round(legacyWidth / 2)));

/**
 * The first layout of the single Overview. Someone who arranged the old tabs keeps what they had: their widgets, in tab
 * order, at the same share of the width, without the ones they removed. Old keys stay in place, so nothing is lost.
 */
export function resolveOverviewLayout(preferences: Pick<AppPreferences, 'dashboardLayouts' | 'dashboardHiddenWidgets'>, isPhone: boolean): WidgetConfig[] {
  const saved = preferences.dashboardLayouts?.[isPhone ? OVERVIEW_PHONE_LAYOUT_KEY : OVERVIEW_LAYOUT_KEY];
  if (saved) return saved.filter(widget => OVERVIEW_WIDGETS[widget.id]);

  const screen = isPhone ? 'mobile' : 'pc';
  const hasCustomised = Object.keys(LEGACY_TABS).some(tab => preferences.dashboardLayouts?.[`${tab}-${screen}`] || preferences.dashboardLayouts?.[tab]);
  if (!hasCustomised) return fromOrder(isPhone ? DEFAULT_PHONE_ORDER : DEFAULT_ORDER);

  const entries = Object.entries(LEGACY_TABS).flatMap(([tab, defaults]) => {
    const hidden = new Set(preferences.dashboardHiddenWidgets?.[`${tab}-${screen}`] ?? []);
    const layout = preferences.dashboardLayouts?.[`${tab}-${screen}`] ?? preferences.dashboardLayouts?.[tab];
    const widgets = layout
      ? [...layout].sort((a, b) => a.y - b.y || a.x - b.x).map(widget => ({ id: widget.id, span: scaleSpan(widget.w) }))
      : defaults.map(id => ({ id, span: OVERVIEW_WIDGETS[id].span }));
    return widgets.filter(widget => OVERVIEW_WIDGETS[widget.id] && !hidden.has(widget.id));
  });

  const seen = new Set<string>();
  const unique = entries.filter(entry => !seen.has(entry.id) && !!seen.add(entry.id));
  return [{ id: 'safeToSpend', span: OVERVIEW_WIDGETS.safeToSpend.span }, ...unique].map((entry, index) => toConfig(entry.id, entry.span, index));
}
