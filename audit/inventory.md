# Crystal — Application Inventory

Generated 2026-10-13 from the source at commit `2073eda` (`main`). Everything here comes from the actual code:
- the route table: `pageRegistry`/`parseRoute`/`renderPage` in `App.tsx`
- the page files in `pages/`
- the Express routers in `server/src/` and `server.ts`

Line numbers refer to that commit.

**What "auth" means in this app.** There is no router library. `App.tsx:2825` gates the entire SPA: unless the user is authenticated (`GET /api/auth/me` succeeds) or in **Demo Mode**, every URL renders the Sign In/Sign Up screen. The backend stores a `role` column (default `'Member'`), but **no frontend page and no backend handler checks it**. There are no admin pages and no role-restricted routes.

---

## 1. Routes / pages

The route table is `pageRegistry` (`App.tsx:36-62`). Paths are parsed by `parseRoute` (`App.tsx:179`) and rendered by `renderPage` (`App.tsx:2755`). Unknown paths fall back to Dashboard without any error.

| # | Page (`Page` id) | Path | File | Auth | Reached from |
|---|---|---|---|---|---|
| 1 | Sign In | *(any path, when signed out)* | `pages/SignIn.tsx` | Public | Default screen when signed out |
| 2 | Sign Up | *(any path, when signed out)* | `pages/SignUp.tsx` | Public | Link on Sign In (component state; it has no URL) |
| 3 | Dashboard | `/` | `pages/Dashboard.tsx` | Session or demo | Sidebar, mobile nav, `g d`, ⌘K |
| 4 | Accounts | `/accounts` | `pages/Accounts.tsx` | Session or demo | Sidebar, `g a` |
| 5 | AccountDetail | `/accounts/:accountId` | `pages/AccountDetail.tsx` (+ 9 `components/*AccountView.tsx`) | Session or demo | Accounts, Investments, ⌘K account search, loan↔property links |
| 6 | Transactions | `/transactions` | `pages/Transactions.tsx` | Session or demo | Sidebar, `g t`, Accounts/Tags "view transactions" |
| 7 | Reports | `/reports` | `pages/Reports.tsx` | Session or demo | Sidebar |
| 8 | Budget | `/budget` | `pages/Budgeting.tsx` | Session or demo | Sidebar, `g b` |
| 9 | Forecasting | `/forecasting` | `pages/Forecasting.tsx` | Session or demo | Sidebar |
| 10 | Investments | `/investments` | `pages/Investments.tsx` | Session or demo | Sidebar, `g i` |
| 11 | HoldingDetail | `/investments/:symbol` | `pages/HoldingDetail.tsx` | Session or demo | Investments → "Holding Details" |
| 12 | Schedule & Bills | `/schedule` | `pages/Schedule.tsx` | Session or demo | Sidebar |
| 13 | Subscriptions | `/subscriptions` | `pages/Subscriptions.tsx` | Session or demo | Sidebar |
| 14 | Quotes & Invoices | `/invoices` | `pages/Invoices.tsx` | Session or demo | Sidebar |
| 15 | Tasks | `/tasks` | `pages/Tasks.tsx` | Session or demo | Sidebar |
| 16 | Challenges | `/challenges` | `pages/Challenges.tsx` | Session or demo | Sidebar |
| 17 | Settings | `/settings` | `pages/Settings.tsx` | Session or demo | Sidebar, `g s` |
| 18 | Personal Info | `/personal-info` | `pages/PersonalInfo.tsx` | Session or demo | Settings, sidebar profile menu |
| 19 | Preferences | `/preferences` | `pages/Preferences.tsx` | Session or demo | Settings, sidebar profile menu |
| 20 | Integrations | `/integrations` | `pages/Integrations.tsx` | Session or demo | Settings, mobile "More" |
| 21 | EnableBankingCallback | `/enable-banking/callback` | `pages/EnableBankingCallback.tsx` | Session or demo* | Bank OAuth redirect only |
| 22 | Rules | `/rules` | `pages/Rules.tsx` | Session or demo | Settings, Merchants → "View all in Rules" |
| 23 | Merchants | `/merchants` | `pages/Merchants.tsx` | Session or demo | Settings, Reports → leaderboard link, mobile "More" |
| 24 | Categories | `/categories` | `pages/Categories.tsx` | Session or demo | Settings |
| 25 | Tags | `/tags` | `pages/Tags.tsx` | Session or demo | Settings |
| 26 | Data Management | `/data-management` | `pages/DataImportExport.tsx` | Session or demo | Settings |
| 27 | Documentation | `/documentation` | `pages/Documentation.tsx` | Session or demo | Settings ("Knowledge Base") |
| — | *(none)* | — | `pages/Warrants.tsx` | — | **Dead: never imported** (see §6) |

\* If the session has expired when the bank redirects back, the callback URL shows Sign In instead. Whether `?code`/`state` survive sign-in is untested.

Global UI shown on every authenticated page (`App.tsx:2840-2910`):
- `Sidebar` (desktop) / `MobileNavbar` (mobile)
- `CommandCenter` (⌘K / Ctrl+K)
- `KeyboardShortcutsModal` (`?`)
- quick-add `AddTransactionModal` (`n`)
- `NotificationCenter` (bill reminders)
- `OnboardingModal` (lazy)

