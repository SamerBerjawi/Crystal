# Crystal: Implementation Progress Tracker

Phase 9 tracker. It records what's built, what was tested and what wasn't. A module is only Done after checks at 1440 × 900, 768 × 1024 and 390 × 844, in light and dark. Anything skipped is written here.

**Base:** this work stacks on `feat/redesign-accounts`, then `feat/redesign-overview`, then `feat/redesign-primitives-shell`, then `feat/redesign-foundation`, then `refactor/remove-new-ui`. None were merged into `main` when this was written. Nothing is committed until the owner asks.

**How old pages keep working:** the old colour names are mapped onto the new palette. Every page takes the new look at once and keeps working until its module is rebuilt. This bridge isn't the finished design, and it's removed in the final module.

## Modules

| # | Module | Includes | Status |
|---|---|---|---|
| 0 | Foundation | Tokens, Manrope, Hugeicons, colour bridge | Done |
| 1 | Primitives | Buttons, fields, menus, overlays, table, states | Done |
| 2 | App shell | Pills, tab row, rail, phone bar, More, top bar | Done, with the gaps listed below |
| 3 | Overview | Summary, hero, Needs you, Safe to spend, grid | Done |
| 4 | Accounts | Hub tabs, account frame, one account form | Done |
| 5 | Transactions | Ledger, Review queue, Merchants, `DEF-06` | Done, with the detail panel left |
| 6 | Planning | Budget, Forecast, Goals, Calendar, Subscriptions, Tasks | Done, committed on `feat/redesign-planning` |
| 7 | Investments | Portfolio, Holdings, Activity, `DEF-01`, `DEF-02`, `DEF-03`, `DEF-04`, `DEF-05` | Done, committed on `feat/redesign-investments` |
| 8 | Reports | Reports, Invoices, Challenges | Done, committed on `feat/redesign-reports` |
| 9 | Settings and data | Hub, Connections, Data, synced choices (`S-002`) | Done, committed on `feat/redesign-settings`, PR open |
| 10 | Rules | Rebuild (`D-009`), with tests first | Done, merged |
| 11 | PIN lock | Idle lock, server-side design (`D-013`) | Done, merged |
| 12 | Any currency | Support across the app (`S-010`) | Done, merged |
| 13 | Clean-up | Remove bridge, `@base-ui/react`, `DESIGN.md` | Not started |

Phase 10 (final QA) follows module 13.

## Module log

### Module 0: Foundation

**Status:** Done, committed as `a1eddb0` on `feat/redesign-foundation`.

**Built**
- All Phase 8 tokens in `index.css`: colour in both themes, type styles, radii, shadows, motion, layers, glass and scrim.
- Two bridges: Crystal's old colour names, and about 5,800 hard-coded Tailwind colour classes, now use the new palette.
- Manrope is self-hosted and the default. Preferences keeps the other typefaces.
- Hugeicons replaces Phosphor everywhere, and Phosphor is uninstalled early rather than in module 13. `components/ui/Icon.tsx` keeps its interface, so saved icon names still work.

**Tested**

| Check | Result |
|---|---|
| `tsc --noEmit` and `tsconfig.strict.json` | Clean |
| `npm test` | 226 passed, 0 failed |
| Production build through Vite | Passed. `npm run build` wasn't used, so the version isn't bumped |
| All 22 routes at 390, 768 and 1440 px in demo mode, dark theme | Real headings, no error screens, no page-level sideways scroll |
| Overview screenshot at 1440 px | Checked in light and dark |
| Icon names | All 200 catalogue names and all legacy map targets resolve to a real icon. Also fixed about 25 names that already fell back to a generic square |

**Not tested**
- Pages in the light theme, apart from Overview at 1440 px. Colour can't change layout, but contrast wasn't checked page by page.
- The sweep used demo data, so a real signed-in account wasn't exercised.
- Saved icons in real user data weren't checked, only names found in code and the catalogue.
- Contrast on the bridge colours. They're temporary, and each module replaces them with checked tokens.
- Cloud-loaded fonts in the Preferences picker.

**Known issues**
- At 768 px, six pages overflow inside the main area: Overview 101 px, Transactions 79, Forecast 340, Categories 94, Tags 8, Merchants 38. This isn't from the foundation: with the old font and weight the numbers are almost the same. The old sidebar leaves only 498 px of content. Module 2 must recheck this.
- Sign-in, the Overview cards and other pages still have their old layouts, as expected until their modules.
- The icon picker still uses the old catalogue names. It works, and it's rebuilt with its module.
- A browser that already saved `plus-jakarta` as its font keeps it, because that's treated as a choice. Only the old unset default moves to Manrope.

### Modules 1 and 2: Primitives and app shell

**Status:** Done, committed on `feat/redesign-primitives-shell`.

**Built: primitives** (`components/ui/`, on `react-aria-components`)
- `Actions.tsx`: `Button`, `IconButton`, `Tooltip`, `TextLink`, `HoldButton`, `SelectionBar`.
- `Fields.tsx`: `TextInput`, `AmountInput`, `Textarea`, `DateInput`, `DateRangeInput`, `Checkbox`, `RadioGroup`, `Switch`, `Slider`.
- `Pickers.tsx`: `Select`, `Combobox`, `MultiSelect`. `Menu.tsx`: `Menu`.
- `Overlays.tsx`: `BottomSheet`, `ResponsiveOverlay`, `Dialog`, `SidePanel`, `FullPanel`, `ConfirmDialog`, `Popover`.
- `Display.tsx`: `DataTable`, `Row`, `DayGroup`, `Badge`, `CountPill`, `ShowMore`. `States.tsx`: `Spinner`, `Skeleton`, `EmptyState`, `Banner`, `ErrorState`, `SyncStatus`.
- `/?ui-kit` shows them all in development. It isn't in the production build. Remove it in module 13.

**Built: restyled in place, so every page changes now**
- `Card`, `Modal`, old `BottomSheet`, `HeaderButton`, `SegmentedControl`, `PageHeader`, `EmptyState`, `CommandCenter`, and the `BTN_*`, `INPUT_BASE_STYLE`, `SELECT_STYLE` and `CLOSE_BTN_STYLE` constants.
- Toasts are bottom centre, and move above the selection bar and phone bar.

