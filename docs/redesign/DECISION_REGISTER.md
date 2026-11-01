# Design Decision Register

The record of decisions made during the Crystal redesign, so they aren't forgotten or contradicted. A decision changes only when the owner changes it.

**Status:** Approved, or Open. Feature IDs refer to `01-application-feature-inventory.md`.

## Project decisions (approved)

| ID | Date | Decision | Why |
|---|---|---|---|
| P-001 | 2026-10-31 | The earlier `-new` redesign is removed. Its presentation layer goes; original functionality stays | Owner not satisfied with that redesign |
| P-002 | 2026-10-31 | The abandoned work is archived at tag `archive/new-ui-2026-10-29` | Keeps removal recoverable |
| P-003 | 2026-10-31 | Keep the transactions, schedule, forecast and goals models and their tests. Delete the six redesign hooks | Tested logic the new design will need |
| P-004 | 2026-10-31 | Delete the old redesign reference and plan documents from the working tree. The archive tag keeps them | Clean slate |
| P-005 | 2026-10-31 | Revert the redesign's classic tooltip transparency change | It made a classic component less readable |
| P-006 | 2026-10-31 | Keep old branches until the cleanup is merged, then delete them as a separate step | No effect on the code |
| P-007 | 2026-10-31 | Keep the redesign's bug fixes in shared code | Reverting would change balances and loan figures |

## Apple HIG (approved)

| ID | Date | Decision | Why |
|---|---|---|---|
| H-001 | 2026-10-31 | Order of authority: owner decisions, feature inventory, reference websites, then Apple HIG | HIG complements the method and doesn't replace it |
| H-002 | 2026-10-31 | Every HIG finding is tagged: accessibility requirement, general UX principle, Apple platform convention, or optional visual recommendation | Not every recommendation is mandatory |
| H-003 | 2026-10-31 | WCAG 2.2 AA decides accessibility pass or fail on the web. HIG figures are targets | Apple's contrast threshold is more lenient for web text |
| H-004 | 2026-10-31 | No Apple-specific navigation, sidebars, Liquid Glass, SF Symbols or typography is assumed | Crystal keeps its own identity |
| H-005 | 2026-10-31 | When HIG conflicts with a reference site, the owner chooses after seeing the trade-off | Owner takes part in design decisions |
| H-006 | 2026-10-31 | The skill stays on disk at `.claude/skills/apple-design/`, excluded from git | Apple's text has no open license and the repo is public |

## Scope decisions (approved)

| ID | Date | Decision | Why |
|---|---|---|---|
| S-001 | 2026-10-31 | Bring back leased-vehicle residual value, account website, the Meal Voucher sub-type and merchant autofill | Each already has data or logic, and the leased value affects net worth |
| S-002 | 2026-10-31 | Sync browser-only user decisions across devices: saved reports, ignored subscriptions, goals in the forecast, matching settings, ignored matches, dismissed notifications | The owner will use several devices. This is a small, deliberate functional change |
| S-003 | 2026-10-31 | Remove items that look like features but don't work: the two-factor row, fixed profile text, AI labels and the wrong version label | Nothing that works is lost |
| S-004 | 2026-10-31 | Real two-factor sign-in is a future feature, outside this redesign | Keeps the redesign focused |
| S-005 | 2026-10-31 | Wording becomes plain language, with some character kept in places such as Challenges | Clearer, while keeping some personality |
| S-006 | 2026-10-31 | Every page gets a purpose-designed phone experience, including Reports, Tasks, Invoices, Challenges, Rules, Merchants, data and settings | The owner wants nothing left as a squeezed desktop page |
| S-007 | 2026-10-31 | Phone Transactions gains multi-select, bulk edit and categorise, and combine. CSV export can stay desktop-only | Bank sync is the main data source, so cleanup must work on a phone |
| S-008 | 2026-10-31 | Shared household data is a separate project after the redesign. The design must leave room for it in navigation and accounts | Crystal stores one private document per user, so sharing is a data-model change |
| S-009 | 2026-10-31 | Separate accounts for individuals stay as they are. They already exist | Confirmed by the owner's future household plans |
| S-010 | 2026-10-31 | Support for any currency is a separate, tested step in Phase 9. The design allows for it from the start | It touches currency lists, exchange rates and the 1:1 fallback |

