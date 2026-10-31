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
| 6 | Rules | Rebuild (`D-009`), with tests first | Not started |
| 7 | Planning | Budget, Forecast, Goals, Calendar, Subscriptions, Tasks | Not started |
| 8 | Investments | Portfolio, Holdings, Activity, `DEF-01`, `DEF-02`, `DEF-03`, `DEF-04`, `DEF-05` | Not started |
| 9 | Reports | Reports, Invoices, Challenges | Not started |
| 10 | Settings and data | Hub, Connections, Data, synced choices (`S-002`) | Not started |
| 11 | PIN lock | Idle lock, server-side design (`D-013`) | Not started |
| 12 | Any currency | Support across the app (`S-010`) | Not started |
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
- Forecast overflows inside the main area by 8 px at 768 px, and Merchants by 13 px at 390 px. Their modules (7 and 5) rebuild those layouts. The six overflows from module 0 are otherwise gone.
- Tabs exist only for pages that exist. Accounts and Investments have none yet, and Review queue and Goals aren't listed. They arrive in modules 4, 8, 5 and 7.
- Rail Review queue opens the Ledger until module 5. Rail Today opens Calendar.
- Lock isn't in the rail or More until module 11, so the rail has seven tools.
- Create opens Add transaction everywhere. The Create menu (`NAV-08`) and "Create something else" (`D-071`) wait for the forms to be reachable from anywhere, in modules 4 and 7.
- On phones the tab row sits under the top bar, above the page title, because the shell can't reach inside old pages.
- Phone page actions still sit under the title until each page is rebuilt.
- Subscriptions on phones keeps its floating button until module 7.
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
- `AccountOverviewModal` should become a side panel (`D-024`). It's a 1,500-line modal, so it's deferred.
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
- `TransactionDetailModal` isn't a side panel yet (`D-024`), and `MerchantDetailModal` keeps its old look.
- Merchants still has the old map in Map and details, and the keyword and regex rules in Auto-categorise until module 6.
- Past bank transactions aren't reprocessed by the `DEF-06` fix.
- Saving a transaction with no category still files it as Transfer, as it always has.
