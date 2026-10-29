# New pages plan: Schedule, Forecasting, Investments, Dashboard

Written 2026-10-29. Planning only: no code was changed. Everything below was read from the code on branch `docs/accounts-migration-notes` (`938a2ef`). Bugs marked **read** were found by reading the code; bugs marked **run** were reproduced with a script.

This file is the entry point. It holds what the four pages share. Each page has its own plan:

| Page | Plan | New route | Classic sources |
|---|---|---|---|
| Schedule & Bills | [SCHEDULE_NEW_PLAN.md](SCHEDULE_NEW_PLAN.md) | `/schedule-new` | `pages/Schedule.tsx` (1,493 lines), `components/MobileScheduleView.tsx` (1,217), `CalendarView`, `ScheduleHeatmap`, `ScheduledItemRow`, `RecurringTransactionModal`, `RecurringOverrideModal`, `EditRecurrenceModal`, `BillPaymentModal` |
| Forecasting | [FORECASTING_NEW_PLAN.md](FORECASTING_NEW_PLAN.md) | `/forecasting-new` | `pages/Forecasting.tsx` (1,792), `components/MobileForecastView.tsx` (1,459), `ForecastChart`, `ForecastOverview`, `ForecastDayModal`, `GoalScenarioModal`, `GoalTable`, `FinancialGoalCard`, `GoalContributionPlan`, `utils.ts` `generateBalanceForecast` / `calculateForecastHorizon` |
| Investments (+ Holding, + Warrants tab) | [INVESTMENTS_NEW_PLAN.md](INVESTMENTS_NEW_PLAN.md) | `/investments-new`, `/investments-new/:symbol` | `pages/Investments.tsx` (1,596), `pages/HoldingDetail.tsx` (530), `pages/Warrants.tsx` (225), `components/MobileInvestmentsView.tsx` (1,020), `utils/investments.ts`, `utils/portfolioHistory.ts`, `src/services/twelveDataService.ts` |
| Dashboard | [DASHBOARD_NEW_PLAN.md](DASHBOARD_NEW_PLAN.md) | `/dashboard-new` | `pages/Dashboard.tsx` (2,169), `components/MobileDashboardView.tsx` (806), 15 widget components, `useTransactionMatcher`, `useSyncedBillMatcher` |

Design authority, in order: `UI_UX_DESIGN_REFERENCE.md` §21 (N20–N24) > §20 > §19 > §11 (R1–R9) > §10 (D1–D16) > §7 (Q1–Q12) > §1–§5, then `DESIGN.md` and `CLAUDE.md` where the reference is silent. The process is the one used for Accounts and Budget (§5.0, D13, and `docs/ACCOUNTS_BUDGET_REVIEW_PLAN.md`).

---

## 1. Build order

The reference's §9 order is Dashboard (3), Forecasting (4), Schedule (6), Investments (8). This plan recommends a different order, because the Dashboard is made of the other three:

| # | Step | Why |
|---|---|---|
| 0 | **Shared engines** (§3 below) | Schedule, Forecasting and Dashboard all expand recurring items and project balances, each with its own copy and its own bugs. Fix once, test once. |
| 1 | **ScheduleNew** | Owns the occurrence engine and the occurrence actions (post, skip, move, edit series) that Forecasting and Dashboard reuse. |
| 2 | **ForecastingNew** | Owns the projection, the lowest-balance figures and goals; the Dashboard's forecast tile reads them. |
| 3 | **InvestmentsNew + HoldingNew** (Warrants as a tab) | Independent of 1–2. Its P0 fix (§3.4) changes net worth on the Dashboard, so it lands before the Dashboard. Could run in parallel with 1–2. |
| 4 | **DashboardNew** | Composes tiles from 1–3 and from Accounts, Transactions and Budget, which already exist. |

If you prefer the reference's order, the Dashboard plan still works: its tiles call the same model functions, which then have to be built inside the Dashboard phase instead.

---

## 2. Rules every one of the four pages follows

These are already decided in the reference; they are listed here so each plan can point to them instead of repeating them.

