# Crystal: Component Inventory

Phase 8 deliverable, approved by the owner (`D-073`). It lists every shared component the redesign needs, what it replaces in today's code, and what happens to what's there now. The values are in the [Design System Specification](06-design-system-specification.md), and the behaviour by screen size is in the [Responsive Specification](08-responsive-behavior-specification.md).

**Status:** **New** is built fresh. **Rebuild** keeps the job and logic, with a new look. **Keep** stays, with new tokens. **Retire** is removed in Phase 9 once nothing uses it.

**Location:** shared components go in `components/ui/` and charts stay in `src/components/charts/`. Mobile variants stop being separate pages wherever a responsive component can do the job (see section 11).

**Foundations:** `react-aria-components` is the one base for interactive parts, because it's already used in 8 files, and it covers keyboard and screen reader behaviour. `@base-ui/react` (1 file) is removed so there aren't two bases. `motion`, `sonner`, `class-variance-authority` and visx stay.

## 1. Actions

| Component | Variants | Replaces | Status |
|---|---|---|---|
| `Button` | Primary, Secondary, Soft, Ghost, Destructive; S, M, L; busy | `ui/button.tsx`, `HeaderButton`, `base/buttons/button-utility` | Rebuild |
| `HoldButton` | Delete, with count | KokonutUI Hold Button, `ConfirmationModal` for ordinary deletes | New (`D-065`) |
| `IconButton` | Plain, Glass, Primary, with tooltip | `button-utility`, `CLOSE_BTN_STYLE` | New |
| `SegmentedControl` | Two to five options | `ui/SegmentedControl.tsx`, `DurationFilter` | Rebuild |
| `Link` | Inline, Summary | Ad hoc links | New |
| `SelectionBar` | Floating, with count and actions | Transactions selection bar | New |
| `FloatingActionButton` | | `FloatingActionButton` | Retire. Create sits in the top bar (`D-054`) |

## 2. Forms

| Component | Variants | Replaces | Status |
|---|---|---|---|
| `Field` | Label, help, error, autofill note | Repeated form markup | New |
| `TextInput` | Text, search, password | Inline inputs | New |
| `AmountInput` | Currency prefix, tabular | Inline inputs | New |
| `DateInput` | Single, range | Inline date fields | New |
| `Textarea` | | Inline textareas | New |
| `Select` | Single | Inline selects | New |
| `Combobox` | Searchable, with create | `LocationAutocomplete`, pickers in the transaction form | New |
| `MultiSelect` | Checkboxes, count | `MultiSelectFilter`, `MultiAccountFilter` | Rebuild |
| `AddressField` | | `AddressAutocomplete` | Keep. Logic unchanged |
| `Checkbox` | | `base/checkbox` | Rebuild |
| `Radio` | | `base/radio-buttons` | Rebuild |
| `Switch` | | `base/toggle` | Rebuild |
| `IconPicker` | | `IconPicker` | Rebuild on Hugeicons |
| `ColorPicker` | Category colours | Colour swatches in forms | New |
| `CategoryPicker` | Suggestions, search, Always file like this | Category selectors, `D-041` | New |
| `Slider` | | Loan pay-extra (`D-039`) | New |

## 3. Menus and overlays

| Component | Variants | Replaces | Status |
|---|---|---|---|
| `Menu` | Actions, context menu | `base/dropdown/*`, row menus, right-click menus | Rebuild |
| `Popover` | Filters, small pickers | Filter popovers | New |
| `Tooltip` | Glass | `base/tooltip` | Rebuild |
| `Dialog` | S, M; confirm, type-to-confirm | `Modal`, `ConfirmationModal`, `FinalConfirmationModal` | Rebuild |
| `SidePanel` | 480, 640 px | Drawer in the transaction form, detail modals | New |
| `FullPanel` | Stepped | Long forms, import wizard | New |
| `BottomSheet` | Peek, half, full | `BottomSheet`, `MobileFilterSheet` | Rebuild |
| `ResponsiveOverlay` | Picks the right one for the screen | | New |
| `CommandPalette` | Search, actions | `CommandCenter` | Rebuild |