---

## 2. API endpoints

### 2a. Production backend: `server/src/` (Express, mounted in `server/src/index.ts:61-78`)

Auth is checked by `authenticateToken` (`server/src/middleware.ts`). It accepts a JWT from either the `Authorization: Bearer` header or the session cookie, and checks the session against `user_sessions`.

| # | Method | Path | File:line | Auth | Called from (frontend) |
|---|---|---|---|---|---|
| 1 | GET | `/api` | `index.ts:61` | Public | — (liveness text) |
| 2 | GET | `/health`, `/api/health` | `index.ts:65` | Public | Docker healthcheck (`docker-compose.yml`) |
| 3 | POST | `/api/auth/register` | `auth.ts:60` | Public | `hooks/useAuth.ts:110` |
| 4 | POST | `/api/auth/login` | `auth.ts:104` | Public, `loginRateLimiter` | `hooks/useAuth.ts:74` |
| 5 | POST | `/api/auth/logout` | `auth.ts:129` | Cookie optional (revokes the session if present) | `hooks/useAuth.ts:48` |
| 6 | GET | `/api/auth/me` | `auth.ts:154` | Required | `hooks/useAuth.ts:142` |
| 7 | GET | `/api/data` | `data.ts:9` | Required | `hooks/useAuth.ts:143` |
| 8 | POST | `/api/data` | `data.ts:34` | Required; zod-validated; 409 on stale `previousUpdatedAt` | `App.tsx:924` (`saveData`/`savePartialData`) |
| 9 | PUT | `/api/users/me` | `users.ts:20` | Required | `hooks/useAuth.ts:189` |
| 10 | POST | `/api/users/me/change-password` | `users.ts:45` | Required, `passwordChangeRateLimiter` | `hooks/useAuth.ts:211` |
| 11 | GET | `/api/smart-fetch?url=&cookies=` | `smartFetcher.ts:5` | **Public** ⚠️ | `pages/Investments.tsx:702`, `components/WarrantPriceModal.tsx:146` |
| 12 | POST | `/api/enable-banking/aspsps` | `enableBanking.ts:142` | Required | `App.tsx:1905` |
| 13 | POST | `/api/enable-banking/authorize` | `enableBanking.ts:178` | Required | `App.tsx:1949` |
| 14 | POST | `/api/enable-banking/session` | `enableBanking.ts:203` | Required | `pages/EnableBankingCallback.tsx:108` |
| 15 | POST | `/api/enable-banking/session/fetch` | `enableBanking.ts:218` | Required | `App.tsx:2462` |
| 16 | POST | `/api/enable-banking/accounts/:accountId/details` | `enableBanking.ts:157` | Required | `App.tsx:2478` |
| 17 | POST | `/api/enable-banking/accounts/:accountId/balances` | `enableBanking.ts:233` | Required | `App.tsx:2479` |
| 18 | POST | `/api/enable-banking/accounts/:accountId/transactions` | `enableBanking.ts:253` | Required | `App.tsx:2506` (paged, ≤100 pages) |
| 19 | POST | `/api/enable-banking/pending` | `enableBanking.ts:275` | Required | `App.tsx:1941` |
| 20 | GET | `/api/enable-banking/pending/:connectionId` | `enableBanking.ts:306` | Required | `pages/EnableBankingCallback.tsx:72` |
| 21 | DELETE | `/api/enable-banking/pending/:connectionId` | `enableBanking.ts:331` | Required | `pages/EnableBankingCallback.tsx:156` |

### 2b. Dev server: `server.ts` (`npm run dev`, port 3000)

| # | Method | Path | Line | Auth | Notes |
|---|---|---|---|---|---|
| D1 | GET | `/sw.js`, `/registerSW.js` | 21 | Public | Serves a service worker that unregisters any stale SW |
| D2 | POST | `/api/ai/proxy` | 36 | **Public** ⚠️ | Forwards any `{endpoint, method, headers, body}`. **No frontend caller** |
| D3 | ALL | `/api/*` | 238 | — | Proxies to `VITE_BACKEND_URL` if set; otherwise runs `handleMockApi` (line 114) |
| D4 | GET | `*` | 292 | Public | SPA fallback (production mode only) |

The `handleMockApi` in-memory mock covers `/health`, `/auth/me|login|register|logout`, `/data` GET/POST, `/users/me` GET/PUT, `/users/me/change-password`, and `/smart-fetch`. For any `/enable-banking/*` path it returns the stub `{aspsps:[],sessions:[]}`. Mock behavior differs from production in several ways (see §6).

**Third-party calls made directly from the browser** (outside our API):
- Twelve Data, for prices and FX (`src/services/twelveDataService.ts`)
- Brandfetch, for merchant logos (`utils/brandfetch.ts`)
- the Carto basemap (`hooks/useCartoBasemap.ts`)
- address/location search (`hooks/useAddressSearch.ts`, `useLocationSearch.ts`)

---

## 3. User workflows (end to end)

