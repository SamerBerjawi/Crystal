# Crystal: Application Feature Inventory

Phase 3 deliverable of the redesign. It records what Crystal does today, so that the redesign keeps every function. It contains no design proposals.

| | |
|---|---|
| Baseline | Branch `refactor/remove-new-ui` (`8434ec7`), the original app after the abandoned redesign was removed |
| Date | 31 October 2026 |
| Starting point | `audit/inventory.md` (13 October, commit `2073eda`), corrected against the current code in section 3 |
| Scale | 27 reachable pages, 8 dedicated mobile page views, about 40 modals and drawers, 16 dashboard widgets, 276 catalogued subfeatures across 24 modules, 47 automations, 9 known defects |

**How this was checked.** I read `types.ts` and the old inventory in full. I extracted the controls, fields, state and handlers of every page and component, then read the key logic directly. All 23 routes loaded correctly at 1440, 768 and 390 wide during Phase 2. I did not click through every action in this document, and a real bank connection was not exercised, because it needs live credentials. Items that are not working features are listed in section 5, not as features.

**IDs.** Every subfeature has a stable ID, such as `TXN-07`. The Phase 6 feature mapping and the Decision Register will refer to these IDs.

---

## 1. How to read this document

Each module has an overview, then features. Each feature gives its **workflow** and **dependencies**, and a table with the subfeature, description, user actions, relevant data and current UI.

**Terms**
- **Drawer:** a panel that slides in from the side. Most create and edit forms use one.
- **Modal:** a centred dialog.
- **Autosave:** every change is saved automatically, with no Save step at page level.
- **Synthetic item:** a scheduled item the app generates from an account, such as a loan payment. It can't be edited as an ordinary recurring item.

---

## 2. Module map

| # | Module | Prefix | Pages | Dedicated mobile view |
|---|---|---|---|---|
| 1 | Access and onboarding | `ACS` | Sign In, Sign Up, Enable Banking callback | No |
| 2 | Global shell | `NAV` | All | `MobileNavbar` |
| 3 | Dashboard | `DSH` | Dashboard | `MobileDashboardView` |
| 4 | Accounts | `ACC` | Accounts, Account Detail | `MobileAccountsView`, `MobileAccountHeader` |
| 5 | Bank connections | `BNK` | Integrations and sync prompts | No |
| 6 | Transactions | `TXN` | Transactions | `MobileTransactionsView` |
| 7 | Reconciliation | `MAT` | Dashboard, Pending Matches | No |
| 8 | Categories | `CAT` | Categories | No |
| 9 | Tags | `TAG` | Tags | No |
| 10 | Rule engine | `RUL` | Rules | No |
| 11 | Merchants | `MER` | Merchants | No |
| 12 | Reports | `RPT` | Reports | No |
| 13 | Budget | `BUD` | Budget | `MobileBudgetView` |
| 14 | Forecasting | `FCT` | Forecasting | `MobileForecastView` |
| 15 | Goals | `GOL` | Forecasting, Dashboard | Within `MobileForecastView` |
| 16 | Schedule and bills | `SCH` | Schedule & Bills | `MobileScheduleView` |
| 17 | Subscriptions and wallet | `SUB` | Subscriptions | `MobileSubscriptionsView` |
| 18 | Investments | `INV` | Investments, Holding Detail | `MobileInvestmentsView` |
| 19 | Quotes and invoices | `DOC` | Quotes & Invoices | No |
| 20 | Tasks | `TSK` | Tasks | No |
| 21 | Challenges | `CHL` | Challenges | No |
| 22 | Settings and profile | `SET` | Settings, Personal Info, Preferences | No |
| 23 | Data management | `DAT` | Data Management | No |
| 24 | Help | `HLP` | Documentation, shortcuts | No |

---

## 3. Corrections to the 13 October inventory

| Old inventory said | Current state |
|---|---|
| "Forgot password?" has no handler | It now explains that an administrator resets passwords. A server command does this (`server/src/cli/reset-password.ts`) because Crystal sends no email |
| Invoices pagination is dead | It works, at 10 documents per page |
| Sprints are stored in localStorage only | They now live in `preferences.activeSprints` and sync across devices. The old key is read as a fallback |
| Onboarding state is localStorage only | `preferences.onboardingCompleted` is now stored with the account |
| `/api/smart-fetch` is public | It now requires sign-in, is rate limited and has a URL guard |
| `/api/ai/proxy` exists | It no longer exists in `server.ts` |
| The Carto basemap and API key exist | Removed. Maps use OpenStreetMap vector tiles through MapLibre, and need no key |
| 21 production endpoints | There are more: Enable Banking credentials gained `GET` and `DELETE` routes |
| Enable Banking key is held in client data | The private key is held encrypted on the server only |
| Reports had period buttons and filters | It also has saved views, group-by, budget vs actual and rule-based insights (`RPT`) |
| Dashboard described as one view | It has four tabs: Overview, Analysis, Activity, Pending Matches |

Later fixes in `utils.ts` and the classic account views also changed balances, loan figures and exchange-rate handling. Section 6 records the current logic.

---

## 4. Modules

## 4.1 Access and onboarding (`ACS`)

Controls entry to the app. No page is reachable when signed out, except through demo mode. The backend stores a `role`, but no feature checks it.

**Workflow:** Open any URL → Sign In → Dashboard. A new user with no accounts or budgets sees onboarding first.
**Dependencies:** Everything. `SET` for profile, `NAV` for sign-out.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| ACS-01 | Sign in | Email and password sign-in, rate limited | Enter credentials, show or hide password, submit | Email, password, session cookie | Split-screen page with form and marketing panel |
| ACS-02 | Sign up | Create an account. Can be turned off with `ALLOW_REGISTRATION=false` | Enter first and last name, email, password (8+ characters) | User profile | Split-screen page, reached from a link and has no URL of its own |
| ACS-03 | Password help | Explains that an administrator resets passwords | Expand the help note | None | Inline note on Sign In |
| ACS-04 | Demo mode | Explore with sample data on the client. Nothing is saved to the server | Choose Explore Demo Mode | `demoData.ts`, `demoSeed.ts` | Button on Sign In |
| ACS-05 | Session restore | Restores the session and data on load, and survives startup errors without signing out | None | Session, financial data | Loading screen |
| ACS-06 | Sign out | Runs a final save, then ends the session | Choose Sign Out | Session | Profile menu; mobile More sheet |
| ACS-07 | Onboarding | Guided setup, and all but the first steps can be skipped | Set currency, add first account, optional goal, optional recurring item, finish | Preferences, account, goal, recurring item | Step-by-step modal over the Dashboard |
| ACS-08 | Autosave and conflicts | Saves changes after a short delay. If another device saved first, the server answers 409 and the app reports it | Automatic; reload on conflict | `lastUpdatedAt`, `previousUpdatedAt` | Toasts for failures |
| ACS-09 | Global error recovery | Catches crashes; widgets fail individually | Reload, Retry Widget | None | Error screen, widget error card |

---

## 4.2 Global shell (`NAV`)

The frame around every signed-in page.

**Workflow:** Navigate through the sidebar, mobile bar, shortcuts or Command Center.
**Dependencies:** All modules, plus `SCH` for notifications and `TXN` for quick add.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| NAV-01 | Desktop sidebar | Four groups: Overview (Dashboard, Accounts, Transactions, Reports), Planning (Budget, Forecasting, Investments, Schedule & Bills), Management (Subscriptions, Quotes & Invoices, Tasks, Challenges), Configuration (Settings) | Navigate, collapse, expand | Current page; open and collapsed state | Fixed left sidebar with theme toggle |
| NAV-02 | Profile menu | Account shortcuts | Open My Account, Preferences, Sign Out | User name, role, picture | Popover at sidebar foot |
| NAV-03 | Mobile bottom bar | Home, Accounts, Activity, Forecasting, More | Tap a tab, open More | Current page | Floating bottom bar |
| NAV-04 | Mobile More sheet | Groups: Planning, Management, Customization, System, plus Sign Out | Tap a destination | Page list | Sheet titled "All Pages" |
| NAV-05 | Page header | Title, subtitle and page actions, with search and notifications | Use page actions, open search | Page context | `PageHeader`, which compacts on scroll |
| NAV-06 | Command Center | Search pages and accounts; run actions such as privacy and theme | ⌘K or Ctrl+K, type, arrow keys, Enter | Pages, accounts | Centred palette |
| NAV-07 | Keyboard shortcuts | ⌘K; N new transaction; G then D, A, T, I, B or S; ? help; Esc close | Press keys | None | `KeyboardShortcutsModal` lists them |
| NAV-08 | Quick add transaction | Add a transaction from anywhere | Press N | Transaction | Transaction drawer |
| NAV-09 | Notifications | Bills due within 3 days or overdue by up to 7 days. Pay / Record acts at once: it marks a bill paid or posts the recurring item, with no form | Open, dismiss, Clear All, Pay / Record, Manage Schedule | Bills, recurring items, dismissed IDs | Bell popover |
| NAV-10 | Privacy mode | Blurs sensitive amounts; can be on at startup | Toggle from sidebar, palette, or mobile Dashboard | `isPrivacyMode` | Blur overlay on amounts |
| NAV-11 | Theme | Light, dark or system | Toggle or select | `theme` | Sidebar toggle, Preferences |
| NAV-12 | Loading and empty states | Page skeletons, empty-state messages, toasts | None, or the action offered | Loading state | `PageSkeleton`, `EmptyState`, Sonner toasts |
| NAV-13 | Mobile gestures | Pull to refresh, swipe rows, drag sheets | Pull, swipe, drag | Varies | `PullToRefresh`, `SwipeableRow`, `BottomSheet` |

---

## 4.3 Dashboard (`DSH`)

The financial summary, with four tabs.

