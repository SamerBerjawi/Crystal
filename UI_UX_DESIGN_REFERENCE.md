# UI/UX Design Reference: Finance Concept Deconstruction

> **Status:** design reference for the New pages (§5.0). Decisions Q1–Q12 (§7) and the WanderGrid alignment decisions D1–D16 (§10) were recorded on 2026-10-25. The third reference (coral "Financial Dashboard") and its decisions R1–R8 are in §11. Priority when sections disagree: §11, then §10, then §7, then §1–§5.
>
> **Authority:** for the New pages, this document **wins over `DESIGN.md`** wherever the two conflict. Every rule in `DESIGN.md` and `CLAUDE.md` that this document does not override still applies.
>
> **History:** an earlier redesign attempt (`v2/`, "Crystal Calm", `docs/REDESIGN_PLAN.md`) was discarded on 2026-10-25. Nothing from it carries over. It is kept only as a local git stash (`redesign v2 WIP`) and on the local branch `feat/redesign-phase0`.

Inputs:
- **Ref D**: desktop concept "FINANCE" dashboard (violet, light, three-column bento).
- **Ref M**: mobile concept, three phones: Home, Insight and Add Expense (indigo gradient headers, floating dock with a centre `+`).
- Crystal's data model (`types.ts` → `FinancialData`) and the 25-entry `Page` union.
- The method used for the WanderGrid redesign: `*New` pages built beside the originals, then a page-by-page cutover (see §5.0).

Every KokonutUI name below was checked against the live registry (kokonutui.com) on 2026-10-25. Several catalogue display names differ from their install slugs, so section 4 lists both.

---

## 1. Visual Language & Design System

### 1.1 Color palette & contrast

Values are sampled from the screenshots by eye, so treat them as approximate.

| Role | Ref D (desktop) | Ref M (mobile) | Notes |
|---|---|---|---|
| Primary / brand | Electric violet ≈ `#6D3AF2` (active nav, toggle, card, Update button) | Indigo ≈ `#6366F1` → `#7C83F7` | M is softer and bluer. D is more saturated. |
| Primary gradient | Card: `#7B4BFF` → `#5B2BE8`, with a large violet glow below it | Header: `#5B5FEF` (top) → `#8187F5` (bottom), with soft light blobs | The gradient only appears on hero surfaces, never on body cards |
| Secondary data series | Orange ≈ `#F2994A` (Expenses line) | Orange `#E8720C` (Food bar) | Orange is always the "second series" or "over budget" colour |
| Success | Green ≈ `#22C55E` (outlined "Success" pill, savings bars, income icon) | Green `#22A55B` ("+8% vs June" chip) | |
| Danger | Red ≈ `#EF4444` (outlined "Failed" pill, down arrow) | Red `#E5484D` ("88%" over-pace label) | |
| Canvas | Off-white `#F5F6FA` inside a grey `#CDD3DE` frame | `#F4F4F6` | Very low-contrast canvas. Cards separate by whiteness, not by borders. |
| Surface (card) | Pure white `#FFFFFF` | Pure white, or white at about 70% on the gradient (KPI strip) | |
| Warm accent surface | Peach `#FBF1E6` behind the "My Cards" balance block | — | One warm tinted block per screen, to add depth |
| Muted surface | `#F3F4F7` (search field, progress track, icon tiles) | `#F1F2F6` (segmented control track, inputs) | |
| Text primary | Near-black `#1C1C28` | `#16161D` | |
| Text secondary | Slate `#8A8FA3` (units "USD", dates, captions) | `#8E8E99` | Units and decimals are always de-emphasised |
| Hairline | `#ECEDF2`, at most 1px | Mostly none | Borders only on outline pills and inputs |

Contrast observations:
- Secondary grey on white (`#8A8FA3`) is about 3.3:1. That is fine for large numerals but **fails AA for 12px captions**, so it needs darkening to about `#6B7080` for small text.
- White text on the `#7C83F7` lower part of the mobile header is about 3.4:1. Body-size text on the gradient needs the darker top stop or a scrim.
- Status pills use **outline plus tinted text**, not filled backgrounds. This keeps tables calm.

### 1.2 Typography & hierarchy

Both refs use a geometric, round sans (Outfit, Urbanist or Plus Jakarta in style) with tight letter spacing on numerals.

| Level | Ref usage | Size / weight (desktop → mobile) |
|---|---|---|
| Hero figure | "491,080 USD", "€2,348.60", "€42.50" | 44–48px / 600 → 56px / 700 |
| Section figure | "284,000 USD", "36,475.40", "€1,847" | 28–32px / 600 |
| Card title | "Balance", "Recent Transactions", "Category Breakdown" | 18–20px / 500–600 |
| Body / table | Names, dates, list rows | 15–16px / 400–500 |
| Caption | "Target $250,000", "Last updated 05 Jan", "of €3,500 budget • 67% • 8 days left" | 12–13px / 400, secondary colour |
| Overline / label | "Daily Average", "Enter Amount", "Category" | 12–13px / 500, at about 70% opacity |

Rules worth adopting:
1. **Split-weight money.** The integer is dark and bold. The unit (`USD`) and the decimals (`.60`) are lighter and greyer, as in "2,348**.60**" and "491,080 USD". This is the single strongest pattern in both refs.
2. **Tabular numerals** for every amount in tables and KPI strips, so columns align.
3. A **one-line meta sentence** under a hero figure carries context: budget, percentage and days left. It replaces three separate stat boxes.
4. Small time stamps are muted inline next to dates ("Apr 20, 2024 · 8.00 am").

### 1.3 Surfaces & glassmorphism

| Token | Ref D | Ref M |
|---|---|---|
| Card radius | about 24px (outer cards), 16px (inner tiles), full (pills) | 20–24px cards, 16px category tiles, full buttons and dock |
| Elevation | Flat white on off-white. The only shadow is a coloured glow under the violet card | Very soft 0 8 24 rgba(20,20,40,.06) on cards. The FAB has a coloured shadow. |
| Glass | Hardly any. The top bar is a white card. | **Frosted glass on gradient**: the KPI strip (white about 15–20%, blur about 20px, inner 1px white/25% border) and the round bell button |
| Inner glow | Violet card: subtle diagonal sheen plus a watermark pattern | Header: radial highlights |
| Selection | Active nav uses violet text and icon, with no filled pill. Active chart day uses an outlined violet pill. | Selected category tile: indigo tint background, 1.5px indigo border, indigo label |

The references are **mostly flat**. Real glass appears only where content sits on a gradient (Q3).

---

