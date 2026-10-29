# Review & change plan: AccountsNew, AccountDetailNew, BudgetNew

Reviewed 2026-10-29 against `UI_UX_DESIGN_REFERENCE.md` (§1–§20, decision priority §20 > §19 > §11 > §10 > §7), `DESIGN.md`, `CLAUDE.md` and `docs/ACCOUNTS_NEW_REDESIGN_PLAN.md`. Analysis only: no code was changed and nothing was run (lint and tests not executed).

Scope:
- Accounts: `pages/new/AccountsNew.tsx`, `pages/new/AccountDetailNew.tsx`, `components/new/accounts/**`, `hooks/useAccountsData.ts`, `hooks/useAccountDetailData.ts`, `utils/accountsModel.ts`, `utils/accountDetailModel.ts`.
- Budget: `pages/new/BudgetNew.tsx`, `components/new/budget/**`, `hooks/useBudgetData.ts`, `utils/budgetModel.ts`.

Severity: **P0** wrong number or data loss · **P1** breaks a recorded design decision or a feature promise · **P2** polish, copy, performance.

---

## 1. Verdict

- **Structure is right.** Both pages follow the §5.0 method: `*New` files, logic in `utils/*Model.ts` + `hooks/use*Data.ts`, header tabs/search/action/controls through `shellContext`, Vaul sheets, Undo toasts, Hold-to-delete. The Budget model is small, pure and readable.
- **The Accounts numbers don't reconcile.** The hero, the KPI tiles, the group subtotals, the split-sheet footer and the detail chart each compute balances with different rules (future-dated transactions in or out, loan interest in or out, clamped or signed, two different FX tables, EUR vs native). A user will see three different "total assets" on one screen. This is the most important fix.
- **The design drifted from the reference in the same ways on every page.** Title Case labels and helper paragraphs, several violet CTAs per screen, accent-filled chips and tiles (R9), white bordered cards on the white page (R2), 10–11 px informational text and 28–36 px tap targets (D14), hand-rolled menus. Most of it is mechanical to fix.
- **Docs are behind the code.** There are no §12-style migration notes for Accounts or Budget (D13), several claims in `ACCOUNTS_NEW_REDESIGN_PLAN.md` are not implemented (BUG-11, detail-page tabs, quick switcher, payment-plan tab, attention rules), and §20 contradicts itself in places.

---

## 2. Cross-cutting issues (both pages)

