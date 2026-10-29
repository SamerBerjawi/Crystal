# ForecastingNew plan (`/forecasting-new`)

Written 2026-10-29. Planning only. Shared rules, the shared engines (step 0) and the library inventory are in [NEW_PAGES_PLAN_INDEX.md](NEW_PAGES_PLAN_INDEX.md). This page reuses Schedule's sheets ([SCHEDULE_NEW_PLAN.md](SCHEDULE_NEW_PLAN.md) §6).

| | |
|---|---|
| Target file | `pages/new/ForecastingNew.tsx` (`export const ForecastingNew`), no props (as classic `Forecasting`) |
| Route | `/forecasting-new` (in `utils/newRoutes.ts`; in the phone dock as "Forecast", N3) |
| Classic sources | `pages/Forecasting.tsx`, `components/MobileForecastView.tsx`, `ForecastChart.tsx`, `ForecastOverview.tsx`, `ForecastDayModal.tsx`, `GoalScenarioModal.tsx` (631 lines), `GoalTable.tsx`, `FinancialGoalCard.tsx`, `GoalContributionPlan.tsx`, `utils.ts` `generateBalanceForecast` (`:1188`) and `calculateForecastHorizon` (`:366`) |
| Data | `useAccountsContext`, `useTransactionsContext`, `useGoalsContext` (`financialGoals`, `goalOrder`, `setGoalOrder`, `saveFinancialGoal`, `deleteFinancialGoal`), `useScheduleContext`, `useCategoryContext`, `useInsightsView` (`activeGoalIds`, `setActiveGoalIds`), preferences (`defaultForecastPeriod`, `currency`, `conversionRates`) |
| Logic | `utils/forecastModel.ts` (step 0 projection + this page's selectors), `utils/goalsModel.ts` (new), `hooks/useForecastData.ts` |
| Purpose in one line | Where your cash is heading, the lowest point on the way, and whether your goals get there. |

---

## 1. Feature inventory and decisions

| # | Classic feature | Where | Decision |
|---|---|---|---|
| F1 | Account selection, default = the primary account, else every liquid account | `Forecasting.tsx:117-123`, `MultiAccountFilter` | **Change**: Filters sheet with presets (Liquid cash (default), Primary account, Cash and cards, Everything); remembered per device (F-09) |
| F2 | Horizon 3M / 6M / EOY / 1Y, default from preferences | `:124`, `:1105` | **Keep** as a visible `PeriodPill` beside Filters (N22: it sets the range); add **2Y** (the engine already runs 24 months, `:173-176`) |
| F3 | Scenario playground: savings boost %, market return %, inflation % | `:130-135`, `:1130-1185` | **Keep** as a *Scenario* sheet; renamed "Income change", "Market return", "Inflation"; the chart shows baseline and scenario together |
| F4 | Four KPI cards: Wealth projection, Portfolio shift, Global performance, Forecast shift | `:1188-1228` | **Change**: two of them are the same number (F-01); the hero shows Today, Lowest ahead, End of horizon, Change. "Global performance" moves to the Goals tab as three separate figures (F-07) |
| F5 | Lowest balance per period (this month, next 3, 6, 12 months) | `ForecastOverview`, `calculateForecastHorizon` | **Keep** in the hero's grey part, showing each period's real minimum (E-05) |
| F6 | Forecast chart: combined or one line per account, goal lines on/off, 10 days of history | `ForecastChart`, `:1235-1300` | **Keep**: Total / Per account switch inside the chart tile; goal markers on/off in Filters; history length follows the horizon (§5) and is rebuilt on the shared balances (F-03) |
| F7 | Click a day → day modal with that day's items, edit (this / future / series), add a new item on that date | `ForecastDayModal`, `:812-935` | **Keep** as a *Day* sheet using Schedule's occurrence sheet and composer |
| F8 | Goals: list or grid, filter by account, drag to reorder (`goalOrder`), on/off for the forecast (`activeGoalIds`), select all, complete, add, add sub-goal, duplicate, delete (with sub-goals), buckets | `:602-810`, `:1300-1560` | **Keep** as the *Goals* tab; grid/table toggle dropped (N24: one responsive list); reorder by drag **and** Move up / down in the menu |
| F9 | Monthly target schedule, by account or by month | `:400-548`, `:1323-1437` | **Keep** in the Goals tab ("Monthly targets", By account / By month) |
| F10 | Global performance: income, savings and expense targets vs current, per account | `:1438-1515` | **Change**: three rings (savings, spending, income) at the top of the Goals tab, amounts converted (F-06) |
| F11 | Forecast ledger: every projected event by month, running balance, monthly lowest marker | `:950-980`, `:1573-1790` | **Keep** as the *Timeline* tab |
| F12 | Goal create / edit (`GoalScenarioModal`: kind, amount, saved, one-time date or recurring frequency + start + monthly contribution + day, bucket, parent, account) | `GoalScenarioModal.tsx` | **Keep** as a stepped `GoalFormSheet` (§10.1: forms with several concerns become steps) with a live projection |
| F13 | Contribution plan text per goal | `GoalContributionPlan.tsx` | **Keep** inside the goal sheet ("Plan" section) |
| F14 | Mobile layout | `MobileForecastView.tsx` (1,459 lines) | **Replaced** by the responsive page |
| F15 | `CACHE_KEYS.PREDICTIVE_INSIGHTS` constant | `:64-66` | **Dropped**: declared, never read |

New, each backed by data the page already computes:

| # | Feature | Why |
|---|---|---|
| N1 | "What moves the line": the six largest flows over the horizon (by series) | Explains the slope; the ledger has the data, but nobody adds it up |
| N2 | Optional safety cushion: a line on the chart and "N days below €x" in the hero | The classic page only shows the minimum; a cushion turns it into a yes/no |
| N3 | Scenario delta in the hero ("+€1,420 at the end of the horizon with this scenario") | The playground changed the chart but never said by how much |
| N4 | Goal projected date and status shown on the chart as flag markers | Goals live on this page; the chart is where you look |

---

## 2. Logic audit (Forecasting-specific)

Shared engine bugs E-01…E-05 and E-08 (index §3.3) all change this page's numbers.

| # | Sev | Where | Finding | Fix | Found by |
|---|---|---|---|---|---|
| F-01 | P1 | `Forecasting.tsx:909, 1206, 1222` | "Portfolio shift" and "Forecast shift" both show `endBalance − startBalance`. | One figure, "Change by {date}". | read |
| F-02 | P1 | `:1199` | The "Growth" badge is `endBalance / startBalance − 1`: infinite with a zero start, wrong sign with a negative start. | Absolute change always; percentage only when the start is positive. | read |
| F-03 | P1 | `:340-385` | The 10-day history walks back from raw `acc.balance` (future-dated items included), never backs out today's transactions, and labels each point one day early; its last point does not meet the forecast's first, so the chart steps at today. | History from the shared per-account balance series (Accounts' `resolveAccountBalance` walk, native → display); the last history point equals the projection's first. | read |
| F-04 | P1 | `:199-212` | A full 24-month projection runs **for every account** (loans and property included) on each recompute, only to project goals. | Project only the accounts goals point at, once each, memoised on their inputs. | read |
| F-05 | P0 | `:228-262` | A savings goal counts as reached when its account's **whole balance** ≥ the target, ignoring `currentAmount`; two goals on one account are both reached with the same money. Unlinked goals compare against the total of the selected accounts. | Projection from the goal's own saved amount + its contributions (`goalsModel.projectGoal`), not from an account balance; a separate check flags when an account's balance can't cover the goals that point at it ("€12,000 of goals, €9,400 in Savings"). | read |
| F-06 | P1 | `:400-600` | Goal totals add `amount` and `currentAmount` across goal currencies without converting. | Convert each goal with `resolveRates` into the display currency. | read |
| F-07 | P1 | `:916` | "Global performance %" divides the sum of income, savings **and** expense progress by the sum of their targets: a large income target hides a missed savings goal. | Three figures (savings, spending, income), never mixed. | read |
| F-08 | P1 | `GoalScenarioModal.tsx:147`, `utils.ts:1414-1440` | A *savings* goal is stored with `transactionType: 'expense'`, so its monthly contribution is projected as money **leaving** the payment account. If that account is the savings account itself, the forecast drops by money that never moves. | Savings contributions are a transfer: out of the payment account, into the goal's account when one is set (no effect when they are the same account); with no destination they stay out of the projected cash (Q-F2). | read |
| F-09 | P2 | `:117-123` | Opens on the primary account only, and forgets any other choice on reload. | Default "Liquid cash" preset; remember the selection per device (localStorage, try/catch). | read |
| F-10 | P2 | `:1414` (engine) | A recurring goal with weekly or yearly `frequency` still contributes monthly. | Contribution cadence follows `frequency` (via `advanceRecurrenceDate`). | read |
| F-11 | P2 | `:966` | Month names from `toLocaleDateString('default', …)`. | `utils/dateFormat.ts`. | read |
| F-12 | P2 | `:393` | The goal-projection memo depends on `[fullForecast, financialGoals, forecastDuration, transactions, selectedAccountIds]` but reads `accounts`, `allRecurringItems`, `activeGoals`, `assumptions`; most changes still flow through `fullForecast`, but not all (an account rename or a goal toggled on another device). | The model takes explicit inputs; memo on them. | read |

Tests (`tests/unit/forecastModel.test.ts`, `tests/unit/goalsModel.test.ts`): start balance ignores a future-dated transaction (E-01); an overdue unpaid bill lands today (E-02); one-time goal with contributions not double-counted (E-03); each horizon period shows its true minimum (E-05); history's last point = projection's first (F-03); savings contribution into the same account leaves the total unchanged (F-08); two goals on one account don't share money (F-05); EUR + USD goals summed in the display currency (F-06); weekly goal contributes weekly (F-10); scenario +10 % income raises the end balance by exactly 10 % of projected income; inflation compounds yearly from today; 2Y horizon covers 24 months.

---

## 3. Layout

### 3.1 Header (N20)

- Title "Forecasting".
- `usePageSearch({ placeholder: 'Search forecast' })`: filters the Timeline's events and the Goals list by name; on Overview it highlights matching events on the chart.
- `usePageAction`: follows the tab (as Accounts detail does): *Overview* and *Timeline* → "Plan a payment" (Schedule's composer, §6.1 of that plan); *Goals* → "Add goal".

### 3.2 Desktop (≥ 1024 px)

```
[ Overview · Timeline · Goals ]                                   (SegmentedTabs, N21)
[ 1Y ▾ ]  [ Filters (1) ]   chips: × Liquid cash             [ Scenario ]   (PageToolbar)
┌ Hero (split tile) ──────────────────────────────────────────────────────────────────┐
│ top (white)                                                                         │
│  LOWEST BALANCE AHEAD   €1,204.18         Today €4,210 · End €6,930 · +€2,720        │
│  on Thu 28 Nov, 2 days before Salary      [ Total | Per account ]                   │
│  ┌ chart C1: history (solid) ── today ┊ projection (sky, dashed) ── goal flags ┐    │
│  └ cushion line · lowest-point ring · scenario line when on ───────────────────┘    │
│ bottom (grey): This month €1,204 (28 Nov) │ Next 3 months €980 │ 6 months │ 12 months│
└──────────────────────────────────────────────────────────────────────────────────────┘
┌ What moves the line (C5, 7 cols) ──────────┐ ┌ Coming up (5 cols) ──────────────────┐
│ Salary          +€3,100 × 12  ███████████  │ │ next 5 events with running balance    │
│ Rent            −€1,200 × 12  ██████       │ │ → "Open Timeline"                     │
└────────────────────────────────────────────┘ └──────────────────────────────────────┘
```

The tabs sit at the top because they swap the whole page (as Budget, N21). The toolbar is shared by all tabs (horizon and accounts apply everywhere).

### 3.3 Phone (375 px)

```
Tabs
[1Y ▾] [Filters] [Scenario icon]
Hero: label, figure, meta line (wraps), chart 200 px, Total/Per account under the chart,
      grey part as 2×2 tiles (This month, 3, 6, 12 months)
What moves the line: list rows with a thin bar each (no chart axis)
Coming up: 5 rows
```

---

## 4. Tabs in detail

### 4.1 Overview

- **Hero figure:** the lowest projected total over the horizon (display currency), red text when below zero, orange when below the cushion. Label "Lowest balance ahead". Sub-line: date and the next income after it ("2 days before Salary").
- **Meta line:** "Today €x · End {date} €y · {±change}"; with a scenario on, a second line "Scenario: {±delta} by {date}" (N3).
- **Grey part:** four lowest-point figures (F5), each a button that zooms the chart to that period.
- **Chart C1** (§5), with **Total / Per account** (`SegmentedTabs`, two items). N24: the two views differ (one line vs several).
- **What moves the line** (N1, chart C5): series summed over the horizon, top 6 by absolute amount, + "Other". Click → Timeline filtered to that series (chip).
- **Coming up:** the next five events with date, amount and the balance after each, + "Open Timeline". On phones it sits under the hero; from 1280 px beside C5.
- **Below-cushion notice:** when the cushion is set and crossed, one line under the hero: "Below €1,500 on 9 days, first on 28 Nov" (red icon), click → Timeline at that date.

### 4.2 Timeline

- Month groups (header: month, month net, month's lowest balance with its date). Inside, days (header: date, day net, end-of-day balance), then events: logo / glyph, name, account (from → to), amount, running balance; badges *Goal* (violet icon), *Bill*, *Loan* / *Card* (sky), *Changed*, *Skipped* (struck), *Overdue* (red, E-02).
- The lowest day of each month gets a red-ring marker on its balance (the classic arrow icon, F11).
- Caps (D11): months render as you scroll (chunked); each month shows 12 events then "Show all N".
- Click an event → Schedule's occurrence sheet (edit this one / this and future / series, skip, post). Goal events → goal sheet.
- Click a day header → *Day* sheet (§6.2).
- Empty: "Nothing planned in this period" with ink "Plan a payment".

### 4.3 Goals

- **Summary (C3):** KokonutUI `apple-activity-card` with three rings: Savings, Spending, Income (saved / target, converted, F-06/F-07). Beside it (desktop) or below (phone): Active goals N · Monthly contributions €x · At risk N.
- **Account check (F-05):** a line per account whose goals exceed its projected balance at their dates ("Savings: €12,000 of goals, €9,400 projected on 1 Jun").
- **Goal list:** buckets as groups (a bucket = parent with items, F8); ungrouped goals under "Goals". Row: kind glyph (savings piggy in the violet slot / spending bag orange / income arrow green, matching C3), name, `ProgressBar` (status colour: green on track, orange at risk, red off track), "€x of €y", target date and projected date ("Projected 3 Mar 2027"), status badge with icon, monthly contribution, account logo, **In forecast** `Switch` (green when on; `activeGoalIds`), ⋯ menu.
- **Menu:** Edit, Add item (buckets), Duplicate (Undo), Mark done / not done (Undo), Move up / Move down (keyboard reorder, writes `goalOrder`, Undo), Delete (Hold; the confirm names the sub-goals that go with it).
- **Drag reorder:** `@dnd-kit` (already used by the classic page) with a 44 px handle; disabled while searching or filtering.
- **Select all / none for the forecast:** a `ToolButton` "Include all" / "Include none" on this tab (F8's select-all).
- **Monthly targets (F9):** `SegmentedTabs` By account / By month; rows of income / savings / spending amounts per month for the next six months; capped at 6 rows per group.
- **Filter by account** (F8) moves to the Filters sheet ("Only goals of the selected accounts", `FilterToggle`).
- Empty: `EmptyState` "No goals yet" with ink "Add goal".

---

## 5. Charts

| # | Where | Bklit parts | Data | Encoding | Interaction | Empty / loading |
|---|---|---|---|---|---|---|
| C1 | Overview hero | `AreaChart` + `Area` (history), `ProjectionLine` + `projection-line-end-marker` (forecast), `ReferenceArea` (below cushion / below zero), markers (`chart-markers`: today line, lowest point ring, goal flags), optional `Band` (Q-F4), `XAxis` / `YAxis`, `ChartTooltip` + `DateTicker` | `forecastModel.chartSeries({ history, projection, scenario, goals, cushion })` | History: solid area in the violet slot (balances, D1). Projection: sky dashed line (planned, D1) from today's point. Scenario: second sky line, solid, with baseline dashed. Below-zero area red at low opacity, cushion area orange at low opacity (accents on chart marks only, R9). `curveMonotoneX` (Q4). History length: 3M → 30 days, 6M → 60, EOY/1Y → 90, 2Y → 180 | Hover / arrow keys read a day: date, balance, that day's net and its top three events; click → Day sheet; grey-part tiles zoom the x-domain (`filter-data-by-x-domain`) | `area-chart-loading` skeleton; one account with no events: flat projection + "No planned payments for these accounts" |
| C1b | Per-account mode | `LineChart` + `Line` per account | `forecastModel.perAccountSeries` | Up to 6 accounts by absolute balance, the rest as "Other"; colours from `--chart-1…5` + neutral; legend with account logos | Hover a legend item dims the others (`chart-legend-hover`) | same |
| C3 | Goals tab | KokonutUI `apple-activity-card` (port) | `goalsModel.summaryRings` | Three rings: savings in the violet slot (money you keep, D1 "balances"), spending orange, income green; one accent per meaning (D2), so savings does not take a second green | Click a ring filters the list to that kind | static rings when reduced motion |
| C5 | Overview | `BarChart` horizontal (`bar-y-axis` categories) with value labels | `forecastModel.drivers(events, horizon)` | Inflows green, outflows orange, transfers sky; one bar per series | Click → Timeline filtered to the series | bar skeleton; "Nothing scheduled" |

No candlestick, radar or sankey here: none answers a forecasting question (N24).

---

## 6. Sheets

### 6.1 Scenario sheet

- Three rows, each an `AmountPad`-style stepper with a slider on desktop: **Income change** (−50 … +50 %, step 1), **Market return** (−20 … +20 % a year; affects investment accounts only, with a line saying none are selected when that's the case), **Inflation** (0 … 15 % a year, on spending).
- Live result in the sheet: "End of horizon: €6,930 → €8,350 (+€1,420)".
- Footer: "Apply" (ink), "Reset" (Undo). Scenario state is per session (Q-F3); a chip "Scenario on" with × appears in `ActiveFilters` while it's applied.

### 6.2 Day sheet

- Header: date, start-of-day and end-of-day balance (`Money`), net.
- Events (same rows as Timeline) with the balance after each.
- Footer: "Plan a payment on this day" (ink) → Schedule composer with the date pre-filled.

### 6.3 Goal sheet (`GoalFormSheet`, steps)

1. **Kind:** Savings · Spending · Income, or **Group** (a bucket, F8).
2. **Amount:** target (`AmountPad`) and saved so far; currency.
3. **When:** By a date (one-time) or Ongoing (recurring: frequency, start, contribution, day of month).
4. **Where:** payment account, destination account for savings (F-08), group (parent).
5. **Review:** live projection from `goalsModel.projectGoal` ("Reaches €5,000 on 3 Mar 2027 · on track · €210 a month needed to hit 1 Jan 2027"), plus the contribution plan (F13).
- Save: `cta` "Save goal"; Undo toast. Delete from the sheet's More menu (Hold).
- Logic from `GoalScenarioModal` (validation, bucket rules, `transactionType` mapping) moves to `utils/goalsModel.ts`; the classic modal calls it too.

---

## 7. Components

| Need | Choice | Status |
|---|---|---|
| Horizon | `PeriodPill` (Base UI menu); KokonutUI `wheel-picker` on phones only if the pill feels cramped (not planned) | exists |
| Tabs, toolbar, filters, chips | `SegmentedTabs`, `PageToolbar`, `FilterSheet`, `ChoiceChips`, `FilterList` (accounts with presets), `FilterToggle`, `ActiveFilters`, `ToolButton` | exists |
| Hero | `Card` with `top`, `TileValue`, `Money` | exists |
| Day scrub | KokonutUI `metric-card` was considered for the hero (day scrub and range drag); **not used**: C1 already scrubs, and two scrubbers on one tile would compete | — |
| Goal rings | KokonutUI `apple-activity-card` | to port |
| Goal funding gauge | KokonutUI `liquid-gauge` was considered for each goal row; **not used** (a ring per row repeats the summary; `ProgressBar` is lighter) | — |
| Reorder | `@dnd-kit` + menu Move up / down | exists |
| Delete | `confirmNew` + `hold-button` | exists |
| Charts | Bklit `AreaChart`, `ProjectionLine`, `ReferenceArea`, `Band`, markers, `LineChart`, `BarChart` | exists |
| Occurrence and composer sheets | from `components/new/schedule/sheets.tsx` | Schedule plan |
| Magic UI | `confetti` when a goal is marked done was considered; **not planned** unless you want it (honours reduced motion; Q-F6) | — |
| Mango UI | Pending X-Q1 | — |

New files:

| File | Contents |
|---|---|
| `utils/forecastModel.ts` | Step 0 `projectBalances` + `horizonEnd(duration, today)`, `historySeries`, `chartSeries`, `perAccountSeries`, `lowestPoints` (E-05), `drivers`, `daysBelow(cushion)`, `dayDetail`, `applyScenario` |
| `utils/goalsModel.ts` | `projectGoal`, `goalStatus`, `summaryRings`, `accountCoverage` (F-05), `monthlyTargets` (by account / by month), `goalTree` (buckets), `validateGoal`, `reorderGoals` |
| `hooks/useForecastData.ts` | Contexts → models; account selection (remembered); writes with `undo`: `saveGoal`, `deleteGoal` (with children), `toggleGoalActive`, `setAllGoalsActive`, `toggleGoalDone`, `duplicateGoal`, `moveGoal` |
| `components/new/forecast/overview.tsx` | Hero, C1, C5, Coming up |
| `components/new/forecast/timeline.tsx` | Month / day groups |
| `components/new/forecast/goals.tsx` | Rings, list, monthly targets |
| `components/new/forecast/sheets.tsx` | Scenario, Day, Goal sheets |
| `components/kokonutui/apple-activity-card.tsx` | Port |
| `pages/new/ForecastingNew.tsx` | Page |
| Tests | `tests/unit/forecastModel.test.ts`, `tests/unit/goalsModel.test.ts`; new files in `new-tokens.test.ts` |

---

## 8. States, accessibility, motion

- **Loading:** `PageSkeletonNew` "dashboard" + chart skeleton.
- **No accounts selected:** the hero says "Pick accounts to forecast" with an ink "Choose accounts" (opens Filters).
- **Privacy mode:** `Money` everywhere; chart y-axis labels masked; tooltips masked.
- **Multi-currency:** projection in the display currency; per-account mode labels each line with the account's native currency in the legend; goals converted (F-06).
- **Reduced motion:** chart reveal off, rings static, drag reorder still works (keyboard route via the menu).
- **Keyboard route:** tabs (tablist); chart focusable with arrows (one day), Shift+arrows (one week), Enter (Day sheet); goal rows are buttons (Enter: sheet), the switch is its own control, ⋯ opens the menu; Move up / down from the menu.
- **Screen readers:** the chart has a text summary ("Lowest €1,204 on 28 November; ends at €6,930 on 29 October 2027") in an `aria-describedby` element.

---

## 9. Phases

| Phase | Scope | Done when |
|---|---|---|
| F1 | Step 0 projection (`projectBalances`, E-01…E-05, E-08) and `goalsModel` (F-05…F-08, F-10) with tests; `generateBalanceForecast` as a wrapper | Tests pass; classic Forecasting and Dashboard still render; differences against classic listed in the notes |
| F2 | Overview: toolbar (horizon, filters), hero + C1 (+ per-account), lowest points, C5, Coming up | Last history point = first projection point; lowest figure equals the minimum of the chart's data |
| F3 | Timeline + Day sheet, wired to Schedule's sheets | Editing an occurrence from the Timeline updates the chart |
| F4 | Goals tab: rings, list, reorder, switches, monthly targets, goal sheet | Every F8–F13 action round-trips with Undo / Hold |
| F5 | Scenario sheet + optional band (Q-F4), cushion (Q-F1), docs (migration notes) | Notes complete |

---

## 10. Open questions

| # | Question | Recommendation |
|---|---|---|
| Q-F1 | Add an optional safety cushion (new preference `forecastCushion`, an amount in the display currency)? | Yes, empty by default; set from the chart tile's ⋯ menu. Preferences pass through the schema, no server change. |
| Q-F2 | Savings goals: model contributions as transfers into a destination account (new optional `FinancialGoal.destinationAccountId`), or keep them as outflows? | Transfers, with the new optional field (the goal schema is `.passthrough()`). With no destination they leave projected cash, as today. |
| Q-F3 | Remember the scenario between visits? | No: a scenario left on silently changes every number. Per session, with a visible chip. |
| Q-F4 | Uncertainty band from your past variable spending (10th–90th percentile of non-scheduled daily spend over the last 90 days, accumulated)? | Build it in F5 as an opt-in ("Show likely range"), clearly labelled; it is new maths, so it gets its own tests. |
| Q-F5 | Should goals stay in the projection by default (`activeGoalIds`)? | Keep classic behaviour (only goals switched on). |
| Q-F6 | Confetti when a goal is marked done (Magic UI)? | Your call; off by default would be odd, so either yes or not at all. |