**Workflow:** Choose accounts and a period → read metrics and widgets → drill into a transaction, category, budget, forecast day or goal → optionally customise the layout.
**Dependencies:** `ACC`, `TXN`, `BUD`, `FCT`, `GOL`, `SCH`, `TSK`, `MAT`, `BNK`, `MER`.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| DSH-01 | Account and period filter | Scope all figures | Pick accounts, quick-select groups, pick a duration | Accounts, `Duration` | `MultiAccountFilter`, `DurationFilter` |
| DSH-02 | Header actions | Page-level actions | Sync banks, add transaction, add widget, edit layout | Connections | Header buttons |
| DSH-03 | Financial Overview widget | Net worth, net flow, revenue, outflow, burn intensity, trend sparklines | Read | Income, expenses, net worth | Summary card |
| DSH-04 | Today's Agenda widget | Tasks and bills due today or tomorrow, plus goal target dates | Complete a task | Tasks, schedule, goals | `TodayWidget` |
| DSH-05 | Forecast Horizon widget | Forward balance with goals | Set horizon, toggle forecast, toggle goals, click a day | Forecast data | Chart with `ForecastDayModal` |
| DSH-06 | Credit Card Statements widget | Current and next statement for each card | Read | Statement balance, due date, used, paid | `CreditCardStatementCard` |
| DSH-07 | Net Worth Over Time widget | Net worth history with trend line | Read, hover | Balance history | `NetWorthChart` |
| DSH-08 | Outflows by Category widget | Spending distribution | Click a category to see its transactions | Categories, expenses | `OutflowsChart` |
| DSH-09 | Net Worth Breakdown widget | Assets against liabilities | Read | Totals | `AssetDebtDonutChart` |
| DSH-10 | Recent Activity widget | Latest transactions | Click a transaction | Transactions | `TransactionList` |
| DSH-11 | Asset and Liability Breakdown widgets | Values by group, such as Liquid Cash, Investments, Properties, Vehicles | Read | Accounts | `AccountBreakdownCard` |
| DSH-12 | Budget Overview widget | Spending against limits | Open a budget, quick create | Budgets | `BudgetOverviewWidget` |
| DSH-13 | Transaction Map widget | Where money was spent | Zoom, reset, select a location | Geotagged transactions | Interactive map |
| DSH-14 | Cash Flow Sankey widget | Money movement, by category or subcategory | Switch view | Income, expenses | `CashflowSankey` |
| DSH-15 | Analysis KPIs | Liquidity ratio, savings rate, debt ratio, net flow | Read | Calculated ratios | Metric row on Analysis tab |
| DSH-16 | Analysis widgets | Financial Runway, Merchant Pareto, Wealth Velocity | Read | Burn, merchants, net worth | Widget cards |
| DSH-17 | Activity tab | Goals and contribution plan with transaction activity | Manage goals, open budget modals | Goals, transactions | Tab content |
| DSH-18 | Pending Matches tab | Full reconciliation workspace (see `MAT`) | See `MAT` | Suggestions | `PendingMatchesView` |
| DSH-19 | Layout customisation | Drag, resize, add and remove widgets, saved per tab and screen class | Edit layout, drag, resize to 1/4 up to Full, remove, add, finish | `dashboardLayouts`, `dashboardHiddenWidgets` | React Grid Layout, `AddWidgetModal` |
| DSH-20 | Mobile dashboard | Net worth, category spending, selected accounts, recent activity | Pull to refresh, swipe, filter, sync, add, toggle privacy | As above | `MobileDashboardView`, `MobileFilterSheet` |

---

## 4.4 Accounts (`ACC`)

Crystal's central entity. Account types: Checking, Savings, Credit Card, Investment, Loan, Property, Vehicle, Other Assets, Other Liabilities, Lending.

**Workflow:** Accounts list → quick overview or full page → type-specific view → act on the account.
**Dependencies:** `TXN`, `SCH`, `FCT`, `GOL`, `INV`, `BNK`, `MER`.

### List

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| ACC-01 | Portfolio summary | Portfolio value, assets, liabilities, liquid cash, cash, invested, 30-day net flow | Read | Calculated totals | Metric cards |
| ACC-02 | Segments | All, Cash, Invested, Assets and others | Switch segment | Accounts | Segmented control |
| ACC-03 | List display | Split or combined; cards or rows; grid or list; sort by manual, name or balance | Toggle, sort | Stored per browser | Toolbar |
| ACC-04 | Grouping | Assets and Liabilities, grouped by type; closed accounts apart | Expand, collapse | Account groups | `AccountsListSection` |
| ACC-05 | Manual reorder | Custom order | Drag on desktop; Move Up or Down on mobile | `accountOrder` | Drag handles |
| ACC-06 | Account card or row | Name, balance, logo, trend, linked-bank status | Open; right-click for menu | Account, 90-day sparkline | `AccountRow` |
| ACC-07 | Context menu | Quick Overview, View Full Account, Filter Transactions, Edit, Adjust Balance, Delete | Choose an action | Account | Right-click menu; swipe on mobile |
| ACC-08 | Quick overview | Summary, recent activity, banking identifiers, copy details. A recent transaction opens its detail on top | Open full view, edit, adjust, copy, open a transaction | Account, IBAN, BIC | `AccountOverviewModal`, phone-sized panel |
| ACC-09 | Bank sync from list | Sync all connected banks | Sync | Connections | Header button |
| ACC-41 | Mobile accounts | Net value, totals, tabs, rows with swipe actions, view and sorting sheet, reorder mode, closed accounts | Tap, swipe to Overview, Adjust or Edit, group, sort, move up or down | As above | `MobileAccountsView` |

### Create, edit and maintain

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| ACC-10 | Add account | Long, tabbed form that changes by type, with about 90 fields | Fill Identity and Core, Specifications, Card and Extras | All `Account` fields | `AddAccountModal` drawer |
| ACC-11 | Edit account | Same form, plus mileage history, delete and close or reopen | Edit, delete, toggle status | All `Account` fields | `EditAccountModal` drawer |
| ACC-12 | Banking fields | Institution, IBAN, BIC, APY, opening date | Enter | `financialInstitution`, `accountNumber`, `routingNumber`, `apy` | Form section |
| ACC-13 | Card fields | Network, last 4, expiry, cardholder, statement day, payment day, settlement account, limit | Enter | Card fields | Form section |
| ACC-14 | Loan calculator | Total, principal and interest reconcile; rate, term, start, down payment, instalment, due day, settlement account, linked asset | Enter; the rest is calculated | Loan fields | Form section |
| ACC-15 | Property fields | Type, purchase price, address, size, year, rooms, basement, attic, parking, garden, terrace, tax, insurance, HOA, rental income, linked mortgage | Enter | Property fields | Form section |
| ACC-16 | Vehicle fields | Make, model, year, plate, VIN, fuel, photo, owned or leased, lease terms, allowance, mileage | Enter, upload image | Vehicle fields | Form section |
| ACC-17 | Other asset or liability fields | Sub-type, counterparty, condition, location, interest rate | Enter | Other fields | Form section |
| ACC-18 | Flags | Primary account; include in analytics | Toggle | `isPrimary`, `includeInAnalytics` | Toggles |
| ACC-19 | Icon | Choose from the Phosphor duotone set | Search, pick | `icon` | `IconPicker` drawer |
| ACC-20 | Adjust balance | Reconcile to a stated balance, or log a market revaluation | Enter target, quick adjust, reset, zero out, date, memo | `isBalanceAdjustment`, `isMarketAdjustment` | `BalanceAdjustmentModal` drawer |
| ACC-21 | Delete account | Permanently removes the account and its transactions | Type to confirm | Account, transactions | `FinalConfirmationModal` |
| ACC-22 | Close or reopen | Mark an account closed or open | Toggle | `status` | Edit drawer |

### Account Detail: all types

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| ACC-23 | Detail shell | Header with balance, actions and type-specific layout | Back, sync, add transaction, adjust | Account | Page; `MobileAccountHeader` on mobile |
| ACC-24 | Balance trend | History with projection | Hover | Balance history, forecast | `HistoricalBalanceTrend` |
| ACC-25 | Ledger | Transactions for this account | Open, edit, delete | Transactions | `TransactionList`, `TransactionDetailModal` |

### Account Detail: by type

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| ACC-26 | General (checking) | Safe to spend, lowest forecast, monthly velocity, upcoming obligations, linked cards and goals | Sync, adjust, log transaction | Forecast, recurring items | `GeneralAccountView` |
| ACC-27 | Cash | Replenished, expended, MTD change, last intake, inflow against outflow | Adjust, log transaction | Cash metrics | `CashAccountView` |
| ACC-28 | Savings | Yield, estimated monthly and annual return, growth, interest history, linked goals | Sync, adjust, log transaction | APY, transactions, goals | `SavingsAccountView` |
| ACC-29 | Credit card | Outstanding balance, utilisation, spend history, billing cycle, auto-pay status | Sync, add transaction | Statement details | `CreditCardAccountView` |
| ACC-30 | Loan | Payoff progress, monthly cost, end date, amortisation chart, equity, loan-to-value, linked asset | Sync, add payment, follow asset link | Loan schedule, linked asset | `LoanAccountView`, `MortgageAmortizationChart` |
| ACC-31 | Loan payment plan | Schedule of every payment with principal, interest, balance and status | Edit a row, record payment | `ScheduledPayment`, `loanPaymentOverrides` | `PaymentPlanTable` |
| ACC-32 | Loan overrides | Early or extra payment with savings preview; defer (full or interest-only) with impact preview; bulk paste | Simulate, apply, clear | Overrides | Three modals |
| ACC-33 | Property | Value, equity, gains, invested capital, IRR, tax, valuation trend, mortgage summary, specifications | Update valuation, record sale, reopen, follow loan | Price history, loan | `PropertyAccountView` |
| ACC-34 | Property valuation | Add, load and delete valuation records | Save, edit, delete | `priceHistory` | `PropertyValuationModal` drawer |
| ACC-35 | Vehicle | Value, equity, depreciation, odometer, lease monitoring, projected final mileage | Update value, add log, retire, reopen | Vehicle fields, logs | `VehicleAccountView`, `VehicleMileageChart` |
| ACC-36 | Mileage log | Single entry or CSV/TSV batch | Add, edit, delete, import | `mileageLogs` | `AddMileageLogModal` drawer |
| ACC-37 | Close asset | Sell, return, give away, retire or write off; a sale can deposit proceeds, converted to the receiving account's currency | Choose type, date, value, account, notes | `closureDetails` | `CloseAssetModal` drawer |
| ACC-38 | Revert closure | Undo a closure and its proceeds | Reopen | `closureDetails` | Button on asset views |
| ACC-39 | Pension | Pot value, growth, retirement target, runway, forecast value, contributions | Sync, adjust, log contribution | Pension metrics | `PensionAccountView` |
| ACC-40 | Spare change | Round-up totals, MTD intake, monthly velocity, recent captures, source account, "coffee index" | Sync, adjust | Spare-change metrics | `SpareChangeAccountView` |