**Built: shell** (`components/ui/Shell.tsx`, `utils/navigation.ts`)
- Top pills, tab row, tool rail, phone top bar, phone bar, More sheet, profile menu, skip link. Notifications are a side panel, and a sheet on phones.
- `Sidebar`, `MobileNavbar` and `HeaderContext` are removed. So are the ambient page glow and the per-page accent colours, which overwrote the green on every page.
- The 95% root font size in `index.html` is removed. Every `rem` was 5% under the approved sizes.

**Tested**

| Check | Result |
|---|---|
| `tsc --noEmit` and `tsconfig.strict.json` | Clean |
| `npm test` | 226 passed, 0 failed |
| Production build through Vite | Passed. `UiKit` isn't in it |
| 22 routes at 1440, 768 and 390 px, light theme, demo mode | Real headings, no error screens, no page-level sideways scroll. Exceptions under Known issues |
| 22 routes at 768 and 390 px, dark theme | The same, run before the last top bar fix, which only changed its width |
| UI kit at 1440 px | Menu, Select, MultiSelect, calendar, Dialog, side panel, unsaved-changes guard, type-to-confirm, hold, quick press, screen reader path, toast and selection bar all behaved |
| UI kit at 390 px | Sheets for More, Menu, Select, Combobox, MultiSelect, Dialog and Full panel. Native date input, 48 px inputs at 16 px text, 64 px rows, toast above the bar |
| Phone search and Create | Search is full screen, Create opens the transaction form, and its footer now fits at 390 px |

**Not tested**
- A real touch device, the on-screen keyboard hiding the phone bar, and dragging a sheet. The emulated browser can't do these.
- The hold button's real pointer and keyboard hold. The test sent synthetic pointer events, and keyboard hold wasn't run.
- Reduced motion, reduced transparency, 200% zoom and 320 px width.
- A keyboard walk through the shell, and a real screen reader.
- Opening each overlay in the UI kit at 768 px. The page itself was checked there, with no overflow and key table columns only.
- Contrast of restyled old pages. They still use bridge colours.
- A signed-in account. Everything ran in demo mode.

**Known issues**
- Forecast overflows inside the main area by 8 px at 768 px, and Merchants by 13 px at 390 px. Their modules (6 and 5) rebuild those layouts. The six overflows from module 0 are otherwise gone.
- Tabs exist only for pages that exist. Accounts and Investments had none then, and Review queue and Goals aren't listed. They arrive in modules 4, 8, 5 and 7.
- Rail Review queue opens the Ledger until module 5. Rail Today opens Calendar.
- Lock isn't in the rail or More until module 11, so the rail has seven tools.
- Create opens Add transaction everywhere. The Create menu (`NAV-08`) and "Create something else" (`D-071`) wait for the forms to be reachable from anywhere, in modules 4 and 6.
- On phones the tab row sits under the top bar, above the page title, because the shell can't reach inside old pages.
- Phone page actions still sit under the title until each page is rebuilt.
- Subscriptions on phones keeps its floating button until module 6.
- `Popover`'s phone sheet, `DateRangeInput`, and the context menu have had little or no use. The context menu isn't built yet, and arrives with the Transactions table.
- `IconPicker`, `ColorPicker` and `CategoryPicker` are built with their modules (10 and 5).
- Layer values are the approved order times ten, until module 13 removes the old `z-50` to `z-500` values.
- Vite doesn't see file changes on this volume, so the preview server needs a restart after edits.

### Module 3: Overview

**Status:** Done, committed on `feat/redesign-overview`.

**Built**
- One Overview page with no tabs (`D-078`): written summary, Net Worth hero, Needs you, filters, then the widget grid. `pages/Dashboard.tsx` keeps its data logic.
- `components/ui/WidgetGrid.tsx`: KokonutUI's Widget Grid (MIT), with Crystal tokens, edit mode, row spans, a remove button and three columns on tablets. `react-grid-layout` is uninstalled (`D-077`).
- `components/ui/Money.tsx`: `Amount`, `Change`, `useFirstVisit` and `PrivacyContext`. `Amount` hides figures from screen readers too.
- `components/ui/Summaries.tsx`: `WrittenSummary`, `NetWorthHero`, `NeedsYou`, `SafeToSpendWidget`, `AccountsSummary`, `KeyRatios`.
- `utils/safeToSpend.ts` (`D-076`), `utils/overviewLayout.ts` and `utils/overviewSummary.ts`, with 12 tests in `tests/unit/overview.test.ts`.
- New widgets for what the old tabs held: Key ratios, Asset allocation, Accounts and Safe to spend.
- Phones have their own order, a Filter sheet and a Customise sheet to reorder and hide. `MobileDashboardView` is removed.
- Fixed: the old Net Flow card always showed zero, because it subtracted a value from itself. It's now income less spending.

**Tested**

| Check | Result |
|---|---|
| Type checks, `npm test`, Vite build | Clean, with 238 tests passed and 0 failed |
| Overview at 1440, 768 and 390 px | No sideways scroll, in dark and light at 1440 and 768, dark at 390 |
| 320 px width | No sideways scroll, and all phone bar labels fit |
| Grid columns | Six at 1440 px, three at 768 px |
| Edit mode | Remove, Add widget, keyboard move with Space and arrows, keyboard resize. The move was announced |
| Phone | Filter sheet, Customise sheet, move up, hide |
| Summary and Needs you | Agree with each other. Demo data shows tasks due |

**Not tested**
- Saving a layout or cushion to a real account. Demo mode doesn't persist, so reload resets them.
- Migrating a real saved layout. Unit tests cover it, but no real account did.
- Dragging or resizing with a pointer or finger, and pull to refresh.
- The first-visit stagger and count-up by eye, and reduced motion.
- Privacy mode on this page, and Safe to spend with real bills and income. Unit tests cover the sums.
- The hero, sentence and cards in a final visual check. The pane shrank during testing, so only low-resolution screenshots exist for this module, and the layout was checked by measurement.

**Known issues**
- Widgets inside the grid keep their old charts and styling until their chart work. Their colours are bridge colours.
- The hero's split covers assets only, so debts appear as a fourth figure beside it.
- Cash in Safe to spend is EUR-based, like the rest of the page, until module 12.
- Filters on desktop still use the old account and period controls until `FilterBar` in module 5.
- Pending Matches opens in a full panel until module 5 replaces it.
- Forecast on phones stacks four cards, which is tall.

### Module 4: Accounts

**Status:** Done, committed on `feat/redesign-accounts`.

