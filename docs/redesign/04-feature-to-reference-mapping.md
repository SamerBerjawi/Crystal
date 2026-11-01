# Crystal: Feature-to-Reference Mapping

Phase 6 deliverable. It maps every subfeature in the [Feature Inventory](01-application-feature-inventory.md) to a design pattern. Approved choices come from the [Decision Register](DECISION_REGISTER.md).

**Status words**
- **Decided:** follows an approved decision.
- **Proposed:** my recommendation, which stands only if you accept it.

**Sources.** Rapport, Orvel, Talvo, Rivolo, Rivet and Tilvo. "No reference" means I'm proposing a pattern based on Crystal's needs, using the closest approved style.

## 1. Rules for every screen

These apply unless a row says otherwise, so the tables stay short.

| Size | Rule |
|---|---|
| Desktop (1024 px and wider) | Rapport pills and tool rail. Page tabs under the pill. Details open in a side panel, short forms in a dialog |
| Tablet (768 to 1023 px) | Same navigation. Two columns become one where needed, and side panels stay. Tables keep their main columns |
| Phone (under 768 px) | Bottom navigation: Overview, Accounts, Transactions, Planning, More. Tables become rows. Side panels and dialogs become bottom sheets. Long forms become full-height sheets |

**Across all sizes:** Orvel's look. Automations in section 11 of the inventory stay. Money uses plain language. Charts carry a text alternative. Dragging always has a keyboard or button alternative, as Talvo does.

## 2. Hubs

`D-005` set seven hubs, and `D-017` approved this placement.

| Hub | Tabs | Inventory modules |
|---|---|---|
| Overview | None | `DSH` |
| Accounts | All, Cash, Cards, Loans, Assets | `ACC` |
| Transactions | Ledger, Review queue, Rules, Merchants | `TXN`, `MAT`, `RUL`, `MER` |
| Planning | Budget, Forecast, Goals, Calendar, Subscriptions, Tasks | `BUD`, `FCT`, `GOL`, `SCH`, `SUB`, `TSK` |
| Investments | Portfolio, Holdings, Activity | `INV` |
| Reports | Reports, Invoices, Challenges | `RPT`, `DOC`, `CHL` |
| Settings | Profile, Preferences, Connections, Categories, Tags, Data, Help | `SET`, `BNK`, `CAT`, `TAG`, `DAT`, `HLP` |

## 3. Decision status

All Phase 6 decisions are made: `D-001` to `D-055`. Rows still marked Proposed are smaller details, which follow this mapping unless you change them.

## 4. Mapping by module

### 4.1 Access and onboarding (`ACS`)

**Advantage:** A familiar, calm entry. **Risk:** Almost no reference shows sign-in. **Recommendation:** Keep it simple, in Orvel's style.

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `ACS-01`, `ACS-02`, `ACS-03` | No reference | Simple centred card | Centred card, without marketing claims | Full screen, large fields | Decided `D-044` |
| `ACS-04` | Current Crystal | Secondary button | Below the form | Below the form | Proposed |
| `ACS-05` | Orvel, loading states | Skeletons | Page skeleton | Page skeleton | Proposed |
| `ACS-06` | Talvo, account menu | Profile menu item | Profile menu | Profile menu | Proposed |
| `ACS-07` | Rapport, create dialog | Step-by-step dialog | Centred dialog | Full-height sheet | Proposed |
| `ACS-08` | Talvo, undo pill | Quiet status pill | Bottom pill | Above bottom bar | Proposed |
| `ACS-09` | Current Crystal | Recoverable error | Card with Retry | Card with Retry | Proposed |
| `PIN lock`, new | Talvo, account menu | Full-screen keypad | Keypad and keyboard | Keypad | Decided `D-013` |

### 4.2 Global shell (`NAV`)