`ResponsiveOverlay` applies `D-024` in one place, so each form is written once and appears as a dialog or panel on larger screens and a sheet on phones.

## 4. Navigation

| Component | Variants | Replaces | Status |
|---|---|---|---|
| `AppShell` | Desktop, tablet, phone | Layout in `App.tsx` | New |
| `TopPills` | Seven hubs | `Sidebar` | New |
| `TabRow` | Scrolling | Page sub-navigation | New |
| `ToolRail` | Eight tools | Rail, part of `Sidebar` | New |
| `PhoneBar` | Five items | `MobileNavbar` | Rebuild |
| `PhoneTopBar` | Search, notifications, Create | `MobileAccountHeader`, mobile headers | New |
| `MoreSheet` | | Mobile menu | New |
| `PageHeader` | Title, actions, filter slot | `PageHeader`, `SettingsSubpageHeader`, `ui/HeroHeader` | Rebuild |
| `Avatar` | Image, initials | `base/avatar` | Keep |
| `SkipLink` | | None today | New |

`Sidebar`, `MobileNavbar`, `SettingsSubpageHeader` and the Settings tile page retire once the shell is in place (`D-045`).

## 5. Data display

| Component | Variants | Replaces | Status |
|---|---|---|---|
| `Card` | Plain, Hero, Inset, Link | `Card`, `ui/card.tsx`, `ui/bento-grid` | Rebuild |
| `Table` | Comfortable, Compact, sticky, selectable | `application/table`, `TransactionList`, `GoalTable`, `PaymentPlanTable` | Rebuild |
| `Row` | Phone list row, with day groups and swipe | `AccountRow`, `ScheduledItemRow`, mobile rows | New |
| `SwipeRow` | Left and right actions | `SwipeableRow` | Keep, restyled |
| `ShowMore` | Count remaining | `application/pagination` | Retire pagination (`D-040`) |
| `Badge` | Neutral, positive, attention, negative, category | `base/badges` | Rebuild |
| `CountPill` | | Ad hoc counts | New |
| `FilterBar` | Chips, filter sheet on phones | `ui/FilterBar`, `TransactionDateAndAccountFilter` | Rebuild |
| `ProgressBar` | Budget, goal | `BudgetProgressBar`, `ConfidenceScoreBar` | Rebuild |
| `ActivityRings` | | `ActivityRings` | Keep, restyled |
| `EntityIcon` | Category, account, merchant | Icon tiles | New |
| `Timeline` | Horizontal, vertical | Renewal timeline | New |

## 6. Financial summaries

| Component | Variants | Replaces | Status |
|---|---|---|---|
| `Amount` | Size, sign, privacy, count-up | Formatting scattered across pages | New |
| `Change` | Icon, sign, words | Ad hoc deltas | New |
| `WrittenSummary` | Linked sentence | None today | New |
| `NetWorthHero` | Figure, change, split bar | `BalanceCard`, `ui/HeroMetricCard` | New |
| `SummaryCard` | Label, figure, context | `StatCard`, `MetricCard`, `ui/MetricCardRow` | Rebuild |
| `NeedsYou` | List with counts | `TodayWidget`, parts of `FinancialOverview` | New |
| `SafeToSpend` | Hideable widget | None today | New |
| `AccountCard` | Five account groups | `AccountBreakdownCard`, `AccountsListSection` | Rebuild |
| `AccountFrame` | One frame, tabs | The nine account views (`D-038`) | New. See section 10 |
| `BudgetRow` | Rivet list | `BudgetProgressCard`, `BudgetOverviewWidget` | Rebuild |
| `GoalCard` | Card, table row | `FinancialGoalCard` | Rebuild |
| `HoldingRow` | Table, phone row | Investments rows | New |
| `ChallengeCard` | | `PredictionCard` | Rebuild |
| `LoyaltyCard` | Wallet tab | `LoyaltyCard` | Rebuild |
| `ReviewCard` | One card at a time | `UnifiedPendingMatcherCard`, `TransactionMatcherCard`, `SyncedBillMatcherCard` | Rebuild |
| `RuleBuilder` | Rebuilt Rules | `RegexCategorizationModal` and Rules setups | New (`D-009`) |
| `WidgetGrid` | Six columns, drag, resize, keyboard | `react-grid-layout`, `WidgetWrapper` | New, if Phase 9 testing confirms it (`D-035`) |
| `PinPad` | Lock screen | None today | New (`D-013`) |