---

## 4.5 Bank connections (`BNK`)

PSD2 open banking through Enable Banking. Each user supplies their own application credentials.

**Workflow:** Save credentials → load banks → choose a bank → authorise at the bank → return through the callback → link each provider account to a Crystal account → sync.
**Dependencies:** `ACC`, `TXN`, `MAT`, server `enableBanking.ts`.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| BNK-01 | Credentials | Application ID, country, PEM private key; the key is encrypted on the server. A server route can delete credentials, but I found no control for it | Enter, save | `applicationId`, `countryCode` | Expandable panel in `EnableBankingIntegrationCard` |
| BNK-02 | Connect a bank | Load the bank list and start authorisation | Load banks, select, Authorize Link | `selectedBank`, status | Integrations card |
| BNK-03 | Authorisation callback | Exchanges the code for a session, then returns | Wait; go back on error | Session | `EnableBankingCallback` page |
| BNK-04 | Connection status | Disconnected, Pending Auth, Active, Needs Reauth; last sync and error | Read | Status, `lastError`, `sessionExpiresAt` | Status badges |
| BNK-05 | Reauthorise | Renew an expired connection | Reauth | Session | Button |
| BNK-06 | Link accounts | Map a provider account to an existing account or a new one, with a sync start date | Choose existing or new, type, 30d, 60d, 90d or date, Save | `linkedAccountId`, `syncStartDate` | Expandable row |
| BNK-07 | Sync options | Import transactions and balance from a date, only new transactions, or balance only | Choose, start | `EnableBankingSyncOptions` | `EnableBankingSyncModal` |
| BNK-08 | Sync entry points | Sync one account, one connection or all banks. All nine account detail views show Sync when the account is bank-linked, and it opens the options in BNK-07 | Sync | Connections | Integrations, Dashboard, Accounts, Transactions, Account Detail |
| BNK-09 | Delete connection | Removes the connection | Delete | Connection | Button |

---

## 4.6 Transactions (`TXN`)

The ledger. Transfers are shown as one row made from two linked transactions.

**Workflow:** Filter and search → scan → open or select → edit, categorise, split, combine, or make recurring.
**Dependencies:** `ACC`, `CAT`, `TAG`, `MER`, `RUL`, `SCH`, `ACC` spare change.

### Viewing

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| TXN-01 | Summary | Total transactions, income, expenses, net cash flow for the filtered set | Read | Filtered totals | Metric cards |
| TXN-02 | Ledger table | Rows with details, account, category, tags, location and value; merchant logos | Scroll, select, open | `Transaction`, `DisplayTransaction` | Data table with day groups and daily net |
| TXN-03 | Sorting | Date, value, merchant or category, each way | Column header or select | `sortDescriptor` | Headers and dropdown |
| TXN-04 | Pagination | Page through results with a page-size choice (default 25) | Change page or size | `itemsPerPage` | Footer controls |
| TXN-05 | Density | Default or high density | Toggle | `density` | Toolbar |
| TXN-06 | Split and combined groups | Parent rows expand to their children; badges mark SPLIT, COMBINED and MARKET | Expand, collapse | `parentTransactionId`, flags | Expandable rows |
| TXN-07 | Transaction detail | Amount, account, category, method, status, transfer bridge, map, notes, tags, loan breakdown | Read, edit, open Google Maps | Full transaction | `TransactionDetailModal` |

### Filtering and export

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| TXN-08 | Search | Across transactions, merchants and categories | Type | `searchTerm` | Search field |
| TXN-09 | Filters | Date range, accounts, category, tags, location, merchant, type (all, expenses, income, transfers), amount range | Set, clear, reset all | Filter state | Expandable filter bar and column popovers |
| TXN-10 | Incoming filters | Arrive filtered from Accounts or Tags | Follow a link | Pending filters | Pre-applied |
| TXN-11 | Export | Export the view as CSV | Export | Filtered rows | Header button |

### Create and edit

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| TXN-12 | Add or edit transaction | Expense, income or transfer, with a searchable account picker. Tabs: Primary Details, Location & Branches, Tags & Notes | Enter amount, date, account, merchant, category, description; save | `Transaction` | `AddTransactionModal` drawer |
| TXN-13 | Transfers | From and to accounts, with swap; creates two linked records | Pick accounts, swap | `transferId` | Part of TXN-12 |
| TXN-14 | Merchant lookup | Live suggestions; fills from known merchants | Type, arrow keys, select | Merchants | Field with suggestions |
| TXN-15 | Location | Address search, known branches, manual coordinates, sync to merchant | Search, pick branch, edit, remove | Location fields | Location tab |
| TXN-16 | Tags | Attach tags, or create one inline | Search, select, create | `tagIds` | Tag picker |
| TXN-17 | Loan split | Divides a payment into principal and interest, automatically or by hand | Toggle, edit | `principalAmount`, `interestAmount` | Section when the account is a loan |
| TXN-18 | Round-up | Sends spare change to a linked account: skip whole, unit push, multiplier | Configure | `autoSpareChange`; spare-change transfer | Section on expenses |
| TXN-19 | Rules at entry | The form applies merchant configuration and rules as you type (AUT-01 to AUT-08). The save step only runs rules on records with no ID, which the form never sends (DEF-06) | Automatic | Rules | Autofill in the form |

### Bulk and row actions

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| TXN-20 | Multi-select | Select rows or all | Check boxes, deselect | `selectedIds` | Selection bar |
| TXN-21 | Bulk categorise | Assign one category | Choose category | `category` | `BulkCategorizeModal` drawer |
| TXN-22 | Bulk edit | Choose fields to change: date, account, memo, merchant, category, tags, location | Toggle fields, enter values | Selected fields | `BulkEditTransactionsModal` drawer |
| TXN-23 | Bulk delete | Delete selected rows | Confirm | Selected IDs | `ConfirmationModal` |
| TXN-24 | Split | Divide one transaction across categories | Add, edit, remove splits; confirm | Children | `SplitTransactionModal` drawer |
| TXN-25 | Unsplit | Restore the original | Choose | Parent | Menu action |
| TXN-26 | Combine | Merge several into one | Set title, category, account, date | Combined parent | `CombineTransactionsModal` |
| TXN-27 | Uncombine | Restore the originals | Choose | Parent | Menu action |
| TXN-28 | Duplicate | Copy into a new transaction | Choose | Transaction | Menu action |
| TXN-29 | Make recurring | Create a recurring item from a transaction | Choose, complete form | `RecurringTransaction` | `RecurringTransactionModal` drawer |
| TXN-30 | Row menu | Edit, unsplit, uncombine, split, duplicate, make recurring, remove location, delete | Right-click | Transaction | Context menu |
| TXN-31 | Mobile ledger | Search, filter sheet, day-grouped rows, detail sheet, swipe to categorise, edit or delete | Tap, swipe, pull to refresh | As above | `MobileTransactionsView` |

---

## 4.7 Reconciliation (`MAT`)

Finds bank-synced transactions that are really transfers, or that pay a planned bill or recurring item.

**Workflow:** A pending card appears on the Dashboard → review suggestions and confidence → confirm or ignore, one at a time or in bulk.
**Dependencies:** `TXN`, `SCH`, `BNK`.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| MAT-01 | Pending summary | Counts of transfer and bill matches | Open by type, Dismiss All | Suggestions | `UnifiedPendingMatcherCard` |
| MAT-02 | Quick reconcile | Accept every match at 80% confidence or above | Reconcile | High-confidence suggestions | Card action |
| MAT-03 | Review modal | Search; filter by type and confidence; select | Match as Transfer, Match as Paid, Ignore; open in full tab | Suggestion, confidence score | `UnifiedPendingMatchesModal` |
| MAT-04 | Full tab | Same review with totals and settings | As MAT-03 | As above | `PendingMatchesView` |
| MAT-05 | Matching settings | Amount tolerance (10%), date flexibility (4 days), lookback (30 days), minimum confidence (45), require name similarity | Adjust, reset | `MatcherConfig`, per browser | `MatcherConfigPanel` |
| MAT-06 | Confidence display | Shows match strength | Read | Score | `ConfidenceScoreBar` |

---

## 4.8 Categories (`CAT`)

**Workflow:** Choose Expense or Income → find or add → edit or reorder.
**Dependencies:** `TXN`, `BUD`, `RUL`, `RPT`.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| CAT-01 | Tree | Parents and sub-categories, with totals | Switch tabs, expand, search | `Category` | Tabs and tree |
| CAT-02 | Add or edit | Name, icon, colour, classification, live preview | Save | `Category` | `CategoryModal` drawer |
| CAT-03 | Add sub-category | Child of a parent | Add | `parentId` | Row action |
| CAT-04 | Reorder | Drag within the tree | Drag | Order, parent | Drag handles |
| CAT-05 | Delete | Confirmed removal | Confirm | Category | Confirm modal |