**Advantage:** A distinctive frame. **Risk:** The rail has no visible labels, and More hides three hubs on phones. **Recommendation:** Add tooltips, and label More clearly.

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `NAV-01` | Rapport, Orvel | Top pills on desktop, bottom bar on phone | Seven pills | Bottom bar and More | Decided `D-002`, `D-054` |
| `NAV-02` | Rapport, Talvo | Account menu | Top right | Top right | Proposed |
| `NAV-03` | Orvel, Talvo, Rivolo, phone | Bottom navigation | Not used | Four hubs and More | Decided `D-054` |
| `NAV-04` | Orvel, More | More menu | Not used | Investments, Reports, Settings, Sync, Privacy, Theme, Lock | Decided `D-054` |
| `NAV-05` | Rapport, Orvel | Title, KPIs and written sentence | Title beside KPIs | Stacked | Proposed |
| `NAV-06` | Rivolo, search | Command palette | Centred palette | Full-screen search | Proposed |
| `NAV-07` | Talvo | Shortcuts list, including L | Dialog | Hidden | Proposed |
| `NAV-08` | Rapport, Create menu | Create menu plus N key | Rail button | Top bar button | Proposed |
| `NAV-09` | Orvel, Rapport | Notifications pop-over | Top right | Top right, sheet | Proposed |
| `NAV-10`, `NAV-11` | Rapport, account menu | Menu toggles | Rail and menu | More menu | Proposed |
| `NAV-12` | Talvo, Orvel | Skeletons and pill toasts | As source | Above bottom bar | Proposed |
| `NAV-13` | Rapport, Orvel | Grabber sheets, swipe rows | Not used | Keep existing gestures | Decided `D-047` |

### 4.3 Dashboard (`DSH`)

**Advantage:** Combines action, spending room and the future. **Risk:** Density. **Recommendation:** Strict order, and fewer cards at first on phones.

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `DSH-01` | Orvel, top bar | Scope chips | Below title | Filter sheet | Proposed |
| `DSH-02` | Orvel, overview | Move and create actions | Header | Top bar | Proposed |
| `DSH-03` | Orvel, greeting; Rivolo, Your money | Written summary, Net Worth hero, and Safe to spend widget that can be hidden | Top row | First cards | Decided `D-050`, `D-053` |
| `DSH-04` | Rapport, Today | Today agenda | Side column | Card with checkboxes | Decided `D-007` |
| `DSH-05` | Talvo, Next 30 days | Forecast card | Top row | Short chart | Decided `D-004` |
| `DSH-06` | Talvo, card stack | Statement cards | Card | Swipe row | Proposed |
| `DSH-07` | Rivolo, Net worth | Line chart | Card | Short chart | Proposed |
| `DSH-08` | Orvel, Where it went | Ranked bars | Card | Top five | Proposed |
| `DSH-09`, `DSH-11` | Orvel, Cash | Split bars | Card | Collapsed | Proposed |
| `DSH-10` | Orvel, Latest payments | Short ledger | Card | Short list | Proposed |
| `DSH-12` | Rivet, Plans | Budget list | Card | Top three at risk | Proposed |
| `DSH-13` | Current Crystal | Map | Card | Opens full screen | Proposed |
| `DSH-14` | Current Crystal | Sankey | Report and widget | Simplified top flows | Decided `D-034` |
| `DSH-15`, `DSH-16` | Orvel, Analytics; Talvo, Cost cover | KPI cards | Below fold | Below fold | Proposed |
| `DSH-17` | Rivolo, Goals | Goal cards | Card | Horizontal cards | Proposed |
| `DSH-18` | Orvel, Needs you | Links into Review queue | Top row | Near top | Decided `D-008` |
| `DSH-19` | KokonutUI, Widget Grid | Free grid with keyboard support | Drag and resize | Reorder and hide | Decided `D-035` |
| `DSH-20` | Orvel, Rivolo, Talvo | Ordered card stack | Not used | Sentence, Safe to spend, Needs you first | Decided `D-021` |

### 4.4 Accounts (`ACC`)