**Built**
- Hub: All, Cash, Cards, Loans and Assets tabs (`D-020`) in the shell's tab row, a summary card per tab, and account cards or rows. Sort, view and layout choices sit in View options.
- `AccountCard` replaces `AccountRow`. Its menu holds every old context menu action, and right-click opens it. Phones keep swipe actions, and reorder with up and down buttons.
- `AccountFrame` and `AccountPanels` replace the nine account views (`D-038`): back, hero, chart, tabs. Property and vehicles add Valuations, vehicles add Mileage, loans add Payment plan, cards add Billing.
- `AccountForm` replaces the Add and Edit forms (`D-023`), both about 1,600 lines. Pick the type, then short sections. It includes the fields the old Add form never showed: insurance, garden, terrace, parking, lease payment day and account. Closing with unsaved changes asks first (`D-068`).
- `utils/accountForm.ts` holds the form's logic, with 10 tests including a round trip through the draft.
- "What if you paid extra?" slider on loans (`D-039`), with 2 tests.
- Removed: `AddAccountModal`, `EditAccountModal`, `MobileAccountsView`, `MobileAccountHeader`, `AccountRow`, the nine views.

**Rebuilt on the owner's request (`D-081`, `D-082`)**
- Tabs are Cards (default), Accounts, Loans and Assets, after Rivolo's Wallet. This replaces the hub bullet above.
- Cards: a row of cards to pick from, then the chosen card's details, limit, top merchants this month, and activity by day. Only the last four digits ever show.
- Accounts, Loans and Assets show two-column pots on desktop: figure, 90-day trend, what's linked, latest three transactions. Phones show rows.
- Sort stays in View options, with Pots or Rows. Rows is where drag reorder lives. The old split, grid and list options are gone, and so is the summary card.
- Rivolo's freeze, spending limits, card controls, full card number and CVV aren't included, because Crystal holds no such data.

