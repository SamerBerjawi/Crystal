# Old screens

Every screen that hasn't been rebuilt, sorted before Module 13. Clean-up removes the bridge styles and old components, so everything here has to be rebuilt, restyled or deleted first.

How this was sorted: an import map from `index.tsx` shows what the app can reach, a check for components that are imported but never rendered, and a count of old styling in each file. **Size** is lines. **Old styling** is how many old patterns the file holds, so a high number means more work.

## Delete

**Step 1 is done:** 97 source files and 2 test files, about 17,200 lines.

Nothing here could be opened.

**92 unreachable files, about 15,700 lines.** The largest groups:

- `src/components/charts`: the heatmap, sunburst, bar squares and unused parts.
- `components/base` and `components/application`: an old component library.
- `components/ui`: `FilterBar`, `HeroMetricCard`, `MetricCardRow`, `bento-grid`, `card`, `button`, `animated-theme-toggler`.
- Old screens and cards: `pages/Warrants`, `WarrantModal`, `MobileFilterSheet`, `CalendarView`, `ScheduleHeatmap`, `ForecastDayModal`, `SyncedBillMatcherModal`, `TransactionMatcherModal` and their cards, `BottomSheet`, `MetricCard`, `StatCard`, `BalanceCard`, `CashFlowCard`, `ThemeToggle`, `FloatingActionButton`.
- `utils/transactionsModel.ts`, which only its own tests use. Those tests go with it. `utils/theme.ts`, `utils/colors.ts` and `utils/backup.ts` go too.

**Imported but never rendered:** `FinancialGoalCard`, `GoalContributionPlan`, `WidgetWrapper`, `BillPaymentModal`, `MultiSelectFilter`. Removing their imports makes them unreachable.

**By decision:**

- `AccountOverviewModal` (`D-113`). Done in step 4 (`D-117`).
- `MerchantOverviewModal` (`D-114`). Done in step 3.
- `handleEditForecastItem` and the handlers only it used on Overview.

## Rebuild

Used often, or large enough that restyling would keep a poor structure.

| Screen | Size | Old styling | Plan |
|---|---|---|---|
| `IconPicker` | 439 | 114 | Works and looks fine, but it's its own drawer. Rebuild on the shared panel |

## Restyle

The structure is fine. These swap to shared dialogs, fields and tokens.

**Overview:** `TodayWidget`, `TransactionList`, `CreditCardStatementCard`, `BudgetProgressBar`, `BudgetProgressCard`, `FinancialRunwayWidget`, `AccountBreakdownCard`, `MerchantParetoWidget`, `AssetDebtDonutChart`, `WealthVelocityWidget`, `TransactionMapWidget`, `OutflowsChart`, `AddWidgetModal`, `MultiAccountFilter`, `DurationFilter`.

**Shared bits:** `CommandCenter`, `KeyboardShortcutsModal`, `LocationAutocomplete`, `AddressAutocomplete`, `EnableBankingCallback`.

**Replace, then delete:** `ConfirmationModal` becomes `ConfirmDialog` on account detail, the last place checked that uses it. `Modal` goes once `AddWidgetModal` and `KeyboardShortcutsModal` stop using it.

**Also move:** `HistoricalBalanceTrend` and account detail's lowest point to `forecastFromData`, so `generateBalanceForecast` can go.

## Order

1. **Delete** what's unreachable. Done.
2. **`TransactionDetailModal`**, because it's the most used. Done (`D-115`).
3. **Merchants**: the detail panel and the map in the profile, then delete `MerchantOverviewModal`. Done (`D-116`).
4. **Quick overview**: compare against the account page, then delete. Done (`D-117`).
5. **Account dialogs and transaction tools**, as one batch. Done (`D-118`).
6. **Bulk edit, split and mileage.** Done (`D-120`).
7. **Sign-in and onboarding.** Done (`D-121`).
8. **Overview widgets and shared bits**, plus the forecast engine move.
9. **Contrast check** on anything restyled.
10. **Module 13**: the bridge styles, `@base-ui/react`, `DESIGN.md`, then Phase 10. Also decide on map credits: `index.css` hides them on every map, and OpenStreetMap's licence requires them.

Each step is checked at all three sizes before the next.
