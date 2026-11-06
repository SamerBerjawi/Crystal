import type { AppPreferences, WidgetConfig } from '../types';

export const OVERVIEW_LAYOUT_KEY = 'overview-v2';
export const OVERVIEW_PHONE_LAYOUT_KEY = 'overview-v2-phone';

/** The views of the Overview. Every widget belongs to one of them. */
export type OverviewTab = 'summary' | 'spending' | 'wealth' | 'upcoming';

export const OVERVIEW_TABS: { id: OverviewTab; label: string; icon: string; blurb: string }[] = [
  { id: 'summary', label: 'Summary', icon: 'dashboard-square-01', blurb: 'Where you stand today' },
  { id: 'spending', label: 'Spending', icon: 'pie-chart-01', blurb: 'Where the money goes' },
  { id: 'wealth', label: 'Wealth', icon: 'chart-increase', blurb: 'What you own and owe' },
  { id: 'upcoming', label: 'Coming up', icon: 'calendar-03', blurb: 'What is next, and what it does to your cash' },
];

export const isOverviewTab = (value: string | null | undefined): value is OverviewTab => OVERVIEW_TABS.some(tab => tab.id === value);

export interface OverviewWidgetMeta {
  title: string;
  /** The view this widget belongs to. */
  tab: OverviewTab;
  /** One line on what it answers, shown when adding widgets. */
  purpose: string;
  icon: string;
  /** Default width, in columns of six. */
  span: number;
  /** Height in units of 96 px. */
  rows: number;
  /** Fixed height on phones, for charts. Lists take the height they need. */
  phoneHeight?: number;
}

export const OVERVIEW_WIDGETS: Record<string, OverviewWidgetMeta> = {
  safeToSpend: { title: 'Safe to spend', tab: 'summary', purpose: 'What you can spend until your next income', icon: 'wallet', span: 2, rows: 3 },
  forecastHorizon: { title: 'Forecast', tab: 'upcoming', purpose: 'The lowest your balance gets in each period ahead', icon: 'fast_forward', span: 4, rows: 3 },
  accountsSummary: { title: 'Accounts', tab: 'summary', purpose: 'Your biggest accounts and their balances', icon: 'nav_accounts', span: 2, rows: 4 },
  netWorthOverTime: { title: 'Net worth over time', tab: 'summary', purpose: 'How your net worth has moved, and where it is heading', icon: 'trending_up', span: 4, rows: 4, phoneHeight: 320 },
  todayWidget: { title: 'Today & upcoming', tab: 'upcoming', purpose: 'What is due today, and what is coming in the next two weeks', icon: 'calendar_check', span: 2, rows: 4 },
  recentActivity: { title: 'Recent activity', tab: 'summary', purpose: 'Your latest transactions', icon: 'rows', span: 4, rows: 6 },
  outflowsByCategory: { title: 'Spending by category', tab: 'spending', purpose: 'Where your money went, by category, against your budgets', icon: 'pie_chart', span: 3, rows: 4, phoneHeight: 400 },
  creditCardStatements: { title: 'Credit card statements', tab: 'upcoming', purpose: 'Last, this and next statement for each card', icon: 'credit_card', span: 6, rows: 4 },
  financialOverview: { title: 'This period', tab: 'spending', purpose: 'Money in, money out and what you kept this period', icon: 'Activity', span: 3, rows: 4 },
  overviewKpis: { title: 'Key ratios', tab: 'wealth', purpose: 'Liquidity, savings rate, debt ratio and net flow', icon: 'scale', span: 6, rows: 3 },
  assetAllocation: { title: 'Asset allocation', tab: 'wealth', purpose: 'Everything you own and owe, grouped, with the split', icon: 'circle_cut', span: 6, rows: 7 },
  assetBreakdown: { title: 'Assets', tab: 'wealth', purpose: 'What you own, by account type', icon: 'account_balance', span: 3, rows: 4 },
  liabilityBreakdown: { title: 'Debts', tab: 'wealth', purpose: 'What you owe, by account type', icon: 'bank_note', span: 3, rows: 4 },
  transactionMap: { title: 'Transaction map', tab: 'spending', purpose: 'Where you spent, on a map', icon: 'marker_pin', span: 6, rows: 5, phoneHeight: 360 },
  cashflowSankey: { title: 'Cash flow', tab: 'spending', purpose: 'How income flows into spending and savings', icon: 'git_branch', span: 6, rows: 5, phoneHeight: 420 },
  financialRunway: { title: 'Runway', tab: 'upcoming', purpose: 'How many months your cash would last', icon: 'hourglass', span: 3, rows: 4 },
  spendingCalendar: { title: 'Spending calendar', tab: 'spending', purpose: 'A dot for every day, coloured by what went out', icon: 'calendar_check', span: 6, rows: 3 },
  goalsRings: { title: 'Goals', tab: 'wealth', purpose: 'Progress towards each goal you are saving for', icon: 'target', span: 3, rows: 4 },
  merchantPareto: { title: 'Top merchants', tab: 'spending', purpose: 'The merchants that take most of your spending', icon: 'shopping_bag', span: 3, rows: 4 },
  wealthVelocity: { title: 'Wealth velocity', tab: 'wealth', purpose: 'What you saved each month against its average', icon: 'zap', span: 3, rows: 4 },
  insights: { title: 'Insights', tab: 'upcoming', purpose: 'Low balances ahead, idle cash and unusual spending', icon: 'lightbulb', span: 3, rows: 4 },
};

