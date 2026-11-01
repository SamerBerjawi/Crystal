# Crystal: Implementation Progress Tracker

Phase 9 tracker. It records what's built, what was tested and what wasn't. A module is only Done after checks at 1440 × 900, 768 × 1024 and 390 × 844, in light and dark. Anything skipped is written here.

**Base:** this work stacks on `refactor/remove-new-ui`, which wasn't merged into `main` when Phase 9 started. Nothing is committed until the owner asks.

**How old pages keep working:** the old colour names are mapped onto the new palette. Every page takes the new look at once and keeps working until its module is rebuilt. This bridge isn't the finished design, and it's removed in the final module.

## Modules

| # | Module | Includes | Status |
|---|---|---|---|
| 0 | Foundation | Tokens, Manrope, Hugeicons, colour bridge | Done |
| 1 | Primitives | Buttons, fields, menus, overlays, table, states | Not started |
| 2 | App shell | Pills, tab row, rail, phone bar, More, top bar | Not started |
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

**Status:** Done, uncommitted.

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