## 2. Layout & Shell Architecture

### 2.1 Navigation

**Desktop (Ref D)**
- **Fixed left sidebar** (about 280px), on its own card, with three zones:
  1. A greeting block ("Welcome back / Emily / Last updated 05 Jan"). Personal and sync-aware.
  2. A flat list of 7 labelled items with icons. The active item is coloured, not boxed.
  3. A promo / status card pinned to the bottom ("New update available → Update").
- **Top command bar** on its own full-width card: logo, page title, a wide search field, messages, notifications (with an orange unread dot), a currency selector with a flag, and an avatar card showing name and email.
- The sidebar and top bar float as separate rounded cards with gaps. This frame style keeps the whole app inside one rounded viewport.

**Mobile (Ref M)**
- **Floating bottom dock**: four items (Home, Insight, Budget, Settings) and a **raised circular `+` FAB** in the centre. On "Insight" the FAB is notched into the bar with an orange underline accent.
- There is no top app bar on the hero screens. The gradient header holds the avatar, a **month selector pill** ("July 2026 ▾") and a round bell.
- Sub-screens (Add Expense) use a **back chevron in a round glass button** and a centred title.

Crystal fit: Crystal has 25 pages against the reference's 7. The reference's flat list only works if the sidebar shows **groups** or about 8 top-level items, with the rest reached through the command palette or Settings.

### 2.2 Main canvas & spatial flow

**Desktop bento (Ref D)**, a 12-column grid with three columns of content:

```
┌ sidebar ┐┌──────────── Balance chart (8 cols, tall) ────────────┐┌ My Cards (4) ┐
│         │└──────────────────────────────────────────────────────┘│ card carousel │
│         │┌ Income KPI ┐┌ Expenses KPI ┐┌── Weekly savings ───┐   │ + recent 2    │
│         │└────────────┘└──────────────┘└─────────────────────┘   └───────────────┘
│         │┌────────── Recent transactions table (8) ─────────────┐┌ Limits (4)    ┐
│         ││                                                      │┌ Categories (4)┐
└─────────┘└──────────────────────────────────────────────────────┘└───────────────┘
```
- **Primary column (about 66%)**: time-series hero → KPI row → table. The reading order goes from summary to detail.
- **Rail column (about 33%)**: object-centric widgets (cards, limits, top categories), each with a "see info" or "see all" drill-in.
- KPI cards pair a **number + target + progress bar with % label inside the fill**, with a diagonal-stripe texture on the fill.

**Mobile (Ref M)**: a single column. The gradient hero holds **1 big figure + meta line + a 3-up glass stat strip**. White content then sits on a sheet whose rounded top overlaps the gradient. After that come chart → 2-up category cards (horizontally scrollable, clipped at the edge to hint at scrolling) → "Latest" list.

**Responsive breakdown (proposed)**

| Breakpoint | Shell | Grid |
|---|---|---|
| ≥ 1280 | Sidebar + top bar + right rail | 12 col, main 8 / rail 4 |
| 1024–1279 | Collapsible sidebar (icon rail) | 12 col, rail drops below main |
| 768–1023 | Icon rail, top bar | 6 col, 2-up cards |
| < 768 | Bottom dock + FAB, gradient hero header | 1 col, horizontal snap rails for card groups |

**Density strategy**: one hero figure per page, at most 4 KPIs, and every list capped at 3–5 rows with "See all". Detail goes into drawers, not more cards.

---

## 3. Micro-Interactions & Modals

### 3.1 Drawers & modals
- **Add Expense (Ref M)** is a full-screen sheet that keeps the gradient header:
  - The **amount is the hero**: a huge figure with a live **converted-currency line** below it ("=$46.32 USD"). Crystal already has multi-currency and `conversionRates`, so this maps directly.
  - **Category grid picker**: a 3×2 grid of icon tiles with one selected state (tint + border).
  - Paired **Date** and **Payment (account)** fields, each with a trailing icon. Then **Note**, then a dashed-border **Attach receipt** drop zone.
  - A **sticky full-width primary button that repeats the amount**: "Save Expense • €42.50".
- The desktop ref shows no modal. Proposed: the same form as a **right-side drawer** on desktop and a **bottom sheet with snap points** on mobile, with a sticky header and footer and a blurred backdrop (`bg-black/40 backdrop-blur-sm`).

### 3.2 Popovers & dynamic inputs
- **Period dropdown** ("Last Week ▾", "July 2026 ▾"): a pill trigger that opens a small menu.
- **Chart-type toggle** (bar / line): a two-icon segmented switch. The active one is a filled violet circle.
- **Overflow menus** (`•••`): on the chart and on every table row.
- **Chart tooltip**: a dark pill (`#141420`) with a date heading and a coloured dot per series. A dashed vertical crosshair and hollow ring markers sit on each line. The x-axis label for the hovered day turns into an outlined pill.
- **Segmented control** (Month / Quarter / Year): a white thumb on a grey track.
- **Search with filter button**: the table header has a search field plus a square filter-icon button.
- **Card carousel**: prev/next round arrow buttons around a single centred card.

---

## 4. Component Mapping & KokonutUI Catalog Alignment

### 4.1 Priority KokonutUI components, verified

Install with `npx shadcn@latest add @kokonutui/<slug>` (the registry is already configured in `components.json`). Nothing is installed yet.

| Catalogue name | Registry slug (`@kokonutui/…`) | What it is |
|---|---|---|
| Split Nav | `morphic-navbar` | Nav bar that splits around the active link. Drag to scrub. |
| Swipe Tabs | `smooth-tab` | Tabs with a swipeable panel and a drag-tracked indicator |
| Stack Panel | `stack-panel` | iOS-settings-style drill-in panel. Swipe back. |
| Widget Grid | `bento-grid` | Drag and resize widgets on a 6-column grid. Keyboard support. |
| Scroll Index | `scroll-index` | Tick rail for long pages. Hover, click or drag to scrub. |
| Metric Card | `metric-card` | KPI with day scrub, range drag and segment breakdown |
| Spending Ring | `spending-ring` | Dial-style category breakdown you flick to spin |
| Flick Card | `card-flip` | Two-sided card you spin with a drag |
| Throw Deck | `card-stack` | A card pile you flick off the top |
| Momentum Rail | `carousel-cards` | Momentum card rail with cover-flow depth |
| Smooth Drawer | `smooth-drawer` | **Vaul** bottom sheet with snap points |
| Morph Popover | `morph-popover` | Button that grows into its own form, then a confirmation |
| Command Palette | `action-search-bar` | ⌘K with nested pages, fuzzy search, running actions |
| Account Menu | `profile-dropdown` | Account card that morphs into a menu, with hold-to-sign-out |
| Wheel Picker | `wheel-picker` | iOS 3D drum picker |
| Particle Button | `particle-button` | Async status button: spinner → check → particle burst |
| Hold Button | `hold-button` | Press and hold to confirm |
| Switch Button | `switch-button` | Light/dark toggle with a circular reveal |
| Tear Button | `tear-button` | Confirm by tearing it off like a ticket stub |
| Undo Button | `undo-button` | Action with a countdown ring for undo |