"Autosave" means: a state change marks a slice dirty, a debounced `savePartialData` sends `POST /api/data {partial:true}`, and the server may answer 409 on conflict (`App.tsx:1155-1208`). Demo mode **never** calls `/api/data`.

### Auth & lifecycle
| ID | Workflow | Pages | Endpoints |
|---|---|---|---|
| W1 | **Sign up**: fill first/last name, email, password; submit; signed in; onboarding opens | Sign Up → Dashboard (+ OnboardingModal) | `POST /api/auth/register` (400 missing fields, 409 email taken) |
| W2 | **Sign in** | Sign In → Dashboard | `POST /api/auth/login` (rate-limited) |
| W3 | **Session restore** on page load or refresh | any | `GET /api/auth/me`, `GET /api/data` |
| W4 | **Sign out**: sidebar profile menu → Logout; a final save runs first | any → Sign In | `POST /api/data` (keepalive), `POST /api/auth/logout` |
| W5 | **Password reset**: **NOT IMPLEMENTED**. The "Forgot password?" button has no handler (`SignIn.tsx:72`) | Sign In | — |
| W6 | **Change password**: Personal Info → "Rotate Credentials" → `ChangePasswordModal` | Personal Info | `POST /api/users/me/change-password` |
| W7 | **Edit profile**: name, phone, address, default city (`LocationAutocomplete`) → "Commit Changes" | Personal Info | `PUT /api/users/me` |
| W8 | **Demo mode**: Sign In → demo button. Loads `demoData.ts`, or the dev cache when running in dev | Sign In → Dashboard | none |
| W9 | **Onboarding**: shown when signed in with 0 accounts, 0 budgets, and `crystal-onboarding-complete` unset. Steps: currency → first account → first recurring item → Finish/Skip | OnboardingModal over Dashboard | autosave |
| W10 | **Autosave and conflict handling**: any mutation → debounced partial save; on 409 the client must reload | all | `POST /api/data` |

### Accounts & banking
| ID | Workflow | Pages | Endpoints |
|---|---|---|---|
| W11 | **Manage accounts**: add (`AddAccountModal`), edit (`EditAccountModal`), adjust balance (`BalanceAdjustmentModal`), overview (`AccountOverviewModal`), delete (`FinalConfirmationModal`), activate/deactivate, manual reorder; view toggles (split/combined, cards/rows, grid/list, sort) | Accounts | autosave |
| W12 | **Account detail**. All types: add transaction, transaction detail. Type-specific views: property valuation, close asset / revert closure (property, vehicle), vehicle mileage log add/edit/delete, loan schedule (`PaymentPlanTable`, early payment/defer/bulk-edit modals), credit card statement, linked loan↔asset navigation, "Sync" for bank-linked accounts | AccountDetail | autosave; W14 endpoints when syncing |
| W13 | **Connect a bank (Enable Banking)**: Integrations → enter app ID, country, client certificate → load banks → choose bank → create. Saves a pending connection → redirect to bank → callback exchanges code for a session → back to Integrations | Integrations → external bank → EnableBankingCallback → Integrations | `POST …/aspsps`, `POST …/pending`, `POST …/authorize`, `GET …/pending/:id`, `POST …/session`, `DELETE …/pending/:id` |
| W14 | **Link and sync bank accounts**: per provider account, link to an existing account or create a new one (type, sync start date); "Sync this account"/"Sync all" (`EnableBankingSyncModal`); global "Sync Connected Banks" buttons on Dashboard, Accounts, Transactions | Integrations, Dashboard, Accounts, Transactions, AccountDetail | `POST …/session/fetch`, `…/accounts/:id/details`, `…/balances`, `…/transactions`; autosave |
| W15 | **Reauthorize or delete a bank connection** | Integrations | W13 endpoints / autosave |

### Transactions & categorization
| ID | Workflow | Pages | Endpoints |
|---|---|---|---|
| W16 | **Add, edit, or delete a transaction**: header button, `n` shortcut, account views, Dashboard | Transactions, Dashboard, AccountDetail, global | autosave |
| W17 | **Bulk and advanced operations**: multi-select → bulk categorize / bulk edit / delete; context menu → edit, split/unsplit, combine/uncombine, duplicate, make recurring (`RecurringTransactionModal`) | Transactions | autosave |
| W18 | **Filter and export**: date, accounts, category, tags, location, type, amount, search/merchant; reset; Export CSV | Transactions | none (client-side download) |
| W19 | **Reconcile pending matches**: `UnifiedPendingMatcherCard` → `UnifiedPendingMatchesModal` (matches synced transactions to transfers/bills) | Dashboard | autosave |
| W20 | **Categories**: add or edit root and child categories (`CategoryModal`), delete (custom confirm) | Categories | autosave |
| W21 | **Tags**: register/edit (`TagModal`), delete, sort, grid/list view, open filtered transactions | Tags → Transactions | autosave |
| W22 | **Rule engine**: create/edit rules (AND/OR conditions, actions), templates, toggle active, test against the ledger, Simulate Impact, apply to existing transactions, revert last run or a batch, clear audit log, accept suggested rules, merchant overrides (CRUD, apply to the past ledger, import from Merchants), categorization sandbox | Rules | autosave |
| W23 | **Merchants**: grid/list, sort, refresh all or one logo (Brandfetch), hide/unhide, detail config (`MerchantDetailModal`), overview (`MerchantOverviewModal`), regex auto-categorize (`RegexCategorizationModal`), deploy smart suggestions | Merchants → Rules | autosave; Brandfetch (external) |