**Advantage:** Clear pots with depth by type. **Risk:** Crystal has far more account types than Rivolo. **Recommendation:** Rivolo's cards in tabs, with Crystal's own views inside.

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `ACC-01` | Rivolo, Your money | Total and split bar | Top card | Top card | Decided `D-016` |
| `ACC-02`, `ACC-03`, `ACC-04` | Rivolo, Wallet tabs | Pots by tab | Tabs and cards | Scrolling tabs | Decided `D-016` |
| `ACC-05` | Current Crystal | Manual order | Drag | Reorder mode | Proposed |
| `ACC-06` | Rivolo, Wallet | Pot card | Two across | One across | Decided `D-016` |
| `ACC-07` | Orvel, row menu | More menu | Menu | Sheet | Decided `D-047` |
| `ACC-08` | Rivolo, Wallet | Open card | Side panel | Sheet | Proposed |
| `ACC-09` | Rivet, Bank sync | Sync status | Header | More menu | Proposed |
| `ACC-10` to `ACC-19` | Rapport, forms | Sectioned form | One account form | Full-height sheet | Decided `D-023` |
| `ACC-20` | Rapport, dialog | Short form | Dialog | Sheet | Proposed |
| `ACC-21`, `ACC-22` | Talvo, Undo; current confirm | Typed confirmation stays | Dialog | Sheet | Proposed |
| `ACC-23`, `ACC-24`, `ACC-25` | Orvel, Accounts | Hero, chart, ledger | Page | Page | Decided `D-038` |
| `ACC-26`, `ACC-27`, `ACC-28` | Rivolo, Wallet; Orvel, Set-asides | Pot detail | Page | Page | Decided `D-038` |
| `ACC-29` | Talvo, cards | Card and statement | Page | Page | Decided `D-038` |
| `ACC-30`, `ACC-31`, `ACC-32` | Talvo, Loans | Ring, schedule, pay-extra | Page | Sections | Decided `D-039` |
| `ACC-33`, `ACC-34`, `ACC-35`, `ACC-36`, `ACC-37`, `ACC-38` | Orvel frame, Crystal content | Shared frame with type tabs | Page | Sections | Decided `D-038` |
| `ACC-39`, `ACC-40` | Rivolo, Goals | Progress card | Page | Page | Decided `D-038` |
| `ACC-41` | Rivolo, phone | Pots two by two | Not used | Two by two | Decided `D-016` |

### 4.5 Bank connections (`BNK`)

**Advantage:** Clear health view of live sync, your main source. **Risk:** Setup is technical. **Recommendation:** Rivet's status cards.

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `BNK-01` | No reference | Guided form | Dialog | Sheet | Proposed |
| `BNK-02`, `BNK-03`, `BNK-05` | Rivet, Bank sync | Link a bank, Reconnect | Card action | Card action | Proposed |
| `BNK-04` | Rivet, Bank sync | Status cards | Grid | List | Proposed |
| `BNK-06` | No reference | Mapping list | Dialog | Sheet | Proposed |
| `BNK-07` | Current Crystal | Sync options | Dialog | Sheet | Proposed |
| `BNK-08` | Rivet, Rivolo | Sync now | Keep every entry point | More menu | Proposed |
| `BNK-09` | Rivolo, Connections | Disconnect in menu | Menu | Sheet | Proposed |

### 4.6 Transactions (`TXN`)

**Advantage:** Combines overview, cleanup and depth. **Risk:** Crystal's form is very large. **Recommendation:** Keep every field, but show the common ones first.

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `TXN-01` | Orvel, Last 30 days | Summary panel, follows filters | Side panel | Below scatter | Decided `D-006` |
| `TXN-02` | Orvel, Ledger | Grouped ledger under scatter | Table | Day rows | Decided `D-006` |
| `TXN-03`, `TXN-04`, `TXN-05` | Talvo, Transactions | Sort headers, Show more, density switch | Table | Sort sheet, Show more | Decided `D-040` |
| `TXN-06` | Current Crystal | Expandable rows | Keep | Keep | Proposed |
| `TXN-07` | Orvel, Rivolo, drawer | Detail panel, suggested categories | Side panel | Sheet | Decided `D-041` |
| `TXN-08` | Talvo, search | Search above list | Field | Field | Proposed |
| `TXN-09` | Orvel, Talvo | Status chips and filter menu | Chips | Filter sheet | Proposed |
| `TXN-10` | Current Crystal | Pre-applied filters | Keep | Keep | Proposed |
| `TXN-11` | Orvel, Export | Export | Header | Desktop only | Decided `S-007` |
| `TXN-12`, `TXN-13`, `TXN-15`, `TXN-16`, `TXN-17`, `TXN-18` | Rapport, forms | Sectioned drawer | Quick form, expanding sections | Full-height sheet | Decided `D-022` |
| `TXN-14`, `TXN-19` | Current Crystal | Autofill stays | Keep | Keep | Decided `S-011` |
| `TXN-20`, `TXN-21`, `TXN-22`, `TXN-23`, `TXN-26`, `TXN-27` | Orvel, Select | Select mode | Selection bar | Select mode, action bar | Decided `S-007` |
| `TXN-24`, `TXN-25`, `TXN-28`, `TXN-29`, `TXN-30` | Orvel, row menu | More menu | Menu | Detail sheet | Decided `D-047` |
| `TXN-31` | Orvel, phone ledger | Rows, Select | Not used | Rows | Decided `D-006` |