---

## 4.9 Tags (`TAG`)

**Workflow:** Create tags → attach them to transactions → open a tag to see its transactions.
**Dependencies:** `TXN`.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| TAG-01 | Tag list | Totals, search, sort (most used, volume, name), grid or list | Search, sort, switch view | `Tag`, usage counts | Metric cards and grid |
| TAG-02 | Add or edit | Name, icon, colour, badge preview | Save | `Tag` | `TagModal` drawer |
| TAG-03 | Open tag | Transactions filtered by the tag | Click | Filter | Navigates to Transactions |
| TAG-04 | Delete | Confirmed removal | Confirm | Tag | `ConfirmationModal` |

---

## 4.10 Rule engine (`RUL`)

Automates cleanup. Four tabs: Rules Workspace, Merchant Overrides, Interactive Sandbox, Execution History & Logs.

**Workflow:** Create or accept a rule → test it → simulate impact → apply to history → review the log → roll back if needed.
**Dependencies:** `TXN`, `MER`, `CAT`.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| RUL-01 | Rule list | Capacity, historical matches and merchant priority totals; ordered list | Reorder by drag, toggle, edit, delete | `TransactionRule` | Tab list |
| RUL-02 | Rule builder | WHEN conditions with AND or OR; THEN actions; priority; live match count | Add conditions and actions, reset, save | Fields: description, merchant, amount, type, category. Operators: contains, equals, greater, less, starts, ends | Inline form |
| RUL-03 | Templates | Subscriptions, Rideshares, Coffee, Salary, Transfers | Apply | Preset rule | Template buttons |
| RUL-04 | Smart suggestions | Rules proposed from transaction history | Accept and activate | `generateSmartRuleSuggestions` | Suggestions panel |
| RUL-05 | Test rule | Try a rule on real transactions | Test | Matches | Inline panel |
| RUL-06 | Simulate impact | Full-ledger dry run: before and after, totals | Search, select, accept, close | Proposed changes | Modal |
| RUL-07 | Apply to history | Apply rules to existing transactions, in batches | Scan Database, select rows, apply | `ruleExecutionLogs` | Panel |
| RUL-08 | Rollback | Revert the last run or a batch | Revert | `RuleRunBackup` | Rollback banner, batch button |
| RUL-09 | Execution log | Time, status, rule, transaction, field changes | Read, clear | `ruleExecutionLogs` | Log table |
| RUL-10 | Merchant overrides | Per-merchant category, logo, description, visibility, notes | Add, edit, delete, search, filter | `merchantRules` | Table and form |
| RUL-11 | Apply overrides | Push overrides to past transactions; import from ledger | Apply, Feed from Ledger | `merchantRules` | Buttons |
| RUL-12 | Sandbox | Test a mock transaction or pick a real one; see the result and which rule fired | Enter values, Pick from Ledger | Mock transaction | Tab with ledger picker |

---

## 4.11 Merchants (`MER`)

Every merchant and institution found in the ledger.

**Workflow:** Browse → open overview → configure → apply to history.
**Dependencies:** `TXN`, `RUL`, `CAT`, Brandfetch.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| MER-01 | Directory | Volume and counts; search; sort (frequent, volume, recent, name); grid or list; show hidden | Search, sort, switch view | Derived merchants, `computeSpendTrends` | Cards with 6-month trend |
| MER-02 | Merchant overview | Volume, average, last activity, category, keywords, map | Read, edit | Merchant stats | `MerchantOverviewModal`, phone-sized panel |
| MER-03 | Merchant profile | Default category, description, notes, hide, online flag | Edit, reset, save | `MerchantRule` | `MerchantDetailModal` drawer, tabs |
| MER-04 | Keyword rules | Words that trigger categorisation; apply to the past | Add, toggle, delete, apply | Rules | Rules & Routing tab |
| MER-05 | Locations | Multiple branches with address, coordinates, primary branch, sync to transactions | Add, edit, remove, set primary | `MerchantLocation` | Locations tab |
| MER-06 | Branding | Domain override, Brandfetch fetch, upload image, website | Fetch, upload, remove | `logo`, `website` | Branding & Logo tab |
| MER-07 | Insights | Period volume and latest history | Read | Transactions | Insights tab |
| MER-08 | Logo refresh | Refresh one or all logos, with progress | Refresh | Brandfetch | Buttons and progress |
| MER-09 | Hide and unhide | Remove from lists and pickers | Toggle | `isHidden` | Card action |
| MER-10 | Auto-categorise rules | Keyword or regex rules with templates, order, apply to past | Add, edit, reorder, toggle, apply | `regexCategorizationRules` | `RegexCategorizationModal` |
| MER-11 | Smart suggestions | Proposed categorisation | Accept | Suggestions | Panel |

---

## 4.12 Reports (`RPT`)

**Workflow:** Choose a period and filters → read analysis → save the view → follow to Merchants.
**Dependencies:** `TXN`, `ACC`, `BUD`, `CAT`, `MER`.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| RPT-01 | Parameters | Period presets, dates, account, merchant, category, group-by | Set, clear | Filter state | Configuration panel |
| RPT-02 | Saved views | Name, save, reopen and delete report settings | Save, apply, delete | `reports.savedViews.v1`, per browser | Chips |
| RPT-03 | KPIs | Total spend, savings rate, transactions, average, recurring impact | Read | Calculated | Metric cards |
| RPT-04 | Spending velocity | Daily spending against the previous period | Read | Daily totals | Chart |
| RPT-05 | Category allocation | Spending distribution | Read | Category totals | Chart |
| RPT-06 | Needs and wants | Keyword-based split against 50/30/20 style targets | Read | Category names | Chart |
| RPT-07 | Merchant loyalty | Frequency against impact | Follow to Merchants | Merchant totals | Leaderboard |
| RPT-08 | Spend breakdown | Table by merchant or category: quantity, total, share | Read | Grouped rows | Table |
| RPT-09 | Insights | Rule-based observations on change, top categories, recurring cost and forecast | Read | Calculated | Panel |
| RPT-10 | Month-end forecast | Projected total and daily burn | Read | Calculated | Panel |
| RPT-11 | Anomalies | Unusual transactions | Read | Calculated | Panel |
| RPT-12 | Recurring patterns | Likely recurring spend | Read | Calculated | Panel |
| RPT-13 | Budget against actual | Limit, actual, difference | Read | Budgets | Table |

---

## 4.13 Budget (`BUD`)

Monthly limits on parent expense categories.

**Workflow:** Pick a month → read status → create or auto-generate budgets → adjust limits.
**Dependencies:** `CAT`, `TXN`, `ACC`.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| BUD-01 | Month navigation | Move between months | Previous, next | `currentDate` | Control at top |
| BUD-02 | Summary | Available liquidity, total budgeted, total spent, utilisation, active range, daily safe spend | Read | Calculated | Hero card |
| BUD-03 | Budget cards | Limit, spent, remaining, status (safe, nearing, over) | Open | `Budget` | `BudgetProgressCard`, `BudgetProgressBar` |
| BUD-04 | Unbudgeted spending | Categories with spending and no budget; set a limit | Set Budget Guide | Spending | Card state |
| BUD-05 | Allocation | Distribution of budgeted money | Read | Budgets | Chart |
| BUD-06 | Add or edit budget | Category, limit, presets, pacing, notes | Save, delete, clear | `Budget`, `categoryId` | `BudgetModal` drawer |
| BUD-07 | Quick budget | Generate from last month or the average of 3, 6 or 12 months | Choose period | Spending history | `QuickBudgetModal` drawer |
| BUD-08 | Delete with Undo | Confirm, then undo through a toast | Delete, Undo | Budget | Dialog and toast |
| BUD-09 | Category link | Budgets follow renamed categories | Automatic | `categoryId` | No UI |
| BUD-10 | Mobile budget | Envelopes, Charts & Pace, attention filters, spending pace, generator | Tap, swipe, pull to refresh | As above | `MobileBudgetView` |

---

## 4.14 Forecasting (`FCT`)

Projects future balances from recurring items, bills, goals and synthetic payments.

**Workflow:** Select accounts and a horizon → read the projection → test scenarios → inspect a day → change what's scheduled.
**Dependencies:** `ACC`, `SCH`, `GOL`, `TXN`.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| FCT-01 | Scope | Accounts and horizon (3M, 6M, EOY, 1Y) | Select | `selectedAccountIds`, `ForecastDuration` | Filters |
| FCT-02 | Summary | Wealth projection, portfolio shift, forecast shift, monthly lowest balance | Read | Calculated | Metric cards |
| FCT-03 | Forecast chart | Balance over time, with goal markers | Hover, click a day, combined or split, toggle goals | `generateBalanceForecast` | `ForecastChart` |
| FCT-04 | Scenario playground | Savings boost, market return, inflation | Adjust sliders, reset | `assumptions`, not saved | Panel; sheet on mobile |
| FCT-05 | Day detail | Events and net change for a date | Open, edit, add new | Scheduled items | `ForecastDayModal` drawer |
| FCT-06 | Edit scope | Change one occurrence, this and future, or the series | Choose | Recurring item | `EditRecurrenceModal` |
| FCT-07 | Forecast ledger | Daily projections with balance, source, and global or monthly lowest markers | Scroll, filter | `tableData` | Table |
| FCT-08 | Lowest balances | Low points by period | Read | `ForecastOverview` data | Cards |
| FCT-09 | Mobile forecast | Tabs: Projection, Goals, Ledger; checkpoints, runway, adjustments | Tap, sheets, pull to refresh | As above | `MobileForecastView` |

---

## 4.15 Goals (`GOL`)