### Planning & scheduling
| ID | Workflow | Pages | Endpoints |
|---|---|---|---|
| W24 | **Budgets**: create/edit (`BudgetModal`), default quick-create, "More Quick Create Options" (`QuickBudgetModal`), delete | Budget (also a Dashboard widget) | autosave |
| W25 | **Financial goals**: add/edit (`GoalScenarioModal`), contribution plan, toggle visibility, filter by account, grid/table view, delete | Forecasting, Dashboard | autosave |
| W26 | **Forecasting**: duration, accounts filter, scenario playground, individual vs. stacked lines, drill into a day (`ForecastDayModal`) → edit a recurrence (`EditRecurrenceModal`/`RecurringOverrideModal`/`BillPaymentModal`), schedule view by account or date | Forecasting, Dashboard (forecast widget) | autosave |
| W27 | **Schedule & bills**: new recurring item, add one-time bill, edit/delete recurring (synthetic loan/card items are disabled), overrides, mark a bill paid, expire all old bills, restore or delete archived bills, heatmap, calendar, search, overdue filter; NotificationCenter "Pay / Record", dismiss, clear all | Schedule, global NotificationCenter | autosave |
| W28 | **Subscriptions & memberships**: detected subscriptions → Track/Ignore (ignored list is stored in **localStorage only**), new service, delete; loyalty cards via `MembershipModal` | Subscriptions | autosave |

### Investments & insights
| ID | Workflow | Pages | Endpoints |
|---|---|---|---|
| W29 | **Trade and holdings**: Trade (`AddInvestmentTransactionModal`), segment filter, show inactive holdings, per-account edit/adjust/details, delete investment transaction or grant | Investments | autosave |
| W30 | **Warrants / equity grants**: add/edit grant (`WarrantModal`), delete | Investments, HoldingDetail | autosave |
| W31 | **Prices**: "Sync Market Prices" (Twelve Data); per-holding "Log / Fetch Price" (`WarrantPriceModal`, smart fetcher scrapes a URL); price history add/edit/delete; candlestick vs. line chart | Investments, HoldingDetail | `GET /api/smart-fetch`; Twelve Data (external); autosave |
| W32 | **Reports**: predefined periods, category/merchant filters, reset, merchant leaderboard → Merchants | Reports → Merchants | none |
| W33 | **Challenges**: create/manage predictions (`PredictionModal`); start/abandon savings sprints (sprints are stored in **localStorage only**) | Challenges | autosave (predictions, userStats) |

### Productivity, settings & data
| ID | Workflow | Pages | Endpoints |
|---|---|---|---|
| W34 | **Quotes & invoices**: draft quote / new invoice (`InvoiceModal`), convert quote → invoice, delete | Quotes & Invoices | autosave |
| W35 | **Tasks**: new/edit (`TaskModal`), delete, sort, manual drag reorder, heatmap | Tasks | autosave |
| W36 | **Preferences**: theme (light/dark/system), font category, currency, country, timezone, date format, fiscal-year start month, default durations, account order, toggles (exclude transfers, show balance adjustments, privacy mode) | Preferences | autosave |
| W37 | **Data management**: new import (`ImportWizard`, source picker) → publish; Export CSV/JSON (`ExportModal`); Smart Restore (`SmartRestoreModal`, merge by ID); import history inspector/evict log; delete imported transactions; **reset all data** (`FinalConfirmationModal`) | Data Management | autosave (reset uses `allowEmpty`) |
| W38 | **Dashboard customization**: Edit Layout (drag/resize via react-grid-layout), Add Widget (`AddWidgetModal`), forecast duration, show forecast/goals toggles | Dashboard | autosave |
| W39 | **Global navigation**: sidebar groups and collapse, mobile tab bar + "More" sheet, ⌘K Command Center (pages, accounts, actions: privacy, theme), shortcuts (`g`+d/a/t/i/b/s, `n`, `?`), privacy blur, profile menu | global | none |
| W40 | **Documentation**: section nav, back to top | Documentation | none |

---

## 4. Per-page interactive elements

Line numbers point to the element in the page file. "→" gives what the element does. Controls that live inside shared modals are listed by modal name.

### Sign In (`pages/SignIn.tsx`)
- **Form** (email, password) `:44` → `onSignIn` → `POST /api/auth/login`; shows `authError`
- Password show/hide `:89`
- **"Forgot password?"** `:72` → **no handler (dead)**
- Demo button `:111` → `handleEnterDemoMode`
- "Sign up for free" `:118` → switches to Sign Up

### Sign Up (`pages/SignUp.tsx`)
- **Form** (first, last, email, password) `:86` → `POST /api/auth/register`
- Password show/hide `:160`
- "Sign In" link `:175`