### 4.7 Reconciliation (`MAT`)

**Advantage:** One cleanup place. **Risk:** Different jobs in one queue. **Recommendation:** A filter for categorise, transfer and bill items.

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `MAT-01` | Orvel, Needs you | Count links | Overview | Overview | Decided `D-008` |
| `MAT-02` | Orvel, Mark all reviewed | Accept high confidence | Queue action | Queue action | Decided `D-008` |
| `MAT-03`, `MAT-04` | Orvel, Review queue | One card and side list | Card and list | One card | Decided `D-008` |
| `MAT-05` | Current Crystal | Settings panel | Dialog | Sheet | Proposed |
| `MAT-06` | Current Crystal | Confidence label | On card | On card | Proposed |

### 4.8 Categories and tags (`CAT`, `TAG`)

**Advantage:** Simple organisation. **Risk:** No direct reference. **Recommendation:** Lists in Settings.

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `CAT-01`, `CAT-02`, `CAT-03`, `CAT-04`, `CAT-05` | No reference | Tree list and dialog | Tree | List, reorder mode | Decided `D-046` |
| `TAG-01`, `TAG-02`, `TAG-03`, `TAG-04` | Orvel, Contacts | Filter and cards | Cards | List | Decided `D-046` |

### 4.9 Rule engine (`RUL`)

**Advantage:** Far simpler. **Risk:** A functional rework that needs tests. **Recommendation:** Build it after the fixes for DEF-06 and DEF-07.

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `RUL-01`, `RUL-02`, `RUL-03` | Orvel, Rules | Plain-sentence rules | List and dialog | List and sheet | Decided `D-009` |
| `RUL-04` | Orvel, Rules worth making | Suggestions | Side panel | Below list | Decided `D-009` |
| `RUL-05`, `RUL-06`, `RUL-07`, `RUL-08`, `RUL-09`, `RUL-12` | No reference | Advanced option | Advanced tab | Desktop first | Decided `D-009` |
| `RUL-10`, `RUL-11` | Orvel, Always file | From a transaction | Combined into rules | Combined | Decided `D-009` |

### 4.10 Merchants (`MER`)

**Advantage:** No page change between merchants. **Risk:** Wide layout. **Recommendation:** List and profile, as decided.

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `MER-01`, `MER-02` | Rivolo, Payees | List beside profile | Two panes | List, then profile | Decided `D-012` |
| `MER-03`, `MER-05`, `MER-06`, `MER-09` | Rivolo, Payees details | Edit in profile | Side panel | Sheet | Decided `D-012` |
| `MER-07` | Rivolo, Payees | Monthly bars, history | Profile | Profile | Decided `D-012` |
| `MER-04`, `MER-10`, `MER-11` | Orvel, Rules | Combined into rules | Rules tab | Rules tab | Decided `D-009` |
| `MER-08` | Current Crystal | Refresh logos | Menu | Menu | Proposed |