| S-011 | 2026-10-31 | Keep every behaviour in section 11 of the inventory unless a decision changes it. Merchant autofill in the transaction form is required | It works today and has no button that would show it in a redesign |
| S-012 | 2026-10-31 | Keep both price sources, Twelve Data and web scraping | The owner relies on both |
| S-013 | 2026-10-31 | DEF-01, DEF-02, DEF-05 and DEF-06 are fixed in Phase 9, not before Phase 4. Investment totals and sync categorisation stay as they are until then | Owner decision: keep the phases in order |

## Owner profile

Used to weigh priorities. None of this removes any feature.

| Topic | Answer |
|---|---|
| Regular use | All areas: daily money, planning, investments and other tools |
| Devices | Mostly desktop today, phone later, because the phone experience isn't good enough yet |
| Phone goals | Check money, record spending, tidy transactions, plan and pay |
| Data source | Live bank sync |
| Users | One user today |
| Currencies | Mainly EUR, with some USD, GBP and RON |

## Design decisions

| ID | Date | Decision | Source | Notes |
|---|---|---|---|---|
| D-001 | 2026-10-31 | Overall look and feel follows Orvel | Orvel | Warm, precise, money figures first |
| D-002 | 2026-10-31 | Desktop navigation uses top pills and a floating tool rail | Rapport | About seven main destinations, so Crystal's pages need grouping. The owner chose this over the recommended sidebar |
| D-003 | 2026-10-31 | Phone navigation uses scrolling top pills and a bottom toolbar | Rapport | **Replaced by `D-051`.** The owner chose this over bottom tabs. Primary navigation sits out of easy thumb reach, so the toolbar should carry the most-used actions. Apple's tab bar guidance is a convention, not a requirement |
| D-004 | 2026-10-31 | The Dashboard combines a written summary, Safe to spend and a forecast card | Orvel, Rivolo, Talvo | Needs careful priority on phones |
| D-005 | 2026-10-31 | Seven hubs with tabs: Overview, Accounts, Transactions, Planning, Investments, Reports, Settings | Orvel, Talvo, for the tabs | Exact page placement is still to be mapped in Phase 6 |
| D-006 | 2026-10-31 | Transactions has a scatter, Ledger, Review queue and Rules tabs, plus a filter-aware summary panel | Orvel, Rivolo | The scatter needs labels and a list as its accessible alternative |
| D-007 | 2026-10-31 | The calendar combines Rapport's layout and Today panel, Rivolo's daily money figures and its phone week strip | Rapport, Rivolo | |
| D-008 | 2026-10-31 | One Review queue covers uncategorised transactions and transfer and bill matches, with Select mode for bulk work | Orvel | Replaces the separate pending-matches screens. All `MAT` functions must survive |
| D-009 | 2026-10-31 | Rules are rebuilt in Orvel's style: plain-sentence rules, suggestions and "Always file like this". Merchant, keyword and regex rules combine into one place, with an advanced option | Orvel | Functional rework with tests in Phase 9. Resolves the rework-scope question |
| D-010 | 2026-10-31 | Forecasting follows Talvo: buffer line, income and bill bubbles, "What moves the line", suggestions and drag to test | Talvo | **Removes the Scenario Playground (`FCT-04`)**: savings boost, market return and inflation assumptions. Deliberate owner choice |
| D-011 | 2026-10-31 | Investment charts default to a line, with an optional candlestick toggle for holdings with enough price data | Rivet | Answers DEF-03 |
| D-012 | 2026-10-31 | Merchants follow Rivolo's Payees: a list beside a live profile, and a separate step on phones | Rivolo | Must keep everything merchant autofill uses (`AUT-01` to `AUT-10`) |
| D-013 | 2026-10-31 | Crystal gets a PIN lock: "Lock Crystal" in the profile menu, a shortcut, and auto-lock after a set idle time, with Sign out instead | Talvo | New feature. It hides the screen and doesn't protect loaded data by itself. Server-side PIN design belongs in Phase 9 |
| D-014 | 2026-10-31 | No month close | None | Bank sync can add older transactions, and the Review queue covers cleanup |
| D-015 | 2026-10-31 | Budget uses Rivet's simpler list, sorted by use, with near-or-over filters | Rivet | Quick budget options and all `BUD` functions must stay. Rivet's list was seen through its controls, not studied closely, so it needs a closer look in Phase 6 |
| D-016 | 2026-10-31 | Accounts uses Rivolo's pots, with further tabs for Crystal's other account types | Rivolo | Crystal's type-specific views must stay (`ACC-26` to `ACC-40`). The tab structure is mapped in Phase 6 |
| D-017 | 2026-10-31 | Hub placement: Overview; Accounts; Transactions (Ledger, Review queue, Rules, Merchants); Planning (Budget, Forecast, Goals, Calendar, Subscriptions, Tasks); Investments; Reports (Reports, Invoices, Challenges); Settings (Profile, Preferences, Connections, Categories, Tags, Data, Help) | Orvel, Talvo | |
| D-018 | 2026-10-31 | The tool rail holds Search, Create, Today, Review queue, Sync banks, Settings, Theme and Lock, with tooltips | Rapport | |
| D-019 | 2026-10-31 | The phone bottom toolbar holds Add, Calendar, Review and More, with labels. Search moves to the top bar | Rapport, adapted | **Replaced by `D-051`.** More holds sync, privacy, theme and lock |
| D-020 | 2026-10-31 | Accounts tabs are All, Cash, Cards, Loans and Assets. Investments link to their own hub | Rivolo | Refines `D-016` |
| D-021 | 2026-10-31 | The phone Dashboard opens with the sentence, Safe to spend and Needs you, then Forecast, Accounts and Recent activity | Orvel, Rivolo, Talvo | Refines `D-004` |
| D-022 | 2026-10-31 | The transaction form shows type, amount, merchant, account, date and category first. Location, tags, notes, split and round-up expand | Rapport, adapted | Every field and all autofill stay |
| D-023 | 2026-10-31 | One account form replaces Add and Edit: pick the type, then short sections for that type | None | All `ACC-10` to `ACC-19` fields stay |
| D-024 | 2026-10-31 | Overlay rule: short task is a dialog, viewing or editing a record is a side panel, long or multi-step is a full panel. All become bottom sheets on phones | Most references | |
| D-025 | 2026-10-31 | Investments uses Rivet's KPIs, line chart, allocation bar and holdings table, plus warrants, pension and spare change. Holdings open in a side panel. Rebalance and watchlist aren't included | Rivet | |
| D-026 | 2026-10-31 | Trades and prices record a currency, and holdings an exchange, in Phase 9. EUR values are calculated from rates | None | Resolves DEF-04. Existing trades default to EUR, so USD-priced ones may need correcting |
| D-027 | 2026-10-31 | Reports combines Orvel's tiles and "What it says", Talvo's chart tabs and Rivolo's comparison with usual, plus automatic reports and optional saved views | Orvel, Talvo, Rivolo | Automatic reports are a new function |
| D-028 | 2026-10-31 | Subscriptions uses Tilvo's totals, renewal timeline and service cards, a Paused & cancelled tab, detected subscriptions on top, and a Wallet tab for loyalty cards | Tilvo | Paused changes tracking only. No loyalty reference, so the Wallet uses Tilvo's card style |
| D-029 | 2026-10-31 | Challenges keeps all functions in calm tabs, with plain language and no battle styling | None | |
| D-030 | 2026-10-31 | Data import keeps its steps in a calmer full panel, desktop first, with simplified phone steps. Backups use a statements-style list | Rivet | A stated exception within `S-006` |
| D-031 | 2026-10-31 | Colour: warm light canvas with forest green as the main accent and amber for highlights, plus a matching dark mode | Orvel, Rapport | Replaces the orange in DESIGN.md. Tune values for contrast in Phase 8 |
| D-032 | 2026-10-31 | Spacious density | Rapport | Differs from Orvel's denser look in `D-001`, so large tables may need a compact option |
| D-033 | 2026-10-31 | Schedule shows day bars by default, with the heatmap behind a toggle | Orvel | |
| D-034 | 2026-10-31 | The Cash Flow Sankey appears in Reports and as a Dashboard widget | None | |
| D-035 | 2026-10-31 | The Dashboard keeps a free grid, using KokonutUI's Widget Grid: six columns, drag, resize and keyboard support. Phones use reorder and hide | KokonutUI | Replaces react-grid-layout, if testing in Phase 9 confirms it. Icons must be swapped to Crystal's set |
| D-036 | 2026-10-31 | Pages stay spacious, while large tables have a Comfortable or Compact switch | Crystal | Refines `D-032`, and keeps `TXN-05` |
| D-037 | 2026-10-31 | Forest green is the primary colour and amber marks attention. Money in uses a separate, brighter green | Orvel, Rapport | Refines `D-031` |
| D-038 | 2026-10-31 | All accounts share one frame: hero, chart, then tabs. Property and vehicles add their own tabs, such as Valuations and Mileage | Orvel, adapted | All `ACC-26` to `ACC-40` functions stay |
| D-039 | 2026-10-31 | Loans gain a "What if you paid extra?" slider, and the early payment form stays | Talvo | New function |
| D-040 | 2026-10-31 | Long lists load in batches, with Show more and a count | Talvo | Replaces page numbers (`TXN-04`) |
| D-041 | 2026-10-31 | Category picking shows three suggestions, then a searchable list, with "Always file like this" below | Orvel | |
| D-042 | 2026-10-31 | Goals use Rivolo's cards, with buckets expanding, and a table view stays | Rivolo | |
| D-043 | 2026-10-31 | Recurring items group by Income, Bills and Transfers, with automatic items marked | Rivolo, adapted | |
| D-044 | 2026-10-31 | Sign in and Sign up use a simple centred card, with unsupported marketing claims removed | None | |
| D-045 | 2026-10-31 | Settings uses hub tabs and a "Find a setting" search. The tile page goes away | Orvel | |
| D-046 | 2026-10-31 | Categories use an expandable tree, and Tags a simple list. Editing is in a side panel | None | |
| D-047 | 2026-10-31 | On phones, tapping a row opens details with all actions, and swiping offers two or three shortcuts | Orvel, Rapport | Every action works without a swipe |
| D-048 | 2026-10-31 | The 67 remaining Proposed rows in the mapping are accepted. Any can still be changed later | Mapping | |
| D-049 | 2026-10-31 | Add ocean blue, terracotta, purple and indigo for categories and charts only | Owner | They never mean good or bad, because terracotta is close to the money-out red. All pass AA in both themes |
| D-050 | 2026-10-31 | Net Worth takes the green hero card on the Dashboard. Safe to spend moves to an ordinary card | Owner | Revises `D-004` and `D-021` |
| D-051 | 2026-10-31 | The phone bottom bar is navigation (hubs and More set by `D-054`). Top pills and the Add, Calendar, Review and More toolbar are dropped from phones. Search, notifications and Create sit in the top bar | Owner | **Replaces `D-003` and `D-019`** |
| D-052 | 2026-10-31 | The desktop tool rail is vertically centred on the screen | Owner | Refines `D-002` |
| D-053 | 2026-10-31 | Safe to spend stays as a Dashboard widget that can be hidden | Owner | Refines `D-050` |
| D-054 | 2026-10-31 | The phone bottom bar shows Overview, Accounts, Transactions, Planning and More. More holds Investments, Reports, Settings, Sync, Privacy, Theme and Lock. It doesn't scroll | Owner | **Revises `D-051`.** Create stays in the top bar. The owner didn't object to the top-bar position, so it can be revisited in testing |
| D-055 | 2026-10-31 | Frosted glass stays on floating items only: the rail, the phone bar, tooltips and similar. It's never used on content cards, and has a solid fallback when your system reduces transparency | Owner | Follows `liquid-glass.md`, which keeps glass on the floating layer |
| D-056 | 2026-10-31 | The Design Direction and preview are approved | Owner | Phase 7 complete |
| D-057 | 2026-10-31 | Manrope is the default typeface, self-hosted. The typeface choices in Preferences stay | Owner | Tabular figures to be confirmed in Phase 8 |
| D-058 | 2026-10-31 | Hugeicons Stroke Rounded replaces Phosphor everywhere | Owner | The owner chose this over the recommended Phosphor line. The free set has no filled style, so active items use a pill and a heavier stroke. Saved icon names stay in the data and are translated when shown |
| D-059 | 2026-10-31 | Motion is expressive: number count-ups, staggered cards and chart reveals | Owner | The owner chose this over the recommended subtle level. Respects reduced motion, and never delays input |
| D-060 | 2026-10-31 | Charts are clean and labelled: light grid, direct labels, rounded bars, soft area under lines | Owner | |
| D-061 | 2026-10-31 | Charts use five chart-only shades of the approved hues. Approved colours stay on chips, labels and icons | Owner | Approved colours failed the colour-blind check as series. Refines `D-049` |
| D-062 | 2026-10-31 | Count-ups and staggers play on the first visit to a page in a session, then pages appear at once | Owner | Refines `D-059` |
| D-063 | 2026-10-31 | Normal spending is plain text with a minus. Income is green with a plus. Red is for losses and overspending | Owner | |
| D-064 | 2026-10-31 | Corners, card borders without shadows, the type scale and Comfortable as the default table density stay as specified | Owner | |
| D-065 | 2026-10-31 | Deleting uses a press-and-hold button, then Undo. Adapted from KokonutUI's Hold Button (MIT), 1.2 seconds | KokonutUI | Owner's choice over a confirmation. Screen readers only send a click, so that case gets a plain confirmation (tier A). Account deletion keeps type-to-confirm, as today |
| D-066 | 2026-10-31 | Toasts sit at bottom centre on desktop and tablet, and above the selection bar when it's showing | Owner | Owner's choice over bottom right |
| D-067 | 2026-10-31 | Overlays dim the page with a scrim and a very slight 2 px blur. The blur drops with reduced transparency | Owner | Refines `D-055`: blur on the scrim only, never on cards |
| D-068 | 2026-10-31 | Closing a form with unsaved changes asks first: Keep editing or Discard | Owner | |
| D-069 | 2026-10-31 | On phones, swiping a transaction left reveals Categorise and swiping right reveals Select. Delete stays in details | Owner | Refines `D-047` |
| D-070 | 2026-10-31 | The phone bottom bar stays visible while scrolling, and hides only with the keyboard open | Owner | |
| D-071 | 2026-10-31 | The phone Create button opens Add transaction at once, with a Create something else link | Owner | |
| D-072 | 2026-10-31 | Tablets keep the tool rail | Owner | |
| D-073 | 2026-10-31 | The Design System Specification, Component Inventory and Responsive Specification are approved | Owner | Phase 8 complete |
| D-074 | 2026-10-31 | Proposed: Privacy moves to the profile menu on desktop and tablet, as Hide amounts. It stays in More on phones | Mapping `NAV-10` | The eight rail tools don't include it, and the sidebar that held it is gone. Awaiting the owner |
| D-075 | 2026-10-31 | Proposed: the logo hides under 900 px, so the seven pills keep their 12 px padding. Overview does the same job | None | Awaiting the owner |
| D-076 | 2026-10-31 | Safe to spend is cash in the primary checking and cash accounts, less everything due before the next income, less a cushion you set. With no scheduled income it runs to the end of the month | Owner | New function. Other accounts, including savings, don't count. With no primary set, every checking account counts |
| D-077 | 2026-10-31 | The grid test passed, so KokonutUI's Widget Grid replaces react-grid-layout, with an edit mode, row spans and three columns on tablets added | KokonutUI | Confirms `D-035`. The source is the registry's `bento-grid`, MIT |
| D-078 | 2026-10-31 | Overview has no tabs. Analysis and Activity widgets join one grid. Pending Matches opens from Needs you until the Review queue exists | Direction section 3 | Saved layouts carry over. Old keys stay in place |
| D-079 | 2026-10-31 | Proposed: hub tabs that share one page keep their tab in the URL as `?tab=`, so Accounts stays one page with five tabs | None | Reload and Back keep the tab. Awaiting the owner |
| D-080 | 2026-10-31 | Proposed: account pages use the green hero, the same as Overview, so "once per page" holds and every type looks alike | `D-038` | Awaiting the owner |
| D-081 | 2026-10-31 | Accounts follows Rivolo's Wallet. Tabs are Cards (the default), Accounts, Loans and Assets. All is removed, and investment accounts stay in the Investments hub | Owner, Rivolo | **Replaces `D-020`.** Cards lists any account with a card, read from the account: card details, a credit card or a meal voucher |
| D-082 | 2026-10-31 | An account with a card appears under Cards and as a pot under Accounts. Credit cards and meal vouchers appear under Cards only | Owner, Rivolo | |
| D-083 | 2026-10-31 | Proposed: a merchant's own category beats regex rules, and rules and round-ups now run on new bank transactions | `DEF-06`, `DEF-07` | Fixes both. Applies from the next sync, not to past transactions. Awaiting the owner |
| D-084 | 2026-10-31 | Proposed: the scatter uses a log scale and hides on phones, so small and large amounts share a chart. The ledger below it is the accessible list | `D-006` | Awaiting the owner |
| D-085 | 2026-10-31 | Proposed: a charge on a loan account saves as a plain expense with no split. The old form showed the split and refused the amount unless you filled it in. Loan payments still need principal and interest | `D-022` | Awaiting the owner |

## Open questions

None at present.