| # | Sev | Issue | Where | Fix |
|---|---|---|---|---|
| X1 | P0 | Two FX tables in one figure. `calculateAccountTotals` converts with the global `dynamicRates` (`convertToEur` without rates); everything else uses `preferences.conversionRates`. The hero then converts EUR→display with the *other* table. Budget uses `dynamicRates` only. | `accountsModel.ts:469-477`, `utils.ts:466-560`, `useBudgetData.ts:28` | One `rates` source threaded through every model call (decide which, see Q1). `calculateAccountTotals` takes `rates`. |
| X2 | P0 | Money math with raw floats in the New models (`reduce((s, x) => s + …)`, `targetBalance - account.balance`, budget `spend.set(... + ...)`), against CLAUDE.md's safe-math rule. | `accountsModel.ts:53-62, 190-205, 491, 570`, `budgetModel.ts:109, 194-201`, `useAccountsData.ts:247`, `useAccountDetailData.ts:349` | Use `safeAdd`/`safeSubtract`/`round2` in models; round only at the edge. |
| X3 | P1 | Copy: Title Case labels ("Daily Safe Spend", "Open Full Cockpit", "Sync Banks", "Bento Grid", "Capital & Debt Allocation") and helper paragraphs ("Click any card to open its cockpit, or flip…", "Use your actual 1 to 12 month…"). §10.1: sentence case, no helper paragraphs. | all page and part files | Copy pass: sentence case, drop helper lines, keep labels ≤ 3 words. |
| X4 | P1 | More than one violet CTA per screen (R7, N4). The header action is the one CTA, yet bodies add `variant="cta"`: Budget "Add budget", Accounts empty state "Add Account", detail hero "Record Activity" (same action as the header's "Record activity"), archetype buttons. | `BudgetNew.tsx:437`, `AccountsNew.tsx:492`, `detailHero.tsx:105`, `views/*` (≈ 6 on a detail screen) | Body buttons become `primary` (ink) or `secondary`; empty states use ink (N4). Sheets keep their own CTA (one per sheet). |
| X5 | P1 | Accent-filled surfaces (R9): violet-soft recommendations pill, red/orange-soft attention chips with borders, filled red/orange utilization pill, accent-tinted header tabs, violet ring on selected tiles. | `BudgetNew.tsx:273`, `overview.tsx:447-449, 491-497, 670-677`, `AccountsNew.tsx:222-225` | Accents only on icons, badges (outline + icon, Q5/D12), charts and text. Selected = ink outline/fill (R7, R9). |
| X6 | P1 | Surfaces (R2): white `Card tone="surface"` blocks and `border border-nv-line` inner tiles on the white page; `shadow-xs/sm/2xs` on tiles. R2: grey tile on white page, white sub-card inside, no hairlines, no shadows. | `BudgetNew.tsx:428, 545, 582, 829, 847`, `budget/sheets.tsx` (5), `accounts/sheets.tsx` (20 borders, 7 shadows), `overview.tsx:448, 521-526` | Default `Card` (grey tile); white only as the split `top` or a sub-card; remove borders/shadows on tiles. D7: no nested elevated cards in sheets, use inset panels. |
| X7 | P1 | Type floor and targets (D14): ~130 uses of `text-[10px]/[11px]` on informational text ("acct", "Subtotal", "IBAN / Account Number", "Avg:", "Has budget"); 28–36 px buttons (copy IBAN `h-7`, presets `h-8`, row menu `h-9`, unbudgeted "+ Budget" `h-8`). | counts per file in §8 | 12 px minimum for information (11 px chips/counters only); every control ≥ 44 px hit area. Add both to `tests/unit/new-tokens.test.ts` so they stay fixed. |
| X8 | P1 | Privacy and formatting (§5.4, §10.1): amounts printed outside `Money` bypass privacy blur and currency formatting: toasts `€${draft.amount}`, "Current: €120", "Currently: €…"; a local `currencySign()` duplicates `formatCurrency`; dates shown raw (`Target: 2026-12-31`, "Statement Day: 1"). | `budget/sheets.tsx:23-46, 118-123, 424, 463, 542`, `BudgetNew.tsx:879, 965`, `overview.tsx:741-742` | Amounts through `Money`/`formatCurrency` only (toasts: respect privacy mode); dates through `utils/dateFormat.ts`; delete `currencySign`. |
| X9 | P1 | Charts: `curveNatural` (§20.4) overshoots on step-like balance data, drawing dips and peaks that never happened; the hero and detail charts also stack a dotted background + gradient TrendLine + Area for one series. | `overview.tsx:125-143`, `detailHero.tsx:248-266`, `YieldPotArchetype.tsx` | Decide Q4 (amend §20.4 to `curveMonotoneX` for money series). Drop the decorative TrendLine/dots on single-series balance charts. |
| X10 | P2 | Memo churn: `useBudgetData()` returns a new object every render and pages memo on `[data, …]`, so every memo recomputes every render; Accounts `heroModel` re-runs per-account 90-day walks (already done for `sparklinesById`) on any transaction change. | `BudgetNew.tsx:139-147`, `budget/sheets.tsx:80-84, 298-319`, `useAccountsData.ts:101-122`, `AccountsNew.tsx:188-206` | Memo on the specific fields; compute per-account series once and feed the hero from them. |
| X11 | P1 | D13 migration notes are missing for Accounts and Budget (Kept / Moved / Dropped / Where the logic lives / KokonutUI check / Keyboard route / Verified / Not verified). §9 names the file `BudgetingNew.tsx`; the code uses `BudgetNew.tsx`. | `UI_UX_DESIGN_REFERENCE.md` | Add §21 Accounts and §22 Budget notes after the fixes; record every dropped feature. |

---

## 3. Accounts list (`/accounts-new`): design vs reference

| # | Sev | Finding | Change |
|---|---|---|---|
| A1 | P1 | **Hero shows one figure set but filters another.** "Total assets" selects *All*; "Total liabilities" selects *Loans & debt* (credit cards live in *Cash & cards*); "Liquid cash" includes Savings but selects *Cash & cards*, which excludes Savings and includes credit cards. | Make tile → segment mapping exact, or make the tiles non-interactive. Align segment definitions with the KPI definitions (see L-A5). |
| A2 | P1 | **One allocation bar mixes assets and debts** into a single 100 %, so "Credit cards 4 %" is a share of assets *plus* debts. Widths use `Math.max(3, pct)` and can exceed 100 %. | Two bars (assets / liabilities) or a single assets bar with debt as a contrasting overlay; exact widths, minimum width only visual via gap. |
| A3 | P1 | **Hero density** (§2.2 "one hero figure, ≤ 4 KPIs"): net worth + 90d badge + solvency badge + 90d change + 3 spark KPIs + 90d chart + 5 allocation buttons + attention chips. "Solvency %" (assets / (assets + debts)) is nonstandard jargon. | Keep: net worth, 90d change, 3 KPIs, chart. Move allocation to the chart's mode switch (the plan's Trajectory / Allocation / Attention). Replace "Solvency" with "Debt-to-assets" or drop it. |
| A4 | P1 | **Tabs auto-change the layout**: picking a segment forces *List*, *All* forces *Split*, overriding the user's choice; the hero's segment clicks don't do the same. | Layout is the user's; remember it per device (localStorage, try/catch). |
| A5 | P1 | **Header controls overload** (N5): Sort, Currency, Institution, Bank synced, Analytics included, Reset, and a 3-way layout switch. | Sort + one Filters pill (Currency, Institution, Synced, Analytics as a `FilterList` like Transactions N10) + active chips with ×. |
| A6 | P1 | **Sync** is a secondary "Sync Banks" button; N7 says a green `variant="success"` button reading "Sync" / "Syncing". | Follow N7. Export stays a secondary tool (N6). |
| A7 | P1 | **Context menu is hand-rolled** (`AccountsNew.tsx:581-731`): no `role="menu"`, no focus trap or arrow keys, 32 px rows, 10 px text, fixed 240/380 px clamps. The row already has a Base UI `Menu` (`parts.tsx:114`). | Delete the custom menu; right-click opens the same Base UI menu at the pointer. |
| A8 | P1 | **Nested interactive elements**: the row is `div role="button"` containing the menu button and peek button; Space opens the detail page (plan: Space = quick peek). | Row = link/button only for navigation; actions in a sibling cell. Enter = open, Space = peek (as planned), menu trigger ≥ 44 px. |
| A9 | P1 | **Wallet rail**: `nv-teal-soft` / `nv-teal-text` don't exist, so the Voucher badge renders unstyled; teal is outside D1's accent set. Back side shows invented defaults ("Statement Day: 1", "Due Day: 15") when unset; "Available balance" shows the book balance incl. future items; 28 px copy button; long helper subtitle. | Voucher = neutral badge with icon (or decide a D1 accent, Q6); hide unset fields; label "Balance"; 44 px copy; no subtitle. Plan §3.2 asked for a collapse toggle: add it or record the drop. |
| A10 | P2 | **List caps** (D11): no "Show all N" on long groups; Bento and List repeat the same group header markup twice in the page. | Extract one `AccountGroupHeader`; cap groups > 8 with `MoreButton`. |
| A11 | P2 | Sort label "90d Momentum" maps to `change30d`. | Rename the value to `change90d`, label "Change (90 days)". |

## 4. Account detail (`/accounts-new/:id`): design vs reference and vs its own plan