const DEFAULT_ORDER = ['safeToSpend', 'forecastHorizon', 'netWorthOverTime', 'todayWidget', 'recentActivity', 'accountsSummary', 'outflowsByCategory', 'creditCardStatements'];
const DEFAULT_PHONE_ORDER = ['safeToSpend', 'forecastHorizon', 'accountsSummary', 'recentActivity', 'todayWidget', 'netWorthOverTime', 'outflowsByCategory', 'creditCardStatements'];

/**
 * What each view shows to begin with, in order, as `id` or `[id, columns, rows]` where the starting size differs from the
 * widget's own. Sizes are picked so each view tiles without gaps; the rest of its widgets are one tap away in Add widget.
 */
type TabDefault = string | [string, number, number];
const TAB_DEFAULTS: Record<OverviewTab, TabDefault[]> = {
  summary: [['safeToSpend', 2, 4], ['netWorthOverTime', 4, 4], ['accountsSummary', 2, 4], ['recentActivity', 4, 4]],
  spending: [['financialOverview', 3, 4], ['merchantPareto', 3, 4], 'spendingCalendar', ['outflowsByCategory', 6, 4], 'cashflowSankey'],
  wealth: [['overviewKpis', 6, 3], ['assetAllocation', 6, 6], ['goalsRings', 3, 4], ['wealthVelocity', 3, 4]],
  upcoming: [['forecastHorizon', 4, 3], ['todayWidget', 2, 6], ['financialRunway', 2, 3], ['insights', 2, 3], 'creditCardStatements'],
};

const fromDefaults = (entries: TabDefault[]) => entries.map((entry, index) => {
  const [id, span, rows] = typeof entry === 'string' ? [entry, OVERVIEW_WIDGETS[entry].span, OVERVIEW_WIDGETS[entry].rows] : entry;
  return toConfig(id, span, index, rows);
});

/** The three old Dashboard tabs, in the order they appeared. */
const LEGACY_TABS: Record<string, string[]> = {
  overview: ['financialOverview', 'todayWidget', 'netWorthOverTime', 'forecastHorizon', 'creditCardStatements'],
  analysis: ['financialRunway', 'wealthVelocity'],
  activity: ['transactionMap', 'outflowsByCategory', 'recentActivity', 'cashflowSankey'],
};

export const toConfig = (id: string, span: number, index: number, rows?: number): WidgetConfig => ({
  id,
  title: OVERVIEW_WIDGETS[id]?.title ?? id,
  x: index,
  y: 0,
  w: span,
  h: rows ?? OVERVIEW_WIDGETS[id]?.rows ?? 3,
});

const fromOrder = (order: string[]) => order.map((id, index) => toConfig(id, OVERVIEW_WIDGETS[id].span, index, OVERVIEW_WIDGETS[id].rows));

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
      ? [...layout].sort((a, b) => a.y - b.y || a.x - b.x).map(widget => ({ id: widget.id, span: scaleSpan(widget.w), rows: widget.h ?? OVERVIEW_WIDGETS[widget.id]?.rows }))
      : defaults.map(id => ({ id, span: OVERVIEW_WIDGETS[id].span, rows: OVERVIEW_WIDGETS[id].rows }));
    return widgets.filter(widget => OVERVIEW_WIDGETS[widget.id] && !hidden.has(widget.id));
  });

  const seen = new Set<string>();
  const unique = entries.filter(entry => !seen.has(entry.id) && !!seen.add(entry.id));
  return [{ id: 'safeToSpend', span: OVERVIEW_WIDGETS.safeToSpend.span, rows: OVERVIEW_WIDGETS.safeToSpend.rows }, ...unique].map((entry, index) => toConfig(entry.id, entry.span, index, entry.rows));
}


/** Where a view keeps its layout. Phones keep their own, since they only reorder and hide. */
export const overviewTabKey = (tab: OverviewTab, isPhone: boolean) => `overview-v3-${tab}${isPhone ? '-phone' : ''}`;

/** The widgets that belong to a view, whether or not it is showing them. */
export const widgetsOfTab = (tab: OverviewTab) => Object.keys(OVERVIEW_WIDGETS).filter(id => OVERVIEW_WIDGETS[id].tab === tab);

/**
 * The layout of one view. A layout saved for the view wins. Without one, someone who arranged the single Overview keeps
 * those widgets, in their order and at their size, on the view each belongs to; a view they left empty, and everyone
 * else, gets the view's defaults.
 */
export function resolveTabLayout(preferences: Pick<AppPreferences, 'dashboardLayouts' | 'dashboardHiddenWidgets'>, isPhone: boolean, tab: OverviewTab): WidgetConfig[] {
  const saved = preferences.dashboardLayouts?.[overviewTabKey(tab, isPhone)];
  if (saved) return saved.filter(widget => OVERVIEW_WIDGETS[widget.id]);

  const layouts = preferences.dashboardLayouts ?? {};
  const screen = isPhone ? 'mobile' : 'pc';
  const customised = !!layouts[isPhone ? OVERVIEW_PHONE_LAYOUT_KEY : OVERVIEW_LAYOUT_KEY]
    || Object.keys(LEGACY_TABS).some(legacy => layouts[`${legacy}-${screen}`] || layouts[legacy]);
  if (customised) {
    const carried = resolveOverviewLayout(preferences, isPhone).filter(widget => OVERVIEW_WIDGETS[widget.id].tab === tab);
    if (carried.length > 0) return carried.map((widget, index) => ({ ...widget, x: index }));
  }
  return fromDefaults(TAB_DEFAULTS[tab]);
}