## 7. Charts

All sit on the visx primitives in `src/components/charts`, which stay.

| Component | Used for | Replaces | Status |
|---|---|---|---|
| `LineAreaChart` | Net worth, balances, prices | `NetWorthChart`, `HistoricalBalanceTrend`, `PriceHistoryChart` | Rebuild |
| `ForecastChart` | Forecast, drag bubbles, buffer | `ForecastChart`, `ForecastOverview` | Rebuild (`D-010`) |
| `CandlestickChart` | Toggle on holdings | `InvestmentCandlestickChart` | Rebuild (`D-011`, `DEF-03`) |
| `BarChart` | Spending, outflows | `OutflowsChart`, `MerchantParetoWidget` | Rebuild |
| `ScatterChart` | Transactions | None today | New (`D-006`) |
| `DonutChart` | Distribution | `AssetDebtDonutChart`, `PortfolioDistributionChart` | Rebuild |
| `SankeyChart` | Cash flow | `CashflowSankey` | Rebuild (`D-034`) |
| `Heatmap` | Calendar, tasks | `ScheduleHeatmap`, `TasksHeatmap` | Rebuild (`D-033`) |
| `DayBars` | Calendar days | `CalendarView` | New |
| `AmortizationChart` | Loans | `MortgageAmortizationChart` | Rebuild |
| `MileageChart` | Vehicles | `VehicleMileageChart` | Rebuild |
| `TransactionMap` | Map | `TransactionMapWidget`, `VectorBasemap` | Keep, restyled |
| `ChartFrame` | Title, legend, table view, summary | None today | New |
| `Sparkline` | Inline trend | Inline charts | New |

`ChartFrame` is the one place that adds the legend, the text summary and the table view, so no chart can ship without them.

## 8. Feedback and states

| Component | Variants | Replaces | Status |
|---|---|---|---|
| `Toast` | Success, error, info, Undo | `sonner` setup | Rebuild theme |
| `Banner` | Info, attention, error | Inline notices | New |
| `NotificationCenter` | Panel, sheet | `NotificationCenter` | Rebuild |
| `EmptyState` | First use, none, no results | `EmptyState` | Rebuild |
| `Skeleton` | Text, card, row, chart | `PageSkeleton`, chart loading | Rebuild |
| `Spinner` | Inside buttons | Ad hoc | New |
| `ErrorState` | Section, page | `RootErrorBoundary`, `WidgetErrorBoundary` | Keep logic, new look |
| `SyncStatus` | Quiet status | Inline text | New |
| `PullToRefresh` | Phone | `PullToRefresh` | Keep, restyled |

## 9. Overlay forms

Each keeps its logic, and its body is rebuilt on `Field` inputs inside `ResponsiveOverlay`.