**Workflow:** Create a goal or bucket → link an account → track progress and contribution plan.
**Dependencies:** `FCT`, `ACC`, `SCH`.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| GOL-01 | Goal types | One-time or recurring; savings, spending or income | Choose | `GoalType`, `GoalCategory` | Form |
| GOL-02 | Add or edit goal | Target, saved amount, dates, frequency, due day, funding account, parent bucket | Save, clear | `FinancialGoal` | `GoalScenarioModal` drawer |
| GOL-03 | Buckets | A goal holding sub-goals | Add item, expand | `isBucket`, `parentId` | `FinancialGoalCard` |
| GOL-04 | Goal card | Progress, target, expected date, status | Toggle, complete, edit, duplicate, delete | `GoalProjection` | Card with menu |
| GOL-05 | Grid or table | Sort; list or group by bucket | Switch, sort | Goals | `GoalTable` |
| GOL-06 | Reorder | Custom order | Drag | `goalOrder` | Drag |
| GOL-07 | Account filter | Show goals for selected accounts | Toggle | Selection | Checkbox |
| GOL-08 | Include in forecast | Choose which goals affect the forecast | Toggle, toggle all | `crystal_active_goal_ids`, per browser | Toggle |
| GOL-09 | Contribution plan | Generated plan of amounts and dates | Read | `ContributionPlanStep` | `GoalContributionPlan` |
| GOL-10 | Target schedule | Monthly targets by account or date, with totals | Switch mode | Goals | Panel |

---

## 4.16 Schedule and bills (`SCH`)

Recurring items and one-time bills. Tabs: Calendar, Timeline, Rules, Expired Archive.

**Workflow:** Review what's due → post it, change it, skip it or expire it.
**Dependencies:** `ACC`, `TXN`, `CAT`, `GOL`, `FCT`, `NAV`.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| SCH-01 | Summary | Commitment index, expected income, projected net, overdue attention | Read | Calculated | Cards |
| SCH-02 | Overdue | Filter all, recurring or one-time | Filter, post, expire | Overdue items | Panel |
| SCH-03 | Heatmap | Activity by day, typed as transfer, income, expense or mixed | Expand | Schedule | `ScheduleHeatmap` |
| SCH-04 | Calendar | Month view with income, expense, transfer and goal items | Move month, Today, post | Schedule, goals | `CalendarView` |
| SCH-05 | Timeline | Upcoming list | Search, post, edit, skip | `ScheduledItem` | `ScheduledItemRow` |
| SCH-06 | Rules | All recurring items; synthetic ones are read-only | Edit, delete, end series | `RecurringTransaction` | List |
| SCH-07 | Expired archive | Old bills | Restore, delete, Mark as Paid | `BillPayment` | List |
| SCH-08 | Add recurring | Expense, income or transfer; frequency, interval, dates, billing day, weekend rule | Save | `RecurringTransaction` | `RecurringTransactionModal` drawer |
| SCH-09 | Add one-time bill | Payment or deposit with due date and account | Save | `BillPayment` | Same drawer, One-Time mode |
| SCH-10 | Occurrence override | Change date, amount or description; skip; revert | Save, skip, revert | `RecurringTransactionOverride` | `RecurringOverrideModal` |
| SCH-11 | Post transaction | Turn a due item into a real transaction | Post, confirm | Transaction | `AddTransactionModal` drawer |
| SCH-12 | Expire bills | Expire one or all old bills | Expire | `status` | Row and bulk action |
| SCH-13 | Synthetic items | Loan, card and property items generated automatically | Read | `isSynthetic` | Marked rows |
| SCH-14 | Mobile schedule | Timeline, Charts, Rules; overdue, Pay Now, add event | Tap, swipe, search | As above | `MobileScheduleView` |

---

## 4.17 Subscriptions and wallet (`SUB`)

Tabs: Overview, Payments, Wallet.

**Workflow:** Review detected subscriptions → track or ignore → manage services and loyalty cards.
**Dependencies:** `TXN`, `SCH`, `ACC`, `CAT`.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| SUB-01 | Summary | Monthly commitment, cards, expiring in 30 days, categories, active, due in 7 days | Read | Calculated | Cards |
| SUB-02 | Smart detection | Finds subscriptions from interval and amount consistency | Track, Ignore | Transactions; `ignored-subscriptions`, per browser | Detected list |
| SUB-03 | Active subscriptions | Recurring expenses treated as services | Add, edit, delete | `RecurringTransaction` | List |
| SUB-04 | Loyalty wallet | Membership cards | Add, edit, delete, copy ID, open website | `Membership` | `LoyaltyCard` grid |
| SUB-05 | Add card | Provider, category, ID, holder, tier, points, dates, website, notes, icon, colour | Save | `Membership` | `MembershipModal` drawer |
| SUB-06 | Mobile subscriptions | Monthly and annual totals, services, wallet | Tap, swipe, add | As above | `MobileSubscriptionsView` |

---

## 4.18 Investments (`INV`)

Segments: All, Stocks, ETFs, Crypto, Warrants, Spare Change, Pension, Other.

**Workflow:** Review the portfolio → trade or log a price → open a holding.
**Dependencies:** `ACC`, `TXN`, Twelve Data, `/api/smart-fetch`.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| INV-01 | Portfolio summary | Value, invested capital, gain or loss, realised return; metrics change by segment | Switch segment | `HoldingsOverview` | Hero and cards |
| INV-02 | Allocation | Share by segment | Read | `typeBreakdown` | Chart |
| INV-03 | Portfolio history | Performance over time | Timeframe, granularity | `buildPortfolioHistory` | `InvestmentCandlestickChart` |
| INV-04 | Holdings table | Instrument, last price, quantity, cost, market value, gain or loss | Open, show inactive | `HoldingSummary` | Table |
| INV-05 | Holding menu | Log or fetch price, trade, details | Right-click or button | Holding | Context menu |
| INV-06 | Investment accounts | Brokerages, wallets and pensions; closed portfolios apart | Edit, adjust, overview, details, reorder, delete | Accounts | `AccountsListSection` |
| INV-07 | Activity log | Trades and grants | Edit, delete | `InvestmentTransaction`, `Warrant` | List |
| INV-08 | Analysis | Exposure and relative performance | Read | Calculated | Panel |
| INV-09 | Trade | Buy or sell: symbol, name, quantity, price, date, sub-type, cash settlement | Save, clear | `InvestmentTransaction` | `InvestmentModal` drawer, Market Trade mode |
| INV-10 | Equity grant | Warrant or RSU: ISIN, name, date, quantity, grant price, tax by amount or percentage, instalments | Save, add instalment | `Warrant`, `taxPayments` | `InvestmentModal` drawer, Grant mode |
| INV-11 | Sync market prices | Update all prices, from a saved web binding or Twelve Data (AUT-29, AUT-30) | Sync | Twelve Data API key, bindings | Header button |
| INV-12 | Log price | Single entry or bulk paste | Save | `priceHistory`, `manualWarrantPrices` | `WarrantPriceModal` drawer |
| INV-13 | Fetch price | Twelve Data ticker | Fetch | `investmentPriceConfigs` | Same drawer |
| INV-14 | Smart web fetch | Scrape a price from a page, pick a value, save the binding | Enter URL, cookies; test; bind; refresh | `SmartPriceBinding` | Same drawer |
| INV-15 | Holding detail | Value, return, average cost, market price, last logged, chart, transactions, price log | Log price, switch chart, edit, delete | Holding | `HoldingDetail` page |
| INV-16 | Mobile investments | Holdings, Charts & P&L, Trades; win rate, biggest win or loss | Tap, swipe, update prices | As above | `MobileInvestmentsView` |

---

## 4.19 Quotes and invoices (`DOC`)

**Workflow:** Draft a quote → send → convert to an invoice → track status.
**Dependencies:** Currency preferences, Brandfetch logos.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| DOC-01 | Summary | Aggregate billing, risk exposure, pipeline, quote velocity | Read | Calculated | Cards |
| DOC-02 | Document list | Invoices or Proposals; search; status filter; 10 per page | Search, filter, page | `Invoice` | Tabs and table |
| DOC-03 | Add or edit document | Type, direction, status, number, dates, currency, entity, line items, tax, discount, notes | Add and remove lines, save | `Invoice`, `InvoiceItem` | `InvoiceModal` drawer |
| DOC-04 | Convert | Quote to invoice | Convert | `type` | Row action |
| DOC-05 | Delete | Confirmed removal | Confirm | Document | `ConfirmationModal` |
| DOC-06 | Payment terms | Terms stored on the document | Data only in this view | `PaymentTerm` | See section 5 |

---

## 4.20 Tasks (`TSK`)

**Workflow:** Add a task → order it → complete it.
**Dependencies:** `DSH` Today's Agenda.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| TSK-01 | Summary | Completion, priority, due in 7 days, workload | Read | Calculated | Cards |
| TSK-02 | Heatmap | Tasks by date and priority | Read | Tasks | `TasksHeatmap` |
| TSK-03 | Task list | Sort by manual, priority or due date | Sort, drag, complete, edit, delete | `Task`, `taskOrder` | `TaskItem` list |
| TSK-04 | Add or edit | Title, status, priority, due date, reminder, description | Save, delete | `Task` | `TaskModal` drawer |

---

## 4.21 Challenges (`CHL`)

Gamified financial health. Sections: Score, Battles, Badges, Mastery, Sprints, Predictions, Records.