| # | Sev | Finding | Change |
|---|---|---|---|
| D1 | P0 | **History chart shows EUR values labelled in the account's currency.** `computeAccount90dSparkline` returns EUR (`accountsModel.ts:153, 169-180`); `detailHero.tsx:57, 246` plots it with `currency={account.currency}`. A USD account's chart reads €-values as $, and toggling to *Forecast* (native) jumps. | Sparkline model returns native values (and a separate display-currency series where needed). |
| D2 | P1 | **Plan §4 not implemented**: no page tabs per archetype, no page search, no quick account switcher, no *Payment plan* tab; the page stacks hero → archetype → ledger, which is the "endless vertical scroll" the plan set out to remove. | Either build the tabs (`usePageTabs`: Overview · Plan/Valuations · Details) and the switcher, or record the drop in the notes. Recommendation: build tabs; the switcher can wait. |
| D3 | P1 | **Duplicated chrome**: an in-body "All Accounts" back pill and `h1` repeat the top bar (D9); Reconcile / Edit / Sync / Appraise sit in the hero instead of `HeaderTools` (N6); header action is always "Record activity → expense" even for a property (valuation) or loan (payment). | Tools to `HeaderTools`; per-archetype header action (plan §4 Action row); drop the in-body back pill on desktop (keep on phone if no header back). |
| D4 | P1 | Leased vehicle headline shows the monthly lease payment as the hero figure under "Current market valuation"-style layout, while the account balance still counts in net worth. | Decide Q5. |
| D5 | P2 | `AccountFormSheet` takes `onDelete` but never uses it, so there is no delete on the detail page. | Add Hold-to-delete in the form's footer (D5) or remove the prop. |
| D6 | P2 | "Insufficient history points for chart" / "Settled today (excluding future scheduled entries)" helper copy. | Short labels: "Not enough history", "Today: €x". |

---

## 5. Accounts logic audit (function by function)

### `utils/accountsModel.ts`

| # | Sev | Function | Finding | Fix |
|---|---|---|---|---|
| L-A1 | P0 | `computeAccountDisplayBalance` (`:38-85`) and `calculateAccountTotals` | Loan/lending balance = outstanding principal **+ all future scheduled interest**. Liabilities and net worth are overstated by the interest not yet accrued; property equity (`computePropertyAccountMetrics`) uses principal only, so the two pages disagree. | Balance = outstanding principal (+ accrued interest to today, optional). Show future interest as its own figure on the loan page. Shared helper used by both pages; mind classic parity (Q2). |
| L-A2 | P0 | Hero model (`computeAccountsHeroModel`) | Figures use different bases on one card: `totalAssets/Liabilities/netWorth` include future-dated transactions (raw `acc.balance`); `liquidCash` and every trend exclude them; trend end-point ≠ headline, so "90d change" doesn't reconcile with the number above it. | Compute every figure from one per-account "today" balance map (native → display), then derive totals, trends and buckets from it. |
| L-A3 | P0 | `computePortfolio90dTrends` (`:262-271`) | Assets add `Math.max(0, value)` (an overdrawn checking account vanishes) and liabilities add `Math.abs(value)` (a card in credit counts as debt), while net worth adds signed values, so assets − liabilities ≠ net worth. Same in `sumBucketEur` (`:570-577`) and `groupAccountsByType` subtotals (`:1014-1021`). | Signed classification: asset accounts contribute signed to assets, debt accounts contribute `-balance` to liabilities (credit surplus reduces debt), exactly as `calculateAccountTotals` does. |
| L-A4 | P0 | `computeAccount90dSparkline` (`:107-215`) | Values in EUR (see D1). For loans it walks back from the amortised balance by subtracting payment transactions (principal + interest), so the loan curve is wrong. Property/vehicle uses the last appraisal for "today" instead of `account.balance`, and `purchasePrice` for days before the purchase date. | Native currency; loans from the amortisation schedule by date; assets: `balance` today, step valuations before, nothing before purchase/opening date. |
| L-A5 | P1 | Segments, buckets and "liquid" | Three definitions of "cash": `LIQUID_ACCOUNT_TYPES` (checking + savings + **credit card**), the *cash* bucket (checking + physical cash), the *Cash & cards* tab (checking + cards + cash). "Property & physical" bucket and tab include **Lending** (a receivable). Group "Investments" only ever holds pension / spare change. `liquidCash` sums card debt signed but its trend clamps it out. | One definition table in the model (`LIQUID`, `RESERVES`, `PHYSICAL`, `RECEIVABLES`, `CARDS`, `LOANS`), reused by tabs, buckets, KPIs and groups. Rename "Investments" group to "Pension & round-ups". |
| L-A6 | P1 | `computeCashSegmentNetFlow` (`:317-341`) | Window is today − 30 days **inclusive** (31 days); excludes all transfers but includes balance adjustments, while the burn figure next to it excludes adjustments. | 30 days = today − 29; same exclusion set for both figures. |
| L-A7 | P1 | Attention items (`:642-710`) | Only 4 of the plan's rules; savings rule compares raw `acc.balance > 1000` in any currency (1,000 BTC or 1,000 RON alike); loan overdue ignores Lending; no "statement due in 7 days", "safe-to-spend < 0 in 14 days", or Enable Banking consent-expiry rules (plan §3.1). | Convert before thresholds; add the planned rules or record them as dropped. |
| L-A8 | P2 | `filterAndSortAccounts` (`:1052-1140`) | `change30d` sorts by the 90-day EUR trend; `apy_apr` ranks a loan's APR above a savings APY in one list. | Rename (A11); sort by APY within assets and APR within debts, or split. |
| L-A9 | P2 | `isMealVoucherAccount` (`:745-790`) | Name/institution substring heuristics ("sodexo" anywhere) decide grouping and wallet priority; no user override. | Prefer an explicit `otherSubType: 'Meal Voucher'`; keep the heuristic only as a suggestion in the form. |

### `utils/accountDetailModel.ts`