Other KokonutUI items that fit finance well and aren't on the priority list: **Amount Pad** (`amount-pad`, the Add Expense amount entry), **Liquid Gauge** (`liquid-gauge`, budget usage), **Apple Activity Card** (`apple-activity-card`, goal rings), **Activity Terrain** (`activity-terrain`, spending heatmap), **Notification Stack** (bills due), **Status Island** (Enable Banking sync and rule runs), **File Upload** (CSV import), **Currency Transfer** (transfer between accounts), **Slide to Confirm** (irreversible actions), **Uptime Card** (bank-connection health), **Receipt Printer** (invoice preview).

### 4.2 Reference concept → component mapping

| Reference concept | Crystal meaning | Component |
|---|---|---|
| Fixed labelled sidebar with active colour | Grouped nav for 25 pages | Custom sidebar in `ShellNew`. **Split Nav** fits the *mobile dock* or a top segmented nav better than a vertical sidebar. |
| Top bar search | Global search and actions | **Command Palette** (`action-search-bar`), opened from the search field and ⌘K |
| Avatar + name + email card | Profile, theme, privacy, sign out | **Account Menu** (`profile-dropdown`) + **Switch Button** for theme |
| Currency selector with flag | **Replaced** by the current page's tabs (Q7) | Segmented page tabs in the top bar. Display currency stays in Preferences. |
| Bell with unread dot | Bills due, sync errors, task reminders | **Notification Stack** inside a popover |
| Asymmetric bento | Dashboard and widget areas | **Widget Grid** (`bento-grid`) |
| Balance multi-line chart + dark tooltip | Net worth / income vs expense over time | **bklit** `line-chart` / `area-chart` + `tooltip`, with crosshair and markers |
| Bar/line toggle | Chart type switch | Segmented icon toggle (custom, small) |
| Total Income / Expenses KPI with target bar | Period income/spend vs budget or goal | **Metric Card** (hero KPI) or Magic UI `number-ticker` + striped progress |
| Weekly savings mirrored bars | Savings per week (in vs out) | bklit `bar-chart` (diverging) |
| My Cards carousel (Transfer Card) | Credit card and checking **accounts** shown as card visuals | **Flick Card** (front: balance, back: limit/statement) inside **Momentum Rail** |
| Card balance + 2 recent items | Account quick view | Account detail **Smooth Drawer** |
| Spending Limits bar | Budget used vs total | **Liquid Gauge** or bklit `gauge` |
| Most spending categories tiles | Top categories in a period | **Spending Ring** (interactive) or 2-up tiles |
| Recent transactions table + status pills | Transaction list | Custom DataTable. Status → attention badges only (Q5). |
| "New update available" promo card | App version / sync status | **Status Island** or a dismissible sidebar card |
| Mobile gradient hero + glass KPI strip | Monthly spend vs budget | Hero section + Magic UI `magic-card`/`number-ticker` |
| Segmented Month/Quarter/Year | Period switch | **Swipe Tabs** (`smooth-tab`) for pages without draggable content. Otherwise use a static segmented control, because smooth-tab slides the whole panel on drag, which fights widget dragging and chart hover. |
| Category breakdown bars | Spend per category with colour | bklit `bar-chart` horizontal, or custom bar rows |
| Budget Goals list | Budgets / goals progress | Apple Activity Card rings or progress rows |
| Floating dock + centre FAB | Primary nav + quick add | Magic UI `dock` or a custom dock, with a FAB opening a **Morph Popover** quick-create menu |
| Add Expense sheet | Transaction create/edit | **Smooth Drawer** (mobile) / right drawer (desktop) + **Amount Pad** + category tile grid + **Wheel Picker** for date/recurrence on mobile + **Particle Button** to save |
| Delete / destructive | Delete account, transaction, rule | **Hold Button** (quick deletes), **Undo Button** (soft deletes with undo), **Tear Button** or **Slide to Confirm** (irreversible: wipe data, restore backup) |
| Settings drill-down | Settings → Categories → Category | **Stack Panel** on mobile |
| Long documentation / reports | Docs, Reports | **Scroll Index** |
| Goal / prediction stack | Challenges cards | **Throw Deck** (swipe through active challenges) |

**Magic UI** roles: `number-ticker` (animated figures), `magic-card` (hover spotlight KPI), `blur-fade` (staggered entry), `animated-list` (live activity feed), `border-beam` / `shine-border` (single highlighted card), `animated-circular-progress-bar` (goal %), `dock` (mobile dock candidate), `marquee` (market tickers), `confetti` (goal reached, challenge won).

**BklitUI** roles (an older bklit copy already lives in `src/components/charts/` for the current UI; the New pages install a fresh copy, see Q12): `line-chart`, `area-chart` (with `projection-line` and dash tails for forecasts), `bar-chart`, `composed-chart` (line + volume bars), `ring-chart`, `pie-chart`, `radar-chart`, `gauge`, `sankey`, `sparkline`, `band` (confidence bands for forecasting).

---

## 5. Application Feature Inventory & Redesign Mapping Matrix

### 5.0 New pages: naming, URLs and migration (the WanderGrid method)

Every redesigned page is **first built as a new page, named after the existing page plus `New`**. The original page stays untouched and live until its New page is approved.