**Workflow:** Check the score → start a sprint or prediction → earn badges.
**Dependencies:** `ACC`, `TXN`, `BUD`, `GOL`, `SCH`, `SUB`.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| CHL-01 | Health score | 0 to 100 from savings rate (30), liquidity (30), debt (20), asset mix (20) | Read factors | Calculated | Score panel |
| CHL-02 | Streak | Login streak and best streak | Read | `UserStats` | Metric |
| CHL-03 | Battles | Debt Nemeses and Savings Guardians with progress | Read | Debts, goals | Battle cards |
| CHL-04 | Badges | Earned across exploration, wealth, habits, planning and prediction | Read | Calculated | Badge grid |
| CHL-05 | Mastery | Levels per budget | Read | Budgets | Panel |
| CHL-06 | Sprints | 11 timed challenges, such as The Zero Day and Dining Detox | Start, abandon | `activeSprints` | Cards |
| CHL-07 | Predictions | Spending cap, net-worth goal or price target with a date. Resolves automatically as won or lost after the end date, while the Challenges page is open | Create | `Prediction` | `PredictionCard`, `PredictionModal` |
| CHL-08 | Records | All-time high, current standing, 1 year ago | Read | Net worth history | Panel |

---

## 4.22 Settings and profile (`SET`)

**Workflow:** Settings hub → subpage → change is saved.
**Dependencies:** All modules read preferences.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| SET-01 | Settings hub | Tiles grouped by Experience, Automation, Workspace, Infrastructure | Open | None | Tile grid |
| SET-02 | Profile | Picture, name, phone, default city, address | Upload, edit, save | `User` | `PersonalInfo` page |
| SET-03 | Change password | Current, new, confirm | Update | Password | `ChangePasswordModal` |
| SET-04 | Appearance | Theme and typeface with live specimen | Choose | `theme`, `appFont` | Preferences section |
| SET-05 | Regional | Currency, country, timezone | Choose | `AppPreferences` | Preferences section |
| SET-06 | Calendar | Date format, fiscal year start | Choose | `dateFormat`, `financialYearStartMonth` | Preferences section |
| SET-07 | Defaults | Dashboard period, forecast horizon, account order | Choose | `defaultPeriod`, `defaultForecastPeriod`, `defaultAccountOrder` | Preferences section |
| SET-08 | Calculation switches | Exclude transfers from charts; show balance adjustments; privacy at startup | Toggle | Flags | Preferences section |
| SET-09 | Data API keys | Twelve Data key, Brandfetch client ID | Enter, reveal, commit | `twelveDataApiKey`, `brandfetchClientId` | `Integrations` page |
| SET-10 | Bank integration | See `BNK` | See `BNK` | See `BNK` | `Integrations` page |

---

## 4.23 Data management (`DAT`)

**Workflow:** Import, export or restore → check the log.
**Dependencies:** All data.

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| DAT-01 | Overview | Import, export, restore counts and last operation | Read | History | Cards |
| DAT-02 | CSV import | Choose Transactions or Accounts, then upload, map columns, clean, map categories, accounts, types and currencies, confirm, publish | Choose a source, work through the steps | `ImportWizard` state | Full-screen wizard |
| DAT-03 | Export | CSV tables or full JSON backup, filtered by data type, date and account | Choose, export | All data | `ExportModal` drawer |
| DAT-04 | Smart restore | Upload a backup, pick sections, Merge or Replace per section | Choose, restore | Backup JSON | `SmartRestoreModal` |
| DAT-05 | Audit trail | Type, identifier, timestamp, status | Read, inspect, remove | `ImportExportHistoryItem` | Table |
| DAT-06 | Import details | Summary, errors, purge imported data | Read, purge | History item | `ImportDetailsModal` drawer |
| DAT-07 | Factory reset | Erase all data after two confirmations | Confirm, type to confirm | All data | `ConfirmationModal`, `FinalConfirmationModal` |

---

## 4.24 Help (`HLP`)

| ID | Subfeature | Description | User actions | Relevant data | Current UI |
|---|---|---|---|---|---|
| HLP-01 | Documentation | User guide with section index | Jump to a section, back to top | Static content | `Documentation` page |
| HLP-02 | Shortcut help | Lists keyboard shortcuts | Press ? | Static | `KeyboardShortcutsModal` |

---

## 5. Not working features

These appear in the app or code but aren't working features. They are recorded so the redesign neither loses nor copies them by accident.

| Item | State |
|---|---|
| Two-factor authentication | The profile shows a row with "Engineering Lock". There's a data field, but no working feature |
| Profile "Updated 45 days ago", "Tier 1", "Level 1" | Static text, not real data |
| User roles | Stored and displayed, but never enforced |
| `pages/Warrants.tsx` | Not routed. Warrants live in Investments |
| `BillPaymentModal` | Imported but never rendered. One-time bills use `RecurringTransactionModal` |
| Unimported components | `ActivityRings`, `BalanceCard`, `CashFlowCard`, `MetricCard`, `StatCard`, `SyncedBillMatcher*`, `TransactionMatcher*`, `ui/HeroHeader`, `ui/card` |
| "AI-powered insights", "AI Model", "Open Banking & AI" | Labels only. Reports and Forecasting use calculations, and Crystal has no AI feature |
| "Join thousands of users", "Live Tracking" | Marketing text. Prices update on request |
| "Crystal Edition v1.0.0" | Static text that differs from the real version, for example `v2.261031.1` |
| "Finaura" | An old product name left in the import wizard |
| Invoice payment terms | The type exists, but I found no editor for them in `InvoiceModal` |
| Language preference | `language` exists, but the interface is English only |
| Keeping redesign-only models | `transactionsModel`, `scheduleModel`, `forecastModel`, `goalsModel` are tested logic kept for the new design, and no screen uses them yet |

---

## 6. Calculations

Business logic the redesign must keep.

| Area | Calculation | Location |
|---|---|---|
| Money | Safe add, subtract, multiply, divide, round | `utils.ts` |
| Currency | Rates resolved from defaults and saved preferences; conversion; formatting | `resolveRates`, `convertCurrency`, `formatCurrency` |
| Net worth | Assets, liabilities and liquid cash from one balance service | `calculateAccountTotals`, `resolveAccountBalance`, `classifyAccountBalanceEur` |
| Loans | Principal plus interest accrued so far; amortisation; overrides; deferral | `computeLoanBalanceBreakdown`, `generateAmortizationSchedule` |
| Credit cards | Statement periods and amounts | `calculateStatementPeriods`, `getCreditCardStatementDetails` |
| Synthetic schedule | Loan, card and property items | `generateSynthetic*` in `utils.ts` |
| Forecast | Daily balance, low points, goals, scenario assumptions | `generateBalanceForecast`, `calculateForecastHorizon` |
| Recurrence | Next date, occurrences, weekend adjustment, overrides | `advanceRecurrenceDate`, `expandRecurringOccurrences`, `adjustDateForWeekend` |
| Account metrics | One function per account type, plus vehicle total cost | `utils/accountDetailModel.ts` |
| Account list | Display balance, 90-day sparkline, portfolio trend, cash net flow | `utils/accountsModel.ts` |
| Budget | Pace, month-end forecast, status, daily allowance, suggestions, allocation | `utils/budgetModel.ts` |
| Investments | Holdings, cost basis, unpriced holdings, realised return, portfolio history | `utils/investments.ts`, `utils/portfolioHistory.ts` |
| Rules | Conditions, priority, merchant rules, suggestions | `utils/rules.ts`, `utils/ruleSuggestions.ts` |
| Merchants | Trends by month | `utils/merchantTrends.ts` |
| Matching | Transfer and bill suggestions, name similarity, confidence | `hooks/useTransactionMatcher.ts`, `hooks/useSyncedBillMatcher.ts` |
| Subscriptions | Interval and amount consistency | `pages/Subscriptions.tsx` |
| Reports | Velocity, recurring candidates, anomalies, month-end forecast, needs and wants | `pages/Reports.tsx` (inside the page) |
| Challenges | Health score, badges, sprint progress | `pages/Challenges.tsx` (inside the page) |
| Dashboard | Ratios, runway, Pareto, velocity | `pages/Dashboard.tsx` and widgets |

**Implication:** Reports, Challenges, Subscriptions and Dashboard hold calculations inside page files. A redesign must move or keep them with care so that numbers don't change.

---

## 7. Data model and storage

**Persisted per user, as one JSON document:** accounts, transactions, investment transactions, recurring items and overrides, loan overrides, goals and order, budgets, tasks and order, warrants, memberships, import history, income and expense categories, preferences, bills, account order, tags, manual prices, price history, invoices, user stats, predictions, bank connections.

**Stored only in the browser, so lost on another device:**

| Key | Holds |
|---|---|
| `theme`, `crystal_font` | Local appearance |
| `crystal_sidebar_open_v2`, `crystal_sidebar_collapsed_v2` | Sidebar state |
| `crystal_accounts_section_layout`, `crystal_split_assets_liabilities`, `crystal_accounts_view_style` | Accounts display |
| `reports.savedViews.v1` | **Saved report views** |
| `ignored-subscriptions` | **Ignored subscriptions** |
| `crystal_active_goal_ids`, `crystal_known_goal_ids` | **Goals included in the forecast** |
| `synced_matcher_config_v2` | **Matching thresholds** |
| `synced_bill_ignored_matches` | **Ignored matches** |
| `crystal_dismissed_bill_notifications` | **Dismissed notifications** |
| `crystal-account-order`, `crystal-task-order` | Duplicates of server order |
| `enableBankingConfig`, `enableBankingPendingConnections` | Bank setup in progress |

Bold items are user decisions rather than display settings.

**Currencies:** Accounts support USD, EUR, GBP, BTC and RON. The invoice form also offers CHF and CAD, and Preferences also lists JPY, CAD, AUD and CHF. A currency with no saved rate converts 1:1, which is a guess.

---

## 8. Mobile today

The mobile switch happens below 768 px. It's a fact-based starting point for later phases.

| Group | Pages |
|---|---|
| Dedicated mobile view | Dashboard, Accounts, Transactions, Budget, Forecasting, Investments, Schedule, Subscriptions |
| Responsive desktop page only | Reports, Challenges, Tasks, Invoices, Merchants, Rules, Categories, Tags, Settings, Preferences, Personal Info, Integrations, Data Management, Documentation, Holding Detail |
| Detail with a mobile header | Account Detail |