### Dashboard (`pages/Dashboard.tsx`)
- Header:
  - Edit Layout / Finish Editing `:1728`
  - Add Widget `:1738` → `AddWidgetModal`
  - Sync Connected Banks `:1747`
  - Add Transaction `:1764` → `AddTransactionModal`
- Forecast duration select `:1819`
- Show forecast toggle `:1836`, show goals toggle `:1845`
- Widgets:
  - `TransactionList` → `TransactionDetailModal`
  - `UnifiedPendingMatcherCard` → `UnifiedPendingMatchesModal`
  - Forecast → `ForecastDayModal` → `RecurringTransactionModal` / `EditRecurrenceModal` / `RecurringOverrideModal` / `BillPaymentModal`
  - `FinancialGoalCard` → `GoalScenarioModal`
  - Budget widgets → `BudgetModal` / `QuickBudgetModal`
  - Also: `CreditCardStatementCard`, `TodayWidget` (tasks), `TransactionMapWidget`, `MerchantParetoWidget`, `FinancialRunwayWidget`, `WealthVelocityWidget`, `MultiAccountFilter`, `DurationFilter`
- Privacy toggle
- Mobile: `MobileDashboardView`

### Accounts (`pages/Accounts.tsx`)
- Header: Sync Connected Banking Accounts `:417`, Add Account `:432` (also `:472`) → `AddAccountModal`
- Split Assets & Liabilities / Combined View `:557/:561`
- Sort select (Manual/Name/Balance) `:568`
- Card / row style `:577/:580`
- Grid / list layout `:586/:589`
- Right-click context menu `:364-371`:
  - Overview → `AccountOverviewModal`
  - Open → AccountDetail
  - View transactions → Transactions (filtered)
  - Edit → `EditAccountModal`
  - Adjust balance → `BalanceAdjustmentModal`
  - Delete → `FinalConfirmationModal`
- Drag reorder and status toggle (`AccountsListSection`)
- Mobile: `MobileAccountsView`

### AccountDetail (`pages/AccountDetail.tsx` + views)
- Every view has Back plus Add Transaction (`AddTransactionModal`); clicking a row → `TransactionDetailModal`
- Cash / Savings / Pension / Spare Change views: Adjust Balance (`BalanceAdjustmentModal`), Sync linked account (`EnableBankingSyncModal`)
- Property view:
  - Update Valuation (`PropertyValuationModal`)
  - Close/Sell Asset (`CloseAssetModal`)
  - Revert Closure
  - "Loan profile" link
- Vehicle view:
  - Update valuation
  - Add / edit / delete mileage log (`AddMileageLogModal`)
  - Close Asset, Revert Closure
- Loan view:
  - Sync
  - Add Payment
  - "Asset portfolio" link
  - Payment plan table (early payment / defer / bulk-edit modals)
- Credit Card view: Sync, Add Transaction, statement card
- General view: Sync, Add Transaction, linked credit cards list
- `ConfirmationModal` ×2 for deletes

### Transactions (`pages/Transactions.tsx`)
- Header:
  - Sync Connected Banking Accounts `:1915`
  - Export `:1931` (CSV)
  - Add Transaction `:1939`
- Filter popovers:
  - Date (clear `:1220`)
  - Accounts (checkboxes `:1245/:1257`, clear `:1265`)
  - Search/merchant (clear `:1294`)
  - Category (`:1304`, clear `:1310`)
  - Location (clear `:1345`)
  - Tags (`:1358`, clear `:1367`)
  - Type `:1378`
  - Amount range (clear `:1405`)
  - Reset all `:2121/:2583`
- Selection bar:
  - Clear / Deselect `:2142/:2160`
  - Bulk action buttons `:2180` → `BulkCategorizeModal`, `BulkEditTransactionsModal`, delete (`ConfirmationModal`), `CombineTransactionsModal`
- Row:
  - Expand split parent `:2429`
  - Category chip → `BulkCategorizeModal` `:2492`
  - Row action `:2561`
- Context menu `:1760-1807`:
  - Edit, Unsplit, Uncombine
  - Split (`SplitTransactionModal`)
  - Duplicate
  - Make recurring (`RecurringTransactionModal`)
  - Delete
- Mobile: `MobileTransactionsView`

### Reports (`pages/Reports.tsx`)
- Predefined period buttons `:772`
- `FilterBar` / `SegmentedControl` tabs
- Merchant leaderboard → Merchants `:1095`
- Clear category/merchant filter `:1318`

### Budget (`pages/Budgeting.tsx`)
- Default Quick Create `:267/:294`
- Create Budget `:275` → `BudgetModal`
- More Quick Create Options `:304` → `QuickBudgetModal`
- Budget cards → edit/delete (`ConfirmDialog`)
- Mobile: `MobileBudgetView`

### Forecasting (`pages/Forecasting.tsx`)
- Playground toggle `:1091`
- Add Goal `:1110` / Create New Goal `:1630` → `GoalScenarioModal`
- Stacked vs. individual lines `:1245/:1252`
- Filter goals by account checkbox `:1293`
- Toggle all displayed `:1297`
- Goals grid/table `:1301/:1308`
- Schedule by Account/Date `:1327/:1333`
- Chart day click → `ForecastDayModal` → recurrence/override/bill modals
- Goal delete → `ConfirmationModal`
- Mobile: `MobileForecastView`