- **Files.** Pages go in `pages/new/<Name>New.tsx`, exported by name (`export const DashboardNew`). Shared New components go in `components/new/`, the app frame in `components/new/ShellNew.tsx`, and KokonutUI / Magic UI / BklitUI ports in their own folders (`components/kokonutui/`, `components/magicui/`, `components/bklit/`).
- **Reaching them.** Each New page has its own `-new` URL beside the original (`/dashboard-new`, `/accounts-new` …), with no feature flag. `parseRoute` in `App.tsx` maps those paths to the New pages, which render inside **ShellNew**. Nothing in the current UI links to them until they are approved.
- **Isolation.** New pages may import data and logic (`types.ts`, `utils.ts`, `utils/`, `contexts/`, data hooks). They must **not** import UI components from the current pages, and current pages must never import from `pages/new/` or `components/new/`.
- **Logic.** Where a current page holds feature logic inline, move it into `utils/` or `hooks/` and have both pages call it. Never copy JSX, components, layout or styling.
- **Clean-slate rule.** Design each New page from a blank canvas, using only this document. Per page: (1) list its features from the data and context layer, (2) decide feature by feature whether it stays, moves or is dropped, and record every drop, (3) design it from §1–§4, KokonutUI first.
- **Migration once a New page is approved:** point the original URL at the New page, keep the `-new` URL as an alias, delete the original page and the components only it used, rename `DashboardNew` → `Dashboard`, then run `npm run lint` and the tests. Once every page is migrated, fold this document into `DESIGN.md`.
- To keep migration cheap, each New page takes the **same props** as the page it replaces.

The **Capabilities / data** column below comes from `FinancialData` and the domain utils, not from the current page layouts. Target files sit in `pages/new/`.

### 5.1 Core (daily use)

| Feature (Page) | Capabilities / data attributes | Target file | Layout paradigm | Primary components |
|---|---|---|---|---|
| **Dashboard** | Net worth (assets − liabilities), income/spend per period, savings rate, budgets used, upcoming recurring and bills, goals, `dashboardLayouts`/`dashboardHiddenWidgets`, `defaultPeriod`, privacy mode | `DashboardNew.tsx` | Gradient-free hero + 3–4 KPIs + bento with right rail | Widget Grid, Metric Card, Spending Ring, Liquid Gauge, bklit line/area/sankey, Momentum Rail (accounts), Notification Stack (due soon) |
| **Accounts** | 10 account types (Checking … Lending) with type-specific fields (credit limit and statement cycle, loan principal/interest/schedule, property and vehicle valuation, mileage logs), balances in their own currency, `accountOrder`, closed accounts, Enable Banking linkage | `AccountsNew.tsx` | Grouped list ↔ card-visual rail, type tabs | Flick Card + Momentum Rail (cards), Widget Grid, Swipe Tabs, Smooth Drawer (details/edit), Hold Button (delete) |
| **AccountDetail** | Balance history, transactions per account, loan amortisation and `loanPaymentOverrides`, credit card cycles, vehicle mileage, property value history, closure details | `AccountDetailNew.tsx` | Hero balance + type-specific module stack | bklit area-chart, Scroll Index (long types), Stack Panel on mobile |
| **Transactions** | CRUD; split/combined parents; transfers (`transferId`); tags; category; merchant; notes; geo location; recurring source; balance adjustments; import IDs; bulk edit; search/filter; display currency conversion | `TransactionsNew.tsx` | Search + filter bar → date-grouped list (virtualised) → detail drawer; FAB add | Command Palette filters, Morph Popover (quick filters), Smooth Drawer + Amount Pad (add/edit), Undo Button (delete), Wheel Picker (mobile date) |
| **Budget** | `budgets` (category, amount, period, currency), `BudgetSuggestion`, spend-to-date per category, `financialGoals` (one-time/recurring, buckets, contribution plans, projection status) | `BudgetingNew.tsx` | Hero "spent of budget • % • days left" + category rows + goals | Liquid Gauge / bklit gauge, Spending Ring, Apple Activity Card (goals), Metric Card |
| **Reports** | Spending/income by category, merchant, tag, period comparisons, net-worth history, cash-flow Sankey, exports | `ReportsNew.tsx` | Tabbed report canvases | Swipe Tabs, bklit sankey/bar/radar, Activity Terrain (heatmap), Scroll Index |

### 5.2 Planning & wealth

| Feature (Page) | Capabilities / data attributes | Target file | Layout paradigm | Primary components |
|---|---|---|---|---|
| **Forecasting** | Projected balances from recurring transactions + synthetic card/loan payments, `ForecastDuration` (3M/6M/EOY/1Y), goal dates, low-balance warnings | `ForecastingNew.tsx` | Full-width projection chart + "what's coming" timeline | bklit area-chart + `projection-line` + `band`, Metric Card (scrub a day), Wheel Picker (horizon on mobile) |
| **Schedule & Bills** | `recurringTransactions` (frequency, interval, weekend adjustment, next due, skip), overrides, `billsAndPayments` (unpaid/paid/expired), loan payments | `ScheduleNew.tsx` | Calendar + upcoming list | Notification Stack (due), Hold Button (mark paid), Undo Button (skip), Smooth Drawer (edit) |
| **Subscriptions** | Recurring expenses detected as subscriptions + `memberships` (provider, tier, points, expiry, colour, icon) | `SubscriptionsNew.tsx` | Monthly-cost hero + card wallet | Flick Card (membership card front/back), Momentum Rail, Spending Ring (by category) |
| **Investments** | Holdings from `investmentTransactions`, allocation, performance, `priceHistory`, price sources (Twelve Data / web / manual), `smartPriceBindings` | `InvestmentsNew.tsx` | Portfolio hero + allocation + holdings list | bklit area/candlestick/ring, Magic UI marquee (tickers), Metric Card |
| **HoldingDetail** | Per-symbol price chart, lots, gain/loss, manual price | `HoldingDetailNew.tsx` | Chart-first detail | bklit candlestick / composed-chart |
| **Warrants** | `warrants` (ISIN, grant date, quantity), `manualWarrantPrices`, vesting bills | `WarrantsNew.tsx` (or a tab inside Investments, see Q11) | List + vesting timeline | bklit bar, Flick Card |
| **Challenges** | `predictions` (spending cap, net-worth goal, price target; active/won/lost), `userStats` (streaks, wins), `activeSprints` | `ChallengesNew.tsx` | Streak hero + challenge deck | Throw Deck, Apple Activity Card, Magic UI confetti |

### 5.3 Management & settings

