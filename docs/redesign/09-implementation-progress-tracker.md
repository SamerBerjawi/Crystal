# Crystal: Implementation Progress Tracker

Phase 9 tracker. It records what's built, what was tested and what wasn't. A module is only Done after checks at 1440 × 900, 768 × 1024 and 390 × 844, in light and dark. Anything skipped is written here.

**Base:** this work stacks on `feat/redesign-primitives-shell`, then `feat/redesign-foundation`, then `refactor/remove-new-ui`. None were merged into `main` when this was written. Nothing is committed until the owner asks.

**How old pages keep working:** the old colour names are mapped onto the new palette. Every page takes the new look at once and keeps working until its module is rebuilt. This bridge isn't the finished design, and it's removed in the final module.

## Modules

| # | Module | Includes | Status |
|---|---|---|---|
| 0 | Foundation | Tokens, Manrope, Hugeicons, colour bridge | Done |
| 1 | Primitives | Buttons, fields, menus, overlays, table, states | Done |
| 2 | App shell | Pills, tab row, rail, phone bar, More, top bar | Done, with the gaps listed below |
| 3 | Overview | Summary, hero, Needs you, Safe to spend, grid | Not started |
| 4 | Accounts | Hub tabs, account frame, one account form | Not started |
| 5 | Transactions | Ledger, Review queue, Merchants, `DEF-06` | Not started |
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
