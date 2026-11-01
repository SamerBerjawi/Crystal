# Old screens

Every screen that hasn't been rebuilt, sorted before Module 13. Clean-up removes the bridge styles and old components, so everything here has to be rebuilt, restyled or deleted first.

How this was sorted: an import map from `index.tsx` shows what the app can reach, a check for components that are imported but never rendered, and a count of old styling in each file. **Size** is lines. **Old styling** is how many old patterns the file holds, so a high number means more work.

## Delete

**Step 1 is done:** 97 source files and 2 test files, about 17,200 lines. `AccountOverviewModal` and `MerchantOverviewModal` remain until steps 3 and 4.

Nothing here could be opened.

**92 unreachable files, about 15,700 lines.** The largest groups:

- `src/components/charts`: the heatmap, sunburst, bar squares and unused parts.
- `components/base` and `components/application`: an old component library.
- `components/ui`: `FilterBar`, `HeroMetricCard`, `MetricCardRow`, `bento-grid`, `card`, `button`, `animated-theme-toggler`.
- Old screens and cards: `pages/Warrants`, `WarrantModal`, `MobileFilterSheet`, `CalendarView`, `ScheduleHeatmap`, `ForecastDayModal`, `SyncedBillMatcherModal`, `TransactionMatcherModal` and their cards, `BottomSheet`, `MetricCard`, `StatCard`, `BalanceCard`, `CashFlowCard`, `ThemeToggle`, `FloatingActionButton`.
- `utils/transactionsModel.ts`, which only its own tests use. Those tests go with it. `utils/theme.ts`, `utils/colors.ts` and `utils/backup.ts` go too.

**Imported but never rendered:** `FinancialGoalCard`, `GoalContributionPlan`, `WidgetWrapper`, `BillPaymentModal`, `MultiSelectFilter`. Removing their imports makes them unreachable.

**By decision:**

- `AccountOverviewModal` (`D-113`). Remove Quick overview from the Accounts and Investments menus. Check first that nothing in it is missing from the account page.
- `MerchantOverviewModal` (`D-114`), once its map is in the merchant profile.
- `handleEditForecastItem` and the handlers only it used on Overview.

## Rebuild

Used often, or large enough that restyling would keep a poor structure.

| Screen | Size | Old styling | Plan |
|---|---|---|---|
| `TransactionDetailModal` | 584 | 101 | Side panel, 640 wide with the map (`D-024`). Opened from everywhere |
| `MerchantDetailModal` | 1,541 | 279 | Side panel, split into smaller parts |
| Merchant profile | | | Takes the map and branches from `MerchantOverviewModal` (`D-114`) |
| `BulkEditTransactionsModal` | 612 | 78 | Side panel |
| `SplitTransactionModal` | 313 | 59 | Dialog, with the shared fields |
| `SignIn`, `SignUp` | 363 | 79 | The first thing anyone sees, on the new tokens |
| `OnboardingModal` | 351 | 75 | Steps in a full panel |
| `AddMileageLogModal` | 493 | 54 | Side panel |
| `IconPicker` | 439 | 114 | Works and looks fine, but it's its own drawer. Rebuild on the shared panel |

## Restyle

The structure is fine. These swap to shared dialogs, fields and tokens.

**Account dialogs:** `BalanceAdjustmentModal`, `PropertyValuationModal`, `CloseAssetModal`, `LoanDeferPaymentModal`, `LoanEarlyPaymentModal`, `LoanPaymentBulkEditModal`, `PaymentPlanTable`.

**Transaction tools:** `CombineTransactionsModal`, `BulkCategorizeModal`, `MatcherConfigPanel`.

**Overview:** `TodayWidget`, `TransactionList`, `CreditCardStatementCard`, `BudgetProgressBar`, `BudgetProgressCard`, `FinancialRunwayWidget`, `AccountBreakdownCard`, `MerchantParetoWidget`, `AssetDebtDonutChart`, `WealthVelocityWidget`, `TransactionMapWidget`, `OutflowsChart`, `AddWidgetModal`, `MultiAccountFilter`, `DurationFilter`.

**Shared bits:** `CommandCenter`, `KeyboardShortcutsModal`, `LocationAutocomplete`, `AddressAutocomplete`, `EnableBankingCallback`.

**Replace, then delete:** `ConfirmationModal` becomes `ConfirmDialog` in Overview and account pages. `Modal` goes once nothing uses it.

**Also move:** `HistoricalBalanceTrend` and account detail's lowest point to `forecastFromData`, so `generateBalanceForecast` can go.

## Order

1. **Delete** what's unreachable. Done.
2. **`TransactionDetailModal`**, because it's the most used.
3. **Merchants**: the detail panel and the map in the profile, then delete `MerchantOverviewModal`.
4. **Quick overview**: compare against the account page, then delete.
5. **Account dialogs and transaction tools**, as one batch.
6. **Bulk edit, split and mileage.**
7. **Sign-in and onboarding.**
8. **Overview widgets and shared bits**, plus the forecast engine move.
9. **Contrast check** on anything restyled.
10. **Module 13**: the bridge styles, `@base-ui/react`, `DESIGN.md`, then Phase 10.

Each step is checked at all three sizes before the next.