| Feature (Page) | Capabilities / data attributes | Target file | Layout paradigm | Primary components |
|---|---|---|---|---|
| **Quotes & Invoices** | `invoices` (quote/invoice, sent/received, items, tax, discount, payment terms, status lifecycle) | `InvoicesNew.tsx` | Status-tabbed list + document preview | Swipe Tabs, Receipt Printer (preview), Particle Button (send/mark paid) |
| **Tasks** | `tasks` (status, priority, due, reminder), `taskOrder` | `TasksNew.tsx` | Kanban (desktop) / grouped list (mobile) | Undo Button (complete), drag reorder |
| **Merchants** | Merchant list, logos (Brandfetch), `merchantLogoOverrides`, `merchantRules`, `hiddenMerchants`, locations | `MerchantsNew.tsx` | Searchable grid + detail drawer | Smooth Drawer, Command Palette |
| **Rules** | `transactionRules` (conditions/actions), `regexCategorizationRules`, execution logs, `lastRuleRunBackup` (undo a run) | `RulesNew.tsx` | Rule list + builder drawer + run history | Morph Popover (quick rule), Status Island (run progress), Undo Button (revert run) |
| **Categories** | Income/expense trees (parent/sub), colour, icon | `CategoriesNew.tsx` | Two-column tree | Stack Panel (mobile drill-in) |
| **Tags** | Name, colour, icon | `TagsNew.tsx` | Chip grid | Morph Popover (create) |
| **Settings** (hub) | Entry point for the pages below | `SettingsNew.tsx` | Grouped list | Stack Panel |
| **Preferences** | Currency, display currency, FY start, language, timezone, date format, default periods, font, privacy mode, transfer exclusion, API keys | `PreferencesNew.tsx` | Grouped form | Switch Button (theme), Wheel Picker (mobile selects) |
| **Personal Info** | `userProfile` | `PersonalInfoNew.tsx` | Profile card + form | Account Menu visuals |
| **Data Management** | Import (transactions, accounts, Mint, snapshot …), export, restore, `importExportHistory` | `DataImportExportNew.tsx` | Import wizard + history list | File Upload, Particle Button, Slide to Confirm / Tear Button (restore, wipe) |
| **Integrations** | Enable Banking connections (status, sync options), Twelve Data, Brandfetch, Carto keys | `IntegrationsNew.tsx` | Connection cards | Uptime Card (connection health), Status Island (sync) |
| **Documentation** | Static help content | `DocumentationNew.tsx` | Long-form | Scroll Index |
| **Sign in / Sign up** | Auth | `SignInNew.tsx`, `SignUpNew.tsx` | Centred card on gradient | Particle Button |
| **EnableBankingCallback** | OAuth return handler | Not redesigned (logic only) | — | — |

### 5.4 Cross-cutting capabilities every new page must keep
- **Privacy mode** (`isPrivacyMode`): every amount goes through one Money component that blurs.
- **Multi-currency**: native currency per account/transaction plus `displayCurrency` conversion. Show both where it matters, as in the "=$46.32 USD" pattern.
- **Demo mode** and the autosave or 409-conflict flow, through the existing contexts.
- **Light and dark**: both refs are light only, so dark has to be designed.
- **Reduced motion**: physics components (flick, throw, tear, particle) need static fallbacks.
- **Safe math**: `utils.ts` helpers for every derived figure.

---

## 6. Constraints carried over from the brief

1. Analysis only in this pass. No code or style changes.
2. Redesigned pages use the `*New` suffix next to the legacy page. Legacy stays intact and operational.
3. Feature-first: map capabilities and data, never legacy layout. Every element must justify itself.
4. Prefer KokonutUI → Magic UI → BklitUI over ad-hoc components.

---

## 7. Open questions (to be answered before implementation)

Each answer is recorded here as a decision as it is taken.

| # | Question | Decision |
|---|---|---|
| Q1 | Brand palette: the references' indigo/violet, or Crystal's amber `#fa9a1d`? | **Reference violet.** Primary ≈ `#6D3AF2` (desktop ref), orange ≈ `#F2994A` as the second data series, green/red for status, per §1.1. No amber on New pages. |
| Q2 | Typeface for the New pages | **Outfit**, self-hosted, with tabular numerals for every amount. No font picker on New pages. |
| Q3 | Glass vs flat surfaces | **Follow the references.** Flat white cards on an off-white canvas. Frosted glass only on the violet gradient (hero strip, round header buttons) and on sheet/drawer scrims. |
| Q4 | Dark mode (the references are light only) | **Derived dark theme**, designed rather than inverted: violet-tinted near-black canvas (≈ `#0E0D14`), cards ≈ `#17161F`, violet brightened for contrast. Light, dark and system all kept. |
| Q5 | Transaction "Success/Failed" pills: what real status do they map to? | **Attention badges, shown only when notable.** "Uncategorized" and "Pending match" (needs review, amber/red outline). "Transfer" (sky, D1), "Split" (neutral) and "Recurring" (green). Every badge carries an icon (D12). Most rows have no pill. |
| Q6 | "My Cards" carousel: which accounts appear? | **Credit cards, checking and savings** as card visuals (violet, dark and light variants), each with its balance and last 2 transactions. Loans and assets stay in lists. |
| Q7 | Top-bar currency selector: saved preference or view only? | **Replaced by page tabs.** The top bar's currency slot holds the current page's tabs, adapted per page (for example Dashboard: Overview / Spending / Cash flow / Wealth). Display currency changes only in Preferences. |
| Q8 | Mobile dock: which 4 destinations around the `+`? | **Home, Accounts \| + \| Transactions, Forecasting.** Other pages are reached through the account menu and the command palette. |
| Q9 | Physics-heavy components (Tear, Throw Deck, flick): how freely to use them? | **Only where they fit.** *(Permanent actions superseded by D5: Hold Button everywhere.)* Throw Deck only for Challenges. Particle Button for saves, Hold Button for deletes, Undo Button for soft deletes. All honour `prefers-reduced-motion`. |
| Q10 | Page merges (Warrants into Investments; Categories, Tags, Rules, Merchants under Settings) | **Merge.** Warrants becomes a tab in `InvestmentsNew`. Categories, Tags, Rules, Merchants, Preferences, Personal Info, Data Management, Integrations and Documentation become sections of `SettingsNew` (Stack Panel on mobile). About 14 New pages in total; the §5 matrix rows for merged pages describe sections, not files. |
| Q11 | Icon set for the New pages | **Hugeicons** (stroke). KokonutUI components are switched from Lucide to Hugeicons when ported. Saved category/account icon names (Phosphor, Material Symbols) resolve through a lookup. |
| Q12 | New dependencies (Vaul for Smooth Drawer; fresh BklitUI copy vs `src/components/charts/`) | **Add Vaul** for drawers and sheets. **Install a fresh BklitUI copy** into `components/bklit/` for New pages only. The old `src/components/charts/` copy stays untouched for the current UI and is deleted at cutover. |

---

## 8. Foundation (built 2026-10-25)