**Differences found so far**
- Mobile Transactions has no multi-select, bulk edit, combine or export.
- Mobile Dashboard has no widget layout editing.
- Reordering accounts uses Move Up and Move Down on mobile, not drag.
- Rules, Merchants, Import and other dense tools have no mobile design.
- Most create and edit forms use the same drawer on all screen sizes.

---

## 9. Observations for later phases

These are facts, not decisions.

- **Depth:** Crystal's forms are very large. Accounts have about 90 fields, and `AddTransactionModal` is about 2,600 lines.
- **Duplication:** Add and Edit Account are near copies. Goals and forecast-day flows are wired twice, on Dashboard and Forecasting. Smart suggestions appear in both Rules and Merchants. Categorisation can be set up from Rules, Merchant Overrides, keyword rules and regex rules.
- **Sync buttons:** The sync action appears on Dashboard, Accounts and Transactions.
- **Language:** Many labels are unusually technical, such as "Principal Net Capital", "Sub-Nodes", "Execute Wipe" and "Temporal Window". The functions stay, but labels can change.
- **Features with no screen after cleanup:** Leased-vehicle residual value, account website, Meal Voucher sub-type and merchant autofill exist only as data or logic today.

---

## 10. Overlay and trigger map

Every modal, drawer, sheet and menu, and what opens it. `InvestmentModal` is the shared form behind the trade and grant entries below. `BillPaymentModal`, `SyncedBillMatcherModal` and `TransactionMatcherModal` are not rendered, so they are not listed. It was added after review, because the feature tables say what each overlay does but not every button that reaches it. It was traced from where each overlay is rendered in the code. The triggers were read from code, and not all of them were clicked.

### Accounts and banking

| Overlay | Opened from | IDs |
|---|---|---|
| `AddAccountModal` | Accounts: Add Account; mobile Add Account | ACC-10 |
| `EditAccountModal` | Accounts: row Edit, context menu, overview Edit Details, mobile swipe. Investments: Edit Account Settings | ACC-11, INV-06 |
| `AccountOverviewModal` | Accounts: card click, Quick Overview, mobile swipe. Investments: account click | ACC-08 |
| `TransactionDetailModal` (nested) | Account overview: a recent transaction | ACC-08 |
| `BalanceAdjustmentModal` | Accounts: row, context menu, overview, mobile swipe. Account Detail: Adjust. Investments: Adjust Balance | ACC-20 |
| `FinalConfirmationModal` | Accounts: Delete Account | ACC-21 |
| `ConfirmationModal` | Investments: delete account. Account Detail: delete mileage log, delete transaction | INV-06, ACC-36, ACC-25 |
| `IconPicker` | Add Account, Edit Account, Category, Tag and Membership forms: Change Icon | ACC-19, CAT-02, TAG-02, SUB-05 |
| `AddMileageLogModal` | Vehicle view: Add Log, edit a log | ACC-36 |
| `PropertyValuationModal` | Property and Vehicle views: Value Update | ACC-34, ACC-35 |
| `CloseAssetModal` | Property view: Record Sale. Vehicle view: Retire Vehicle | ACC-37 |
| `EnableBankingSyncModal` | Sync on all nine account detail views when bank-linked. Integrations: Sync, Sync All | BNK-07, BNK-08 |
| `LoanEarlyPaymentModal` | Payment plan: Early Payment; row Early Extra Payment | ACC-32 |
| `LoanDeferPaymentModal` | Payment plan: Defer Payments; row Defer This Payment | ACC-32 |
| `LoanPaymentBulkEditModal` | Payment plan: Bulk Edit | ACC-32 |
| `AddTransactionModal` | Loan view: Add Payment; payment plan: Record Payment | ACC-30, ACC-31 |
| Mobile: View & Sorting sheet | Mobile Accounts: view controls | ACC-41 |

### Transactions and reconciliation

| Overlay | Opened from | IDs |
|---|---|---|
| `AddTransactionModal` | Press N anywhere. Transactions: Add, edit, Duplicate. Dashboard: Add Transaction. Account views: Add or Log Transaction. Schedule: post | TXN-12, NAV-08, SCH-11 |
| Account and tag pickers | Inside the transaction drawer | TXN-12, TXN-16 |
| `TransactionDetailModal` | Transactions: row. Dashboard: a row, or a category with its transactions. Account Detail: a row | TXN-07 |
| `BulkCategorizeModal` | Transactions: selection bar, category chip on a row | TXN-21 |
| `BulkEditTransactionsModal` | Transactions: selection bar | TXN-22 |
| `SplitTransactionModal` | Transactions: context menu, selection bar, mobile detail | TXN-24 |
| `CombineTransactionsModal` | Transactions: selection bar | TXN-26 |
| `RecurringTransactionModal` | Transactions: Make Recurring, mobile detail | TXN-29 |
| `ConfirmationModal` | Transactions: delete one or many | TXN-23 |
| Context menu | Transactions: right-click a row | TXN-30 |
| Filter popovers | Transactions: filter bar and columns | TXN-09 |
| Mobile: filter sheet | Mobile Transactions and Dashboard: Filter | TXN-31, DSH-20 |
| Mobile: Transaction Details sheet | Mobile Transactions: tap a row | TXN-31 |
| `UnifiedPendingMatchesModal` | Dashboard: Review Matches, or a transfer or bill count | MAT-03 |
| `MatcherConfigPanel` | Pending Matches tab: Configure Matching Thresholds | MAT-05 |

### Planning

| Overlay | Opened from | IDs |
|---|---|---|
| `BudgetModal` | Budget: Create Budget, card edit, Set Budget Guide. Dashboard: budget click | BUD-06 |
| `QuickBudgetModal` | Budget: More Quick Create Options. Dashboard: budget widget | BUD-07 |
| `ConfirmDialog` | Budget: Delete Budget | BUD-08 |
| Mobile: Quick Budget sheet | Mobile Budget: Auto | BUD-10 |
| `ForecastDayModal` | Dashboard and Forecasting: click a chart day | FCT-05 |
| `EditRecurrenceModal` | Dashboard, Forecasting, Schedule: edit a recurring occurrence | FCT-06 |
| `RecurringOverrideModal` | After This Occurrence Only; Schedule: edit one occurrence | SCH-10 |
| `RecurringTransactionModal` | Schedule: New Recurring, Add One-time, edit. Forecast day: Add New Item, edit series. Subscriptions: New Service, Track, edit | SCH-08, SCH-09, SUB-03 |
| `GoalScenarioModal` | Forecasting: Add Goal, Create New Goal, edit, add sub-goal. Dashboard: edit a goal | GOL-02 |
| `ConfirmationModal` | Forecasting: delete goal. Schedule: delete, end series, expire all | GOL-04, SCH-06, SCH-12 |
| Goal card menu | Goal: more menu with Edit, Duplicate, Delete | GOL-04 |
| Schedule row menu | Row: Post Transaction, Mark as Expired, Edit Recurrence, Delete | SCH-05 |
| Mobile: Forecast Accounts sheet | Mobile Forecasting: Filter Accounts | FCT-09 |
| Mobile: Scenario Playground sheet | Mobile Forecasting: Playground | FCT-09 |
| Mobile: Add Schedule Event sheet | Mobile Schedule: add | SCH-14 |

### Investments, subscriptions and documents

| Overlay | Opened from | IDs |
|---|---|---|
| `AddInvestmentTransactionModal` | Investments: Trade, Trade Asset, edit activity. Holding Detail: edit | INV-09 |
| `WarrantModal` | Investments: edit grant. Holding Detail: Edit Grant | INV-10 |
| `WarrantPriceModal` | Investments: Log / Fetch Price, mobile Price. Holding Detail: Log Price, Add Entry, edit a price | INV-12, INV-13, INV-14 |
| `ConfirmationModal`, `ConfirmDialog` | Investments: delete activity. Holding Detail: delete price. Investment form: delete | INV-07, INV-15 |
| Holding context menu | Investments: right-click | INV-05 |
| `MembershipModal` | Subscriptions: Add Card, edit | SUB-05 |
| `ConfirmDialog` | Subscriptions: delete service or card | SUB-03, SUB-04 |
| `InvoiceModal` | Invoices: Draft Quote, New Invoice, edit | DOC-03 |
| `ConfirmationModal` | Invoices: delete | DOC-05 |
| `TaskModal` | Tasks: New Task, Add task, edit a task | TSK-04 |
| `ConfirmationModal` | Tasks: delete | TSK-03 |
| `PredictionModal` | Challenges: Create Prediction | CHL-07 |

### Organisation

| Overlay | Opened from | IDs |
|---|---|---|
| `CategoryModal` | Categories: New Category, edit, Add Sub-category | CAT-02, CAT-03 |
| `TagModal` | Tags: New tag, edit | TAG-02 |
| Confirm dialogs | Categories: delete. Tags: delete | CAT-05, TAG-04 |
| `MerchantOverviewModal` | Merchants: card click | MER-02 |
| `MerchantDetailModal` | Merchants: Merchant settings, overview Edit Merchant | MER-03 |
| `RegexCategorizationModal` | Merchants: Auto-Categorize Rules | MER-10 |
| Rules inline dialogs | Rules: Simulate Impact, Pick from Ledger, confirmations | RUL-06, RUL-12 |

### Global, settings and data