### 4.11 Reports (`RPT`)

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `RPT-01`, `RPT-02`, `RPT-03`, `RPT-04`, `RPT-05`, `RPT-06`, `RPT-07`, `RPT-08`, `RPT-09`, `RPT-10`, `RPT-11`, `RPT-12`, `RPT-13` | Orvel, Analytics; Talvo, Saved reports; Rivolo, usual spend | As decided | Tile picker and panel | One report at a time | Decided `D-027` |

### 4.12 Budget (`BUD`)

**Advantage:** Calm and quick to scan. **Risk:** Less detail per row. **Recommendation:** Rivet's list, with Crystal's functions added.

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `BUD-01` | Talvo, month chips | Month chips | Chips | Scrolling chips | Proposed |
| `BUD-02` | Rivet, Plans | Ring and sentence | Top card | Top card | Decided `D-015` |
| `BUD-03`, `BUD-04` | Rivet, Plans | Rows with pace tick and filters | Two columns | One column | Decided `D-015` |
| `BUD-05` | Orvel, Where it went | Ranked bars | Side | Below | Proposed |
| `BUD-06` | Rivet, cap dialog | Short dialog, Advanced for notes | Dialog | Sheet | Decided `D-015` |
| `BUD-07` | Current Crystal | Generator | Dialog | Sheet | Proposed |
| `BUD-08` | Talvo, Undo pill | Undo | Pill | Pill | Proposed |
| `BUD-09` | Current Crystal | Automatic | Keep | Keep | Decided `S-011` |
| `BUD-10` | Rivet, phone | Single-column rows | Not used | Rows | Decided `D-015` |

### 4.13 Forecasting (`FCT`)

**Advantage:** Test decisions directly. **Risk:** Bubbles are small on phones. **Recommendation:** List view by default on phones.

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `FCT-01` | Talvo, Cash Horizon | 30/60/90 and account filter | Chips | Chips, sheet | Decided `D-010` |
| `FCT-02`, `FCT-08` | Talvo, What moves the line | Explanation panel | Side panel | Below chart | Decided `D-010` |
| `FCT-03`, `FCT-06` | Talvo, Cash Horizon | Buffer, bubbles, drag, keys | Chart | Tap a bubble to move | Decided `D-010` |
| `FCT-04` | None | **Removed** | Not built | Not built | Decided `D-010` |
| `FCT-05` | Talvo, bill bubble | Item panel | Side panel | Sheet | Decided `D-010` |
| `FCT-07` | Talvo, List view | List | Toggle | Default | Proposed |
| `FCT-09` | Talvo, phone | Chart and list | Not used | Sections | Decided `D-010` |

### 4.14 Goals (`GOL`)

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `GOL-01`, `GOL-02` | Rivolo, New goal | Short form | Dialog | Sheet | Proposed |
| `GOL-03`, `GOL-04` | Rivolo, Goals | Ring, need, actions | Cards | One column | Decided `D-042` |
| `GOL-05`, `GOL-06` | Current Crystal | Table option, order | Keep | Reorder mode | Decided `D-042` |
| `GOL-07`, `GOL-08` | Current Crystal | Filter and include | Keep | Keep | Proposed |
| `GOL-09`, `GOL-10` | Rivolo, Goals summary | Monthly need | Panel | Section | Proposed |

### 4.15 Schedule and bills (`SCH`)

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `SCH-01`, `SCH-02` | Rivolo, Calendar KPIs | Summary cards | Row | Two by two | Proposed |
| `SCH-03` | Orvel, Next 30 days | Day bars, heatmap toggle | Bars and toggle | Scrollable bars | Decided `D-033` |
| `SCH-04`, `SCH-05` | Rapport and Rivolo, calendar | Month and Today | Grid and panel | Week strip | Decided `D-007` |
| `SCH-06` | Rivolo, Scheduled | Income, Bills, Transfers groups | List | List | Decided `D-043` |
| `SCH-07` | Tilvo, Paused & cancelled | Archive tab | Tab | Tab | Proposed |
| `SCH-08`, `SCH-09` | Rapport, New task | Dialog with modes | Dialog | Sheet | Proposed |
| `SCH-10`, `SCH-11`, `SCH-12` | Orvel, Scheduled | Row actions | Row | Swipe, sheet | Decided `D-047` |
| `SCH-13` | Current Crystal | Read-only label | Keep | Keep | Proposed |
| `SCH-14` | Rivolo, phone calendar | Week strip | Not used | Week strip | Decided `D-007` |