| Piece | Where | Notes |
|---|---|---|
| Routes | `utils/newRoutes.ts` (tested in `tests/unit/newRoutes.test.ts`) | `-new` paths, detail ids, merged pages (Q10) resolve to their host page, unknown `-new` paths stay in the New UI |
| Wiring | `App.tsx` (`parseRoute`, render) | A `-new` path renders `ShellNew` instead of the classic shell, with the same data providers. App-level navigation (shortcuts) stays in whichever UI is showing |
| Tokens | `components/new/new.css` (values, light + dark) and `index.css` (`nv-*` utilities) | Scoped to `.crystal-new`; the classic UI is unchanged. bklit `--chart-*` variables are re-pointed inside the scope |
| Font | `@fontsource-variable/outfit`, loaded by `new.css` | Only New pages load it |
| Icons | `components/new/NvIcon.tsx` | Curated Hugeicons name map |
| Primitives | `components/new/ui.tsx` | `Card`, `CardTitle`, `Button`, `IconButton`, `SegmentedTabs`, `Money` (split weight, privacy blur), `Badge`, `ProgressBar`, `EmptyState` |
| Sheet | `components/new/Drawer.tsx` | Vaul: bottom sheet below 768px, right drawer above, sticky footer |
| Shell | `components/new/ShellNew.tsx`, `shellContext.ts` | Sidebar + top bar (page tabs via `usePageTabs`), phone header + dock with `+` (Q8), account menu, notifications |
| Charts | `components/bklit/charts/` | Fresh BklitUI copy (Q12). Local edits are marked "Crystal patch" |
| Placeholders | `pages/new/PlaceholderNew.tsx`, `NotFoundNew.tsx` | Every New URL works now and links to its classic page until it is built |
| Gallery | `pages/new/GalleryNew.tsx` at `/design-new` | Dev server only |
| Isolation | `tests/unit/new-isolation.test.ts` | New code (including `components/kokonutui`) imports no classic UI; classic code imports no New code |
| Token lint (D14) | `tests/unit/new-tokens.test.ts` | Fails on hex colours, arbitrary or numeric z-index, arbitrary rgb/hsl values, Tailwind palette colours and `bg-black` in `pages/new`, `components/new`, `components/kokonutui` |
| Accents (D1, D2) | `new.css`, `ui.tsx` (`ACCENT`, `Accent`) | Violet, green, orange, sky; each with fill, `*-text`, `*-soft` and `on-*`. Red is status only (`nv-red`, `nv-red-soft`) |
| Elevation (D10, D14) | `new.css` (`--nv-shadow-*`) | Cards: soft shadow in light, 1px `nv-line` outline in dark. Chrome (`shadow-nv-chrome`) and floating layers (`shadow-nv-float`) never get a hairline |
| More primitives | `ui.tsx` | `StatTile` (D9), `Switch` (green when on), `MoreButton` ("Show all N", D11), `Badge` with `icon`, accent `SegmentedTabs` items |
| Toasts (D4, D6) | `components/new/toast.tsx`, `utils/toastBridge.ts` | Sileo host in ShellNew; `toast.success/error/info/warning/undo/dismiss`. App.tsx's own toasts go to Sileo through the bridge while the New shell is mounted, to Sonner otherwise. Sentence case and readable descriptions are CSS overrides in `new.css` |
| Confirm (D5, D15) | `components/new/ConfirmDialog.tsx` | `confirmNew({ title, message, danger })` → `Promise<boolean>`. Centred Base UI dialog from 768px, Vaul sheet on phones; danger uses the Hold Button |
| Hold Button (D5) | `components/kokonutui/hold-button.tsx` | KokonutUI `hold-button` 2.0.0, ported: `nv-*` tones, NvIcon, 44px pill |
| Errors (D15) | `components/new/ErrorPanel.tsx` | `ErrorBoundaryNew` wraps every New page inside ShellNew (resets on navigation); message only, Copy details |
| Skeletons (D15) | `components/new/Skeleton.tsx` | `PageSkeletonNew` (dashboard, list, detail), the page Suspense fallback inside ShellNew |
| Sheet scrim (D7) | `Drawer.tsx` (`SCRIM_CLASS`, `useSheetFlag`) | Light blur veil; `<html data-nv-sheet>` while a phone sheet is open moves new toasts to the top |

Running it: `npm run dev` needs a backend; the `dev-mock` launch configuration (port 5174) sets `CRYSTAL_MOCK_API=1` so demo mode works.

Not built yet, and planned with the pages that need them: KokonutUI Command Palette and Account Menu ports, Amount Pad, Widget Grid, Metric Card, Spending Ring, Smooth Drawer, the logo chip (D12) and the Hugeicons finder (D12).

Ports so far (D13): `hold-button` (KokonutUI 2.0.0, `components/kokonutui/hold-button.tsx`).

## 9. Proposed page order

Each page follows the §5.0 loop: list features from the data layer, decide keep / move / drop, design from §1–§4, build, check at 1440 and 375 in both themes, then approve.

| # | Page | Why this position |
|---|---|---|
| 1 | **TransactionsNew** + the `+` quick-add sheet | The dock's `+` already promises it. Sets the patterns every later page reuses: list rows, attention badges (Q5), the drawer form, Amount Pad, category grid |
| 2 | **AccountsNew** + **AccountNew** (detail) | Card visuals (Q6) with Flick Card and Momentum Rail; the dashboard's "My Cards" needs them |
| 3 | **DashboardNew** | Composes what 1–2 established into the bento (Widget Grid, Metric Card, Spending Ring, balance chart). Ship the Command Palette and Account Menu ports in the shell at the same time |
| 4 | **ForecastingNew** | It is in the dock; bklit projection line and band |
| 5 | **BudgetNew** | Liquid Gauge, goals rings |
| 6 | **ScheduleNew** | Bills and recurring; the notifications popover links here |
| 7 | **ReportsNew** | Built on the chart set from 3–5 |
| 8 | **InvestmentsNew** + **HoldingNew** (Warrants tab) | Largest data surface after Transactions |
| 9 | **SubscriptionsNew** | Memberships as Flick Cards |
| 10 | **SettingsNew** | The nine merged sections (Q10), Stack Panel on phones |
| 11 | **InvoicesNew**, **TasksNew**, **ChallengesNew** | Smaller, independent pages |
| 12 | **AuthNew** | Sign in / sign up; last, since it replaces the entry point |

---

## 10. WanderGrid alignment (decisions D1–D16, 2026-10-25)

The WanderGrid redesign (`~/Documents/wandergrid/UI_UX_DESIGN_REFERENCE.md`) adopted many practices through its review rounds. Each difference with this document was put to the user; these are the answers. They win over §1–§9 and §7.