| Overlay | Opened from | IDs |
|---|---|---|
| `CommandCenter` | ⌘K or Ctrl+K; header Search | NAV-06 |
| `KeyboardShortcutsModal` | Press ? | NAV-07, HLP-02 |
| `NotificationCenter` | Bell in the header | NAV-09 |
| `OnboardingModal` | Automatic for a new user | ACS-07 |
| Profile menu | Sidebar footer | NAV-02 |
| `AddWidgetModal` | Dashboard: Add Widget | DSH-19 |
| `ChangePasswordModal` | Personal Info: Change password | SET-03 |
| `NewImportModal` | Data Management: Import | DAT-02 |
| `ImportWizard` | After choosing an import source | DAT-02 |
| `ExportModal` | Data Management: Export, Backup | DAT-03 |
| `SmartRestoreModal` | Data Management: Restore | DAT-04 |
| `ImportDetailsModal` | Audit Trail: Inspector | DAT-06 |
| `ConfirmationModal`, `FinalConfirmationModal` | Data Management: Factory Reset, remove from history. Import details: Purge Import Data | DAT-05, DAT-06, DAT-07 |

### Mobile swipe actions

| View | Actions |
|---|---|
| Accounts | Overview, Adjust, Edit |
| Transactions | Categorise, Edit, Delete |
| Budget | Edit, Delete |
| Schedule | Pay Now, Mark Done, Edit, Delete |
| Investments | Detail, Adjust, Price, Edit, Delete |
| Subscriptions | Edit, Cancel |

---

## 11. Default behaviours and automations

What Crystal does on its own. These are easy to lose in a redesign, because no button shows them. **The redesign must keep all of them, unless a decision says otherwise.** Each was read from the code. The transaction form behaviour is the owner's confirmed working behaviour.

### Transaction form

| ID | Behaviour | Detail | Keep |
|---|---|---|---|
| AUT-01 | Merchant autofill | Typing 2 or more characters in Merchant looks up the merchant's configuration and fills it in while you type | Required |
| AUT-02 | What gets filled | Default category, default description and location: the primary branch, or the first branch, or the merchant's single address. Includes place name, street, city, postal code, region, country, coordinates and label | Required |
| AUT-03 | Merchant website | Not a transaction field, so it isn't copied. It lives on the merchant and supports logos and links | Required |
| AUT-04 | Your edits win | Once you change category, description or location yourself, autofill stops overwriting that field | Required |
| AUT-05 | Choosing a suggestion overrides | Picking a merchant from suggestions refills all three fields, even after manual edits | Required |
| AUT-06 | Merchant suggestions | Built from past transactions, most frequent first, with their category | Required |
| AUT-07 | Branch chips | A merchant with several locations shows quick chips to choose a branch | Required |
| AUT-08 | Rules while typing | If the merchant has no configuration, transaction rules run as you type and when description or amount lose focus | Required |
| AUT-09 | Description to merchant | Leaving Description with Merchant empty copies the description into Merchant, then applies autofill | Required |
| AUT-10 | Location saved to merchant | On save, a transaction's location is added to the merchant as a new or updated branch. On by default, with a checkbox to turn off. Skips Internal Transfer, Round Up and manual corrections | Required |
| AUT-11 | Default account | Starts on the primary account | Required |
| AUT-12 | Default date | Starts on today, or the date passed in from a schedule or forecast item | Required |
| AUT-13 | Default city | New transactions start with the city and country from your profile | Required |
| AUT-14 | Loan split | Payments to a loan split principal and interest from the balance and rate. Editing either one turns the automatic split off and keeps both summing to the total | Required |
| AUT-15 | Round-up | Offered when the account has a linked spare-change account. Uses the chosen strategy and multiplier | Required |
| AUT-16 | Transfer save | One transfer becomes two linked records, kept together when edited | Required |

### Address and location

| ID | Behaviour | Detail | Keep |
|---|---|---|---|
| AUT-17 | Address lookup | Searches after a 250 ms pause. Uses Photon first, with Nominatim as a fallback | Required |
| AUT-18 | Result details | A result fills address, place, street, city, postal code, region, country and coordinates | Required |
| AUT-19 | Merchant to transactions | Saving a merchant can write its primary location to all of its existing transactions, using a checkbox | Required |
| AUT-20 | Map display | Coordinates feed the transaction, merchant and dashboard maps | Required |

### Merchants and rules

| ID | Behaviour | Detail | Keep |
|---|---|---|---|
| AUT-21 | Merchant identity | Names are normalised to one key, so spelling variants share a configuration | Required |
| AUT-22 | Order of priority | Merchant configuration first; if it has a category or description, transaction rules are skipped. Then rules, highest priority first, and the first match wins | Review with `RUL` |
| AUT-23 | Apply to history | Rules, overrides and keyword rules can update past transactions, with rollback for rule runs | Required |
| AUT-24 | Logos | Fetched from Brandfetch by merchant or domain, with overrides and uploads | Required |

### Bank sync

| ID | Behaviour | Detail | Keep |
|---|---|---|---|
| AUT-25 | Duplicate protection | Synced transactions are matched by bank ID or a hash, so a re-sync doesn't duplicate them. Identical rows on one day stay separate | Required |
| AUT-26 | Sync defaults | The first sync is a full import. Later syncs default to only new transactions | Required |
| AUT-27 | Balance source | Synced accounts record the balance source and last sync time | Required |
| AUT-28 | Match suggestions | Synced transactions are compared with transfers and planned items to suggest matches | Required |

### Investments

| ID | Behaviour | Detail | Keep |
|---|---|---|---|
| AUT-29 | Two price sources | Each holding uses a saved web binding if it has one, otherwise Twelve Data. Both feed the same price log | Required |
| AUT-30 | Sync Market Prices | Refreshes all displayed holdings at once and reports which failed. It runs only on request, not on a schedule | Required |
| AUT-31 | Ticker mapping | A holding can use a different Twelve Data ticker from its symbol | Required |
| AUT-32 | Web scraping | Fetches a page through the server, offers values to pick from, then saves the selector. Optional cookies. Bindings sync with the account | Required |
| AUT-33 | Trade autofill | Entering a symbol looks up its name and type from Twelve Data | Required |
| AUT-34 | Missing price fallback | With no price, a holding uses the last trade price, then average cost, and is flagged as price unavailable | Required |
| AUT-35 | Cash settlement | A trade can also create the matching cash transaction | Required |

### Across the app

| ID | Behaviour | Detail | Keep |
|---|---|---|---|
| AUT-36 | Exchange rates | With a Twelve Data key, rates refresh on load and save with your preferences | Required |
| AUT-37 | Balance updates | Saving, editing or deleting a transaction updates account balances | Required |
| AUT-38 | Loan repayments | A payment reduces a loan by its principal only | Required |
| AUT-39 | Synthetic schedule | Loans, cards and properties create scheduled items automatically | Required |
| AUT-40 | Paying a bill | Marking a bill paid records it. Notifications do this at once with today's date | Required |
| AUT-41 | Bill alerts | Show items due within 3 days or up to 7 days overdue | Required |
| AUT-42 | Budget link | Budgets follow a renamed category | Required |
| AUT-43 | Login streak | Updates once a day when you open the app | Required |
| AUT-44 | Prediction results | Resolve as won or lost after the end date, while Challenges is open | Required |
| AUT-45 | Subscription detection | Finds likely subscriptions from transaction patterns | Required |
| AUT-46 | Autosave | Every change saves automatically, with a final save on sign-out | Required |
| AUT-47 | Delete cascade | Deleting an account removes its transactions, schedule items and links | Required |

---

## 12. Known defects and rework

Found while logging section 11, or reported by the owner. **Nothing here has been fixed.** The "Proof" column says how sure each finding is.

| ID | Severity | Problem | Effect | Proof |
|---|---|---|---|---|
| DEF-01 | Critical | `buildHoldingsOverview` filters accounts, but still adds every traded symbol. Investments sums seven segments | **Traded positions are counted once in every segment, so the All value is up to 7× too high.** Cost basis is inflated the same way. Other segments' positions appear in each list, labelled Stock | **Confirmed by running the real function:** a €3,000 portfolio gave €21,000 |
| DEF-02 | Critical | Portfolio history counts each position once, but its last point is replaced with the inflated total from DEF-01 | The chart's final candle jumps. This is the likely cause of the inaccurate candlesticks | Confirmed in code, not run on live data |
| DEF-03 | High | Portfolio candles aren't market data. Each one opens at the last logged close, and highs and lows come only from logged points | Candles look like market OHLC but only reflect when prices were logged. Sparse logs give flat or misleading candles. Twelve Data price history isn't used | Confirmed in code |
| DEF-04 | High | Trades have no currency, and prices are treated as EUR. Twelve Data tries `X/EUR`, `X/USD`, then `X`, and the returned currency is never checked | A USD quote may be saved and valued as EUR. No exchange is specified either, so a ticker listed in several places may use the wrong one | In code. Needs a live key to confirm |
| DEF-05 | High | Portfolio history uses a grant's full quantity, but the overview deducts sold units | Past values overstate sold warrants | Confirmed in code |
| DEF-06 | High | Rules only run on transactions without an ID, and synced transactions already have one. Round-ups stop for the same reason | **Merchant configuration, rules, regex rules and round-ups don't appear to apply to bank-synced transactions** | Confirmed in code, not run with a live bank |
| DEF-07 | Medium | The save step runs regex rules after merchant rules | Where rules do run, a regex can override a merchant's category, despite the stated priority | Confirmed in code |
| DEF-08 | Medium | Accounts without a symbol and without a purchase price use the current balance as cost | Those accounts always show zero gain | Confirmed in code |
| DEF-09 | Medium | `Sync Market Prices` requests every holding at once | Twelve Data limits may fail larger portfolios | Suspected, not tested |

### Rules page rework (`RUL`)

The owner reports that this page is untested and too complicated, and may need a complete redesign and rework from the ground up. The code supports that:

- It's a single 3,417-line page.
- Categorisation can be set up in four places: merchant configuration, transaction rules, keyword rules and regex rules.
- The core rule logic has no unit tests.
- Merchant configuration silently stops transaction rules from running (AUT-22).
- Bank-synced transactions appear to skip it all (DEF-06).

So rework of `RUL-01` to `RUL-12`, and of how they relate to `MER-04` and `MER-10`, is treated as functional work, not just a visual redesign.