| # | Sev | Function | Finding | Fix |
|---|---|---|---|---|
| L-D1 | P0 | `computeOperatingAccountMetrics` (`:1198-1224`) | The 14-day obligations loop handles `monthly/weekly/daily/yearly` but **not `biweekly`** (a valid `RecurrenceFrequency`): `nextDue` never advances, so the same payment is added up to 60 times and *Safe to spend* drops by 60× that amount. `setMonth` also overflows month-ends (31 Jan → 3 Mar); weekend adjustment, end dates and skip overrides are ignored; bills aren't converted to the account currency (`:1230`). | Reuse the app's recurrence expander (the one `generateBalanceForecast` uses), with overrides; convert bills. Add a biweekly unit test. |
| L-D2 | P0 | `computeVehicleAccountMetrics` (`:749-806`) | BUG-11 is marked fixed but isn't: `currentMileage` is 0 when there are no logs (ignores `account.currentMileage`), and with no log on or before the lease start the baseline odometer is 0, so a used car leased at 40,000 km is "Over budget" by 40,000. The ±1,000 km band is hard-coded. | Fall back to `currentMileage`; baseline = log at/after start, or a lease-start odometer field; band as a share of allowance. Tests. |
| L-D3 | P0 | `computeVehicleTcoMetrics` (`:1586-1649`) | Only counts expenses **booked on the vehicle account itself**, which is rare (fuel is paid from checking), so TCO is ~0. The fuel regex `/…|ev/` matches "Revolut", "levy", "event"; `/gas/` matches "Las Vegas"; `/tax/` matches "taxi". With one mileage log, distance = the whole odometer (prior owners' km). Depreciation is lifetime while spend covers only the logged period. | Source costs by category (and/or a tag or `linkedVehicleId`) across accounts; word-boundary matching on category names, not free text; distance from the first log; same window for every term. |
| L-D4 | P1 | Compounding (`computeCompoundingProjection :1355`, pension `:951`, savings accrual `:363`) | APY is treated as a nominal rate (`apy / 12` compounded monthly), which overstates growth (5 % APY → 5.12 % effective). Pension projection silently uses **5 %** when no APY is set and retirement defaults to **now + 20 years**. | Monthly rate = (1 + APY)^(1/12) − 1. No invented defaults: show "Set an expected return / retirement year" instead. |
| L-D5 | P1 | `computePensionAccountMetrics` (`:893-905`) | "CAGR" treats all contributions as if made on day one; for a pension funded monthly this understates the return badly. | Money-weighted return (XIRR on dated contributions); label it so. |
| L-D6 | P1 | `computeSavingsAccountMetrics` (`:374-396`) | "Interest YTD" adds recorded payouts in months that have one and **estimates** in months that don't; a bank paying quarterly gets estimate + real payout for the same period. Past estimated months are flagged `isProjected`. | Either recorded only, or estimate only for periods after the last recorded payout; label estimates "Estimated". |
| L-D7 | P1 | `computeCreditCardAccountMetrics` (`:476-526`) | Calls `calculateStatementPeriods` twice; "payments" are recognised by category text containing "payment"/"transfer"; the 6-month chart uses calendar months although the plan calls it statement spend. | Payments = transfers in (or a flag); chart by statement cycle; one period computation. |
| L-D8 | P1 | `resolveRealTodayBalance` number overload (`:86-119`) | With a number + currency it does not filter by account, so a caller that passes all transactions subtracts other accounts' future items. Applied to amortised loan balances, it also subtracts future payments that the schedule already excludes. | Require `accountId` in both overloads; skip for loan/lending. |
| L-D9 | P2 | `solveLoanParameter` (`:1764-1786`) | Duration uses `Math.round` (rounding down leaves an unpaid remainder; use `ceil`); rate returns **0** when `M·n < P`, which is an impossible loan (should be `null` + message). | As stated, with tests. |
| L-D10 | P2 | `simulateExtraLoanPayment` (`:1469-1527`) | Extra payment is applied to overdue periods too; months saved counts rows with a payment, which breaks if the schedule keeps zero rows mid-way (deferrals). | Apply from the next upcoming period; compute months from payoff dates. |
| L-D11 | P2 | `computePropertyHoldingCashflow` (`:1532-1581`) | Property tax assumed yearly with no frequency; mortgage cost excluded from "net cashflow" without saying so. | Frequency field or label "before mortgage". |
| L-D12 | P2 | `isRoundUpCapture` (`:1002-1010`) | Any income ≤ 10 units counts as a round-up (a €10 gift does). | Rely on the `spare-<id>` convention (N8) / flag first; amount rule only as fallback below 1 unit of the source's rule. |

### Hooks

| # | Sev | Function | Finding | Fix |
|---|---|---|---|---|
| L-H1 | P0 | `adjustBalance` (`useAccountsData.ts:239-277`, `useAccountDetailData.ts:346-376`) | Delta = target − `account.balance` (includes future-dated items; for loans, unrelated to the amortised figure shown), and a back-dated reconciliation is still computed against *today's* balance. | Delta against the balance **as of the chosen date** (same helper as L-A2); disable for amortised loans (use overrides instead). |
| L-H2 | P1 | `recordCardStatementPayment` (`useAccountDetailData.ts:406-462`) | If `fromAccountId` is set but the account isn't found, the card leg keeps a `transferId` with no partner (orphan transfer). | Fail early when the source account is missing. |
| L-H3 | P1 | `addMileageLogs` (`:516-545`) | Batch import overwrites an existing log on the same date silently and skips `validateMileageReading`. | Validate each entry against the merged list; report conflicts in the sheet. |
| L-H4 | P2 | Undo by snapshot (`updateAccount`, valuations, mileage) | Undo restores the whole account snapshot, wiping any later edit made before the toast expires. | Undo applies an inverse patch of only the changed fields. |
| L-H5 | P2 | `defaultSortBy` cast (`useAccountsData.ts:365`) | `preferences.defaultAccountOrder` is cast to the New sort union without mapping. | Map classic values explicitly. |
| L-H6 | Note | Shared `utils.ts` amortisation changes (BUG-08/09) landed in the New-UI commit and change **classic** numbers too. | `f0b73da` | Check classic AccountDetail loan pages once; mention it in the notes. |

---

## 6. Budget (`/budget-new`): design vs reference

| # | Sev | Finding | Change |
|---|---|---|---|
| B1 | P1 | **Hero label is wrong**: "Total spending this month" shows only spend in budgeted categories, and says "this month" for any selected month. | "Spent in budgets · {Month}"; optionally show total spend in the meta line (§1.2 rule 3: "€1,847 of €3,500 · 53 % · 8 days left"). |
| B2 | P1 | **Repetition** (§2.2 density): unbudgeted spend appears 4× (header chip, "Outside budget" cell, "Spending without a budget" card, sheet); recommendations 2× (header chip + rail card); auto-fill 3× (header tool, rail card, empty state). | One place each: unbudgeted = the figure cell (opens sheet); recommendations = header chip; auto-fill = header tool + empty state. Drop the two rail callout cards. |
| B3 | P1 | **CTAs and chips**: second violet "Add budget" in the list header (N4); violet-filled recommendations pill (R9); "needs review" chip only renders when `near > 0` though it counts `near + ahead` (`BudgetNew.tsx:260`); FilterChips lack × when active (R8). | Remove body CTA; neutral chip with icon; condition on `near + ahead`; × on active chips. |
| B4 | P1 | **Goals tab**: month navigation still shows (goals aren't monthly); progress bars cycle violet/green/sky by index (D2: accents carry meaning, never decoration); no projection status (`goal.projection.status`), raw ISO dates; totals mix completed goals into "Monthly contributions". Read-only (no create/edit) with no recorded decision. | Hide MonthNav on Goals; one accent by status (green on track / done, orange at risk, red off track) with a status badge; formatted dates; contributions of active goals only. Record "goal editing stays in Forecasting" (or build it, Q7). |
| B5 | P1 | **Surfaces** (R2/X6): list, allocation and goal cards are white bordered cards on a white page; inner tiles have borders. | Grey tiles, white sub-cards only for the split hero `top`. |
| B6 | P2 | "Budget health: 3 / 5" next to "All within limit" (near / ahead lines are neither ok nor over). | Show "N on track"; note lists over / near counts. |
| B7 | P2 | `RingGauge` takes `elapsedPct` but ignores it; `GoalRings` is exported and unused. | Show the pace marker on the ring, or drop the prop; delete dead code. |
| B8 | P2 | Allocation donut duplicates the list's information (limits by category) and takes the rail's top slot. | Consider replacing it with "Spent by category vs limit" or move below the list on desktop. |

## 7. Budget logic audit

| # | Sev | Function | Finding | Fix |
|---|---|---|---|---|
| L-B1 | P0 | `BudgetSheet.handleDelete` + `App.handleDeleteBudget` | Delete shows **two** Undo toasts (the sheet's and the App handler's, which `useBudgetData` documents). Clicking both restores twice → duplicate budgets (one with a new id). | Pick one: the hook's `remove` returns an undo and suppresses the App toast while the New shell is mounted, or the sheet stops toasting. |
| L-B2 | P0 | `BudgetSheet.handleSave` (`sheets.tsx:107-113`) | Editing saves with `currency: displayCurrency` but shows `editingBudget.amount` in its **original** currency: a 100 USD budget becomes 100 EUR on any edit. | Edit in the budget's own currency (show the converted figure as a hint) or convert on load. |
| L-B3 | P0 | `parseAmount` (`budgetModel.ts:268-274`) | "1.250,50" → 1.2505 and "1.250" → 1.25 (European grouping). | Locale-aware parse (decimal separator from preferences/`Intl`), tests for both styles. |
| L-B4 | P1 | `projectedSpend` (`:73-74`) | Linear extrapolation: rent paid on the 1st projects to 30× rent on day 1. | Project fixed/recurring items from the schedule and extrapolate only variable spend; hide the forecast before day ~5. |
| L-B5 | P1 | `spendByCategory` (`:95-112`) | Refunds (income in an expense category) are not netted, so returns inflate spending; budgets match category **names**, so renaming a category orphans its budget. | Net refunds per category; migrate budgets on category rename (or key by id, Q8). |
| L-B6 | P1 | `useBudgetData.autofill` (`:58-63`) + `AutofillSheet` | Undo only restores changed budgets and **leaves the newly created ones**; the sheet doesn't show the Undo at all; preview rounds with `friendlyAmount` but the plan writes `Math.round(avg)`, so applied amounts differ from the preview; it overwrites every existing budget without a toggle. | One plan function feeds preview and apply; undo removes created ones too; Undo toast; "Keep existing limits" switch (default on). |
| L-B7 | P1 | `SuggestionsSheet` apply / apply all | No Undo (D6). Fixed "3 months" window; ignores `defaultQuickCreatePeriod`. | Undo toast; window from preferences or a pill. |
| L-B8 | P1 | `UnbudgetedSheet.onAddBudget` (`BudgetNew.tsx:1017`) | The suggested amount is passed and ignored. | Pre-fill the sheet's amount. |
| L-B9 | P2 | `averageMonthlySpend` (`:115-128`) | Divides by N months even when history is shorter (new users get understated averages). | Divide by months that have data (from first transaction date). |
| L-B10 | P2 | Preset buttons labelled "+50…+1000" set the value instead of adding. | Label "50" or make them add. |
| L-B11 | P2 | `BUDGET_ACCOUNT_TYPES` excludes physical-cash wallets (`Other Assets / Cash`). | Classic parity; decide Q9. |
| L-B12 | P2 | `today` memoised once (`BudgetNew.tsx:82`): a tab left open across midnight keeps yesterday's pace. | Refresh on visibility change. |

---

## 8. Design-rule counts per file (for the mechanical pass)

`sub12` = `text-[9–11px]`; `cta` = `variant="cta"`; `px` = any arbitrary `text-[Npx]`.

| File | sub12 | cta | px | shadows | hairline tiles |
|---|---|---|---|---|---|
| `components/new/accounts/sheets.tsx` | 53 | 5 | 53 | 7 | 20 |
| `components/new/accounts/overview.tsx` | 15 | 0 | 15 | 2 | 2 |
| `components/new/accounts/parts.tsx` | 13 | 0 | 14 | 0 | 1 |
| `components/new/accounts/views/*` | 19 | 5 | 19 | 0 | 10 |
| `components/new/accounts/AccountFormSheet.tsx` | 3 | 1 | 10 | 0 | 4 |
| `components/new/accounts/detailShared.tsx` | 1 | 2 | 1 | 0 | 5 |
| `pages/new/AccountsNew.tsx` | 4 | 1 | 4 | 2 | 1 |
| `pages/new/BudgetNew.tsx` | 6 | 1 | 28 | 0 | 5 |
| `components/new/budget/sheets.tsx` | 5 | 3 | 25 | 0 | 5 |
| `components/new/budget/parts.tsx` | 2 | 0 | 11 | 0 | 1 |

---

## 9. Change plan

Each phase ends with `npm run lint`, the unit tests (`npx tsx tests/unit/<name>.test.ts`, check for ✕), and a browser check at 375 / 768 / 1024 / 1440 in light and dark on demo data (D13). One commit per phase on a new branch.

### Phase 1: Correct numbers (P0, logic only, no visual change)
1. **One balance service** in `utils/accountsModel.ts`: `resolveAccountBalances(accounts, txs, overrides, rates, today)` → per account `{ native, today, display }` with the loan rule from L-A1. Hero totals, trends, buckets, group subtotals, split footer, wallet and detail hero all read it (L-A2, L-A3, L-A5, X1).
2. Sparklines in native currency; loans from the schedule; asset valuation steps (D1, L-A4).
3. Recurrence: reuse the shared expander for 14-day obligations, incl. biweekly and overrides (L-D1).
4. Vehicle mileage baseline and fallback; TCO sourcing and matching (L-D2, L-D3).
5. Balance adjustment as-of-date (L-H1).
6. Budget: single delete Undo, currency-safe edit, locale-aware `parseAmount` (L-B1–L-B3).
7. Safe-math pass in the three models (X2).
8. **Tests**: one ✕-checked case per finding above (biweekly, USD sparkline, overdrawn checking, card in credit, loan interest, used-car lease, TCO regex, EU amounts, double delete, currency edit). Add tests for BUG-06/07, which have none today.

Done when: hero net worth = Σ group subtotals = split footer, and the 90-day chart's last point equals the headline, on demo data and a multi-currency fixture.

**Status (2026-10-29, branch `fix/new-pages-correct-numbers`): done, not committed.** Notes from doing it:
- The balance service lives in `utils.ts` (`resolveAccountBalance`, `computeLoanBalanceBreakdown`, `classifyAccountBalanceEur`, `resolveRates`), so classic Dashboard and Accounts get the same numbers (Q3). `calculateAccountTotals` now excludes future-dated items too.
- Q1: there is no manual-rate UI today; `resolveRates` = built-in defaults overridden by `preferences.conversionRates`.
- L-D1 also affected the shared `generateBalanceForecast`: a biweekly item never advanced there either (a possible hang). Both now use `advanceRecurrenceDate`, which also stops 31 Jan → 3 Mar skipping February.
- L-D2: `account.currentMileage` does not exist; the baseline falls back to the first log inside the lease, and pace is measured from that log's date.
- L-B1: fixed by removing the sheet's toast (the app handler's Undo stays) and making that Undo idempotent.
- Tests: `tests/unit/phase1Numbers.test.ts` (17 cases). Browser: pages render without errors on demo data, net worth = assets − liabilities on the page, budget delete shows one Undo and a double click restores one budget. The currency-safe budget edit was not checked in the browser (demo budgets are all EUR).

### Phase 2: Remaining logic (P1)
L-A6, L-A7, L-D4–L-D8, L-H2, L-H3, L-B4–L-B8. Compounding helper shared by savings, pension and the estimator; XIRR for pension; projection that respects recurring items.

**Status (2026-10-29): done, not committed.** Notes from doing it:
- L-A7: added "card payment due within 7 days" and "bank connection expires within 14 days"; the "safe to spend < 0 in 14 days" rule is **dropped** from the list page (it needs every recurring item per account; the detail page already shows safe to spend).
- L-D4/L-D5: `monthlyRateFromApy` feeds savings, the estimator and the pension projection; `computeXirr` gives the pension's money-weighted return. Without a retirement year or an expected return the pension shows a "Set …" prompt instead of a projection. The estimator's editable starting rates (3 % / 6 %) stay.
- L-B4: `forecastMonthEnd` counts recurring items in budgeted categories once and extrapolates the rest; hidden before day 5.
- L-B5 + Q8: refunds net per category; budgets carry `categoryId`, and App keeps `categoryName` in step on load and on rename (classic Budget benefits too). No schema change: `budgets` is `z.any()`.
- L-B6/L-B7: one plan for preview and apply, "Keep existing limits" (on by default), Undo removes created budgets (`deleteBudget(id, { silent: true })`); recommendations get an Undo and use the quick-create period.
- Tests: `tests/unit/phase2Logic.test.ts` (13 cases; the card-due case only runs on days 1–24). Three older tests were updated for the intended changes (APY rate, refund netting, auto-fill default).
- Browser (demo data): every detail archetype and both list pages render without errors. Auto-fill, recommendations and the mileage import were not exercised in the browser: the demo has no past spending in budgeted accounts and no vehicle logs to conflict with.

### Phase 3: Reference compliance (mechanical, P1)
X3 copy, X4 CTAs, X5 accent fills, X6 surfaces, X7 type floor and targets, X8 Money/date helpers, delete `currencySign`, replace `nv-teal-*`. Extend `tests/unit/new-tokens.test.ts` with: no `text-[9|10|11px]` outside chips, no `shadow-*` in `pages/new` and `components/new`, no `variant="cta"` in `pages/new` page bodies.

**Status (2026-10-29): done, not committed.** Built on `feat/new-accounts-card-and-header` (the fork's card, header and text-size work, committed first). Notes:
- X7: informational text is 12 px+, chips and counters 11 px. Small `Button`s keep their 36 px look with a 44 px hit area (pseudo-element in `ui.tsx`); `smooth-tab`, `momentum-rail` arrows and the `card-flip` button got the same, so every New page benefits. The allocation bar's segments are now decorative; the legend buttons below do the filtering.
- X6: outlined white cards on the page are white sub-cards without outlines; panels inside sheets are inset (D7); the overview sheet's glass card graphics are inset panels. Thin row dividers inside lists are kept. `shadow-nv-float` stays on menus and popups only.
- X4/X5: body CTAs are ink; attention chips, the recommendations pill and the utilization pill are neutral with the accent on the icon; selected tiles use an ink ring; header tabs lost their accent tints; the voucher badge is a neutral `Badge` with the tag icon (Q6).
- X3: about 300 labels to sentence case (stored values such as property and asset types untouched); explanation lines under headings and long sheet descriptions removed.
- X8: the duplicate `currencySign` in `budget/sheets.tsx` is gone; toasts use `formatCurrency` (privacy-masked); displayed dates use the new `formatShortDate`. The credit card line no longer invents a statement day 1 / due day 15.
- `tests/unit/new-tokens.test.ts` now also checks the Accounts and Budget files: type floor, 11 px only on chips, shadows, body CTAs, glass and `nv-teal`. Verified it fails on planted violations.
- Browser (demo data): Accounts, Budget, card and vehicle detail at desktop, 768 (light) and 375 (dark): no text under 11 px, no control under 44 px, no sideways scroll, no console errors.

### Phase 4: Page structure (P1)
- Accounts list: A1–A9 (hero simplification with Trajectory / Allocation / Attention modes, two-sided allocation, filters into one pill, N7 Sync, Base UI context menu, row semantics, wallet fixes, remembered layout).
- Account detail: D2–D5 (archetype tabs, header tools and per-archetype action, delete in form).
- Budget: B1–B6 (hero label and meta line, de-duplication, goals tab cleanup).
- Charts: X9 per the Q4 decision.

**Status (2026-10-29): partly done, on `feat/new-ui-mobile-header-toolbar`.** The header, filters and layouts were reworked first because the phone header was unusable (decisions N20 to N24, `UI_UX_DESIGN_REFERENCE.md` §21): one-row header, tabs and one Filters button above the list, multi-select institutions, green Sync, split sheet only, wallet removed, the same on Transactions and Budget. This covers A2 (filters in one pill), A3 and part of B2/B3 (the Budget header chips, the body Add budget button). The migration notes planned for §21 and §22 are now §21.1 (header and toolbar) and still to write for Accounts and Budget as pages. Not yet done: the hero simplification, Base UI context menu, row semantics and phone row layout (account names truncate to "Everyday …" because the balance sits beside the name), per-archetype detail tabs.

### Phase 4 (Accounts): detail workspace, decided items, list fixes

Planned 2026-10-29 after the audit of the New Accounts pages on `feat/new-ui-mobile-header-toolbar` (PR #282). Budget items B1–B6 stay for a later pass. One branch off #282; one commit per step; each step ends with `npm run lint`, the unit tests and a browser check on demo data (375 / 768 / 1440, light and dark).

**4.1 Detail page tabs and switcher (Q10, D2, N21).** Body tabs directly under the hero, per archetype, remembered per account type (localStorage, try/catch):
- Operating, card, savings, pension, round-ups: **Overview · Activity · Details**.
- Loan / Lending: **Overview · Payment plan · Activity · Details**.
- Property / Vehicle: **Overview · Valuations & logs · Activity · Details**.
- *Overview* = today's archetype view; *Activity* = the ledger; *Details* = identifiers (copyable), linked accounts and goals, lifecycle (archive, reopen, delete).
- Quick account switcher: the account name in the hero opens a menu of all accounts (grouped as on the list), Base UI `Menu`, arrow keys.
- Files: `pages/new/AccountDetailNew.tsx`, `components/new/accounts/detailHero.tsx`, new `components/new/accounts/detailTabs.tsx`; the archetype views lose the parts that move to other tabs.
- Done when each archetype shows its tabs, the hash (`#plan`, `#activity`…) opens a tab directly, and the switcher moves between accounts without the list.

*Status 4.1 (2026-10-29): done on `feat/new-account-detail-tabs`, not committed.* Tabs from `detailTabsFor` / `resolveDetailTab` (`utils/accountDetailModel.ts`, tested in `tests/unit/accountDetailTabs.test.ts`); UI in `components/new/accounts/detailTabs.tsx` (tab hook, switcher, Details tab). Payment plan only appears for loans with a schedule (the demo mortgage has none; checked by giving it one). Loan schedule, vehicle mileage log and a new valuation history moved out of Overview; the everyday account's "connected cards & goals" became the Details tab's Connections. The hero still has its back pill and buttons (4.3, D3).

**4.2 Classic parity, inside the tabs** (the four gaps from the audit):
- *Activity*: rows open the existing New transaction detail sheet (`components/new/transactions/detail.tsx`) with edit and delete (Undo toast, D6). Reuse, don't fork.
- *Payment plan*: full schedule (filter pills All / Paid / Upcoming / Overdue / Changed), per-row actions **Defer** (full holiday or interest-only), **Edit payment** (total, principal, interest), **Extra principal**, **Mark paid**, and **Reset changes**, all through `saveLoanPaymentOverrides` with Undo. Port the logic of `LoanDeferPaymentModal` / `LoanPaymentBulkEditModal`, not their UI.
- *Details*: **Reopen** a sold or retired asset (`revertClosure`) and **Hold to delete** the account (D5), through `AccountFormSheet`'s unused `onDelete` or a Details-tab row. Archive / reopen for ordinary accounts here too.
- Vehicle mileage chart in *Valuations & logs* (`AreaChart` of readings with the pro-rata allowance line for leases).
- Tests: a model test for each override kind (defer full, defer interest-only, edited payment, reset) against `generateAmortizationSchedule`.

*Status 4.2 (2026-10-29): done on `feat/new-account-detail-parity`, not committed.* Activity rows open the Transactions page's own sheet (`AccountTransactionSheet`, mounted only while open). Payment plan is its own component (`views/PaymentPlan.tsx`): skip, interest only, edit payment, extra principal, mark paid, clear, reset, all with Undo, through the new `applyLoanOverride` (keeps a payment's other changes; the old "clear extra principal" deleted the whole override, deferral included). Details has a Manage card: archive / reopen, reopen a sold asset (`revertClosure`), sell / retire, hold-to-delete. Vehicle mileage chart with the lease allowance line. Tests: `tests/unit/paymentPlan.test.ts`. Browser: each action checked on demo data; the lease allowance line was not seen (the demo vehicle is owned).

**4.3 Decided, not built.**
- **Q5 leased vehicles:** new optional `residualValue` on `Account` (form field for leased vehicles; `types.ts`, `demoData.ts`; the zod schema passes it through). A leased vehicle counts in assets only when `residualValue` is set, at that value; the hero shows months left and the monthly payment. Change in `classifyAccountBalanceEur` / `resolveAccountBalance` (shared, so classic follows), with tests.
- **Q2 future interest:** the loan *Overview* shows "Interest still to pay" from `computeLoanBalanceBreakdown().futureInterest`, next to the balance (principal + accrued).
- **Q4 chart curve:** `curveMonotoneX` for every money series in the New pages (`detailHero`, `overview`, `YieldPotArchetype`); drop the decorative `TrendLine` and dotted background on single-series balance charts (X9); amend §20.4 in the reference.
- **D3 chrome:** remove the in-body "All accounts" pill and repeated title (the shell header has them); Reconcile / Edit / Sync / Appraise go to a `PageToolbar` row under the tabs (`ToolButton`, overflow in `ToolMenu`); the header action follows the archetype (operating: Add transaction; card: Pay statement; loan: Record payment; property / vehicle: Add valuation / Log mileage; savings: Log interest).

*Status 4.3 (2026-10-29): done on `feat/new-account-decided-items`, not committed.* Q5: `residualValue` on `Account` (form field for leases); `resolveAccountBalance` returns it for a leased vehicle, else 0, so totals, trends and classic follow; the hero shows months left and whether the car counts (tests: `tests/unit/leasedVehicle.test.ts`). Q2: the loan Overview shows "Interest still to pay" plus "owed now". Q4: `curveMonotoneX` on every money chart in the New pages, decorative `TrendLine` and dotted `Background` removed, §20.4 amended. D3: back pill and hero buttons gone; Sync / Reconcile (not for scheduled loans) / Edit in a `PageToolbar` under the tabs; the header action follows the account (Add transaction, Pay statement, Record payment → Payment plan, Add valuation, Log mileage → Valuations & logs, Log interest, Add contribution). Not seen in the browser: a leased vehicle (the demo car is owned).

**4.4 Accounts list (open from §3).**
- A1: each hero total opens the segment it adds up (liabilities → a debts filter that includes cards), or the totals stop being links.
- A2 (allocation): two bars, assets and liabilities, each summing to 100 %; widths from the real shares (no `Math.max(3, …)`).
- A3: hero down to net worth + 90-day change, three figures (assets, liabilities, liquid cash), the chart and the attention chips; "Solvency %" goes.
- A7: replace the hand-made right-click menu with the row's Base UI `Menu` (open at the pointer); keyboard and `role="menu"` come with it.
- A8: the row is one link (Enter opens the page, Space the quick overview); menu and peek sit beside it, not inside.
- A10: groups longer than 8 show 8 and a "Show all N" `MoreButton` (D11).
- A11: sort value `change90d`, label "Change (90 days)"; L-A8: rate sort ranks APY within assets and APR within debts.
- Leftovers after #282: delete `AccountSparklineSvg` (or put the sparkline back on rows: decide in review); `isMealVoucherAccount` either drives a "Meal vouchers" group or goes.

*Status 4.4 (2026-10-29): done on `feat/new-accounts-list-fixes`, not committed.* A1: the three totals are figures, not links (no tab matches "all assets"; the tabs sit right below). A2: an assets bar and a liabilities bar, each 100 %, real widths. A3: Solvency % gone, one "±€x (y%) in 90 days" line. A7: the hand-made right-click menu is replaced by Base UI `ContextMenu` with the same entries as the ⋯ menu (one list, `accountMenuEntries`), now including Show transactions and Delete. A8: the row is one button (click / Space: quick overview, Enter: account page), the ⋯ menu beside it. A10: groups over 8 show "Show all N". A11 / L-A8 / L-H5: `change90d` "Change (90 days)"; "Interest rate" sorts APY within assets and APR within debts; the default sort maps the classic preference explicitly. Leftovers: none — `AccountSparklineSvg` and `isMealVoucherAccount` turned out to be used inside their own files (the audit's check missed that). Tests: `tests/unit/accountsList.test.ts`. Not seen in the browser: "Show all" (no demo group has more than 8 accounts).

**4.5 Docs.** §22 Accounts migration notes (D13: kept, moved, dropped, where the logic lives, keyboard route, verified / not verified), and mark each item of `docs/ACCOUNTS_NEW_REDESIGN_PLAN.md` built or dropped.

*Status 4.5 (2026-10-29): done.* `UI_UX_DESIGN_REFERENCE.md` §22 holds the Accounts migration notes; `docs/ACCOUNTS_NEW_REDESIGN_PLAN.md` starts with a built / changed / dropped table. **Phase 4 (Accounts) is complete**; Budget B1–B6 and Phase 5 remain.

Order: 4.1 → 4.2 (needs the tabs) → 4.3 → 4.4 → 4.5. 4.3's Q5 and Q4 and all of 4.4 don't depend on 4.1 and could run in parallel in their own worktrees if wanted. Not in Phase 4: L-D9–L-D12, L-H4, L-H5, X10 (Phase 5).

### Phase 5: Polish and docs (P2)
A10, A11, B7, B8, L-A8, L-A9, L-D9–L-D12, L-H4, L-H5, L-B9–L-B12, X10 performance. Write §21 Accounts and §22 Budget migration notes (X11), fix the §9 file name, fix §20's internal contradictions (§20.4 vs monotone sparklines in §20.8; "ink ring" written as `ring-nv-violet`; Base UI tooltip classes `bg-white/80 dark:bg-zinc-900/80` that the token test forbids), and mark the redesign plan's unbuilt items as built or dropped.

---

## 10. Decisions (answered 2026-10-29)

All ten recommendations were accepted. Q2, Q3 and Q9 change numbers on the classic pages as well, so Phase 1 ships them app-wide and records the change in the migration notes. Q4 requires amending §20.4 of `UI_UX_DESIGN_REFERENCE.md` in Phase 5.

| # | Question | Decision |
|---|---|---|
| Q1 | Which FX source is authoritative: `preferences.conversionRates` or the live `dynamicRates`? | Live rates with manual overrides from preferences, one helper. Accepted. |
| Q2 | Loan balance: principal only, or principal + future interest (today's classic behaviour)? | Principal (+ accrued interest). Changes net worth in classic too, so ship to both. Accepted. |
| Q3 | Should `calculateAccountTotals` change for classic too, or only New pages? | Both: one number for net worth across the app. Accepted. |
| Q4 | Amend §20.4 `curveNatural` to `curveMonotoneX` for money series? | Yes: monotone never invents values. Accepted. |
| Q5 | Leased vehicles: counted in net worth? Hero figure = lease payment or residual value? | Exclude from assets unless a residual value is set; hero = months left + payment. Accepted. |
| Q6 | Meal vouchers: give them an accent (D1 has four) or a neutral badge? | Neutral badge with icon. Accepted. |
| Q7 | Goals on the Budget page: read-only (edit in Forecasting) or full CRUD here? | Read-only for now, recorded as a decision. Accepted. |
| Q8 | Key budgets by category id instead of name? | Yes, with a one-time migration in `App.tsx` load. Accepted. |
| Q9 | Count physical-cash wallet spending against budgets? | Yes (spending is spending); differs from classic, record it. Accepted. |
| Q10 | Account detail: build the tabbed workspace from the plan, or keep the stacked page? | Build tabs (Overview · Plan/Valuations · Details). Accepted. |