| # | Topic | Decision | Changes |
|---|---|---|---|
| D1 | Accent set | **Four accents: violet, orange, green, sky.** Red is status only (over budget, errors, overdue) | Adds `nv-sky` (fill ≈ `#38BDF8`, small-text shade ≈ `#0369A1`; dark ≈ `#7DD3FC`). Meanings: **violet** brand, selected, cash and balances; **green** income, on track, done; **orange** spending, attention, due soon; **sky** transfers, planned and forecast items |
| D2 | Accent use | **WanderGrid §8.1 rules.** Fill the surface with the accent, not only the icon; a selected pill takes the accent of what it selects; stat-tile icons sit in accent-filled circles; toggles are green when on; one accent per meaning, never decoration. Each accent has a small-text shade (`*-text`) | §1.1, §2.2 |
| D3 | Selected state | **Violet**, as the reference: violet primary buttons and selected states. No near-black "ink" fills except chart tooltips | Unchanged from §1 |
| D4 | Toasts | **Sileo** (`sileo`) is the one toast host while a `-new` page is showing: Undo action, about 6 s (8 s for errors), above the dock on phones, moves to the top while a phone bottom sheet is open. The classic UI keeps Sonner until cutover | New `components/new/toast.ts` front over Sileo |
| D5 | Permanent actions | **Hold Button for every permanent action**, including delete, restore over data and wipe. Tear Button is not used for deletes | Supersedes Q9's Tear / Slide to Confirm |
| D6 | Undo-first | **Every reversible change applies at once with an Undo toast** (recategorise, mark paid, skip a recurring payment, archive, move). Only permanent actions ask first (D5) | §3 |
| D7 | Overlays | **Light blur veil** behind sheets and dialogs (no dark dimming); **no nested elevated cards** inside a sheet (inset panels instead). The **sticky footer stays** for long forms such as Add expense | `Drawer` scrim changes |
| D8 | Chart motion | **Keep Bklit's reveal** animation on first appearance (differs from WanderGrid). Numbers still roll with NumberFlow when data changes; reduced motion turns the reveal off | — |
| D9 | Page header | **Top bar keeps the title and page tabs** (Q7), with the title in Title Case (not uppercase). Each page body opens with **three filled stat tiles** (accent icon in a circle, number, label; compact rows above content), then on list pages a **page toolbar** (view toggle, search, one primary "New" button) | §2 |
| D10 | Floating chrome | **Soft shadow, no hairline border** on floating chrome (dock, top bar, popovers, avatar). **Inactive dock tabs show the icon only**; the active tab shows its name (the name stays the accessible label). Sidebar hover keeps its background fill | Shell changes |
| D11 | Long lists | **Cap lists**: first N with a fade and an accessible "Show all N" button (`aria-expanded`, 44px); the cap lifts while searching or filtering; "first 3, then +N" inside cards and rows; no list gets its own scroll area; tables become card lists on phones; after "Show all", long lists render in chunks while scrolling | — |
| D12 | Icons and logos | **Logos wherever a brand appears** (merchants, banks), on a white chip with the name always shown and an icon fallback, through the existing Brandfetch helpers. **Every status chip carries an icon**; icons are muted at rest and never carry status colour alone. **A searchable Hugeicons finder** for new category and account icons; stored Phosphor / Material names keep resolving | Supersedes the Q11 lookup-only plan |
| D13 | Build process | **Adopt WanderGrid's process**: KokonutUI first, then Magic UI, then Bklit, vanilla only with a written reason; porting checklist (lucide → Hugeicons, no `next/*`, `nv-*` tokens, named z-index, real props, version recorded) and a table of ports; the per-page checklist; migration notes per page (Kept, Moved, Dropped, Where the logic lives, KokonutUI check, Keyboard route, Not verified); page logic in `hooks/use<Page>Data.ts` and `utils/<page>Model.ts` with unit tests; verification at **375, 768, 1024 and 1440** in light and dark | §5, §9 |
| D14 | Guardrails | **Named z-index scale only** (`z-dropdown`, `z-sticky`, `z-popover`, `z-modal`, `z-toast`); **no arbitrary hex or z-index** in class names in `pages/new` and `components/new`, enforced by a unit test; **11px type floor** (chips and counters only, informational text 12px+); **44px targets**; in dark mode cards use a 1px `nv-line` outline and the lighter surface step instead of shadows | Foundation fixes |
| D15 | Shared feedback UI | **Build now, before the first page**: the Sileo host, a `ConfirmDialog` (centred from 768px, bottom sheet on phones, Hold for danger), an `ErrorPanel` (message only, Copy details) for the New shell's error boundary, content-shaped skeletons, and chart tooltips on `nv-surface` | Foundation |
| D16 | Cutover | **WanderGrid's path**: build on `-new` URLs; when every New page is approved they take the clean URLs and the classic UI moves under `/classic` for a while; then the classic files are deleted in small commits, with a `classic-final` git tag to recover anything | Supersedes the page-by-page migration steps in §5.0 |

### 10.1 Rules carried over from WanderGrid without a question

These follow from the decisions above or were already implied, and apply to every New page:

- **Feature parity:** nothing the classic page does is lost silently. Every dropped feature is a recorded decision in the page's migration notes.
- **Copy:** short, sentence-case labels and action-oriented buttons; no helper paragraphs.
- **Forms with several concerns become steps.** Detail views follow the reference's layout, not a gimmick component.
- **Every gesture has a keyboard and plain-tap route** (drag, flick, hold, swipe); `prefers-reduced-motion` turns morphs into fades.
- **Formatting** only through Crystal's helpers (`formatCurrency`, `utils/dateFormat.ts`).
- **Review rhythm:** the user reviews a running page and replies with a short numbered list; a commit follows each round.

---

## 11. Reference 3: coral "Financial Dashboard" (decisions R1–R8, 2026-10-25)

A third concept the user likes for its **layout, hero, tile styles and overall design**. Conflicts with §1–§10 were shown side by side (A = this document, B = the new reference) and decided by the user. These win over every earlier section.

### 11.1 What the reference shows