### Investments (`pages/Investments.tsx`)
- Header: Sync Market Prices `:1104`, Trade `:1113` → `AddInvestmentTransactionModal`
- View All segment `:1142`
- Show inactive holdings `:1220`
- Per account:
  - Edit Account Settings `:1349` → `EditAccountModal`
  - Adjust Balance `:1356` → `BalanceAdjustmentModal`
  - Account Details `:1363`
- Per holding:
  - Log / Fetch Price `:1421` → `WarrantPriceModal`
  - Trade Asset `:1428`
  - Holding Details `:1435`
- Delete transaction or grant `:1485` → `ConfirmationModal`
- "Analysis" `:1505`
- Warrant add/edit → `WarrantModal`
- `AccountOverviewModal`
- Mobile: `MobileInvestmentsView`

### HoldingDetail (`pages/HoldingDetail.tsx`)
- Back `:116/:224`
- Log Price `:255` / + Add Entry `:474` → `WarrantPriceModal`
- Candlestick vs. line `:350/:356` (repeated at `:383/:389` for the alternate layout)
- Edit Grant/Transaction `:446` → `WarrantModal` / `AddInvestmentTransactionModal`
- Price entry Edit/Delete `:502/:509` (`ConfirmDialog`)

### Schedule & Bills (`pages/Schedule.tsx`)
- Overdue filter All/Recurring/One-time `:131/:144/:158`
- Add One-time `:951` → `BillPaymentModal`
- New Recurring `:958` → `RecurringTransactionModal`
- Expand heatmap `:1185`
- Clear search `:1259`
- Expire all old bills `:1300/:1395`
- Recurring row settings/delete `:1368/:1369` (disabled for synthetic items)
- Restore to Active Bills `:1440`
- Delete Bill `:1466`
- Row actions → `EditRecurrenceModal` / `RecurringOverrideModal` / `AddTransactionModal` (mark paid)
- `CalendarView`
- `ConfirmationModal`
- Mobile: `MobileScheduleView`

### Subscriptions (`pages/Subscriptions.tsx`)
- Add Card `:478/:891` → `MembershipModal`
- New Service `:486/:741` → `RecurringTransactionModal`
- Detected subscriptions: Ignore `:699`, Track `:705`
- Delete active `:814` (`ConfirmDialog`)
- `LoyaltyCard`
- Mobile: `MobileSubscriptionsView`

### Quotes & Invoices (`pages/Invoices.tsx`)
- Draft Quote `:132`, New Invoice `:139` → `InvoiceModal`
- Convert to Invoice `:311`
- Delete `:319` → `ConfirmationModal`
- Filter/segment tabs
- **Pagination ◀ ▶ `:352/:355`: hard-coded `disabled`, no handler (dead)**

### Tasks (`pages/Tasks.tsx`)
- New Task `:194/:312` → `TaskModal`
- Sort select `:253` (Manual/Priority/Temporal)
- `TaskItem` edit/complete/delete (`ConfirmationModal`)
- Drag reorder
- `TasksHeatmap`

### Challenges (`pages/Challenges.tsx`)
- Create Prediction `:956/:1112` → `PredictionModal`
- `PredictionCard` actions
- Sprint cards → start `:1091`
- Abandon `:1080`
- Tabs (`SegmentedControl`)

### Settings (`pages/Settings.tsx`)
- Manage Profile `:131` → Personal Info
- Tiles `:35`: Preferences, Integrations, Rules, Merchants, Categories, Tags, Data Management, Documentation

### Personal Info (`pages/PersonalInfo.tsx`)
- Profile form `:148` (+ `LocationAutocomplete`) → Commit Changes `:269` → `PUT /api/users/me`
- Rotate Credentials `:245` → `ChangePasswordModal`

### Preferences (`pages/Preferences.tsx`)
- Theme light/dark/system `:198/:233/:268`
- Font category `:354`
- Quick currency chips `:481`
- Selects:
  - currency `:501`
  - country `:524`
  - timezone `:546`
  - date format `:604`
  - fiscal-year start month `:625`
  - default duration `:691`
  - forecast duration `:713`
  - account order `:735`
- Toggles: exclude transfers `:791`, show balance adjustments `:817`, privacy mode `:843`

### Integrations (`pages/Integrations.tsx` + `EnableBankingIntegrationCard`)
- Carto API key Reveal/Hide `:100` (key is stored in localStorage)
- Enable Banking card:
  - credentials panel toggle / close
  - Load banks
  - Bank select
  - Create connection
  - Reauthorize
  - Sync all
  - Delete connection
  - Per-account row: expand, Sync this account, link mode (existing/new), account type, sync start presets
  - Opens `EnableBankingSyncModal`

### EnableBankingCallback (`pages/EnableBankingCallback.tsx`)
- No input. Shows progress or an error while it exchanges the code
- "Back to integrations" `:199`