| Type (`D-024`) | Overlays |
|---|---|
| Dialog, confirm | `ConfirmationModal`, `FinalConfirmationModal`, `ChangePasswordModal`, `KeyboardShortcutsModal`, `BalanceAdjustmentModal`, `QuickBudgetModal`, `EditRecurrenceModal`, `RecurringOverrideModal`, `TagModal`, `AddWidgetModal`, `SmartRestoreModal`, `ExportModal` |
| Dialog, picker | `IconPicker` |
| Side panel, record | `AddTransactionModal`, `TransactionDetailModal`, `AccountOverviewModal`, `MerchantDetailModal`, `MerchantOverviewModal`, `BudgetModal`, `CategoryModal`, `TaskModal`, `GoalScenarioModal`, `RecurringTransactionModal`, `MembershipModal`, `WarrantModal`, `WarrantPriceModal`, `PredictionModal`, `AddInvestmentTransactionModal`, `InvestmentModal`, `ForecastDayModal`, `AddMileageLogModal`, `PropertyValuationModal`, `CloseAssetModal`, `LoanEarlyPaymentModal`, `LoanDeferPaymentModal`, `SplitTransactionModal`, `CombineTransactionsModal`, `BulkCategorizeModal`, `EnableBankingSyncModal`, `MatcherConfigPanel` |
| Full panel | `AddAccountModal` and `EditAccountModal` (joined, `D-023`), `InvoiceModal`, `ImportWizard`, `ImportDetailsModal`, `BulkEditTransactionsModal`, `LoanPaymentBulkEditModal`, `OnboardingModal` |

**Moved or removed:** `UnifiedPendingMatchesModal` moves into the Review queue page (`D-008`). `PendingMatchesView` does the same. `BillPaymentModal`, `SyncedBillMatcherModal` and `TransactionMatcherModal` aren't rendered today, so they're removed (`S-003`). The Scenario Playground is removed (`D-010`).

## 10. Pages that merge

| New | Replaces |
|---|---|
| `AccountFrame` with tabs | `CashAccountView`, `CreditCardAccountView`, `GeneralAccountView`, `LoanAccountView`, `PensionAccountView`, `PropertyAccountView`, `SavingsAccountView`, `SpareChangeAccountView`, `VehicleAccountView` |
| Account-type tabs | `CreditCardStatementCard`, `PaymentPlanTable`, property and vehicle sections |

## 11. Mobile views

These separate views are replaced by page-level phone layouts that share data logic with desktop, but have their own purpose-built layout (`S-006`).

| Today | Status |
|---|---|
| `MobileDashboardView`, `MobileAccountsView`, `MobileBudgetView`, `MobileForecastView`, `MobileInvestmentsView`, `MobileScheduleView`, `MobileSubscriptionsView`, `MobileTransactionsView` | Rebuild. Each keeps being a distinct layout, on shared components |
| `MobileFilterSheet`, `MobileAccountHeader`, `MobileNavbar` | Retire, replaced by `FilterBar`, `PageHeader`, `PhoneBar` |

## 12. Needed but not in the references

| Item | What we do |
|---|---|
| Loyalty cards | Designed from Crystal's own data, as references have none |
| Challenges | Calm tabs (`D-029`), Crystal's own design |
| Data import | Stepped full panel (`D-030`) |
| Property and vehicle sections | Tabs in `AccountFrame` |

## 13. Totals

| Group | New | Rebuild | Keep | Retire |
|---|---|---|---|---|
| Actions | 4 | 2 | 0 | 1 |
| Forms | 10 | 5 | 1 | 0 |
| Menus and overlays | 4 | 5 | 0 | 0 |
| Navigation | 7 | 2 | 1 | 0 |
| Data display | 4 | 5 | 2 | 1 |
| Financial summaries | 11 | 7 | 0 | 0 |
| Charts | 4 | 9 | 1 | 0 |
| Feedback and states | 3 | 4 | 2 | 0 |
| **Total** | **47** | **39** | **7** | **2** |

## 14. Dependencies

| Package | Change |
|---|---|
| `@hugeicons/core-free-icons`, `@hugeicons/react` | Add (`D-058`) |
| `@fontsource-variable/manrope` | Add (`D-057`) |
| `@phosphor-icons/react` | Remove when unused |
| `@fontsource/plus-jakarta-sans`, `@fontsource/inter`, `@fontsource-variable/geist` | Keep, as Preferences choices |
| `@base-ui/react` | Remove |
| `lucide-react` | Not added. The Hold Button and Widget Grid get Hugeicons instead |
| `react-grid-layout` | Remove if `WidgetGrid` passes testing |
