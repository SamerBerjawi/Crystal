# DashboardNew plan (`/dashboard-new`)

Written 2026-10-29. Planning only. Shared rules, shared engines and the library inventory are in [NEW_PAGES_PLAN_INDEX.md](NEW_PAGES_PLAN_INDEX.md). The Dashboard composes tiles from the other New pages, so it reads their models: Accounts (`utils/accountsModel.ts`), Transactions (`utils/transactionsModel.ts`), Budget (`utils/budgetModel.ts`), and the planned Schedule, Forecasting and Investments models ([SCHEDULE_NEW_PLAN.md](SCHEDULE_NEW_PLAN.md), [FORECASTING_NEW_PLAN.md](FORECASTING_NEW_PLAN.md), [INVESTMENTS_NEW_PLAN.md](INVESTMENTS_NEW_PLAN.md)).

| | |
|---|---|
| Target file | `pages/new/DashboardNew.tsx` (`export const DashboardNew`), same props as `Dashboard`: `user`, `tasks`, `saveTask`, `onTogglePrivacyMode`, `onSyncBanks`, `isSyncingBanks` (the classic interface also lists categories, goals and schedule arrays that the component reads from contexts instead) |
| Route | `/dashboard-new` ("Home" in the phone dock, N3) |
| Classic sources | `pages/Dashboard.tsx` (2,169 lines), `components/MobileDashboardView.tsx`, widgets: `FinancialOverview`, `TodayWidget`, `NetWorthChart`, `ForecastOverview`, `CreditCardStatementCard`, `OutflowsChart`, `AssetDebtDonutChart`, `TransactionList`, `AccountBreakdownCard`, `BudgetOverviewWidget`, `TransactionMapWidget`, `CashflowSankey`, `FinancialRunwayWidget`, `MerchantParetoWidget`, `WealthVelocityWidget`; `UnifiedPendingMatcherCard`, `UnifiedPendingMatchesModal`, `PendingMatchesView`, `MatcherConfigPanel`; `AddWidgetModal`, `WidgetWrapper`, `react-grid-layout` |
| Data | All domain contexts; `useInsightsView` (`dashboardAccountIds`, `dashboardDuration`, `activeGoalIds`); `useTransactionMatcher`, `useSyncedBillMatcher`, `useMatcherConfig`; preferences (`dashboardLayouts`, `dashboardHiddenWidgets`, `defaultPeriod`, `defaultForecastPeriod`, `excludeTransfersFromAnalytics`, `showBalanceAdjustments`, `currency`, `conversionRates`) |
| Logic | `utils/dashboardModel.ts` (composition, period maths, layout), `hooks/useDashboardData.ts` |
| Purpose in one line | One screen that says how you are doing this month, what is due, and where your money stands, with a way into each page. |

---

## 1. Feature inventory and decisions

### 1.1 Page-level features

