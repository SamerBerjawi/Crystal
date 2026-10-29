# ScheduleNew plan (`/schedule-new`)

Written 2026-10-29. Planning only. Shared rules, the shared engines (step 0) and the library inventory are in [NEW_PAGES_PLAN_INDEX.md](NEW_PAGES_PLAN_INDEX.md); this file does not repeat them.

| | |
|---|---|
| Target file | `pages/new/ScheduleNew.tsx` (`export const ScheduleNew`), no props (as classic `SchedulePage`) |
| Route | `/schedule-new` (already in `utils/newRoutes.ts` as `'Schedule & Bills'`, title "Schedule") |
| Classic sources | `pages/Schedule.tsx`, `components/MobileScheduleView.tsx`, `CalendarView.tsx`, `ScheduleHeatmap.tsx`, `ScheduledItemRow.tsx`, `RecurringTransactionModal.tsx`, `RecurringOverrideModal.tsx`, `EditRecurrenceModal.tsx`, `BillPaymentModal.tsx`, `AddTransactionModal.tsx` (post an occurrence) |
| Data | `useScheduleContext()` (`recurringTransactions`, `recurringTransactionOverrides`, `billsAndPayments`, `loanPaymentOverrides`, save/delete for each, `markBillAsPaid`), `useAccountsContext`, `useTransactionsContext` (`saveTransaction`), `useCategoryContext`, `useTagsContext`, preferences (`currency`, `conversionRates`, `brandfetchClientId`, `merchantLogoOverrides`) |
| Logic | `utils/scheduleModel.ts` (step 0 engine + this page's selectors), `hooks/useScheduleData.ts` |
| Purpose in one line | What money is due when, and the place to change it: post, skip, move, edit or end a payment. |

---

## 1. Feature inventory and decisions

Every classic capability, and what happens to it. Nothing is dropped silently (§10.1).

| # | Classic feature | Where | Decision |
|---|---|---|---|
| F1 | Upcoming timeline grouped Overdue / Today / Next 7 days / by month | `Schedule.tsx:528-555` | **Keep** as the *Upcoming* tab |
| F2 | Overdue section with its own filter (all / recurring / one-time) and a "projected delta" | `Schedule.tsx:66-200` | **Change**: overdue is the first group of *Upcoming*, always open; the source filter moves to the Filters sheet (N22); the delta becomes the group header's total |
| F3 | Calendar month view | `CalendarView.tsx` | **Keep** as the *Calendar* tab (Month) |
| F4 | 12-month heatmap (income / expense / transfer / mixed) | `ScheduleHeatmap.tsx` | **Keep** as *Calendar → Year*; colours re-mapped to D1 (red is status-only, so expense becomes orange) |
| F5 | Rules list: every recurring series, synthetic loan installments grouped per loan | `Schedule.tsx:296-323, 1340-1375` | **Keep** as the *Series* tab; synthetic series read-only with a link to their account |
| F6 | Expired bills archive with Restore, Mark paid, Delete | `Schedule.tsx:1380-1480` | **Keep** inside the *Bills* tab (Expired chip) |
| F7 | "Mark as expired & archive" for unpaid bills older than 7 days, all at once | `Schedule.tsx:817-833` | **Keep**, with Undo (classic has none) |
| F8 | Next-30-days totals: income, expenses, net, counts | `Schedule.tsx:497-530` | **Keep** in the hero; transfers handled (S-01) |
| F9 | Largest inflow and outflow cards | `Schedule.tsx` `majorInflow` / `majorOutflow` | **Change**: "Largest out" becomes one line in the hero; the inflow card is dropped (the hero already shows money in) |
| F10 | Top-5 categories pie for the next 30 days | `categoryBreakdown`, Recharts `PieChart` | **Change**: a ring of *monthly cost by category* on the *Series* tab (a stable basis instead of a 30-day window that jumps when rent falls just outside it) |
| F11 | Search over description and account | `Schedule.tsx:492` | **Keep** in the header (`usePageSearch`); also matches merchant and category |
| F12 | Add recurring / Add bill | header buttons | **Keep** as one header action "Add schedule" opening a composer with a *Repeats / Once* switch |
| F13 | Edit an occurrence: this one, this and future, whole series | `EditRecurrenceModal`, `handleEditSingle/Future/Series` | **Keep** as a menu (three entries) instead of a modal with three buttons |
| F14 | Change one occurrence (date, amount, description), skip / unskip | `RecurringOverrideModal` | **Keep** in the occurrence sheet; skip and unskip apply at once with Undo (D6) |
| F15 | Post an occurrence as a real transaction (pre-filled, tagged `recurringSourceId`), advance `nextDueDate`; pay a bill | `handleOpenPostModal`, `handleSavePostedTransaction` | **Keep**, through the shared quick-add composer (`TransactionForm`), with Undo; advancing follows E-09 |
| F16 | End series at an occurrence | `handleEndSeries` | **Keep**, Undo instead of a confirm (it is reversible) |
| F17 | Delete series / bill | `handleDeleteItem` with `ConfirmationModal` | **Keep**, Hold Button (D5) |
| F18 | Merchant logos | `brandfetchClientId`, `ScheduledItemRow` | **Keep** through `LogoTile` (D12, §20.5) |
| F19 | Mobile layout | `MobileScheduleView.tsx` | **Replaced** by the responsive page (one component, §5.0) |
| F20 | Segment hero gradients per tab | `Schedule.tsx:840` | **Dropped** (R9: no accent-filled surfaces) |

New in ScheduleNew (each one justified by data the page already has):

| # | Feature | Why |
|---|---|---|
| N1 | Payment history per series in the occurrence sheet ("paid on time 5 of the last 6") | The matched transactions are already found by `isOccurrenceSatisfied`; showing them answers "did this go out?" |
| N2 | Monthly equivalent per series and per group ("€1,940 a month in fixed costs") | Weekly, fortnightly and yearly items can't be compared otherwise |
| N3 | Committed-cash chart in the hero (next 30 days) | Shows *when* the money leaves, which the totals don't |
| N4 | Warrant tax bills marked as such, with a link to the Warrants tab | `BillPayment.warrantId` exists and is never shown |

---

## 2. Logic audit (Schedule-specific)

Shared engine bugs E-01…E-11 are in the index (§3.3); E-06, E-07, E-09, E-10 and E-11 mostly affect this page.

| # | Sev | Where | Finding | Fix | Found by |
|---|---|---|---|---|---|
| S-01 | P1 | `Schedule.tsx:509-525` | The 30-day totals only count `income/deposit` and `expense/payment`; **every transfer is ignored**, including loan installments and card settlements (synthetic transfers) and transfers to accounts outside Crystal. A mortgage of €1,200 is missing from "Expenses (30 days)". | Classify transfers: to a loan, card or external account = *out*; from external = *in*; between two of your cash accounts = *moves* (shown separately, not in the net). | read |
| S-02 | P1 | `Schedule.tsx:507` | `convertToEur(item.amount, currency)` without `resolveRates`, then shown with `formatCurrency(value, 'EUR')`. | Display currency + `resolveRates` (E-08). | read |
| S-03 | P1 | `Schedule.tsx:829-833` | "Expire all old bills" writes N bills with no Undo and one toast. | One write, `toast.undo` restoring each bill's previous status. | read |
| S-04 | P2 | `Schedule.tsx:515-520` | Category breakdown: recurring items by category name, every bill as "Bills", synthetic items as "Other". | Bills keep their category when they have one; synthetic items get "Loan", "Card", "Property"; categories resolved by id as Budget does (Q8). | read |
| S-05 | P2 | `ScheduleHeatmap.tsx:25-29` | Hex colours; expense is red (status-only colour in D1). | `nv-*` tokens; orange for out, green in, sky transfers. | read |
| S-06 | P2 | `ScheduleHeatmap.tsx:43` | Heatmap starts on the 1st of this month, so overdue items earlier in the month are drawn as upcoming and earlier overdue ones are not drawn. | Overdue days get a red outline (status); range = this month − overdue … +11 months. | read |
| S-07 | P2 | `Schedule.tsx:552` | Month group labels use `toLocaleString('default', …)`, not the app's language and date helpers. | `utils/dateFormat.ts`. | read |
| S-08 | P2 | `RecurringOverrideModal.tsx:90` | "Delete" in the override modal removes the change, but reads like deleting the payment. | Label "Undo changes to this payment"; it is an Undo-able action. | read |
| S-09 | P2 | `Schedule.tsx:188, 1368-1369` | Synthetic rows are read-only (good), but nothing says why or where to change them. | Badge "From your loan" / "From your card" with a link to the account's Payment plan or card Overview. | read |
| S-10 | P2 | whole page | One `useMemo` builds everything and depends on `searchQuery`, so every keystroke regenerates 12 months of occurrences for every series. | Engine output memoised on data only; search filters the result. | read |

Tests for this page (in `tests/unit/scheduleModel.test.ts`, on top of step 0's): monthly on the 31st through February; biweekly; weekend rule forward and backward; override moved into another month; skipped occurrence excluded from totals but listed; one transaction never satisfies two occurrences (E-06); overdue by 20 days still listed (E-07); posting a future occurrence keeps earlier ones open (E-09); a loan installment counts as *out*, a checking → savings transfer as *moves* (S-01); USD series in a EUR display (S-02); expire-all undo restores each status (S-03); monthly equivalents (weekly × 52 / 12, biweekly × 26 / 12, yearly / 12, daily × 365 / 12, times 1 / interval).

---

## 3. Layout

### 3.1 Header (N20)

- Title "Schedule" with the subtitle from `NEW_PAGE_SUBTITLES` from 640 px.
- `usePageSearch({ placeholder: 'Search payments' })`: description, merchant, category, account names.
- `usePageAction({ label: 'Add schedule', icon: 'add' })`: opens the composer (§6.1). On phones a violet round icon button.

### 3.2 Desktop (≥ 1024 px)

```
┌ Hero (split tile) ──────────────────────────────────────────────────────────────────┐
│ top (white): DUE IN THE NEXT 30 DAYS      −€1,284.50          [committed-cash chart] │
│   €3,410 out · €2,125 in · 14 payments · next: Rent, in 2 days   bars per day,       │
│                                                                   cumulative line    │
│ bottom (grey): ● Out €3,410   ● In €2,125   ● Moves €400   ⚠ 2 overdue · Largest out: Rent €1,200 │
└──────────────────────────────────────────────────────────────────────────────────────┘
[ Upcoming · Calendar · Series · Bills ]                       (SegmentedTabs, N21)
[ Filters (2) ]  chips: × Expenses  × Main checking      ⋯     (PageToolbar, N22–N23)
┌ Upcoming list (8 cols) ─────────────────────────────┐ ┌ Rail (4 cols) ───────────┐
│ OVERDUE · 2 · −€84.00                               │ │ This month               │
│  ◉ Gym          Main checking · 12 Oct · 17 d late  │ │  ring: paid vs still due │
│ TODAY                                               │ │  €1,920 of €3,050 paid   │
│ NEXT 7 DAYS · −€1,310                               │ │ Fixed costs              │
│ NOVEMBER 2026 · −€2,050          (first 8, Show all)│ │  €1,940 / month → Series │
└─────────────────────────────────────────────────────┘ └──────────────────────────┘
```

The rail only appears on *Upcoming* from 1280 px (on smaller widths its two figures go into the hero's grey part, which already has room for four). On *Calendar* the selected day's list takes the rail's place.

### 3.3 Phone (375 px)

```
Hero: figure, meta line, chart (140 px), grey row as a 2×2 grid
Tabs (scroll sideways if needed)
[Filters] ··· chips line (scrolls)
Groups as card rows; row = logo 40 px, name + account/date, amount right; ⋯ opens the menu
```

No rail; "This month" and "Fixed costs" are the hero's grey cells. The page's "Add schedule" is in the header only.

---

## 4. Sections in detail

### 4.1 Hero (split tile)

- **Figure:** net of the next 30 days (today … today + 29, inclusive, the Accounts L-A6 rule), signed, display currency. Label "Due in the next 30 days". Skipped occurrences excluded, overdue included (they still have to be paid).
- **Meta line (§1.2 rule 3):** "€x out · €y in · N payments · next: {name}, {in N days | today}".
- **Grey part (≤ 4 figures, §2.2):** Out (orange icon), In (green icon), Moves (sky icon; hidden when 0), Overdue (red badge with icon, only when > 0; tap = scroll to the Overdue group). "Largest out: Rent €1,200" as a caption under Out.
- **Chart C1** (§5).
- Tapping a day in C1 scrolls *Upcoming* to that day (and sets a removable "Day" chip).

### 4.2 Upcoming tab

- Groups: Overdue (red header icon), Today, Next 7 days, then months. Each header: label, count, group net (`Money`, signed).
- Row (`OccurrenceRow`): `LogoTile` (merchant → category glyph → kind icon), name (bold), second line `account` (transfers `from → to`) · date · relative ("in 3 days", "17 days late" in red text), amount on the right (income green text, spending ink, transfers sky text), badges with icons only when notable: *Changed* (override), *Skipped* (struck amount), *Loan* / *Card* / *Property* (synthetic, sky), *Warrant tax* (N4).
- Click / Enter → occurrence sheet (§6.2). ⋯ and right-click → the same menu (Base UI `Menu` / `ContextMenu`, one entry list as Accounts' `accountMenuEntries`).
- Caps (D11): Overdue and Today never capped; Next 7 days and each month show 8, then "Show all N". Lifted while searching or filtering. Months render lazily beyond the third.
- Empty: `EmptyState` "Nothing scheduled" with an ink "Add schedule" (N4: empty states use ink).

### 4.3 Calendar tab

- **Month** (default): a 7-column grid (Monday first, or the locale's first day), each day cell 44 px+ with up to three dots (green in, orange out, sky transfer) and the day's net under the date from 768 px. Today ringed in ink; overdue days red outline. The month control (`‹ November 2026 ›`) stays visible beside Filters (N22: it sets the range). Selecting a day lists its occurrences under the grid (phone) or in the rail (desktop), same `OccurrenceRow`.
- **Year:** chart C3 (§5). Toggle Month / Year as a two-item `SegmentedTabs` next to the month control. N24 check: the two views look different at 375 px (grid vs. heatmap), so it ships.
- Keyboard: grid is `role="grid"`; arrows move a day, PageUp/PageDown a month, Home/End the week, Enter selects.

### 4.4 Series tab

- Groups: Income, Expenses, Transfers, then **From your accounts** (loan installments, card settlements, property costs; read-only).
- Row: name, cadence ("Monthly on the 5th", "Every 2 weeks on Friday", "Yearly on 1 Mar"), next date, amount, monthly equivalent (N2), account; ended series under a collapsed "Ended" group.
- Group header: count and "€x a month".
- Chart C2 at the top (ring of monthly cost by category).
- Sort (in the Filters sheet, N22): next date (default), amount, monthly cost, name.
- Row click → series sheet (the composer in edit mode). Menu: Edit, Pause? (**not planned**: no `paused` field; End series covers it), End series, Delete (Hold). Synthetic rows: "Open loan" / "Open card" / "Open property" only.

### 4.5 Bills tab

- Status chips (`ChoiceChips`): Unpaid (default) · Paid · Expired. Counts on each.
- Row: name, due date (late in red), amount, account, badges (Warrant tax).
- Tools (N23): "Expire old (N)" when unpaid bills are more than 7 days late (F7, Undo); on Expired rows: Restore (Undo), Mark paid, Delete (Hold).
- Paid bills: last 12 months, newest first, capped.

### 4.6 Filters sheet (N22)

| Section | Control | Notes |
|---|---|---|
| Type | `ChoiceChips` multi: Income, Spending, Transfers | icons |
| Source | `ChoiceChips` multi: Recurring, Bills, Loans, Cards, Property | replaces F2's overdue filter |
| Accounts | `FilterList` with presets (as Transactions N11) | |
| Categories | `FilterList` (expense/income trees) | |
| Show skipped | `FilterToggle` | default on in Upcoming (struck), off in totals |
| Sort | Series tab only | |

Footer: Reset, "Show N payments".

---

## 5. Charts

| # | Where | Bklit parts | Data | Encoding | Interaction | Empty / loading |
|---|---|---|---|---|---|---|
| C1 | Hero | `ComposedChart` (bars + line), `XAxis` (day ticks, `DateTicker` on hover), `ChartTooltip` | `scheduleModel.dailyCommitted(occurrences, today, 30)` → `{ date, out, in, moves, cumulativeNet }` | Out bars orange (negative, below zero line), in bars green (above), moves not drawn (they don't change total cash); cumulative net as a `curveMonotoneX` line in ink; zero reference line | Hover / arrow keys read a day; click selects the day (F3 chip) | Skeleton bars (`bar-chart-loading`); with no payments: flat line and "Nothing due in 30 days" |
| C2 | Series tab | `RingChart` + `RingCenter` (or KokonutUI `spending-ring`, Q-S2) | `scheduleModel.monthlyCostByCategory(series)`, top 6 + Other | Category colours from the user's categories (they are data, not accents); centre "€1,940 / month" | Hover a segment → legend row highlights; click → filters Series to that category (chip) | Ring skeleton; "No recurring spending" |
| C3 | Calendar → Year | `heatmap/HeatmapChart` with `HeatmapLegend` | `scheduleModel.yearHeatmap(occurrences)` → per day `{ net, in, out, count }` | Diverging: green for net in, orange for net out, intensity by amount (log scale so rent doesn't flatten the rest); overdue outlined red | Hover → tooltip (date, count, in, out); click → opens Month on that day | Heatmap skeleton |

All money series use `curveMonotoneX`; tooltips follow §20.1–§20.3; series keys through `toProperCase`.

---

## 6. Sheets and interactions

### 6.1 Schedule composer (`ScheduleFormSheet`)

One sheet for create and edit, D7 sticky footer:
1. *Repeats / Once* switch (recurring series vs one-time bill).
2. Type tabs: Spending · Income · Transfer (bills: Payment · Deposit).
3. Amount with `AmountPad` (phones) and currency.
4. Merchant (logo once typing pauses, as Transactions N18), description.
5. Chips that open pick lists (Transactions composer pattern): Category, Account, To account (transfer), Starts (date), Repeats (daily / weekly / every 2 weeks / monthly / yearly + every N), Day of month, Weekend rule (none / move before / move after), Ends (never / on date).
6. Live preview line: "Next: Fri 7 Nov, Mon 8 Dec, Wed 7 Jan" (from the engine, so what you see is what the page will show).
- Save: `cta` "Save schedule" (the sheet's one CTA). Toast with Undo on create and edit.
- Edit of an existing series opened from an occurrence asks first (Menu): *This payment only* (→ occurrence sheet), *This and future* (splits the series: old one ends the day before, new one starts here; Undo reverts both), *Every payment*.
- Logic: reuse `RecurringTransactionModal`'s validation by moving it to `utils/scheduleModel.ts` (`validateSeries`, `splitSeriesAt`); never import the modal.

### 6.2 Occurrence sheet (`OccurrenceSheet`)

- Hero: logo, name, amount large (sign colour), date and status pill (Overdue / Today / Upcoming / Skipped / Paid).
- Lines (Transactions N17 style): Account, Category, Repeats (cadence + next three dates), Changed from (original date and amount, when overridden), History (N1: last six occurrences with paid date and a small on-time / late badge; links to the matched transactions).
- Inline edit of this occurrence: date, amount, description (writes an override; Undo).
- Footer: **Mark paid** (ink; opens the quick-add composer pre-filled; on save the transaction gets `recurringSourceId`, the occurrence turns Paid, Undo removes the transaction and restores `nextDueDate`), round buttons Skip / Unskip, More (Edit series, End series here, Delete series).
- Bills: Mark paid (same flow), Edit, Expire, Delete.
- Synthetic: read-only lines + "Open loan" (→ `/accounts-new/:id#plan`) / "Pay statement" (→ card account's header action).

### 6.3 Actions and their safety

| Action | Behaviour |
|---|---|
| Mark paid / post | Applies; Undo |
| Skip / unskip | Applies; Undo |
| Change this payment | Applies; Undo |
| End series here | Applies; Undo |
| Expire bill / expire all old | Applies; Undo |
| Restore bill | Applies; Undo |
| Delete series / bill | `confirmNew({ danger: true })` → Hold Button |

---

## 7. Components

| Need | Choice | Status |
|---|---|---|
| Tabs | `SegmentedTabs` (body, N21); KokonutUI `smooth-tab` only if the panel has no draggable content (Calendar has none, the list has none; but N21 already uses `SegmentedTabs` on Accounts and Budget, so keep it for consistency) | exists |
| Toolbar, filters, chips | `PageToolbar`, `FilterSheet`, `ChoiceChips`, `FilterList`, `FilterToggle`, `ActiveFilters` | exists |
| Hero | `Card` with `top`, `TileValue`, `Money`, `Badge` | exists |
| Rows and menus | New `OccurrenceRow`; Base UI `Menu` / `ContextMenu` | new (plain: no KokonutUI list fits) |
| Delete | `confirmNew` → KokonutUI `hold-button` | exists |
| Amount | KokonutUI `amount-pad` | exists |
| Charts | Bklit `ComposedChart`, `RingChart`, `HeatmapChart` | exists |
| Category ring (optional) | KokonutUI `spending-ring` | to port (Q-S2) |
| Due-soon stack | KokonutUI `notification-stack` — **not on this page** (the list is the page); used by Dashboard and the shell bell | Dashboard plan |
| Year heatmap alternative | KokonutUI `activity-terrain` — **not planned**: Bklit `HeatmapChart` already has the legend, tooltip and skeleton | — |
| Magic UI | None needed. `animated-list` for the Upcoming list was considered and rejected (motion on a list you scan, D8 only covers charts and numbers) | — |

New files:

| File | Contents |
|---|---|
| `utils/scheduleModel.ts` | Step 0 engine (`buildOccurrences`, `advanceAfterPosting`, matching) + `groupUpcoming`, `summaryNext30`, `dailyCommitted`, `monthlyEquivalent`, `monthlyCostByCategory`, `yearHeatmap`, `seriesGroups`, `cadenceLabel`, `validateSeries`, `splitSeriesAt`, `classifyTransfer` |
| `hooks/useScheduleData.ts` | Contexts → model; writes returning `undo`: `postOccurrence`, `skip`, `unskip`, `overrideOccurrence`, `clearOverride`, `saveSeries`, `splitSeries`, `endSeries`, `deleteSeries`, `saveBill`, `markBillPaid`, `expireBills`, `restoreBill`, `deleteBill` |
| `components/new/schedule/overview.tsx` | Hero + C1 |
| `components/new/schedule/parts.tsx` | `OccurrenceRow`, group headers, `SeriesRow`, `BillRow`, `CadenceText` |
| `components/new/schedule/calendar.tsx` | Month grid, year heatmap |
| `components/new/schedule/sheets.tsx` | `ScheduleFormSheet`, `OccurrenceSheet` |
| `pages/new/ScheduleNew.tsx` | Page, tabs, toolbar, filter state |
| `tests/unit/scheduleModel.test.ts` | §2 cases |
| `tests/unit/new-tokens.test.ts` | Add the new files |

`App.tsx`: render `ScheduleNew` for the `'Schedule & Bills'` New route (replacing `PlaceholderNew`).

---

## 8. States, accessibility, motion

- **Loading:** `PageSkeletonNew` variant "list" plus hero skeleton; chart skeletons from Bklit.
- **Empty:** no series and no bills → one `EmptyState` with ink "Add schedule"; a filtered-empty list says "No payments match" with "Clear filters".
- **Privacy mode:** all amounts through `Money`; chart tooltips show masked values; the heatmap legend hides amounts.
- **Multi-currency:** rows show native amounts; totals in the display currency, with the native amount in the sheet ("$120.00 ≈ €110.40").
- **Demo mode:** works on `demoData.ts`; check the demo has a biweekly item, an override and an overdue bill, or add them (D13 verification needs them).
- **Reduced motion:** chart reveal off; sheet transitions fade.
- **Keyboard route:** tabs are a tablist (arrows, Home, End); rows are buttons (Enter: sheet; Shift+F10 or ⋯: menu); calendar grid as §4.3; every sheet traps focus and returns it.
- **Screen readers:** amounts read signed ("minus 84 euros"); overdue rows announce "17 days late".

---

## 9. Phases

Each phase ends with `npm run lint`, the unit tests (check for ✕) and the browser at 375 / 768 / 1024 / 1440 in light and dark on demo data. One commit per phase on a new branch (CLAUDE.md git workflow).

| Phase | Scope | Done when |
|---|---|---|
| S1 | Step 0 engine pieces this page needs (`buildOccurrences`, matching, `advanceAfterPosting`) + §2 tests | All §2 tests pass; classic Schedule shows the same occurrences as before except where a bug is fixed (record which) |
| S2 | Page shell: header, hero + C1, Upcoming tab, Filters sheet, occurrence sheet (read-only) | Upcoming matches classic's timeline on demo data, totals reconcile with the rows |
| S3 | Actions: post, skip, change, end, delete, with Undo / Hold; composer for create and edit, split series | Each action round-trips with Undo in the browser |
| S4 | Calendar (Month + Year), Series tab + C2, Bills tab + expire-all | Classic features F3–F7, F10 reachable |
| S5 | Polish and docs: copy pass, caps, keyboard route, token test, migration notes (new reference section "Migration notes: ScheduleNew") | Notes list Kept / Moved / Changed / Dropped / Logic / KokonutUI check / Keyboard / Verified / Not verified |

---

## 10. Open questions

| # | Question | Recommendation |
|---|---|---|
| Q-S1 | Count loan installments and card settlements as *out* in the hero, and transfers between your own cash accounts as *moves* (not in the net)? | Yes (S-01). |
| Q-S2 | Category ring on Series: Bklit `RingChart` or port KokonutUI `spending-ring`? | Bklit first; port `spending-ring` only if you want the flick-to-spin interaction (needs a keyboard route and a static fallback). |
| Q-S3 | "Mark paid" for a recurring payment: always create a transaction (as classic), or also allow "Mark paid without a transaction" (for payments a bank sync will import later)? | Offer both: default creates one; the menu has "Already in my transactions…" which links an existing transaction instead (uses the same `recurringSourceId`). |
| Q-S4 | Keep `dueDate` on a paid bill and add an optional `paidDate` (E-10)? | Yes; `billsAndPayments` is `z.any()`-validated, so no schema change; record in `types.ts` and `demoData.ts`. |
| Q-S5 | Pause a series (new `pausedUntil` field) or rely on End series + re-create? | Not now; record as a possible later addition. |