### 4.16 Subscriptions and wallet (`SUB`)

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `SUB-01`, `SUB-02`, `SUB-03`, `SUB-04`, `SUB-05`, `SUB-06` | Tilvo, Services; Rivet, Trim nudge | As decided | Summary, timeline, cards | Two by two, vertical list | Decided `D-028` |

### 4.17 Investments (`INV`)

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `INV-01`, `INV-02`, `INV-04`, `INV-06`, `INV-07`, `INV-08` | Rivet, Portfolio | As decided | Page sections | Reduced rows | Decided `D-025` |
| `INV-03` | Rivet, Performance | Line, candle toggle | Chart | Chart | Decided `D-011` |
| `INV-05`, `INV-15` | Rivet, holding panel | Holding panel | Side panel | Tall sheet | Proposed |
| `INV-09`, `INV-10` | Rivet, trade | Trade form in panel | Panel | Sheet | Decided `D-026` |
| `INV-11`, `INV-12`, `INV-13`, `INV-14` | Current Crystal | Two price sources | Keep, restyled | Sheet | Decided `S-012` |
| `INV-16` | Rivet, phone | Reduced rows | Not used | Rows | Proposed |

### 4.18 Quotes and invoices (`DOC`)

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `DOC-01`, `DOC-02` | Talvo, Invoices; Rapport, Finance | Aging and table | Table | Cards | Proposed |
| `DOC-03`, `DOC-04`, `DOC-05`, `DOC-06` | Rapport, New invoice | Sectioned form | Full panel | Full-height sheet | Proposed |

### 4.19 Tasks (`TSK`)

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `TSK-01`, `TSK-02`, `TSK-03` | Rapport, Today | Checklist | List | List | Proposed |
| `TSK-04` | Rapport, New task | Dialog | Dialog | Sheet | Proposed |

### 4.20 Challenges (`CHL`)

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `CHL-01`, `CHL-02`, `CHL-03`, `CHL-04`, `CHL-05`, `CHL-06`, `CHL-07`, `CHL-08` | Rivet, Health score; no direct reference | As decided | Tabs | Tabs | Decided `D-029` |

### 4.21 Settings, data and help (`SET`, `DAT`, `HLP`)

| Subfeature | Reference and page | Pattern | Desktop and tablet | Phone | Status |
|---|---|---|---|---|---|
| `SET-01` | Orvel, Settings | Hub tabs with setting search | Tabs | Scrolling tabs | Decided `D-045` |
| `SET-02`, `SET-03` | Rivet, Settings | Forms | Form | Form | Proposed |
| `SET-04`, `SET-05`, `SET-06`, `SET-07`, `SET-08` | Rivet, Settings | Grouped settings | Form | Form | Proposed |
| `SET-09`, `SET-10` | Rivet, Rivolo Connections | Connection cards | Cards | List | Proposed |
| `DAT-01`, `DAT-02`, `DAT-03`, `DAT-04`, `DAT-05`, `DAT-06`, `DAT-07` | Rivet, Statements; no direct reference | As decided | Sections | Desktop first for import | Decided `D-030` |
| `HLP-01`, `HLP-02` | Orvel, Support | Searchable help | Page | Page | Proposed |

## 5. New functions

| Function | Source | Status |
|---|---|---|
| PIN lock | Talvo | Approved, `D-013` |
| Safe to spend | Rivolo | Approved, `D-004` |
| Paused services | Tilvo | Approved, `D-028` |
| Automatic reports | Owner | Approved, `D-027` |
| Compared with usual | Rivolo | Approved, `D-027` |
| Forecast buffer, drag and suggestions | Talvo | Approved, `D-010` |
| Loan pay-extra slider | Talvo | Approved, `D-039` |
| Rebalance check, Watchlist | Rivet | Not included, `D-025` |

## 6. Removed by decision

| Function | Decision |
|---|---|
| Scenario Playground, `FCT-04` | `D-010` |