| # | Classic feature | Where | Decision |
|---|---|---|---|
| F1 | Tabs Overview · Analysis · Activity · Pending matches (badge with count) | `Dashboard.tsx:1805-1825` | **Change** to **Overview · Spending · Cash flow · Wealth** (Q7's example); Pending matches becomes an attention item and a sheet (Q-D4) |
| F2 | Period (TODAY, WTD, MTD, 30D, 60D, 90D, 6M, YTD, 1Y, ALL), shared through `useInsightsView` | `DurationFilter`, `:1873` | **Keep** as a visible `PeriodPill` (N22: it sets the range) |
| F3 | Accounts filter, shared through `useInsightsView` | `MultiAccountFilter` | **Keep** in the Filters sheet with presets (as Transactions N11) |
| F4 | Forecast horizon select, show-forecast and show-goals toggles (Overview only) | `:1828-1870` | **Change**: horizon follows the period until you pick one, then stays (D-07); toggles in Filters ("Forecast on the net worth chart", "Goal markers") |
| F5 | Customize: edit mode, add widget, remove widget, change width, drag layout (react-grid-layout, per tab and device, `dashboardLayouts`, `dashboardHiddenWidgets`) | `:1178-1440`, `:1741-1757` | **Change**: a *Customize* sheet per tab (show / hide, order, size S / M / L), keyboard and touch friendly; drag-and-resize with KokonutUI `bento-grid` from 1024 px as an optional phase (Q-D2). Stored under new keys so classic layouts are untouched |
| F6 | Sync banks (header button; pull down to sync on touch) | `:1759-1777`, `:187-200` | **Keep**: green "Sync" tool (N7, N23); pull-to-refresh kept on phones |
| F7 | Add transaction (header) | `:1779-1784` | **Keep**: the header's violet action is "Add transaction" (N4 default) |
| F8 | Pending matches banner: transfer and bill match counts, high-confidence count, quick reconcile (≥ 80), dismiss all, review | `UnifiedPendingMatcherCard`, `:1789-1800`, `:1491-1575` | **Keep** as an attention item ("6 matches to review · 4 sure") with "Confirm sure ones" (Undo) and "Review" (opens `MatchReviewSheet`) |
| F9 | Pending matches tab: lists, confirm / dismiss one, selected, all; matcher settings | `PendingMatchesView`, `MatcherConfigPanel` | **Moved** into `MatchReviewSheet` (shared with Transactions' To review, X-Q5) |
| F10 | Transaction detail modal from a category or a row | `TransactionDetailModal` | **Change**: rows open the New transaction sheet (`components/new/transactions/detail.tsx`); a category opens Transactions filtered to it (`/transactions-new?category=…`) |
| F11 | Forecast day modal, recurring / override / edit-recurrence / bill modals from the agenda and the chart | `:383-535` | **Change**: Schedule's occurrence sheet and composer (Schedule plan §6) |
| F12 | Goal modal, budget modals (quick budget, budget) | `GoalScenarioModal`, `QuickBudgetModal`, `BudgetModal` | **Change**: open the owning page's sheet (Forecasting goal sheet; Budget's sheet) |
| F13 | Mobile layout | `MobileDashboardView.tsx` | **Replaced** by the responsive page |

### 1.2 Widgets → tiles

| Classic widget | Tab today | Decision | New tile (tab) |
|---|---|---|---|
| `financialOverview` (net worth, income, expenses, changes, sparklines) | Overview | **Change** | *This month* hero (Overview) + *Net worth* tile (Overview) |
| `todayWidget` (tasks, recurring, bills, goals due ≤ 3 days, process an item) | Overview | **Keep** | *Due soon* (Overview), from Schedule's engine (E-11) |
| `netWorthOverTime` (history + forecast + goal markers) | Overview | **Keep** | *Net worth* tile (Overview, compact) and full chart (Wealth) |
| `forecastHorizon` (lowest balance per period) | Overview | **Keep** | *Cash ahead* tile (Overview), from Forecasting's `lowestPoints` |
| `creditCardStatements` | Overview | **Keep** | *Cards* tile (Overview), shown only with configured cards |
| `budgetOverview` | Analysis | **Keep** | *Budgets* tile (Spending) |
| `financialRunway` (days until zero) | Analysis | **Keep** | *Runway* (Cash flow) |
| `wealthVelocity` | Analysis | **Keep** | *Wealth velocity* (Wealth) |
| Analysis KPIs: liquidity ratio, savings rate, debt ratio, net flow | Analysis | **Change** (D-01, D-02, D-03) | Cash flow and Wealth stat rows |
| Asset allocation pie + assets / liabilities breakdown | Analysis | **Change** | *Allocation* (Wealth), two bars as Accounts A2 |
| `transactionMap` | Activity | **Keep** | *Where you spent* (Spending), reusing `PlacesMap` |
| `outflowsByCategory` | Activity | **Keep** | *Spending by category* (Spending) |
| `netWorthBreakdown` (assets vs debt donut) | Activity | **Merged** into *Allocation* (same numbers) |
| `recentActivity` | Activity | **Keep** | *Recent activity* (Overview), 5 rows |
| `cashflowSankey` | Activity | **Keep** | *Money flow* (Cash flow) |
| `merchantPareto` | none (defined, in no tab: D-11) | **Revive** | *Top merchants* (Spending) |
| `assetBreakdown`, `liabilityBreakdown` | none (D-11) | **Dropped** (covered by *Allocation*) |

### 1.3 Greeting band (R3)

The reference's R3 asks for a greeting band above the tiles: date disc, "Show my tasks", a calendar button with an unread dot, and the two-tone "Hey, need help? Just ask me anything" prompt with a mic.

| Part | Decision |
|---|---|
| Date disc ("29", "Thu, October") | **Keep** |
| "Show my tasks" pill | **Keep**, as an **ink** pill: R3 made it violet, but N4 (later, higher priority) makes the header action the screen's one violet button. Opens the *Due soon* sheet (tasks + bills + recurring) |
| Calendar button with unread dot | **Keep**: opens Schedule's Calendar tab; dot when something is overdue |
| Ask prompt + mic | **Phase D5 (optional)**: opens an *Ask* sheet backed by the existing AI proxy (`/api/ai/proxy`, CLAUDE.md); mic only where the browser has speech input. Q-D3 |

---

## 2. Logic audit

| # | Sev | Where | Finding | Fix | Found by |
|---|---|---|---|---|---|
| D-01 | **P0** | `Dashboard.tsx:1914-1917` | Analysis "Net flow" is `calculateAccountTotals(...).netWorth − calculateAccountTotals(...).netWorth`: **always 0**. | Net flow = income − spending for the period (the same numbers as *This month*), or net-worth change over the period (Q-D5). | read |
| D-02 | P1 | `:1905-1907` | "Debt ratio" (liabilities / assets) is shown as 0 % whenever **net worth** ≤ 0, i.e. exactly when debt is high. It also calls `calculateAccountTotals` three times inline per render. | Guard on assets > 0; compute once in the model. | read |
| D-03 | P1 | `:1446-1478` | Liquidity ratio and savings rate ignore the accounts filter (they use every analytics account); liquid cash uses raw balances (future items in) and `convertToEur` without rates; `LIQUID_ACCOUNT_TYPES` includes credit cards, while Accounts' liquid definition (L-A5) does not; the spend window is "3 calendar months back" via `setMonth`. | Accounts' definition table and `resolveAccountBalance`; filter applied; window = last 90 days / 3. | read |
| D-04 | P1 | `:688-742` | The previous-period comparison reads `transactions`, the current one `analyticsTransactions`: with "show balance adjustments" off, adjustments count in the previous period only; orphan transfers count in the current period only (`:657-659` vs `:715-725`). Changes are skewed. | One `periodTotals(range)` function used for both periods (Transactions already has one: `transactionsModel` previous-period helpers). | read |
| D-05 | P1 | `:618-624` | The income / spending cache key (`transactionsKey|accounts|duration`) leaves out `showBalanceAdjustments` and `excludeTransfersFromAnalytics`, so toggling either preference shows stale totals until a transaction changes. | No hand-made cache; memo on the real inputs (the model is cheap once E-* are fixed). | read |
| D-06 | **P0** | `:995-1108` | Net-worth history walks back from today's net worth using **transactions only**: property and vehicle valuations, loan amortisation and investment prices never move the line (Accounts BUG-04, fixed there but not here). The forecast part adds the **change in projected cash** to net worth, so a €1,200 mortgage installment lowers projected net worth by €1,200 instead of by its interest. The forecast also uses all selected accounts while net worth uses analytics accounts only. | History from Accounts' per-account balance walk (`accountsModel`), the same one as the Accounts hero, so both pages draw the same line. Projected net worth = projected cash + projected debt reduction (principal from the loan schedule) + assets held flat (or at their APY / market assumption). | read |
| D-07 | P1 | `:207-231` | Every period change overwrites the forecast horizon the user picked. | Horizon follows the period until the user picks one; then it is remembered per device. | read |
| D-08 | P1 | `:328-336` vs `:351-354` | Two sets of synthetic items: the agenda from analytics accounts and transactions, the forecast from all of them. A loan excluded from analytics shows in the forecast but not in "today". | Schedule's engine once (step 0). | read |
| D-09 | P2 | `:936-980` | Asset groups ("Liquid cash" = checking + savings; "Investments" = all `Investment`, pension and round-ups included; "Other assets" = other + lending) differ from the Accounts page's groups; bar widths divide by total assets computed separately. | Use `groupAccountsByType` / Accounts' definition table; shares from the same totals. | read |
| D-10 | P2 | `:898-922` | `createBreakdown` uses raw `acc.balance` and `Math.abs` per type, so an overdrawn checking account adds to assets. (Feeds the dead widgets of D-11 only.) | Removed with D-11. | read |
| D-11 | P2 | `:150-155`, `:1259-1267` | `merchantPareto`, `assetBreakdown` and `liabilityBreakdown` are defined but in no tab: unreachable. | Revive Top merchants; drop the two breakdowns (§1.2). | read |
| D-12 | P2 | `:1144-1150` | Card statement dates formatted with a hard-coded `'en-US'` locale. | `utils/dateFormat.ts`. | read |
| D-13 | P2 | `:1110-1117`, `:1162-1167` | Trend colour as hex; the budget tile navigates with `pushState('/budget')`, which leaves the New UI. | Tokens; links to `-new` routes (`utils/newRoutes.ts`). | read |
| D-14 | P2 | `:854-891` | Sparklines leave out every transfer, while the KPIs above them count transfers to unselected accounts; the sparkline does not add up to its figure. | Sparkline from the same per-day series as the figure. | read |

Tests (`tests/unit/dashboardModel.test.ts`): net flow ≠ 0 with income and spending (D-01); debt ratio with negative net worth (D-02); filters change the cash-flow figures (D-03); previous period excludes adjustments when the preference is off (D-04); toggling the preference changes totals (D-05); net-worth history moves on a property valuation and a loan principal payment, and its last point equals the Accounts hero (D-06); projected net worth falls by interest only on a loan installment (D-06); horizon override survives a period change (D-07); one synthetic set (D-08); sparkline sums to the KPI (D-14); layout merge keeps hidden tiles hidden and adds new tiles at the end.

---

## 3. Layout

### 3.1 Header (N20)

- Title "Dashboard" (or the two-tone "Good morning, {first name}" if you prefer; Q-D6).
- `usePageSearch`: none (the page finder, N2).
- `usePageAction`: default **Add transaction** (quick add).

### 3.2 Overview, desktop (≥ 1280 px)

```
┌ Greeting band (grey, full width) ────────────────────────────────────────────────────┐
│ (29) Thu, October   [ Show my tasks · 3 ]  (📅•)      Hey, need help?  Just ask me…  (🎤) │
└───────────────────────────────────────────────────────────────────────────────────────┘
[ Overview · Spending · Cash flow · Wealth ]                              (N21)
[ This month ▾ ]  [ Filters ]                              [ Sync ] [ Customize ]   (N22–N23)
⚠ 6 matches to review · 4 sure  [Confirm sure ones] [Review]   ⚠ Visa due in 3 days   (attention line)
┌ This month (split, 7 cols) ─────────────────┐ ┌ Net worth (5 cols) ─────────────────────┐
│ top: SPENT THIS MONTH  €1,847.20            │ │ €182,400  +€2,310 (90 days)             │
│ of €3,500 budget · 53 % · 8 days left       │ │ area chart (history solid, forecast sky │
│ C1 daily spend bars vs pace line            │ │ dashed), goal flags                     │
│ bottom: Income €4,100 │ Net +€2,253 │ Saved 55 % │ └─────────────────────────────────────────┘
└─────────────────────────────────────────────┘
┌ Due soon (4) ────────┐ ┌ Cash ahead (4) ───────┐ ┌ Cards (4) ──────────────────────┐
│ tasks, bills, recurring│ │ lowest €1,204 on 28 Nov│ │ Visa · €640 due 2 Nov · Pay      │
│ next 7 days, 5 rows    │ │ mini projection        │ │ Amex · statement closes in 6 d   │
└───────────────────────┘ └────────────────────────┘ └──────────────────────────────────┘
┌ Recent activity (7) ─────────────────────────┐ ┌ Budgets (5) ──────────────────────┐
│ 5 rows (Transactions' row) → All transactions │ │ 4 nearest their limit, rings/bars │
└───────────────────────────────────────────────┘ └───────────────────────────────────┘
```

At 1024–1279 px the 7/5 rows become 6/6 and the three small tiles become 2 + 1. At 768 px tiles pair two by two. Below 768 px everything is one column (§3.4).

### 3.3 Other tabs (desktop)

```
Spending:  [ Spending by category (ring + list, 6) | Top merchants (6) ]
           [ Where you spent (map, 8)              | Budgets (4)       ]
Cash flow: [ Stat row: Income · Spending · Net · Savings rate · Months of runway ]
           [ Money flow (Sankey, 12) ]
           [ Income vs spending, 12 months (bars + savings-rate line, 8) | Runway (4) ]
Wealth:    [ Net worth over time (full chart, 12) ]
           [ Allocation (two bars, 6) | Wealth velocity (6) ]
           [ Investments (portfolio value, gain → Investments, 6) | Debt (ratio, payoff → Accounts, 6) ]
```

### 3.4 Phone (375 px)

```
Greeting band: date disc + "Show my tasks"; the prompt collapses to a round ask button
Tabs (scroll sideways) · [Period ▾] [Filters] [Sync icon] [⋯ Customize]
Attention line (scrolls sideways)
This month hero (figure 36 px, meta line, chart 120 px, 3 figures in a row)
Net worth (figure, chart 120 px)
Due soon · Cash ahead · Cards · Recent activity · Budgets (one column, each capped at 3 rows)
```

---

## 4. Tiles in detail

Every tile is the R5 tile: `TileHeader` (icon chip, title, optional pill with caret), value, optional `FooterLink` to the owning page. Each tile reads one model function; none computes on its own.

| Tile | Tab | Content | Source | Link |
|---|---|---|---|---|
| **This month** (hero, split) | Overview | Figure: spent in the period (label follows the period: "Spent this month", "Spent in 90 days"); meta: "of €x budget · y % · z days left" (budget only for monthly periods); C1; bottom: Income, Net, Savings rate | `transactionsModel` period totals, `budgetModel` | Transactions |
| **Net worth** | Overview | Figure + period change; C2 compact | `accountsModel` hero series (D-06), Forecasting projection | Accounts |
| **Due soon** | Overview | Next 7 days: overdue first, tasks (title, due), bills and recurring (logo, amount); "Mark paid" / "Done" inline with Undo; KokonutUI `notification-stack` look on phones (Q-D7) | Schedule `buildOccurrences`, `tasks` | Schedule, Tasks |
| **Cash ahead** | Overview | Lowest balance ahead and its date; mini projection; "Below cushion on N days" when set | Forecasting `lowestPoints`, `projectBalances` | Forecasting |
| **Cards** | Overview | Configured cards: statement balance, due date countdown, "Pay" (opens the card's Pay statement), utilisation bar | `accountDetailModel` card metrics | Account page |
| **Recent activity** | Overview | 5 newest rows (transfers once), same row as Transactions | `transactionsModel.buildRows` | Transactions |
| **Budgets** | Overview, Spending | Four budgets nearest their limit (rings, or `liquid-gauge`, Q-D7); over-budget first, red badge | `budgetModel` | Budget |
| **Spending by category** | Spending | C3 ring + top 6 list with amounts and change vs previous period; click → Transactions filtered | `transactionsModel` | Transactions |
| **Top merchants** | Spending | Top 6 by spend with logo and share (the Pareto: "6 merchants = 62 % of spending") | `transactionsModel` merchants | Transactions (Merchants filter) |
| **Where you spent** | Spending | `PlacesMap` (lazy) with clusters; click → Transactions with the place chip | `transactionsModel` clusters | Transactions |
| **Stat row** | Cash flow | Income, Spending, Net (D-01), Savings rate, Months of runway (D-03) | `dashboardModel.cashFlowStats` | — |
| **Money flow** | Cash flow | C4 Sankey: income categories → spending categories (top 8 + Other), with what is left as "Saved" | `dashboardModel.sankey` | Reports (later) |
| **Income vs spending** | Cash flow | C5: 12 months, income green / spending orange bars, savings-rate line | `dashboardModel.monthly` | Reports |
| **Runway** | Cash flow | Days of liquid cash at the 90-day spend rate; bar against 3 / 6 months | `dashboardModel.runway` | Forecasting |
| **Net worth over time** | Wealth | C2 full: period range, forecast and goal markers per Filters | as Net worth | Accounts |
| **Allocation** | Wealth | Assets bar and liabilities bar, each 100 % (Accounts A2) with legend amounts | `accountsModel` allocation | Accounts |
| **Wealth velocity** | Wealth | Average monthly net-worth change over 3 / 6 / 12 months; time to the next round milestone | `dashboardModel.velocity` | — |
| **Investments** | Wealth | Portfolio value, unrealized gain, XIRR | `investmentsModel.portfolioTotals` | Investments |
| **Debt** | Wealth | Debt ratio (D-02), total debt, next payoff date | `accountsModel` + loan schedules | Accounts |

Attention line (above the tiles, only items that apply, each a chip with an icon, D12): pending matches (F8), overdue payments, card due within 7 days, budgets over limit, bank connection expiring (Accounts L-A7 rules), prices older than 7 days (Investments N2). Max four, then "+N".

---

## 5. Charts

| # | Tile | Bklit parts | Encoding | Interaction |
|---|---|---|---|---|
| C1 | This month | `BarChart` (daily spend) + `Line` (budget pace: budget × day / days in month) | Bars orange (spending); pace line ink dashed; days over pace keep the orange bar and get a red marker above | Hover reads a day; click → Transactions for that day |
| C2 | Net worth (compact and full) | `AreaChart` + `Area`, `ProjectionLine`, goal markers, `DateTicker` | History in the violet slot; forecast sky dashed (D1); `curveMonotoneX` | Scrub; full version has the period's range |
| C3 | Spending by category | `RingChart` + `RingCenter` (or KokonutUI `spending-ring`) | User's category colours; centre = total | Hover highlights the list row; click filters |
| C4 | Money flow | `sankey/SankeyChart` | Income nodes green, spending nodes in category colours, transfers sky | Hover a link shows the amount; click a node → Transactions |
| C5 | Income vs spending | `BarChart` grouped + `Line` | Income green, spending orange, savings-rate line ink on a right axis | Hover a month |
| C6 | Cash ahead | `AreaSparkline` | Sky | Hover reads a day |
| C7 | Budgets | `Ring` per budget (or `liquid-gauge`) | Green under pace, orange near, red over | Click → Budget |

No dotted backgrounds or decorative trend lines (§20.4). Tooltips per §20.1–§20.3.

---

## 6. Customize

- **Sheet** per tab: each tile with a `Switch` (shown), Move up / Move down, and a size `ChoiceChips` (S / M / L → 4 / 6 / 12 columns on desktop; on phones every tile is full width). Reset to default (Undo).
- **Storage:** `preferences.dashboardLayouts["new:<tab>"]` (`WidgetConfig[]`, `x` = order, `w` = columns, `h` unused) and `preferences.dashboardHiddenWidgets["new:<tab>"]`. Classic keys (`overview-pc`, …) are not read or written. Preferences pass through the schema, no server change.
- **Merge rule:** stored order first, then any tile added in a later release at the end; hidden tiles stay hidden (classic AUD-50 rule).
- **Drag and resize (optional, Q-D2):** KokonutUI `bento-grid` (6-column grid with keyboard support) from 1024 px; the sheet stays the keyboard and phone route.

---

## 7. Components

| Need | Choice | Status |
|---|---|---|
| Greeting band | New `GreetingBand` (date disc, ink pill, round buttons, `TwoToneTitle`) | new (plain; R3 has no KokonutUI equivalent) |
| Tiles | `Card`, `TileHeader`, `TileValue`, `PeriodPill`, `FooterLink`, `IconChip` | exists |
| Toolbar | `PageToolbar`, `FilterButton`, `FilterSheet`, `ToolButton` (green Sync), `ToolMenu` (Customize on phones) | exists |
| Attention chips | `FilterChip`-style chips with icons (not filters: they navigate) | exists (style) |
| Due-soon stack | KokonutUI `notification-stack` (port) on phones; list on desktop | to port (Q-D7) |
| Budget gauges | KokonutUI `liquid-gauge` (port) or Bklit `Ring` | to port (Q-D7) |
| Category dial | KokonutUI `spending-ring` (port) or Bklit `RingChart` | shared with Schedule Q-S2 |
| Goal rings | KokonutUI `apple-activity-card` — **not on the Dashboard** (goal flags on the net-worth chart are enough; rings live on Forecasting) | Forecasting |
| Layout | Customize sheet; KokonutUI `bento-grid` optional | to port (Q-D2) |
| Match review | `MatchReviewSheet` (new, `components/new/matches/`), logic from `useTransactionMatcher` / `useSyncedBillMatcher` (hooks, allowed) | new |
| Map | `components/new/transactions/PlacesMap.tsx` (lazy) | exists |
| Sync status | KokonutUI `status-island` (shared with Investments) — optional; the green button's "Syncing" state is the baseline (N7) | optional |
| Numbers | NumberFlow on figure changes (D8); Magic UI `number-ticker` **not needed** | exists |
| Magic UI | `blur-fade` staggered entry of tiles was considered; **not planned** (motion on every visit; D8 limits motion to charts and numbers) | — |
| Mango UI | Pending X-Q1 | — |

New files:

| File | Contents |
|---|---|
| `utils/dashboardModel.ts` | `periodRange`, `periodTotals` (current and previous, D-04), `thisMonthHero`, `cashFlowStats` (D-01, D-03), `debtRatio` (D-02), `netWorthSeries` (D-06, over `accountsModel`), `projectedNetWorth` (D-06), `monthly`, `sankey`, `runway`, `velocity`, `attentionItems`, `dueSoon`, `layoutFor(tab, prefs)`, `mergeLayout` |
| `hooks/useDashboardData.ts` | Contexts, filters (`useInsightsView`), horizon override (D-07), writes with `undo`: `markOccurrencePaid`, `toggleTask`, `confirmSureMatches`, `saveLayout`, `resetLayout` |
| `components/new/dashboard/greeting.tsx` | `GreetingBand`, Ask sheet (phase D5) |
| `components/new/dashboard/tiles/*.tsx` | One file per tile (lazy-loaded below the first screen: map, Sankey) |
| `components/new/dashboard/customize.tsx` | Customize sheet |
| `components/new/matches/MatchReviewSheet.tsx` | Shared match review |
| `pages/new/DashboardNew.tsx` | Page |
| Tests | `tests/unit/dashboardModel.test.ts`; `new-tokens.test.ts` |

---

## 8. States, accessibility, motion, performance

- **First screen budget:** the Overview's first row (hero, net worth) renders from data already in memory; map and Sankey are lazy and only on their tabs.
- **New user (no data):** one onboarding tile ("Add your first account" ink button → Accounts; "Import transactions" → Data) instead of empty tiles.
- **A tile fails:** `WidgetErrorBoundary`-style boundary per tile in New style (`ErrorPanel` compact) so one broken tile doesn't blank the page.
- **Privacy mode:** `Money` everywhere; `onTogglePrivacyMode` stays reachable from the account menu.
- **Multi-currency:** every figure in the display currency (`resolveRates`, E-08).
- **Reduced motion:** chart reveals off, no stack animation.
- **Keyboard route:** tablist; tiles are regions with headings (the Scroll Index rail picks them up from `lg`, N13); tile links are real links; Customize sheet: switches, Move up / down buttons, size chips; attention chips are buttons.

---

## 9. Phases

| Phase | Scope | Done when |
|---|---|---|
| D1 | `dashboardModel.ts` + tests (D-01…D-14); reuse the other pages' models | Net worth equals the Accounts hero; period totals equal TransactionsNew's for the same filters |
| D2 | Overview tab: greeting band (no Ask yet), toolbar, attention line, This month, Net worth, Due soon, Cash ahead, Cards, Recent activity, Budgets | Every classic Overview widget reachable |
| D3 | Spending, Cash flow, Wealth tabs | Every classic Analysis and Activity widget reachable |
| D4 | Customize sheet + storage; `MatchReviewSheet` | Layout persists per tab; matches confirm and dismiss with Undo |
| D5 | Optional: Ask sheet (AI proxy, mic), `bento-grid` drag, KokonutUI ports | Per Q-D2, Q-D3, Q-D7 |
| D6 | Docs: migration notes "DashboardNew" | Notes complete |

---

## 10. Open questions

| # | Question | Recommendation |
|---|---|---|
| Q-D1 | Tabs: Overview · Spending · Cash flow · Wealth (as above), or keep classic's Overview · Analysis · Activity? | The four above; each answers one question. |
| Q-D2 | Layout editing: Customize sheet only, or also drag-and-resize with KokonutUI `bento-grid` on desktop? | Sheet first (works everywhere); `bento-grid` in D5 if you miss dragging. |
| Q-D3 | Build the "Ask me anything" prompt (R3) now, later, or drop it? | Later (D5), with the AI proxy; until then the band shows only the date and Show my tasks. |
| Q-D4 | Pending matches: a sheet from the Dashboard's attention line (and Transactions' To review), instead of a tab? | Yes. |
| Q-D5 | "Net flow" on Cash flow: income − spending (cash view) or change in net worth (wealth view)? | Income − spending here; net-worth change lives on the Net worth tile. |
| Q-D6 | Header title: "Dashboard" or a greeting ("Good morning, {first name}")? The greeting band already greets. | "Dashboard" in the header; the greeting stays in the band. |
| Q-D7 | Port `notification-stack` (Due soon on phones) and `liquid-gauge` (Budgets)? | `notification-stack` yes (it is the reference's due-soon pattern); budgets use Bklit rings to match BudgetNew. |
| Q-D8 | Keep pull-to-refresh sync on phones? | Yes (classic behaviour); it is the only gesture, and the Sync button is its tap route. |