- **Frame:** one large rounded canvas. A **grey top band** holds the header row and the hero; below it a **white area** holds the tiles. No sidebar.
- **Header row:** round menu button, black logo disc, **two-tone title** ("Financial" ink / "Dashboard" grey), then on the right a round `+`, the profile (photo, name, role) and a round search button with a "Start searching here…" field.
- **Hero band:** a 120px **date disc** ("19") with "Tue, December", a coral **"Show my tasks →"** pill, a round calendar button with an unread dot, and on the right a large **two-tone prompt** ("Hey, need help? 👋" ink / "Just ask me anything!" grey, with a text caret) beside a large round **mic button**.
- **Tiles:** light grey (`~#F5F5F5`) on the white area, **no shadows, no borders**, radii about 28–32px. Each tile: a **white icon chip** (40px circle) top-left, a **period pill with a caret** ("Weekly ▾", "Direct debits ▾", "2023 ▾") top-right, a small grey label, then a large value whose **currency symbol is in the accent**. Some tiles are **split**: a white upper sub-card (card number, Receive / Send) over the grey lower part (monthly fee, "Edit cards limitation" link with an accent icon).
- **Footer links:** small accent text with a round accent icon ("View on chart mode", "Edit cards limitation").
- **Charts and widgets:** a **dark ring gauge** (black disc, accent arc, "36% Growth rate"), **dot-matrix progress** ("13 days · 109 hours"), **year comparison pins** (2022 grey vs 2023 accent), **concentric circles** for annual profit tiers ($14K → $4K), a **waveform** of thin bars with a dot pager, a sparkline with a "+9.3%" pill.
- **Activity manager:** title with round more / collapse buttons and a "Filters" pill, a search field, **filter chips with ×** (Team, Insights, Today), then sub-tiles: an amount with waveform, a **vertical icon stepper** list (Bank loans ▾, Accounting, HR management), an illustrated callout with one CTA (Wallet verification, Enable).
- **Review prompt:** pager dots, close button, "How is your business management going?", five **rating faces**.
- **Buttons:** black pill (Receive) beside a light pill (Send); the coral pill is kept for the one big call to action.

### 11.2 Decisions

| # | Topic | Decision | Supersedes |
|---|---|---|---|
| R1 | Palette | **Keep D1**: violet brand with green, orange and sky accents, red for status. Wherever the reference uses coral, Crystal uses **violet** | — |
| R2 | Surfaces | **Grey tiles on a white page, no shadows.** Light: page `#FFFFFF`, tiles a light grey (`nv-tile`, about `#F5F5F7`), inner sub-cards white (`nv-surface`); the shell's top band is the tile grey. Dark: page `nv-canvas`, tiles one step lighter, sub-cards one step lighter again. Radii: tiles **28px**, sub-cards 20px, chips and buttons full. **Split tiles** (white upper sub-card over the grey tile) are a standard pattern. No hairlines or outlines on tiles in either theme (tone steps carry the separation) | §1.3, D14's dark-mode outline for cards, the white-card `Card` |
| R3 | Dashboard hero | **Both.** A full-width **greeting band** at the top of DashboardNew: date disc, "Show my tasks" violet pill (opens what is due: tasks and bills), round calendar button with an unread dot, and the two-tone **"Hey, need help? Just ask me anything"** prompt with a mic button (backed by the existing `/api/ai/proxy`; the mic is shown only where speech input is available). The **money hero** (violet gradient "Spent this month" with the glass stats) becomes the **first tile** in the grid below | §2.2 hero, Q3's glass use stays on that tile |
| R4 | Navigation | **No sidebar on any width.** A top bar like the reference: round **menu button** that opens the grouped navigation in a drawer (left sheet on desktop, bottom sheet on phones), logo disc with the two-tone "Crystal / page name" title, round `+` (quick add), profile (photo, name; opens the account menu), round search button with a search field from 1024px. **Page tabs (Q7)** sit under the band, left-aligned. The **phone dock with the centre `+` (Q8, D10) is unchanged** | §2.1 sidebar, the sidebar in ShellNew |
| R5 | Tiles | **B is the default tile**: icon chip top-left, period or filter pill with caret top-right, small grey label, large value, optional footer link (accent text with a round accent icon). The **filled accent stat tiles (D9) stay only for each page's opening triplet** | D9 for everything except the triplet |
| R6 | Money | **Combined**: the currency symbol in violet and the decimals faint ("**$**491,080**.00**" with a violet $ and grey .00). Privacy blur unchanged | §1.2 rule 1, `Money` |
| R7 | Buttons and selected state | **Black ink primary**: everyday primary buttons and selected pills are ink (`nv-ink` fill, light in dark mode) with a light secondary pill beside them. **Violet is kept for the single hero call to action per screen** ("Show my tasks", "Enable", "Save expense") | D3 |
| R8 | Pattern catalogue | **Adopted:** the charts set (dark ring gauge, dot-matrix progress, year comparison pins, concentric circles, waveform bars with a dot pager); **two-tone titles** (first part ink, second part grey) for page titles, the brand and hero prompts; **filter chips with ×**, the **vertical icon stepper list**, and **period / filter pills with a caret** in tile headers. **Not adopted:** rating faces, the illustrated callout tile, circular single-action tiles | — |

### 11.3 What changed in the foundation (built 2026-10-25)

- Tokens: add `nv-tile` (light and dark), `nv-on-ink`; drop the card shadow from tiles; page background white in light mode.
- `Card` becomes the grey tile (with a `split` slot for the white sub-card); add `TileHeader` (icon chip, title, period pill), `PeriodPill`, `FilterChip` (with ×), `FooterLink`, `TwoToneTitle`.
- `Money`: violet currency symbol plus faint decimals.
- `Button` primary becomes ink; a `cta` variant is violet (one per screen). `SegmentedTabs` selected thumb becomes ink unless the tab has an accent (D2).
- ShellNew: remove the sidebar; new top bar (menu drawer, logo disc, two-tone title, `+`, profile, search); grey band behind header and page tabs; dock unchanged.
- Charts (R8) are built as Bklit-based or plain components when the first page needs them.

Built as listed above: tokens `nv-tile` and `nv-on-ink` (`new.css`, `index.css`), white page in light mode, `shadow-nv-card` is `none`; `Card` defaults to the grey tile and takes `top` for a split tile; `components/new/tile.tsx` holds `IconChip`, `PeriodPill` (Base UI menu), `TileHeader`, `TileValue`, `FilterChip`, `FooterLink` and `TwoToneTitle`; `Money` colours the currency symbol; `Button` has `primary` (ink) and `cta` (violet); `IconButton` gains `chip` and `ink` tones; `SegmentedTabs` selects in ink. ShellNew has no sidebar: the grey band with menu, logo disc, two-tone title, `+`, notifications, profile and search (from 1024px), page tabs in the band, and `NavDrawer` (left on desktop, bottom sheet on phones) with a page search that ⌘K / Ctrl+K also opens. The phone dock is unchanged. Not yet: the dashboard greeting band (built with DashboardNew) and the R8 charts.