| Rule | Source | What it means on these pages |
|---|---|---|
| One-row header | N20 | The shell header gets only `usePageSearch` and `usePageAction`. No tab, tool or control slots. |
| Tabs in the body | N21 | `SegmentedTabs` directly above what they switch; the URL hash opens a tab (`#calendar`, `#goals`…), the last tab is remembered per device (localStorage in try/catch). |
| One Filters button | N22 | Every filter and the sort live in `FilterSheet`; active filters show as `ActiveFilters` chips with icons. A control that sets the data range (horizon, period, month) stays visible beside the button. |
| Tools beside Filters | N23 | `PageToolbar` → `FilterButton`, `ToolbarSpacer`, `ToolButton`; more than two tools collapse into `ToolMenu`. Sync is green (N7). |
| No filler | N24 | A switcher whose views look alike at 375 px does not ship; a section that repeats another is left out. |
| One violet CTA | N4, R7 | The header action is the only violet button; body buttons are ink (`primary`) or `secondary`; empty states use ink. |
| Surfaces | R2, R9 | Grey tiles (`Card`) on a white page; white only as a split tile's `top` or a sub-card; no hairlines or shadows on tiles; accents only on icons, badges, charts and text. |
| Accent meanings | D1, D2 | violet (brand slot, now dark slate `#183A37`, §19) = balances and selection; green = income, on track, done; orange = spending, attention, due soon; sky = transfers, planned and forecast items; red = status only (overdue, below zero, loss). |
| Money | R6, §5.4 | Every amount through `Money` (violet symbol, faint decimals, privacy blur) or `formatCurrency` (toasts, aria labels). Dates through `utils/dateFormat.ts` (`formatShortDate`). |
| Type and targets | D14, X7 | 12 px floor for information, 11 px only on chips and counters; 44 px hit area on every control; named z-index only. `tests/unit/new-tokens.test.ts` must cover each new file. |
| Undo first | D5, D6 | Reversible changes apply at once with `toast.undo`; permanent ones use `confirmNew` with the Hold Button. |
| Lists | D11 | Cap at N with `MoreButton` ("Show all N"); the cap lifts while searching or filtering; no inner scroll areas; tables become card lists below `lg`. |
| Charts | §20, Q4 | Bklit from `components/bklit/charts/`; money series `curveMonotoneX`; no decorative `TrendLine` or dotted `Background` on single-series money charts; tooltips per §20.1–§20.3; series labels through `toProperCase`. Bklit's reveal on first paint (D8), off with reduced motion. |
| Sheets | D7 | Vaul `Drawer` (bottom sheet < 768 px, right drawer above); inset panels inside sheets, never nested elevated cards; sticky footer on long forms. |
| Isolation | §5.0, §8 | New files import no classic UI (`tests/unit/new-isolation.test.ts`). Logic shared with classic moves to `utils/` or `hooks/`. |
| Logic location | D13 | `utils/<page>Model.ts` (pure, strict-typed, unit-tested with `npx tsx`, check for ✕) + `hooks/use<Page>Data.ts` (contexts, display currency, writes that return an `undo`). |
| Same props | §5.0 | Each New page takes the same props as the classic page it replaces (Investments and Dashboard have props; Forecasting and Schedule take none). |
| Verification | D13 | `npm run lint`, the unit tests, and the browser at 375, 768, 1024 and 1440, light and dark, on demo data (`dev-mock` launch configuration, port 5174). Migration notes (Kept, Moved, Changed, Dropped, Where the logic lives, KokonutUI check, Keyboard route, Verified, Not verified) in a new `UI_UX_DESIGN_REFERENCE.md` section per page. |

---

## 3. Shared engines (step 0)

### 3.1 What exists today