**Changed behaviour, worth checking**
- Account pages' Safe to spend now uses the tested 14-day model. The old Checking page really used 7 days. Overview's Safe to spend is different on purpose (`D-076`).
- Editing a loan now saves its Paid from account. The old Edit form showed the field but dropped the change.
- Notes now save on every account type, as the form always showed them. They used to save only on Other assets and debts.
- Adjust balance is on every account type's page apart from loans, cards, property and vehicles. Checking and Savings had lost it there.
- A loan with no term or rate shows its balance rather than €0, with a note to add them.
- Removed as duplicates: the Savings 90-day chart (the frame's chart covers it), and the decorative Pension accumulation index and Cash reserve index figure. The Cash burn rate sentence stays.
- The vehicle page no longer shows a stock Unsplash photo when you haven't added one.

**Tested**

| Check | Result |
|---|---|
| Type checks, `npm test`, Vite build | Clean, with 253 tests passed and 0 failed |
| Five hub tabs, and 10 account types with every tab | 46 views at 768 and 390 px, and every tab at 1440 px: no sideways scroll, no error screens. Light theme |
| Add a vehicle: type tiles, sections, unsaved guard, save | Worked |
| Right-click menu, Delete, type to confirm | Button stayed off until the name was typed, then the account went |
| Add a loan: total reconciled to 12,000 from principal and interest | Worked, and its schedule of 60 payments rendered |
| Extra payment slider by keyboard | €80 extra showed 15 months sooner and €321.05 saved |
| Phone View options and Add account sheets, 64 px rows | Worked |
| New tabs at 1440, 768 and 390 px, and dark at 390 px | No sideways scroll and no error screens. Picking a card changes the detail. Card row is five across, three on tablets, and scrolls on phones |

**Not tested**
- Dark theme on these pages. They use tokens throughout, except old pieces below.
- Editing every field type on a real account, image upload, and the mileage editor in the form.
- Swipe actions, drag reorder and touch reorder.
- Bank-linked sync from an account page, sale and reopen, valuation and mileage modals, in the new frame.
- A signed-in account. Demo mode doesn't persist.
- Checking accounts and meal vouchers in Cards, on screen. Demo data has only credit cards, so unit tests cover those.
- The look of the Cards page at full size. The browser pane was too small for screenshots, so the layout was checked by measurement.

**Known issues**
- The hub pill and its first pot tab are both called Accounts.
- `AccountOverviewModal`, `PaymentPlanTable`, `BalanceAdjustmentModal`, `HistoricalBalanceTrend` and the amortisation and mileage charts keep their old styling on bridge colours.
- `AccountOverviewModal` was later deleted (`D-113`, `D-117`).
- The full panel on phones scrolls through sections rather than stepping one at a time.
- Demo loans have no term or rate, so they show no schedule.

### Module 5: Transactions

**Status:** Done, uncommitted, with the two gaps under Known issues.

**Built**
- `DEF-06` and `DEF-07` fixed. New bank transactions now take merchant, transaction and regex rules, and round-ups. A merchant's own category beats regex rules. `utils/rules.ts` has `applySavedRules` and `spareChangeFor`, with 4 tests.
- Ledger: scatter, search, filter chips, day-grouped table, Comfortable or Compact (remembered), Show more in place of page numbers (`D-040`), and a "This view" summary that follows the filters.
- `LedgerTable`, with every old row action in its menu. Right-click opens the same menu. Phones get day rows, swipe left to Categorise and right to Select (`D-069`), long press to select, and a filter sheet.
- Selection bar with Categorise, Edit, More, and press-and-hold delete. Row menus open a dialog with the hold button (`D-065`). Undo was already there.
- Review queue at `?tab=review` (`D-008`): one card with a side list on desktop, and one card on phones. It covers transactions to categorise, and transfer and bill matches, with search, type filter, Skip, Select mode, Confirm likely and Matching settings.
- `CategoryPicker` (`D-041`): three suggestions, search, and Always file like this, which saves the merchant's category.
- `ReviewContext` holds the matchers above the pages, so Overview and the queue agree and dismissed transfer matches stay dismissed.
- Merchants: list beside a live profile (`D-012`), and on phones the profile is a separate step.
- Removed: `MobileTransactionsView`, `UnifiedPendingMatchesModal`, `PendingMatchesView`, `UnifiedPendingMatcherCard`.

**Tested**

| Check | Result |
|---|---|
| Type checks, `npm test`, Vite build | Clean, with 258 tests passed and 0 failed |
| Ledger, Review queue, Merchants at 1440 and 768 px, dark theme | No sideways scroll, no error screens. Tablet shows key columns only |
| Review queue with seeded items | File a category, skip, match a transfer, settings, with counts dropping each time |
| Ledger: selection bar, row menu by right-click, Accounts filter popover | Worked |
| Phone: 64 px rows, Select mode, selection bar above the phone bar with More, filter sheet, queue, merchant profile step | Worked, no sideways scroll |

**Not tested**
- A real bank sync. `DEF-06` is proved by unit tests and code, not with a live bank.
- Swipe, long press and drag on a real touch device. Hold delete by real pointer.
- Split, combine, bulk edit and duplicate in the new page. Their logic and forms didn't change.
- Light theme on these pages, and the scatter by eye. The pane was too small for screenshots.
- Bill match cards. Demo data produces none, though they share the transfer card's flow.
- Always file like this reaching a real saved account.

**Known issues**
- `AddTransactionModal` is rebuilt to `D-022` (a side panel, full-height on phones). Its logic moved to `utils/transactionForm.ts`, with tests. Save, edit, transfer, the unsaved-changes prompt and suggestions were tested in the browser at 1440×900, and layout at 768×1024 and 390×844, in light and dark. Merchant rules, loan split, round-up and branch saving have unit tests only, because the demo data has no merchant rules, loans payments or spare-change link to try them on. Live address search wasn't tested.
- `TransactionDetailModal` became a side panel in the old-screens work (`D-115`). `MerchantDetailModal` was rebuilt in the same work (`D-116`).
- Past bank transactions aren't reprocessed by the `DEF-06` fix.
- Saving a transaction with no category still files it as Transfer, as it always has.

### UI adjustment: background tint and translucent surfaces (`D-086`)

- Added `--solid`, `--rim`, `--card-shadow` and the `--mesh-*` tints, plus the `.surface-card` class. `--surface`, `--inset` and `--line` are now translucent, so use `bg-solid` for anything that floats.
- Screens not yet rebuilt keep their own colours and pick up the tint only where they use the shared tokens.
- Checked in the browser: Overview at 1440×900 in both themes, Transactions at 1440×900 and 390×844 in both themes, the transaction form at 1440×900 in light, and Accounts at 390×844 in light. No page overflowed sideways at 390×844. 768×1024 wasn't rechecked. Text contrast was calculated at the strongest part of the tint. The reduced-transparency fallback wasn't tried in a browser.

### UI adjustment: Rapport and Tilvo accents (`D-087`)

- Added `--pill`, `--on-pill`, `--pine`, `--on-pine`, `--blue`, `--tomato`, `--rose` and `--teal`, with soft tints. These replace `--ocean`, `--terracotta`, `--purple` and `--indigo`. Chart series run blue, tomato, teal, amber, rose.
- Tilvo's exact chart colours keep the owner's look but trip two palette checks: light teal is just under the chroma floor, and the dark set is lighter than the validator's band. Light amber is under 3:1 on its own, so its charts need labels. Colour-blind separation passes in both themes.
- Old screens still use the green bridge colours (`primary-500` and similar) until they're rebuilt.
- Checked in the browser at 1440×900: Overview in light and dark, Accounts in dark. Not rechecked at phone or tablet size.

### UI adjustment: Rapport headers, KPIs and animation (`D-088`)

- `PageHeader` takes `stats` and owns the title and figure animation. `CountUp` in `Money.tsx` handles non-currency figures. Chart timing lives in `src/components/charts/animation.ts`, with `LINE_MOTION`, `BAR_MOTION` and `ARC_MOTION` for the Recharts charts.
- Pages without figures: the settings subpages keep title only. Old screens can repeat a figure in their own cards until they're rebuilt. Account detail keeps its own hero (`D-038`).
- Recharts can't copy Rapport's bar stagger or exact easing curves, so those charts use the nearest built-in easing.

### Module 6: Planning

Built so far: Budget. One responsive page replaces `MobileBudgetView` and `QuickBudgetModal`.

- Rivet's layout (`D-015`): ring and sentence, then category rows with a pace tick, filters for All, Near or over and No cap, and sorting. `BudgetRow`, `ProgressRing` and a shorter `BudgetModal` are new or rebuilt.
- Quick budget is a menu with the four periods, your default first, then a confirmation.
- Budget's spending figures keep the old page's calculation. `spendByCategory` in `budgetModel.ts` also nets refunds, and switching to it would change the numbers.
- `BudgetModal` showed a notes field that never saved, so it's gone. The old Watchlist is now the Near or over filter.
- Checked at 1440×900, 768×1024 and 390×844 in dark: no overflow, phone targets at 44 px or more, filters, month change and the edit form work. Saving a budget, Quick budget and delete weren't run in the browser, and light theme wasn't seen.

Goals is its own page at `/goals`, between Forecast and Calendar (`D-017`, `D-042`).

- `goalsModel.ts`, `forecastModel.ts` and `scheduleModel.ts` already existed, tested but unused by any page. Goals now uses `goalsModel.ts`, with `goalCardView`, `planLine`, `monthlyNeed` and `completionChanges` added. Forecast and Calendar should build on the other two.
- `GoalCard` follows Rivolo: ring, saved, target, months left, and a line on what a month gets you. Buckets expand. Table view, by-bucket grouping, account filter, include in forecast, include all, reorder and monthly targets all stay. Reorder has a drag handle and arrows for touch.
- `GoalScenarioModal` and `GoalTable` are rebuilt, keeping their file names. Goal totals never mix saving, spending and income.
- Rivolo's Add money and Move back aren't built, because Crystal has no such function.
- The Forecast page's goals section and phone Goals tab are gone. `FinancialGoalCard` stays until the Forecast rebuild, which also removes its old projection code.
- Checked at 1440×900 in dark: cards, table, bucket expand, saving an edit, the include switch, include all and monthly targets. Phone and tablet widths have no overflow. Drag reorder, delete, duplicate, and creating a goal or bucket weren't run in the browser. Light theme wasn't seen.

Forecast is rebuilt on `forecastModel.ts` and `scheduleModel.ts` (`D-010`, `D-090` to `D-092`), as one responsive page. `MobileForecastView` and `ForecastChart` are gone.

- `ForecastHorizonChart`: the line, buffer, lowest point, In, Out and Fixed bubble lanes, day hover, a 1.4 s wipe, goal markers and a by-account view. Bills drag, with left and right arrows then Enter from the keyboard. Long ranges group by week and can't be dragged.
- Panels: What moves the line, buffer status with a move suggestion, Cash buffer, Biggest ahead and Low points. `ForecastDayPanel` opens a day or bubble, with a date field for moving. `ForecastList` marks the lowest day overall and in each month. Phones get the chart without bubbles, above the list.
- The Scenario Playground is removed (`D-010`).
- Figures now come from `projectBalances`, not `generateBalanceForecast`. Overdue items land on today, so the demo's 1-year low went from −€311.75 to −€694.75. Overview's Forecast widget still uses the old engine and can disagree until it moves over.
- Checked at 1440×900 in dark: a real drag and Just this one, the buffer warning, day panel, list, and the 90-day and 1-year ranges. Phone and tablet have no overflow. This one and later, The whole series, the move suggestion button, keyboard moves and by-account lines have unit tests or none in the browser. Light theme wasn't seen.

Calendar is rebuilt on `scheduleModel.ts` as one responsive page with four tabs. `MobileScheduleView` and `ScheduledItemRow` are gone.

- Calendar: day bars for the next 30 days, a year heatmap behind a toggle (`D-033`), the month grid and a day panel beside it (`D-007`). Phones get a week strip and the day below. Goals show on their dates.
- Upcoming: overdue, today, next 7 days, then months, with search, a money filter and the overdue filter. Scheduled: Income, Spending, Transfers, From your accounts and Ended (`D-043`). Archive: expired bills, with restore, mark as paid and delete.
- `OccurrenceRow` has Post, plus a menu for edit, skip, end series, expire and delete. `RecurringTransactionModal`, `RecurringOverrideModal` and `EditRecurrenceModal` are rebuilt, keeping their names.
- Overdue recurring items still look back 7 days. A skipped overdue item leaves the list, so the toast has Undo. Posting uses `nextDueAfterPaying`, which keeps earlier unpaid dates open.
- `CalendarView` and `ScheduleHeatmap` remain for Overview.
- Checked at 1440×900 in dark: month grid, selecting a day, month change, heatmap, Upcoming, opening Post, one-date edit, skip with Undo, adding a one-time bill, Scheduled and Archive. Phone and tablet have no overflow, and phone targets are 44 px or more. Saving a posted transaction, This one and later, End series, delete, restore, saving a recurring item and light theme weren't run in the browser.

Subscriptions is rebuilt as one responsive page (`D-028`, `D-093`). `MobileSubscriptionsView` is gone.

- New `utils/subscriptionsModel.ts` with tests: detection moved over unchanged, plus totals, renewals, and pause, resume and cancel.
- Tabs: Active, with subscriptions found in transactions, the 30-day renewal line (a list on phones) and service cards; Paused & cancelled, with Saved by pausing; Wallet, with cards grouped by category. `LoyaltyCard` and `MembershipModal` are rebuilt.
- `pausedAt` is a new optional field on recurring items. The server schema already passes unknown fields through, so no backend change. `liveSeries` leaves paused items out of the Calendar, Forecast, Overview, account pages, bill reminders and bill matching.
- Saving merges into the old record, so clearing a field means saving it as `undefined`, not leaving it out. `resumeService` and Undo do this, and a test guards it.
- Monthly totals now use `monthlyEquivalent`, the same as the Calendar, so weekly and biweekly items differ slightly from before.
- Mark as cancelled sets an end date. Rivet's Trim nudge isn't built.
- Checked at 1440×900 in dark: pause, its effect on Calendar and Forecast, resume, cancel with Undo, the Wallet and the add card form. Phone and tablet have no overflow. Track and Ignore weren't run, because the demo has nothing to detect, and they have unit tests. Saving a card, delete and light theme weren't run.

Tasks is rebuilt as one responsive page, on a new `utils/tasksModel.ts` with tests.

- A checklist in Rapport's style: tick to finish, with filters by status, sort by priority, due date or your order. A Board view stays on tablet and desktop. `TaskItem` and `TaskModal` are rebuilt, and `TasksHeatmap` is now a plain grid, because the chart library drew its cells at zero opacity.
- Tasks left the Settings breadcrumb, because it sits in Planning (`D-017`).
- The heatmap shows open tasks only, and the four summary cards are now the header KPIs.
- Drag to reorder works in Your order, on the list, and moves between statuses are in each task's menu.
- Checked at 1440×900 in dark: tick and untick, add, delete, filter and board. Phone and tablet have no overflow. Drag reorder, editing and light theme weren't run in the browser.

Module 6 is complete. Tasks, Forecast and Calendar were seen in light at 1440×900. Budget, Goals and Subscriptions weren't. Overview's forecast widget still uses the old engine, and `FinancialGoalCard`, `CalendarView`, `ScheduleHeatmap` and `ForecastOverview` stay for Overview until Module 13 or an Overview pass.

### Module 7: Investments

**Status:** Done, with the gaps under Not tested.

- One responsive page with Portfolio, Holdings and Activity tabs (`D-025`). `MobileInvestmentsView`, `HoldingDetail` and `AddInvestmentTransactionModal` are gone, and the page went from 1,606 lines to 525.
- A holding opens in a side panel. `/investments/SYMBOL` still works and opens the same panel.
- The header, chips, chart, allocation and holdings all read one overview, so segments add up to All. Checked in the demo: the six segments sum to €75,355.90, the same as All. This closes `DEF-01` and `DEF-02`.
- `DEF-03`: the line is the default, and candles appear only with 20 or more logged prices, labelled as built from logs (`D-011`).
- `DEF-04`: trades carry a currency and a holding carries its exchange. Quotes come from `/quote` with their real currency, and a quote with no known currency is refused. A $200 trade showed as €186 in the demo (`D-095`).
- `DEF-05`: history deducts sold grants. The mock trend is gone.
- Both price sources stay: Twelve Data and a saved web page. The price form is now a side panel, with ticker and exchange fields it never had.
- Removing `!mb-0` from the Planning pages and Investments restored the gap under the header, which `space-y` had lost.

**Not tested:** a live Twelve Data quote or web page scan, because the demo has no key. Saving a grant and its instalments. Trade edit. Account rows in the Holdings tab were rendered but their menus weren't run. Light theme was seen at 1440×900 on Portfolio and the holding panel only.

### Module 8: Reports

**Status:** Done, with the gaps under each Not tested.

- Reports is a tile picker and one report at a time, with a "What it says" sentence on each (`D-027`). Phones show the tiles, then a report with a way back.
- Automatic reports: year to date, this month so far and the five months before. Saved views sit beside them and now sync through preferences, moving over from this browser once (`S-002`).
- Compared with usual is new: each category against its average over the three periods before, counting only periods with spending.
- All the sums moved from the page to `utils/reportsModel.ts`, with 14 tests. The page went from 1,351 lines to 254.
- Four numbers change on purpose (`D-096`): comparisons now cover the same category and merchant as the report, the pace chart follows the account filter, the forecast stops at today, and monthly budgets scale to the period.
- Cash flow uses design tokens and plain labels, and shows as a list on phones (`D-034`). The Overview widget picks up the same changes.

**Not tested:** with the demo's few recent transactions, Compared with usual, Repeat spending and Unusual payments only showed their empty states in the browser. Their sums are covered by unit tests. Moving real saved views from a browser wasn't run.

**Invoices**

- An aging card (Talvo) sits above a table of documents, with rows on phones. The form is a sectioned full panel (Rapport), and a full-height sheet on phones.
- All the sums moved to `utils/invoicesModel.ts`, with 10 tests. The page went from 386 lines to 210, and the form from 705 to 214.
- Four sums change on purpose (`D-097`): totals convert to EUR, bills you received count as what you owe rather than income, Paid this month checks the year, and a sent invoice past its due date reads as overdue without changing what's saved.
- Saving shows the list the document belongs to. A new quote used to save out of sight when Invoices was showing.
- Turning an accepted quote into an invoice now asks first, because it could create a duplicate. Payment terms stay read-only, as no editor existed (`DOC-06`).
- Ten documents per page became Show more.

**Not tested on Invoices:** a mixed-currency list, and the aging buckets beyond Not due yet, in the browser. Unit tests cover both. Editing a bill you received, and payment terms, weren't run.

**Challenges**

- All seven functions stay, in calm tabs: Score, Debts and goals, Badges, Budgets, Sprints, Predictions and Records (`D-029`). The battle styling, hit points and levels on debts are gone. Badge and sprint names keep some character (`S-005`).
- The sums moved to `utils/challengesModel.ts`, with 15 tests. The page went from 1,164 lines to 311.
- Four faults are fixed (`D-098`): sprints match categories by words, Forecaster unlocks when you make a prediction, a prediction's card and result use the same value, and over-budget categories no longer read Novice.
- A price prediction shows in the holding's currency.

**Not tested on Challenges:** a prediction settling after its end date, a sprint failing or completing, and debt payments on a real loan, in the browser. Unit tests cover the first two. Light theme was seen on Score only.

## Module 9 log

### Hub, Profile and Preferences

- The tile page is gone (`D-045`). `/settings` and the G then S shortcut open Profile. Every Settings page header has "Find a setting", driven by `utils/settingsIndex.ts`.
- `SettingsGroup` is the shared layout: the topic on the left, its controls in a card on the right, stacked below large screens.
- Profile drops text that wasn't true: "Updated 45 days ago", Two-Factor "Engineering Lock", "Tier 1", "Verified Account" and the encryption and audit log claims. The stock photo fallback is now initials.
- Preferences keeps every setting. The eight currency shortcuts go, because the searchable list does the same job.
- `color-scheme` now follows the theme across the app, which fixes white native scrollbars in dark mode.

Tested in the app at 1440×900, 768×1024 and 375×812, with no overflow: search and jump, switches, theme in light and dark, profile save, password dialog validation.

Not tested: a real password change (demo has no backend), picture upload, the Combobox on a real touch device.

### Connections, Data, Categories, Tags, Help and synced choices

- Connections: `BankConnectDialog`, `BankConnectionCard` and `BankLinkDialog` replace the 970-line card's screens. The logic stays in `EnableBankingIntegrationCard`. The sync dialog is now a standard dialog and also serves account pages.
- Data: export and restore logic moved to `utils/dataTransfer.ts`, with tests. Export, Restore and Import details are side panels. The two-step erase stays.
- Import: parsing moved to `utils/importParsing.ts`, with tests. The wizard is a full panel. Phones only choose rows to skip (`D-030`).
- Categories and Tags: tree logic in `utils/categoryTree.ts`, tag sums in `utils/tagsModel.ts`, with tests. Editing is in a side panel (`D-046`).
- Help: `utils/helpContent.ts`, searchable.
- Synced choices: `utils/syncedChoices.ts` and `utils/matcherConfig.ts`, with tests.
- Removed: `FinalConfirmationModal`, `TransactionDateAndAccountFilter`.

Tested in the app at 1440×900, 768×1024 and 375×812, with no overflow: bank cards from demo data, link, sync and connect dialogs, delete confirmation, a full CSV import with a bad row and an unknown currency, deleting that import, a merge restore from a small test file, the first erase step, the phone import, category expand and menu, the icon picker, one local choice moving to preferences.

Not tested:
- Real bank connection, reconnect or sync. Find banks needs a backend, and the demo has none.
- Saving a Twelve Data or Brandfetch key against the live services.
- Choices reaching a second real device, because that needs a backend.
- Completing an erase.
- Drag to reorder categories by hand. The move logic has unit tests.
- Move up and Move down in the running app. The logic has unit tests.
- Downloaded export files. The contents have unit tests.

## Module 10 log

Modules 0 to 8 merged into `main` on 2026-11-01 through PRs #291 to #300.

- Engine: `utils/rules.ts` has one way to run rules, `applyRules`, used by saving, bank sync, the form and previews. The core logic now has tests.
- Migration: `utils/rulesMigration.ts` runs on every load and does nothing once done, so an older backup restored later moves across too. Loads don't save by themselves, so the moved data reaches the server with the next change.
- Model: `utils/rulesModel.ts` holds sentences, previews, runs, undo, ordering, drafts and suggestions.
- Page: `pages/Rules.tsx`, `RuleBuilder`, `RuleRow` and `RulesAdvanced` replace the 3,420-line page. `RegexCategorizationModal` is removed.
- Merchants and the Review queue read and write always file rules. Merchants has a link to Rules in place of the regex dialog.

Tested in the app at 1440×900, 768×1024 and 375×812, with no overflow: migrating old-format data, adding a suggestion, builder validation, a template, live match count, Move down, preview, apply, undo, try a transaction, phone builder steps, editing an always file from Merchants.

Not tested:
- Migration against real saved data on a real server.
- A rule firing on a live bank sync. A bank record with an id has a unit test.
- Drag to reorder by hand. The move logic has unit tests.
- Always file from the Review queue in the app.
- Autofill in the running transaction form with the new rules. It has unit tests.
- A very large rule list or ledger, because match counts run on every change.

`undoRulesMigration` is tested but has no button. Loading migrates again unless the older code is restored, so it's a recovery tool.

## Module 11 log

- Server: `server/src/lock.ts` and `lockRules.ts`, with a 423 check in `authenticateToken`. Adds `users.pin_hash`, `user_sessions.locked_at` and `user_sessions.pin_failures` with additive `ALTER TABLE` statements.
- Client: `LockScreen`, `PinPad`, `PinDialog`, `useIdleLock` and `utils/lockModel.ts`. Lock is in the rail, the profile menu and the phone More sheet, and on the L key. PIN and auto-lock settings are under Profile, Security.
- The mock backend in `server.ts` follows the same rules, so the flow can run without Postgres. Use the `dev-mock` launch configuration.

Tested in the app against the mock at 1440×900, 768×1024 and 375×812, with no overflow: setting a PIN with its three errors, locking by L, the rail and the More sheet, 423 on read and write, no account data on screen, staying locked on reload, wrong PIN by keyboard and keypad, the right PIN, the count of tries, signing out on the fifth, Sign out instead, removing the PIN.

Not tested:
- The real server routes and SQL against Postgres. Their rules have unit tests, and the routes pass type checks only.
- Auto-lock firing in the running app, including after a laptop sleeps. The timing has unit tests.
- A second tab following the lock.
- Locking with unsaved changes, and when the server can't be reached.
- A screen reader on the keypad.
- Whether a browser's own HTTP cache could keep a `/api/data` response.

The disk cache limit first noted here is closed by `D-112`.

In dev builds only, a session that ends falls back to the dev cache. Production has no dev cache.

## Module 12 log

- `utils/currencies.ts` holds the ISO list, symbols, decimals and names. `Currency` is now a string.
- `utils.ts`: `convertToMain`, `getMainCurrency`, `setMainCurrency` and `missingRates`. A missing rate gives 0, not 1:1. `convertToEur` stays for what is defined in EUR. A partial rate table now falls back to known rates.
- About 70 EUR conversions and over 100 hard-coded `'EUR'` values and € signs moved to the main currency. Kept as EUR on purpose: holdings and warrants (`D-095`), rows saved with no currency, and challenge scoring (`D-110`).
- Budget totals in Budgeting, the Overview widget and Challenges now convert each budget from its own currency.
- `ExchangeRates` in Preferences, a banner across the app, and `src/services/exchangeRates.ts`. nginx's report-only CSP allows Frankfurter.

Tested in the app with USD, GBP, JPY and XOF accounts at 1440×900, 768×1024 and 375×812, with no overflow: live ECB rates loaded, EUR to USD and JPY checked against the rates, no double conversion, no decimals in JPY, searching currencies by name, the banner, a manual rate clearing it, and each main page in USD.

Not tested:
- Twelve Data rates with a real key alongside ECB.
- A three-decimal currency in the app (KWD has unit tests).
- The account form's currency picker, onboarding and CSV import with new currencies.
- Bank sync in a currency Crystal hadn't listed before.

## Review before Module 13

Open items from Modules 0 to 12 are worked through before Clean-up, in this order: decisions, a live checklist, behaviour gaps, then screens sorted into rebuild, restyle or delete.

### Decisions (done)

All seven Proposed decisions are closed: `D-074`, `D-075`, `D-079`, `D-080`, `D-083`, `D-084` and `D-085`. Two changed the app: Hide amounts joined the rail, and account heroes and wallet cards have a colour per type. Checked at 1440×900 in dark and light, with computed colours for each type and the rail at 560 px tall. The owner plans a sidebar later, so the top pills and `D-075` are temporary.

### Live checklist (written, not run)

[The checklist](10-live-checklist.md) covers what only a real install can prove: the rules migration, the PIN lock on Postgres, live bank sync, and live rates. It waits on the owner.

### Behaviour gaps (done)

- Overview and Forecast now use one calculation (`D-111`). The tiles' hiding of repeats and their dependence on the chart's range are gone. Checked: Next Year shows €499.75, the same as Forecast's lowest point. `handleEditForecastItem` and related Overview handlers are now unused, for Module 13.
- A record saved with no category and no transfer now files as Uncategorized, so it reaches the Review queue. The form requires a category and bank sync already set Uncategorized, so this path is rare. It has unit tests, and wasn't seen in the app. Older records filed as Transfer this way aren't changed.
- Disk cache closed (`D-112`). Type-checked only, because the demo has no real backend. Added to the live checklist.
- Budget, Goals and Subscriptions looked right in light at 1440×900.
- The Subscriptions timeline had overlapping labels. Labels now take lanes and can't overlap. A label with no free lane shows as a dot with its name on hover.
- Not real gaps: price bindings and account and task order already sync.
- Still open: contrast of restyled old screens, which goes with the screen sort. `HistoricalBalanceTrend` and account detail's lowest point still use `generateBalanceForecast`.

### Old screens (sorted, steps 1 to 8 done)

[The sort](11-old-screens.md) puts every old screen into delete, rebuild or restyle, with an order of work ending in Module 13.

Step 1 deleted 97 source files and 2 test files, about 17,200 lines, including Overview's forecast dialogs and handlers that nothing could open. Types, 404 tests (438 less the 34 in the removed files) and the build pass, and every route opens. Package dependencies stay for Module 13.

Step 2 rebuilt `TransactionDetailModal` as a 640 side panel, a sheet on phones, with `components/PlaceMap.tsx` ready for the merchant profile (`D-115`). It follows Hide amounts, which the old modal didn't, and shows a map only for a saved location. Checked in dark at about 1340 wide, 768×1024 and 375×812, with no overflow, and in light at desktop width: a mapped expense, income, a loan split, a transfer, deleting a transfer (both sides, with undo), Edit, the category list on Overview, and the panel over Quick overview. Hold to delete was checked by its screen reader path only, not by a real long press. The 390×844 size wasn't opened separately, and a real merchant logo wasn't seen because dev has no Brandfetch key.

Step 3 rebuilt `MerchantDetailModal` from 1,540 lines into a 640 side panel of about 150, with `MerchantBranches`, `MerchantKeywordRules`, `MerchantLogoFields` and `utils/merchantModel.ts`, which has 7 tests (`D-116`). The profile on Merchants now holds the map, branches with Google Maps links, website, description, keywords and notes, and `MerchantOverviewModal` is gone (`D-114`). On phones the merchant name now has its own row. Checked in dark at 1440×900, 768×1024 and 375×812 with no overflow: two branches on one map, one older single-address merchant, an online merchant, all three tabs, the unsaved prompt, adding a keyword with its match count, Make primary, saving with the branch stamped on transactions, and the transaction panel on the changed map. Not checked: light theme on these screens, address search, logo upload, Apply to past, removing a branch, and a real Brandfetch logo.

Step 4 deleted `AccountOverviewModal` (1,495 lines) after comparing it with the account page (`D-117`). Rows on Accounts and Investments now open the account page, the phone swipe action is gone, and Investments gained Open account in its menu. Holding figures stay on the Holdings tab. Checked: the row click on both pages, Details at 375×812 with no overflow or clipped numbers, Billing, and the new detail rows at desktop width. The copy button's failure message was seen, but a successful copy wasn't, because the preview pane denies clipboard access. Condition, location and counterparty weren't seen, because the demo data doesn't set them.

Step 5 moved the seven account dialogs and three transaction tools onto the shared dialogs, fields and tokens, and `PaymentPlanTable` now works on touch (`D-118`). It also fixed Add to plan only (Simulate in Plan), which counted the extra twice. Plans already saved with that override keep the doubled figure until the extra is set again or the payment is edited. Checked in dark at 1440×900: save on Adjust balance, opening Update value and Record sale, Defer and Remove deferred, Add to plan only, Edit payment, opening Bulk edit, Assign a category and Matching settings, and saving Combine. At 375×812: the plan and the three loan panels, with no overflow. At 768×1024 the table scrolled inside its box, so it became the list below 1024; the list wasn't reopened at tablet size after that. Not checked: light theme, Record payment, saving a value or a sale, applying Bulk edit, and the dialogs other than the three loan panels on phones.

The same testing led to `D-119`: saves no longer change accounts inside a state updater, so a balance moves once in dev too, and the change now converts directly to the account's currency. Balances already wrong from the old conversion aren't corrected. Checked in dev: +50 on Adjust balance, delete and undo. Not checked in the app: a non-EUR main currency, which only unit tests cover, or a production build. `handleManualWarrantPrice` still sets warrant prices inside an updater, but it sets the same value each time, so a rerun changes nothing.

Step 6 rebuilt `BulkEditTransactionsModal` and `AddMileageLogModal` as side panels and `SplitTransactionModal` as a dialog, with `utils/bulkEdit.ts`, `utils/mileageModel.ts` and `utils/splitModel.ts` (`D-120`). Batch mileage dates now stay as typed, so no time zone can move the day, and impossible dates like 30 February are refused. Checked in dark at 1440×900: a split with comma amounts, with the card balance unchanged at €840.25, Split staying off while parts don't add up, bulk editing two transactions, the mileage error, and batch readings with a bad line and without. At 375×812: bulk edit and both mileage modes, with no overflow. Not checked: Split on phones, these screens at 768×1024, light theme, tags and location in bulk edit, address search, Unsplit and Combine in the app (unit tests cover their balances), and the balance chart with splits, which reads transactions directly and may count a parent and its parts together. Accounts already split or combined keep the extra amount, and undoing an old split no longer removes it, so those balances need Adjust balance.

Step 7 rebuilt `SignIn`, `SignUp` and `OnboardingModal` (`D-121`). The account now follows the main currency chosen the step before, the currency list covers every ISO currency, and amounts accept comma decimals. The side panels with marketing claims, and their external background images, are gone. On the mock backend: a wrong password, the reset note, a short password, and sign-up into onboarding. Going Back and Next left one renamed account and one goal, and a repeat saved with a category. Sign-in at 1440×900 in dark and 768×1024 in light, and sign-in, sign-up and steps 1 to 5 at 375×812, with no overflow. Not checked: a successful sign-in on Postgres, a different currency chosen in step 2, the closing prompt, and onboarding at 768×1024 or in light.

Between steps 7 and 8 the owner made about 73 commits in Antigravity: the sidebar and page pills, the bottom dock, Smooth Tab, the search bar, amount styling, softer borders and glow, logos everywhere and the icon system. Their decisions are recorded as `D-122` to `D-128`, which replace `D-002`, `D-018`, `D-052` and `D-075`. Types, 489 tests and the build passed on that `main`.

Step 8 restyled the Overview widgets and shared bits and finished the forecast engine move (`D-129`). `HistoricalBalanceTrend` and the account page's 30-day lowest point now use `accountForecast` in `utils/forecastModel.ts`, which wraps `forecastFromData`, so `generateBalanceForecast` and its 378 lines are gone. `Modal`, `ConfirmationModal` and the unused `BudgetProgressCard` are deleted. Add a widget and Keyboard shortcuts are dialogs, and the mileage delete uses `ConfirmDialog`. Overview's account filter now shares `hooks/useAccountFilterOptions.tsx` and `FilterList` with the Ledger, the period is a chip `Select`, and both address fields share `components/SuggestInput.tsx`. Also fixed: the map summed amounts across currencies and called income spending, Runway counted split parents, the transaction list worked out merchant logos its own way instead of from Merchants, and map tooltips were white in dark mode. The search bar's zinc greys now use tokens. Checked in dark at 1440×900: every Overview widget with demo data, Add a widget, the account filter and period chips, the account trend on a checking and a vehicle account, Keyboard shortcuts, search, deleting a mileage reading, and the address field in New transaction. In light at 1440×900: the lower widgets. At 768×1024 and 390×844: Overview and the account trend, with no page overflow. Not checked: address and city suggestions, which need the outside geocoder, the map with real places, credit card statements (the demo has none due), and the shortcut `?` from a real key press (a synthetic key event opens it). At 768 the new sidebar leaves Overview about 500 px, so Safe to spend is cut off; that belongs to the sidebar (`D-122`), not these widgets.

After step 8, the owner found Overview's forecast higher than Forecast's. Forecast had started counting pending warrant tax instalments and Overview hadn't, and the tiles used different periods (`D-130`). `warrantTaxBills` in `utils/forecastModel.ts` now feeds Forecast, Overview and the account page, and `horizonTiles` reuses `lowestPoints`. Checked with a €1,500 test instalment on the demo checking account: all four Overview tiles matched Forecast's Low points (€3,285.75, €1,143.75, €501.75 and −€782.25), then the instalment was removed.