### Rules (`pages/Rules.tsx`, 3.4k lines)
- Header: suggestions toggle `:1201`, Simulate Impact `:1209`, Add/close rule `:1219`
- Templates `:1305-1309`: Subscriptions, Rideshares, Coffee, Salary, Transfers
- Rule form `:1314`:
  - name
  - AND/OR `:1351/:1358`
  - add/remove condition `:1368/:1460` (field/operator/value selects)
  - add/remove action `:1480/:1541`
  - Reset Form `:1584`
  - Submit `:1591`
- Suggested rules: accept `:1661`
- Add rule `:1682`
- Apply to existing `:1710`
- Per rule: Test `:1849`, Toggle active `:1857`, Edit `:1864`, Delete `:1871`
- Revert last run `:2027`, revert batch `:2058`, clear audit logs `:2083`
- Merchant overrides:
  - Apply all to past ledger `:2178`
  - Feed from Merchants `:2185`
  - Form `:2218` (Cancel `:2210/:2301`)
  - Deploy suggestion `:2362`
  - Add `:2389`
  - Category filter `:2414`
  - Edit/Delete `:2552/:2559`
- Ledger picker `:2606`
- Sandbox type `:2701`
- Apply historical changes `:2915`
- Simulate modal close `:3062/:3209/:3217`
- Ledger picker close `:3267`
- Inline confirm dialog `:3389/:3396`

### Merchants (`pages/Merchants.tsx`)
- Auto-Categorize Rules `:584/:630` → `RegexCategorizationModal`
- Refresh logos `:591/:637`
- View all in Rules `:666`
- Deploy smart suggestion `:702`
- Grid/list `:816/:822`
- Sort `:831`
- Per entity:
  - refresh logo `:890/:1058`
  - hide/unhide `:899/:1066`
  - Protocol Configuration `:1073` → `MerchantDetailModal`
  - card click → `MerchantOverviewModal`

### Categories (`pages/Categories.tsx`)
- New Category `:248` / Initialize Root Category `:339` → `CategoryModal`
- Income/expense tabs
- `CategoryItem` edit/add-child/delete
- Delete confirm: Abort `:232` / Execute Deletion `:233`

### Tags (`pages/Tags.tsx`)
- Register New Tag `:175` → `TagModal`
- Sort `:227`
- Grid/list `:239/:245`
- Edit `:280/:356`, Delete `:286/:359` → `ConfirmationModal`
- Card click → Transactions filtered by tag

### Data Management (`pages/DataImportExport.tsx`)
- New import `:461` → `NewImportModal` → source picker `:87` → `ImportWizard`
- Export CSV `:465` / JSON `:490` → `ExportModal`
- Restore `:494` → `SmartRestoreModal`
- History: Inspector `:554` → `ImportDetailsModal`; Evict Log `:562`
- Reset all data `:601` → `ConfirmationModal` → `FinalConfirmationModal`

### Documentation (`pages/Documentation.tsx`)
- Section nav `:244/:263`
- Back to top `:302`

### Global components
- **Sidebar:**
  - nav items
  - close (mobile)
  - privacy toggle
  - collapse
  - profile menu → Personal Info / Preferences / Logout
- **MobileNavbar:** tabs, "More" sheet with groups (Planning, Management, Configuration, App)
- **CommandCenter:** search pages and accounts; actions: toggle privacy, dark/light theme
- **NotificationCenter:** open, Clear All, item click, Dismiss, Pay / Record
- **KeyboardShortcutsModal:** list of shortcuts
- **OnboardingModal:** currency, account type/currency, payment account, income/expense, category; Back / Get Started / Skip / Next / Finish

---

## 5. QA chunks

| Chunk | Workflows | Pages | Main risk areas |
|---|---|---|---|
| **A. Auth, session & persistence** | W1–W10 (10) | Sign In, Sign Up, Personal Info, Onboarding, global | Rate limits, 409 conflict path, keepalive save on logout, demo mode isolation, missing password reset |
| **B. Accounts & open banking** | W11–W15 (5) | Accounts, AccountDetail (9 type views), Integrations, EnableBankingCallback | OAuth redirect round-trip, pending-connection recovery, account linking, paged sync, asset closure/revert |
| **C. Transactions & categorization** | W16–W23 (8) | Transactions, Dashboard matcher, Categories, Tags, Rules, Merchants | Split/combine integrity, bulk ops, rule apply/revert batches, merchant overrides, filters/export |
| **D. Planning & scheduling** | W24–W28 (5) | Budget, Forecasting, Schedule, Subscriptions, NotificationCenter | Recurrence overrides, synthetic loan/card items, bill paid → transaction, forecast math, goal projections |
| **E. Investments & insights** | W29–W33 (5) | Investments, HoldingDetail, Reports, Challenges | Cost basis/valuation, warrants, price fetch (Twelve Data / smart-fetch), price history, localStorage-only sprints |
| **F. Productivity, settings & data** | W34–W40 (7) | Invoices, Tasks, Preferences, Data Management, Dashboard layout, Documentation, global nav | Import wizard, restore merge, reset-all, preference side effects (currency/date/privacy), shortcuts |

---

## 6. Flags: dead, unreachable, duplicated, suspicious