| Concern | Copies today | Problem |
|---|---|---|
| Expanding a recurring item into dated occurrences | `generateBalanceForecast` (`utils.ts:1188`, own loop), `expandRecurringOccurrences` (`utils.ts:1146`, used by Accounts), Schedule's own `advanceDate` (`pages/Schedule.tsx:363`), Schedule's `advanceOneCycle` when posting (`:720-740`), Dashboard's copy of the posting code (`pages/Dashboard.tsx:500-530`), `TodayWidget` (`:103-118`, no biweekly) | Five rule sets for weekend adjustment, month ends, overrides and "already paid". Results disagree between pages. |
| Synthetic items (loan installments, card settlements, property costs) | Built separately in Dashboard (twice: `:328` from analytics accounts, `:351` from all accounts), Forecasting (`:164`), Schedule (`:288`) | Same inputs, three call sites, two different account sets on the Dashboard alone. |
| Starting balance of a projection | `generateBalanceForecast` uses raw `acc.balance` and `convertToEur` without rates (`utils.ts:1471`) | Includes future-dated transactions (the Accounts Phase 1 rule says today's balance excludes them, `resolveAccountBalance`); uses the built-in FX table, not `resolveRates` (decision Q1). |
| "Is this occurrence already paid?" | Schedule only (`isOccurrenceSatisfied`, `:346`) | Forecasting and Dashboard never check, so a bill paid early is counted again in the forecast. |
| Display currency | Forecasting, Schedule and the Dashboard's analysis cards hard-code `'EUR'` | A user whose currency is USD sees EUR everywhere on three pages. |

### 3.2 What step 0 builds

| File | Responsibility |
|---|---|
| `utils/scheduleModel.ts` | **One occurrence engine.** `buildOccurrences({ recurring, overrides, bills, accounts, transactions, loanPaymentOverrides, from, to, today, rates })` → `Occurrence[]` with `{ key, sourceKind: 'recurring' \| 'bill' \| 'loan' \| 'card' \| 'property' \| 'goal', sourceId, originalDate, date, amount (signed, native), currency, amountDisplay, accountId, toAccountId, category, merchant, status: 'overdue' \| 'today' \| 'upcoming' \| 'paid' \| 'skipped', isOverride, isReadOnly, matchedTransactionId? }`. Built on `advanceRecurrenceDate` and `expandRecurringOccurrences`; synthetic items generated once inside it. Matching paid occurrences (§3.3) lives here. |
| `utils/forecastModel.ts` | **One projection.** `projectBalances({ accounts, occurrences, goals, startBalances, horizonEnd, assumptions, rates, displayCurrency })` → daily series (total + per account), event ledger with running balance, lowest points. Starting balances come from `resolveAccountBalance` (today, future items excluded). Everything in the display currency. `generateBalanceForecast` becomes a thin wrapper over it so classic pages keep working (and get the fixes, as Accounts did with Q3). |
| `utils/scheduleModel.ts` → `advanceAfterPosting(rt, postedOccurrence)` | One rule for what `nextDueDate` becomes after posting, used by Schedule, Dashboard agenda and the occurrence sheet. |
| Tests | `tests/unit/scheduleModel.test.ts`, `tests/unit/forecastModel.test.ts` (cases listed in each page plan). |

### 3.3 Shared bugs fixed in step 0

Severity as in the Accounts review: **P0** wrong number or data loss · **P1** breaks a decision or a promise · **P2** polish.

| # | Sev | Where | Finding | Fix | Found by |
|---|---|---|---|---|---|
| E-01 | P0 | `utils.ts:1471` | Projection starts from raw `acc.balance`: future-dated transactions are in the start balance, and the recurring item that created them is projected again on its date. | Start from `resolveAccountBalance(..., today)`. | read |
| E-02 | P0 | `utils.ts:1452` | Unpaid bills with a due date before today are dropped from the forecast, so an overdue bill that still has to be paid disappears from the projection. | Overdue unpaid bills land on today (flagged overdue). | read |
| E-03 | P0 | `utils.ts:1404-1440` | A one-time goal with a date **and** a monthly contribution is counted twice: the whole remaining amount on its date, plus every monthly contribution before it. | Contributions until the date, then only the remainder still missing on the date. | read |
| E-04 | P1 | `utils.ts:1416-1420` | First goal contribution: `setDate(dueDateOfMonth)` overflows (31 in a 30-day month → next month's 1st). | Clamp to the month's last day, as later months already do. | read |
| E-05 | P1 | `utils.ts:437` (`calculateForecastHorizon`) | "Lowest balance" per period deliberately skips values already shown for an earlier period (`findNthLowestUniquePoint`), so a period can show its second- or third-lowest point. | Report each period's real minimum; if two periods share it, say so. | read |
| E-06 | P1 | `pages/Schedule.tsx:353` | An occurrence counts as paid if any transaction linked to the series is within 4.5 days; one transaction can satisfy two weekly or many daily occurrences. | Each transaction satisfies at most one occurrence, the nearest one. | read |
| E-07 | P1 | `pages/Schedule.tsx:333` | Occurrences overdue by more than 7 days vanish from Schedule (and are never in the forecast). | Overdue until posted, skipped or the series ends; "Expire" stays for bills. | read |
| E-08 | P1 | Forecasting, Schedule, Dashboard analysis | `'EUR'` hard-coded for display; `convertToEur` without `resolveRates`. | Display currency (`preferences.currency`) and `resolveRates` everywhere (Q1). | read |
| E-09 | P1 | `pages/Schedule.tsx:720-745`, `pages/Dashboard.tsx:500-530` | Posting an occurrence sets `nextDueDate` past the later of the posted date and the old `nextDueDate`; paying a future occurrence early skips every unpaid occurrence in between. | `advanceAfterPosting`: posting marks that occurrence paid (link by `recurringSourceId` + date); `nextDueDate` moves only when the posted occurrence is the oldest open one. | read |
| E-11 | P1 | `components/TodayWidget.tsx:103-118` | The Dashboard agenda's own loop has no `biweekly` branch: a fortnightly item never advances, so it shows its first date forever (the loop is bounded, so no hang). Same family as Accounts L-D1. | Agenda reads `buildOccurrences`. Test with a biweekly item. | read |
| E-10 | P2 | `pages/Schedule.tsx:751`, `pages/Dashboard.tsx:529` | Paying a bill overwrites its `dueDate` with the payment date, so history no longer shows whether it was paid late. | Keep `dueDate`; store the payment date in the linked transaction (or a new optional `paidDate`). | read |

---

## 4. Libraries and parts available

### 4.1 Already in the repo for New pages

| Kind | Parts |
|---|---|
| New primitives (`components/new/ui.tsx`) | `Card` (grey tile, `top` for a split tile), `CardTitle`, `Button` (`primary` ink, `secondary`, `cta` violet, `success` green), `IconButton`, `SegmentedTabs`, `Money`, `Badge` (with `icon`), `StatTile`, `Switch`, `MoreButton`, `ProgressBar`, `EmptyState`, `ACCENT` |
| Tiles (`components/new/tile.tsx`) | `IconChip`, `PeriodPill`, `TileHeader`, `TileValue`, `FilterChip`, `FooterLink`, `TwoToneTitle` |
| Toolbar (`components/new/PageToolbar.tsx`) | `PageToolbar`, `ToolbarSpacer`, `FilterButton`, `ToolButton`, `ToolMenu`, `ActiveFilters`, `FilterSheet`, `FilterSection`, `ChoiceChips`, `FilterToggle` |
| Shell | `usePageSearch`, `usePageAction`, `useShellNew().openQuickAdd`, `ShellNew` Scroll Index (from `lg`), `ErrorBoundaryNew`, `PageSkeletonNew` |
| Feedback | `toast` (Sileo: `success/error/info/warning/undo`), `confirmNew` (Hold for danger), `Drawer` (Vaul) |
| Icons and logos | `NvIcon` (Hugeicons), `EntityIcon` (category/tag glyphs), `LogoTile` / `AccountLogo` (Brandfetch → upload → icon, §20.5) |
| KokonutUI ports (`components/kokonutui/`) | `hold-button`, `amount-pad`, `card-flip`, `metric-card` (KPI with day scrub, range drag, breakdown; `formatValue`, `invert`), `scroll-index`, `smooth-tab` |
| Bklit (`components/bklit/charts/`) | `AreaChart` + `Area`, `LineChart` + `Line`, `BarChart` + `Bar` (+ `bar-squares`, value labels), `ComposedChart`, `CandlestickChart` (+ `bollinger`), `PieChart` + `PieSlice` + `PieCenter`, `RingChart` + `Ring`, `RadarChart`, `Gauge` (linear and notched, `CRYSTAL_FLOW_GRADIENTS`), `AreaSparkline` / `LineSparkline` + `useSparklineHover`, `ScatterChart`, `Heatmap` (`heatmap/`), `Sankey` (`sankey/`), `Band` (confidence band), `ProjectionLine` (+ end marker), dash tails (`series-dash-tail-overlay`), `ReferenceArea`, markers, `Legend`, `ChartTooltip` + `DateTicker` |
| Base UI | `Menu`, `ContextMenu`, `Dialog`, `Tooltip` (as used in Accounts and Transactions) |
| Other | MapLibre places map (`components/new/transactions/PlacesMap.tsx`, R11), `@dnd-kit` (already a dependency), NumberFlow (D8) |

### 4.2 KokonutUI components to port for these pages

Slugs come from the reference's §4.1 (checked against the registry on 2026-10-25). Check each again at port time. Port with `npx shadcn@latest add @kokonutui/<slug>`, then the D13 checklist: lucide → Hugeicons, no `next/*`, `nv-*` tokens, named z-index, real props, demo data removed, version recorded in the reference's ports table, reduced-motion fallback.

| Slug | Used by | Role |
|---|---|---|
| `bento-grid` (Widget Grid) | Dashboard | Optional drag-and-resize layout on ≥ 1024 px (Dashboard Q-D2) |
| `liquid-gauge` | Dashboard (budget tile), Forecasting (goal funding) | Percentage fill |
| `apple-activity-card` | Forecasting (goal rings), Dashboard (goals tile) | Up to three concentric rings |
| `spending-ring` | Dashboard (spending tile), Schedule (next-30-days by category) | Interactive category dial; static ring fallback |
| `activity-terrain` | Schedule (year heatmap) — only if it beats Bklit `Heatmap`; see Schedule plan §5 | Calendar intensity map |
| `notification-stack` | Dashboard (due soon), shell bell | Stack of due items |
| `status-island` | Investments (price update progress), Dashboard (sync) | Progress of a running job |
| `undo-button` | Schedule (skip), Forecasting (scenario reset) | Only if Sileo's undo toast is not enough; default is the toast (D6) |
| `wheel-picker` | Forecasting (horizon on phones) | Optional; a `PeriodPill` already works |
| `action-search-bar` | Shell (⌘K), not page-specific | Listed for completeness (reference §8 "not built yet") |

### 4.3 Magic UI

- **Magic UI** roles in the reference (§4.2): `number-ticker`, `animated-list`, `blur-fade`, `marquee`, `confetti`, `animated-circular-progress-bar`. Folder `components/magicui/` does not exist yet. Each plan names where one would fit, but none is required: NumberFlow already rolls numbers (D8), and N24 rules out decoration that repeats information (a ticker marquee on Investments is listed as **not** planned for that reason).
- The library the brief called "mangoui" is **Magic UI** (answered 2026-10-29, X-Q1). Ports go to `components/magicui/` with the D13 checklist; add the `@magicui` registry to `components.json` with the first port.

---

## 5. Cross-page open questions

| # | Question | Recommendation |
|---|---|---|
| X-Q1 | What is "Mango UI"? | **Answered 2026-10-29: Magic UI.** No separate library; the Magic UI rows in each plan apply. |
| X-Q2 | Build order: this plan's (Schedule → Forecasting → Investments → Dashboard) or the reference's (Dashboard → Forecasting → Schedule → Investments)? | This plan's order, with step 0 first. |
| X-Q3 | Should step 0's fixes change classic pages too (as Q2/Q3 did for Accounts)? | Yes: `generateBalanceForecast` becomes a wrapper over the new model, so Classic Dashboard, Forecasting and Account detail show the same projection. Record it in each page's migration notes. |
| X-Q4 | Goals: they are edited on Forecasting today, read on Budget (Q7) and the Dashboard. Keep Forecasting as their home? | Yes: a Goals tab on ForecastingNew is the one place to create and edit goals. |
| X-Q5 | Pending matches (transfer and bill matcher) only live on the classic Dashboard. Where do they go? | A shared `MatchReviewSheet` (`components/new/matches/`), opened from an attention item on DashboardNew and from Transactions' To review tab. See Dashboard plan Q-D4. |

## 6. Status

| Step | Status |
|---|---|
| 0 Shared engines | Not started |
| 1 ScheduleNew | Planned |
| 2 ForecastingNew | Planned |
| 3 InvestmentsNew + HoldingNew + Warrants tab | Planned |
| 4 DashboardNew | Planned |