### Dead or unreachable
1. **`pages/Warrants.tsx`** (225 lines) is never imported or routed. The Warrants feature now lives in Investments/HoldingDetail (see commit `2073eda`).
2. **"Forgot password?"** (`SignIn.tsx:72`) has no handler. No reset endpoint exists, so **there is no password-reset workflow**.
3. **Invoices pagination** (`Invoices.tsx:352-357`): both buttons are hard-coded `disabled` with no handlers.
4. **`POST /api/ai/proxy`** (`server.ts:36`) has no frontend caller. It exists only in the dev server.
5. **Unimported components and utilities** (no import found anywhere):
   - `components/ActivityRings.tsx`, `BalanceCard.tsx`, `CashFlowCard.tsx`, `MetricCard.tsx`, `StatCard.tsx`
   - `components/ui/HeroHeader.tsx`, `components/ui/card.tsx`
   - `components/base/avatar/base-components/index.tsx`
   - `utils/backup.ts`, `utils/dateFormat.ts`
6. **Superseded matchers:** `TransactionMatcherCard/Modal` and `SyncedBillMatcherCard/Modal` aren't imported. They were replaced by `UnifiedPendingMatcherCard`/`UnifiedPendingMatchesModal` (commit `552f5c6`).
7. **Stale build output in `server/dist/`**: `dbNorm.js`, `patch.js`, `urlValidator.js`, and their `.test.js` files have no source in `server/src`. Notably, `dist/urlValidator.js` contains an SSRF guard (`isAllowedTargetUrl`, which blocks localhost, private, and metadata IPs). Its source is gone and the current `smartFetcher.ts` doesn't use it (see Security #1).
8. `renderPage` has `default: <div>Page not found</div>` (`App.tsx:2788`), but it's effectively unreachable because `parseRoute` maps unknown paths to Dashboard.
9. The `is_2fa_enabled` DB column and the `is2FAEnabled` field exist, but there is no 2FA UI or endpoint.
10. The `role` field is stored and displayed (Sidebar, Settings, Personal Info) but never enforced. There are no admin features.

### Duplicated
1. `pageRegistry` gives AccountDetail the path `/accounts` and HoldingDetail `/investments`, the same as their list pages. This only works because of the regexes in `parseRoute` and the `.find` order.
2. Goal management (`GoalScenarioModal`, `FinancialGoalCard`, `GoalContributionPlan`) and forecast day/recurrence modals are wired separately in **both** Dashboard and Forecasting.
3. `handleDeploySmartSuggestion` and the smart-suggestion UI are implemented in both Merchants (`:702`) and Rules (`:2362`).
4. The "Sync Connected Banks" button and handler are repeated in Dashboard, Accounts, and Transactions headers.
5. Header buttons are rendered twice, apparently for mobile and desktop layouts: Merchants `:584/:630` and `:591/:637`, Subscriptions `:478/:891` and `:486/:741`, HoldingDetail chart toggle `:350/:383`.
6. `accountOrder`/`taskOrder` are persisted **both** in localStorage (`App.tsx:524-525`) and in the server `FinancialData` blob.
7. Two card components: `components/Card.tsx` (used) and `components/ui/card.tsx` (unused).

### State that never reaches the server
1. Savings sprints (`crystal_active_sprints`), ignored subscriptions (`ignored-subscriptions`), the Carto API key, Accounts view settings, and the onboarding-complete flag are all **localStorage only**. They are lost on another device or browser.

### Security / behavior (worth a QA pass)
1. **`GET /api/smart-fetch` has no auth.** It fetches any http(s) URL server-side, and forwards caller-supplied cookies. That is an open SSRF proxy on the production backend. A private-IP guard used to exist (`server/dist/urlValidator.js`), but it isn't in the current source.
2. **`POST /api/ai/proxy` has no auth.** It forwards arbitrary endpoint/method/headers (dev server only).
3. **The dev mock backend** (`server.ts`, used when `VITE_BACKEND_URL` is unset):
   - login accepts any password and auto-creates users
   - `/data` falls back to user id 1 when there is no session
   - with only one user, `getSessionUser` returns that user to anyone
   - change-password always succeeds
   - Enable Banking is stubbed

   Don't treat QA results against `npm run dev` without a backend as representative of production.
4. "Reset all data" is client-side: it runs `loadAllFinancialData(empty)` plus an `alert`, and the empty state is then persisted by the next autosave via `allowEmpty`. This needs explicit verification that the server copy is cleared.

---

## 7. Counts

| Item | Count |
|---|---|
| Page files in `pages/` | 28 |
| Reachable pages/screens | **27**: 25 routed `Page` ids, plus Sign In and Sign Up |
| Dead page files | 1 (`Warrants.tsx`) |
| URL routes | 25 (23 static + 2 dynamic: `/accounts/:id`, `/investments/:symbol`) |
| Production API endpoints (`server/src`) | **21** handlers (22 paths, since `/health` and `/api/health` share one) |
| Dev-server-only endpoints (`server.ts`) | 4 (`/sw.js`, `/api/ai/proxy`, `/api/*` proxy/mock, SPA fallback) |
| Endpoints with no frontend caller | 2 (`GET /api` liveness and `POST /api/ai/proxy`) |
| User workflows | **40** (W1–W40; W5 password reset is documented as **missing**) |
| QA chunks | 6 |
