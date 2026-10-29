# UI/UX Design Reference: Finance Concept Deconstruction

> **Status:** design reference for the New pages (§5.0). Decisions Q1–Q12 (§7) and the WanderGrid alignment decisions D1–D16 (§10) were recorded on 2026-10-25. The third reference (coral "Financial Dashboard") and its decisions R1–R8 are in §11. Priority when sections disagree: §20, then §19, then §11, then §10, then §7, then §1–§5.
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
- **Chart tooltip & curves**: frosted glassmorphic pill with `backdrop-blur-sm` (`rgb(24 24 27 / 0.82)` in light, `rgb(18 18 18 / 0.85)` in dark, neutral 1px border `rgb(255 255 255 / 0.12)` and `shadow-2xl`), a date heading and a coloured dot per series with series names strictly formatted in **Proper Case** (e.g. `Net Worth`, `Balance`) and split-weight currency figures. Line and area charts draw smooth rounded continuous curves (`curveMonotoneX` for money series, see §20.4) with `strokeLinejoin="round"` and `strokeLinecap="round"` instead of sharp zigzag edges. A dashed vertical crosshair and hollow ring markers sit on each line. The x-axis label for the hovered day turns into an outlined pill or glassmorphic date ticker.
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
| **Integrations** | Enable Banking connections (status, sync options), Twelve Data, Brandfetch keys | `IntegrationsNew.tsx` | Connection cards | Uptime Card (connection health), Status Island (sync) |
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
| Shell | `components/new/ShellNew.tsx`, `shellContext.ts`, `PageToolbar.tsx` | Sidebar + a one-row top bar (title, search, the page's action, account menu; N20), phone dock, notifications. A page's tabs, filters and tools are its own, built from `PageToolbar.tsx` (§21) |
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

Ports so far (D13): `hold-button` (KokonutUI 2.0.0, `components/kokonutui/hold-button.tsx`); `amount-pad` (KokonutUI 1.0.0, `components/kokonutui/amount-pad.tsx`: a controlled amount field; recipient, presets, balance and Send removed; keys read the latest value through a ref so fast typing never drops a digit).

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


**R9 (2026-10-25, after reviewing TransactionsNew): no accent-filled surfaces.** The filled orange, green and violet stat tiles are removed everywhere. Every tile is the grey tile; accents live only on **icons** (a soft accent circle behind the icon), **badges**, **charts** and **text** (the violet currency symbol, income in green). This applies to all accent fills: the stat tiles (supersedes D9's filled tiles and R5's "filled triplet"), selected pills and category tiles (now ink outline or ink fill, R7), selected rows, and the money hero (supersedes R3's violet gradient and Q3's glass: it is now a neutral split tile with the figure on the white sub-card). `ACCENT` keeps only `icon` and `text`; `nv-hero-gradient`, `nv-glass` and the `glass` IconButton tone are deleted. D2 is revised: accents mark meaning on icons and text, never by filling a surface. Violet buttons (the one call to action, R7) and the violet `+` stay.

### 11.3 What changed in the foundation (built 2026-10-25)

- Tokens: add `nv-tile` (light and dark), `nv-on-ink`; drop the card shadow from tiles; page background white in light mode.
- `Card` becomes the grey tile (with a `split` slot for the white sub-card); add `TileHeader` (icon chip, title, period pill), `PeriodPill`, `FilterChip` (with ×), `FooterLink`, `TwoToneTitle`.
- `Money`: violet currency symbol plus faint decimals.
- `Button` primary becomes ink; a `cta` variant is violet (one per screen). `SegmentedTabs` selected thumb becomes ink unless the tab has an accent (D2).
- ShellNew: remove the sidebar; new top bar (menu drawer, logo disc, two-tone title, `+`, profile, search); grey band behind header and page tabs; dock unchanged.
- Charts (R8) are built as Bklit-based or plain components when the first page needs them.

Built as listed above: tokens `nv-tile` and `nv-on-ink` (`new.css`, `index.css`), white page in light mode, `shadow-nv-card` is `none`; `Card` defaults to the grey tile and takes `top` for a split tile; `components/new/tile.tsx` holds `IconChip`, `PeriodPill` (Base UI menu), `TileHeader`, `TileValue`, `FilterChip`, `FooterLink` and `TwoToneTitle`; `Money` colours the currency symbol; `Button` has `primary` (ink) and `cta` (violet); `IconButton` gains `chip` and `ink` tones; `SegmentedTabs` selects in ink. ShellNew has no sidebar: the grey band with menu, logo disc, two-tone title, `+`, notifications, profile and search (from 1024px), page tabs in the band, and `NavDrawer` (left on desktop, bottom sheet on phones) with a page search that ⌘K / Ctrl+K also opens. The phone dock is unchanged. Not yet: the dashboard greeting band (built with DashboardNew) and the R8 charts.

---

## 12. Migration notes: TransactionsNew (round 1, 2026-10-25)

`pages/new/TransactionsNew.tsx`, `/transactions-new`; features from `pages/Transactions.tsx`, `components/AddTransactionModal.tsx` and the transactions context. The classic page is untouched.

### 12.1 Decisions (T1–T4)

| # | Topic | Decision |
|---|---|---|
| T1 | Scope | **Core now, advanced next.** Round 1 is below; split / combine, loan principal-interest, spare change, make recurring and location editing come in round 2 and stay reachable through "Open in classic UI" until then |
| T2 | Tabs | **Activity / To review** in the band (`?tab=review` in the URL). Type is filter chips (Expenses, Income, Transfers) |
| T3 | Stat tiles | **Spent** (orange), **Income** (green), **To review** count (violet, opens that tab), for the selected period |
| T4 | Amount entry | **KokonutUI Amount Pad**: on-screen keys on phones, typing into the big amount on desktop |

### 12.2 Notes

- **Kept (features):** the list of every transaction, newest first, grouped by day; transfers shown once (both legs merged, "From → To"); split and combined parents shown with a Split badge (their parts hidden); search over title, merchant, description, category, note and amount; period (this month, last month, last 90 days, this year, last 12 months, all time; all time when the month is empty, with a line saying so); type chips; account, category and tag filters with removable chips; a detail sheet; add and edit expense, income and transfer (amount, category, account or from / to, date, merchant, description, note, tags); delete with Undo; duplicate to today with Undo; multi-select with categorize (Undo) and delete (Hold for more than one, then Undo); CSV export of what is shown; bank sync; the account and tag filters other pages hand over; balance adjustments follow the "show balance adjustments" preference; merchant logos (Brandfetch) with a letter fallback in the category colour.
- **Round 2:** built, see §16.
- **Dropped (decided, round 1):** the column table with per-column filter popups (replaced by the search, chips, filter sheet and sort pill); the map widget. Both can come back in a review round.
- **Search, controls and the add button:** in the header band (§13 N2, §14 N4–N5); the page body starts with the stat tiles.
- **Changed on purpose:** To review counts uncategorized expenses and income (not transfers or adjustments). Deleting one transaction applies at once with Undo instead of a confirm (D6); deleting several asks with the Hold Button first (D5). The last account used in quick add is remembered on the device.
- **Where the logic lives:** `utils/transactionsModel.ts` (rows, filters, day groups, periods, totals, CSV, `planSave` for drafts; strict-typed; `tests/unit/transactionsModel.test.ts`) and `hooks/useTransactionsData.ts` (contexts, display currency, logos, writes that return an `undo`). The classic page keeps its own copy, untouched.
- **Quick add:** `components/new/transactions/sheets.tsx` `QuickAddSheet`, mounted once in ShellNew and opened by the band's `+`, the dock's `+` and the page's "Add transaction" (`useShellNew().openQuickAdd`). The shared form is `TransactionForm.tsx`; parts (row, avatar, badges, picker and text fields) are in `parts.tsx`.
- **KokonutUI-first check:** Amount Pad (ported), Hold Button (bulk delete). Swipe Tabs not used for the page tabs (they live in the band as segmented tabs). Smooth Drawer not ported yet: sheets use the Vaul `Drawer`. Plain components: the day-grouped list, the filter sheet and the picker field (no KokonutUI component covers a select).
- **Keyboard and tap route:** every row is a button (Enter opens the sheet); in select mode a tap or Enter toggles a row; the amount takes digits, "." or ",", and Backspace; the period, category and account pickers are menus with arrow keys.
- **Phones:** the stat tiles are a snap rail so the list starts on the first screen; the page's "Add transaction" button is hidden (the dock's `+` does it).
- **Verified:** in the browser on demo data at 1440, 1024, 768 and 375, light and dark: quick add (keyboard and keypad), edit, delete and Undo, search, chips, filters, select, To review empty state, the empty-period state. **Not verified:** CSV download contents in a browser (the CSV text is unit tested), bank sync against a real Enable Banking connection, and Brandfetch logos (no key in demo mode).

---

## 13. Navigation and search adjustments (N1–N2, 2026-10-25)

| # | Topic | Decision | Supersedes |
|---|---|---|---|
| N1 | Phone dock | **Every tab always shows its name.** The dock is Home, Accounts \| + \| Activity, Forecast, **More**; More opens the menu drawer with every page (it reads as selected on a page that has no dock tab). The `+` floats over its own gap so it stays between Accounts and Activity | D10's active-only labels; Q8's four-tab dock |
| N2 | Header search | **The header search belongs to the page.** A page registers its own search with `usePageSearch({ value, onChange, placeholder })` and the header field filters that page (Transactions: transactions; Accounts: accounts). Pages without one (the dashboard, placeholders) get a **page finder**: type, then arrow keys and Enter, or click a result. Desktop: an inline field in the band. Phones and tablets: a search button opens the field under the header row. ⌘K / Ctrl+K focuses it; Escape clears it. **The menu drawer has no search** | R4's drawer search and "Start searching here…" button; the Transactions toolbar search field |

Built: `components/new/HeaderSearch.tsx`, `usePageSearch` in `components/new/shellContext.ts`, ShellNew's band and dock. TransactionsNew registers "Search transactions".

---

## 14. Header actions and controls (N3–N5, 2026-10-25)

| # | Topic | Decision | Supersedes |
|---|---|---|---|
| N3 | Phone dock | **Five named links, no `+`:** Home, Accounts, Activity, Forecast, More | Q8's centre `+`, N1's floating `+` |
| N4 | Primary action | **Each page's primary action is the header's violet button** (desktop: icon and label, e.g. "+ Add transaction"; phones and tablets: a violet round icon button). A page sets it with `usePageAction({ label, icon, onClick })`; pages without one get **Add transaction** (quick add), so adding a transaction is one tap from anywhere. It is the screen's one call to action (R7); the page body does not repeat it (empty states use the ink button). On phones the bell moves into the account menu ("N bills due soon") to make room | The band's plain `+` (R4), the toolbar's "Add transaction" |
| N5 | Page controls | **Superseded by N20 to N23 (2026-10-29).** ~~A page's controls live in the header band~~ **A page's controls live in the header band**, under the tabs: period, filters, type chips, active filter chips and tools (select, export, sync). Pages render them with `<HeaderControls>` (a portal into the band's slot); the slot disappears when a page has none | The toolbar tile at the top of the page body |

Built in `components/new/shellContext.ts` (`usePageAction`, `HeaderControls`, `headerSlot`) and ShellNew. TransactionsNew moved its toolbar into `HeaderControls` and registers "Add transaction".

---

## 15. Header tools row (N6–N7, 2026-10-26)

| # | Topic | Decision |
|---|---|---|
| N6 | Page tools | **Superseded by N23 (2026-10-29).** ~~A page's tools sit on the tabs row, right-aligned~~ **A page's tools sit on the tabs row, right-aligned** (select, export, sync on Transactions), filled through `<HeaderTools>` (a portal into the row's slot, in `shellContext.ts`). The row shows only when a page has tabs or tools. On a 375px phone the tools wrap under the tabs, still right-aligned. Period, filters, sort and chips stay in the band's controls row (§14 N5) |
| N7 | Sync and chips | **Sync is a green button with the word "Sync"** (`Button variant="success"`; "Syncing" and disabled while running). The Expenses / Income / Transfers chips carry icons (`FilterChip icon`), as every status chip does (D12) |

---

## 16. TransactionsNew round 2 (2026-10-26)

Everything the classic page did that round 1 deferred. The logic is in `utils/transactionsModel.ts` (15 unit tests in `tests/unit/transactionsModel.test.ts`), the writes in `hooks/useTransactionsData.ts` (each returns an Undo), the sheets in `components/new/transactions/` (`actions.tsx`: split, combine, bulk edit, make recurring; `LocationField.tsx`; `TransactionForm.tsx`; `sheets.tsx`).

- **Split and unsplit:** the detail sheet's menu (or the selection bar's Split) opens a sheet with two equal parts to start; add, remove and edit parts (amount, category, description); the button reads "Remaining €x" until the parts add up, then "Save N parts". A split row shows once with a Split badge (its parts are listed in the sheet). Editing a split replaces its parts. Unsplit removes the parts.
- **Combine and uncombine:** select two or more ordinary transactions, Combine: a sheet for description, category, date and account, with the net total and the list. The combined row shows once with a Combined badge; Uncombine in the menu puts the originals back.
- **Bulk edit:** the selection bar's Edit opens a sheet where each field has its own switch (date, account, description, merchant, category, tags with Add or Replace, location with clear). Only switched-on fields change. Categorize (the quick action) uses the same engine.
- **Make recurring:** from the menu; a sheet with amount, account(s), category, merchant, description, repeats (daily to yearly) every N, start, optional end, day of the month, and the weekend rule. It creates a recurring transaction with an Undo.
- **Location:** the form searches places with the app's address search; a chosen place stores address, place, street, city, postal code, state, country and coordinates. The detail sheet shows it, and the menu has Remove location. A **Locations** group in Filters filters by city; search also matches city and place.
- **Loan payments:** a transfer into a loan account (or an income on one) shows principal and interest. They follow the amount from the loan's rate and balance until you type one of them (the other becomes the remainder); with no rate on the loan they start empty. They are stored on the loan's leg and shown in the detail sheet.
- **Round-up:** an expense or transfer out of an account that feeds a spare-change account shows a Round up switch (on by default for new transactions), the Skip whole / Unit push rule and a multiplier, with the amount set aside. Saving creates the spare-change pair; editing updates or removes it.
- **Filters and sort:** amount from / up to, locations, and a Sort pill (newest, oldest, largest, smallest, merchant, category). Date sorts group by day; the others are one flat list.

**Corrections to round 1's notes:** "Pending bank matches in To review" was listed by mistake; the classic page has no such feature. Categorize now converts a transfer into an ordinary transaction (as the classic page did) instead of skipping transfers, and changes the type when the category is of the other kind.

**Differences from the classic page, on purpose:** combine excludes transfers, existing groups and parents (the classic page only excluded transfers); bulk edit's account change skips transfers (the classic page moved one leg); loan principal and interest are recorded for payments into a loan, not from one; an existing round-up is found by the `spare-<id>` convention only; deleting a split or combined parent deletes its parts; the "sync location to merchant" option is dropped; a split or combined parent cannot be edited or duplicated (use Edit split, Unsplit or Uncombine).

**Verified** in the browser on demo data (the preview's browser storage had been reset, so it held the demo data and not your backup): split, edit and unsplit; combine and uncombine; bulk edit and its empty message; the amount filter and flat sort; make recurring; a loan transfer with manual principal and interest, its detail row, edit and delete with Undo; the location search and pick. Not exercised in the browser: the round-up switch (the demo's spare-change account is not linked to an account; the model is unit tested), the sheets on a real touch device, and a bank sync.

---

## 17. Reference 4: dark fintech dashboard, applied to Transactions (R10, T5–T9, 2026-10-26)

A fourth concept (a dark indigo dashboard with a phone set), integrated into the Transactions page. Questions on its conflicts with §1–§16 were shown with a sketch and answered by the user.

### 17.1 What the reference shows

- **Desktop:** a large **Total balance** card (big figure, faint decimals) with an **Accounts** row of account tiles (last digits, balance, a ↗ button) and arrows; four KPI tiles (Total spent with +10% and a gradient sparkline, Savings, Top category, Active subscriptions); a **Spending** panel with a bar chart by weekday (violet gradient bars, a tooltip on the hovered bar, a y-axis) beside **category percentage tiles** with glowing coloured outlines; a **Recent transactions** table.
- **Phone:** a transactions list with square merchant logos, name and date under it, amount and category on the right; a budget progress line ("You've spent X / Y budget this month"); a home screen with a gradient balance card and category tiles; a **transaction details** screen with the logo, a large amount, a key-value card, a **map** of the location, a tag field with removable tags, "Split this payment", "Create saving rule from this" and "Report an issue".

### 17.2 Decisions

| # | Topic | Decision |
|---|---|---|
| R10 | Style | **Layout and content, plus gradient on data marks only.** Tiles stay flat grey (R2, R9). The violet-to-blue gradient (`--nv-grad-from` / `--nv-grad-to`, classes `nv-grad-v` and `nv-grad-h`) is used on chart bars, sparklines and map clusters, never on a surface, a button or a card. No glowing outlines |
| R11 | Maps | **OSMF vector tiles + MapLibre, VersaTiles `colorful` / `colorful-dark`; no CARTO anywhere.** See the Map note below |
| T5 | Hero | **Weekday bars beside a map of where you spent**, in one "Spending" tile. The map **replaces the category percentage tiles**. Both follow the account scope, the period and the page filters |
| T6 | Top of the page | **A balance card with account tiles, and four KPI tiles**, replace the three stat tiles on this page: **Spent** and **Income** (each with the change against the previous period of the same length and a gradient sparkline), **Top category**, **To review**. "Total balance" is the checking, savings and credit-card accounts (cards count as what is owed) in the display currency, or just the picked accounts. Tapping an account tile filters the list to it. The reference's Savings and Active subscriptions tiles are not here (subscriptions belong to their own page); the budget strip was not chosen |
| T7 | Cross-filtering | **The chart and the map filter the list.** Tap a weekday bar or a place on the map; each becomes a removable chip in the header controls. The chart ignores the day filter and the map ignores the place filter, so each can be switched while the other is set |
| T8 | Rows | **The reference's row**: a 48px square merchant logo (a letter when there is none), the name in bold with the account (and the date when not grouped by day) under it, the amount with its category beneath on the right. Dates here carry no time, so none is shown |
| T9 | Detail sheet | **A map of the location** (when the transaction has coordinates) and an **inline tag editor**: type a tag and press Enter (an existing tag is reused, a new one is created), × removes one; each change has an Undo. **Not added:** "Create saving rule" (the user did not choose it) and "Report an issue" (no equivalent) |

### 17.3 Notes

- **Map:** `components/new/transactions/PlacesMap.tsx`, loaded lazily so MapLibre stays out of the main bundle. Transactions with coordinates are grouped by city (else a coordinate cell); a cluster is a gradient circle sized by its count. The map frames the places and refits when it resizes until the user pans or zooms it. **R11 (basemap): OSMF Shortbread vector tiles drawn by MapLibre with VersaTiles styles, with Home Assistant 2026.10's palettes (cream and golden roads in light, navy with teal parks in dark) laid over `colorful` / `colorful-dark`**. No API key, and CARTO is removed everywhere (its key field, `cartoApiKey` preference, hook and provider badge are gone). The style is built in `utils/mapStyle.ts` (mercator, no globe) and shared by the New maps and, through `@maplibre/maplibre-gl-leaflet`, the classic Leaflet maps. Requests go to `vector.openstreetmap.org` (tiles) and `tiles.versatiles.org` (fonts, sprite); the production CSP already allows HTTPS. Attribution credits OpenStreetMap and VersaTiles. A transaction with a city but no coordinates is counted ("N name a city but have no coordinates") and cannot be placed; choosing the place from the location search stores coordinates.
- **Logic:** `utils/transactionsModel.ts` (weekday totals, clusters, places, previous period, percentage change, series, sparkline path, top category, balance), 20 unit tests. The Locations filter now uses place keys (city, else a coordinate cell).
- **Detail sheet:** the open row is resolved live from the data, so tag changes show at once; its edit draft resets only when a different transaction opens.
- **Verified** in the browser: on demo data in a separate origin (so no real data was on screen) at 976, 1440 and 375 px, dark and light: balance card and account tiles, KPI sparklines, the chart, the map with clusters, a real click on a cluster (list 22 → 11, chip, ring), a weekday bar (22 → 6), the row layout, the detail sheet with its map and a tag added and removed. On the real data, by counts only: 6 account tiles, 7 bars, 6 places with 52 located transactions this month, no errors.
- The account tile filter was also checked on the real data by counts (141 → 106 transactions, a chip, "1 selected account", then cleared).
- **Not verified:** the previous-period change on a closed range (all-time has none, and the demo data is old; the logic is unit tested) and bank sync.

## 18. Transactions table (2026-10-26)

From `lg` up the list is a table with the classic page's structure in the New style (`components/new/transactions/table.tsx`): **Transaction details** (logo, title, merchant or description, attention badges, notes icon), **Account** (a transfer reads `from → to`), **Category** (pill with the category dot), **Location** (flag and city), **Tags** (first tag and `+n`), **Value**, and a row menu (View details, Select). Location and Tags show from `xl`. Day headers carry the record count and the day's **Daily net** (transfers and adjustments left out), and a day checkbox while selecting. Details, Category and Value headers sort (Details = merchant A–Z, Value = largest then smallest, each a third click back to newest first); Account, Location and Tags do not sort, since the model has no sort for them. Below `lg` the card rows stay. Classic's per-column filter popovers are not carried over: filtering stays in the Filters drawer and the header chips.

**Round-ups are folded into their transaction (N8).** As in the classic table, a round-up (the `spare-<id>` transfer pair) is not a row of its own: it shows as a small piggy amount under the transaction's value (`SpareChip`, table and card rows), and deleting the transaction deletes its pair. The pair is matched by id, then, for older data, by account, day and description. A round-up that matches nothing stays listed as a "Round-up" row so no money movement is hidden. Built in `buildRows` (`TxRow.spare`).

**Account logo and header filters (N9).** The Account column leads with the institution's logo on a white chip, else a bank icon. Each column header has a filter button (a count badge when active) opening a popover: Details searches, Account / Category / Location / Tags pick values, Value sets the type and amount range. They share state with the Filters drawer and the header chips.

**One filter list everywhere (N10).** The column popovers and the Filters drawer share `FilterList` (`components/new/transactions/filters.tsx`): a search box from 8 options, a "n selected" count with Clear, and group headers that select or clear their whole group (with a partial state). Accounts group by type (assets before debts, Closed last), categories under Expenses and Income with sub-categories indented, locations show their transaction count, tags their colour. The drawer lists Type, Accounts, Categories, Locations and Tags as titled sections with a count badge.

**Quick filters and details filters (N11).** The accounts list opens with presets (All accounts, Liquid only, All assets, All liabilities, Investments; a preset with no accounts is left out): a click selects exactly those accounts, and it shows pressed while the selection matches. Every filter list also has Select all next to Clear. The Details column filter (and a Details section in the drawer) has **Description** (details and notes) and **Merchant** as separate filters, each with a header chip when active; the page search in the header stays separate.

**Permanent sidebar on desktop (N12).** From `lg` the grouped page links sit in a fixed grey sidebar (logo, Overview / Planning / Manage, its own scroll) that is always open; the header drops its menu button and logo mark, and the page shifts right by the sidebar's width. Phone and tablet keep the dock and the menu drawer (N1, N3). This supersedes the R8 "top bar with menu drawer replaces the sidebar" for desktop only. `NavList` is shared by the sidebar and the drawer.

**Scroll index and hidden scrollbars on phone (N13).** From `lg` the shell wraps every page in KokonutUI's Scroll Index (`components/kokonutui/scroll-index.tsx`, installed with `npx shadcn@latest add @kokonutui/scroll-index`, moved next to the other ports and restyled with `nv-*` tokens, sample article removed): a rail of ticks at the page's right edge, one per tile title (`h2`) and, on Transactions, one per day (`data-nv-index`). Hover swells the ticks and names the section, a click or arrow key jumps there, dragging the rail scrubs the page. Below `lg` the rail is hidden and every scrollbar in the shell is hidden (the content still scrolls).

**Icons and logos for what money is attached to (N14).** `components/new/EntityIcon.tsx`: categories and tags show the icon the user picked, in their colour (stored names in the old Material, Phosphor and Untitled spellings map onto a curated Hugeicons set of about 70 glyphs; an unknown name falls back to a letter in the colour). Financial institutions and merchants show their logo on a white chip, else a bank icon or a letter (`LogoTile`). Shown in the table (category and tag chips, account and merchant logos), the card rows, the detail sheet, the add and edit form's category picker and tag chips, and every filter list. The Details filter now picks merchants from a searchable list with logos and counts (replacing the free-text merchant box); long lists show the first 150 until searched.

**The four KPIs, as in the classic page, with a chart (N15).** Total transactions, Total income, Total expenses and Net cash flow replace the Spent / Income / Top category / To review tiles (To review stays on the tab). They follow the list: every filter applies, transfers and balance adjustments are neither income nor expense, and each shows its change against the same filters one period back. The tiles are also the picker for the chart under them: KokonutUI's Metric Card (`components/kokonutui/metric-card.tsx`, installed with `npx shadcn@latest add @kokonutui/metric-card`, restyled with `nv-*` tokens, demo data removed, a `formatValue` and an `invert` prop added). It draws the selected KPI per day over the page's period (at least a week, at most a year) against the same number of days before it, with a breakdown (transactions by kind, income and expenses by their three biggest categories plus Other; net flow has none), hover or arrow-key reading of a day, and a drag to read a range. Phone: tiles two by two, the chart full width.

**Redesigned overview and add / edit sheet (N16).** After the classic overview's layout, in the New style.
- **Overview** (`components/new/transactions/detail.tsx`): the sheet opens on a full-bleed hero, the map of where it happened with the place as a glass pill (a quiet banner when there is no location), the merchant's logo, the date and account, the merchant name large, the amount very large (ink, green for income) with the currency and a kind pill, then the status badges. Below, soft tiles: Account (logo, last four), Category (icon in colour, its parent), Merchant, Net flow, Location (address, an Open in Maps link), Description, Memo, Round-up, Loan payment, Tags (edited in place), split or combined parts. The footer is Edit, then round Duplicate, Delete and More. The Drawer gained a `hero` prop for this (close button floats over it).
- **Add / edit form**: the type tabs, then titled sections: **Amount** (a large tile with the keypad on phones, tinted by kind, a summary line of account, day and currency), **Category** (six tiles with their icon in colour, the one being edited always among them, plus Browse every category), **Details** (account picker with bank logos, merchant field that shows the merchant's logo once typing pauses, Today / Yesterday chips beside the date, description), the round-up and loan panels when they apply, and a collapsed **Note, location and tags** (open when the transaction has any).

**Balance with the statistics, a coloured expenses chart, a flatter overview (N17).** Supersedes parts of N15 and N16.
- **Balance card**: the account tiles are gone (the account filter lives in the filters). It holds the total balance, the transaction count at the top right, and Expenses, Income and Net in a compact row of three (each with its change on the period before). They are the chart's picker. Phone: 36 px balance, 15 px figures.
- **Chart replaces the weekday bars**: the expenses chart sits beside the map in the Spending card. Each day is a stacked bar in the categories' own colours (the three biggest plus Other in grey; income likewise; transactions by kind in red, green and sky), the breakdown bar and dots use the same colours, and picking a segment shows only it. Amounts use the app's money style (violet sign, grey decimals), also in the breakdown. Net cash flow keeps the line. The weekday filter has no control now; its chips still appear if a link sets one.
- **Overview**: no tiles. Each fact is a line with a round tinted glyph (account sky, category in its own colour, merchant orange, net flow in the kind's colour, location green, description and tags violet, memo orange, round-up green), a small label over the value, and a hairline between lines. The hero banner is tinted with the category's colour (income green, transfers sky) and shows a kind pill and a category pill in the same colours.

**The add / edit composer and the layer fix (N18).** Supersedes the form part of N16.
- **Bug**: popovers and menus opened from inside a sheet appeared behind it, and clicking them closed the sheet. Cause: `z-popover` (200) was below `z-modal` (500), and the sheet counts a click in another layer as outside. Now the scale is dropdown 50, sticky 100, modal 500, popover 600, toast 1000; every popup carries `pointer-events-auto`; and the Drawer ignores outside clicks that land in a `z-popover` layer.
- **Composer** (`TransactionForm`, `composer.tsx`): it fits one screen. Type tabs, the amount (keypad on phones), one merchant line with its logo (none for transfers), a quiet description line, then chips that open a searchable pick list: Category (icon, sub-categories indented), Account (bank logos, grouped by type), To account (transfers), Date (Today, Yesterday, another day). A row of the six most used categories sits under them, tinted in their colours. Note, Location and Tags are dashed "+" chips that open their field on demand (open from the start when the transaction has them). Round-up and loan panels appear when they apply.

**Round-up panel, tab centring and the chart line (N19).** The round-up panel: a green piggy disc, the title, a green "Sets aside €0.50" (or why nothing), the switch; when on, a divider, then two clear choices for a whole amount (radio cards: Set aside nothing / Set aside 1, each with one line of explanation) and the multiplier as a − ×1 + stepper. Segmented tabs centre their icon and label in the button, vertically too. The expenses chart draws the trend as a white (black in light mode) line over the coloured bars.

---

## 19. Primary Brand & CTA Colour Update (2026-10-28)

Only the primary brand & CTA slot (`--nv-violet` token family in `components/new/new.css`) is updated from electric violet (`#6D3AF2`) to **Dark Slate Grey (`#183A37`)**. All other surfaces (`#FFFFFF` / `#F4F4F6` in light, `#000000` / `#111111` / `#1C1C1C` in dark), text hierarchy, and accents (`orange`, `green`, `sky`, `red`, `peach`) remain unchanged.

| Token | Light Mode | Dark Mode | Role |
|---|---|---|---|
| `--nv-violet` | `#183A37` | `#183A37` | Primary brand fill, hero CTA buttons, primary chart series (`--chart-1`), focus rings |
| `--nv-violet-strong` | `#112B29` | `#112B29` | CTA hover state |
| `--nv-violet-soft` | `#E6EFEE` | `#132927` | Soft icon circle & badge background |
| `--nv-violet-text` | `#183A37` | `#65B5AD` | Currency symbols, links, and small brand text |
| `--nv-on-violet` | `#FFFFFF` | `#FFFFFF` | Text on primary brand / CTA fills |

---

## 20. Tooltips & Legends Design Standards (2026-10-28)

Every tooltip and chart legend across the application must strictly adhere to the following design rules:

### 20.1 Glassmorphic Blur & Neutral Background for All Tooltips
All floating tooltips (chart hover tooltips, date tickers, base UI tooltips, and popovers) feature a subtle frosted glassmorphic appearance with a neutral (non-tinted) backdrop:
1. **Neutral Translucent Background:**
   - Light mode: `--chart-tooltip-background: rgb(24 24 27 / 0.82);` (neutral dark Zinc-900 glass, no blue/violet color cast)
   - Dark mode: `--chart-tooltip-background: rgb(18 18 18 / 0.85);` (neutral dark 950 glass)
   - Base UI tooltips: `bg-white/80 dark:bg-zinc-900/80`
   - Foreground / Muted: `--chart-tooltip-foreground: #fafafa;`, `--chart-tooltip-muted: #a1a1aa;`
2. **Backdrop Blur `sm`:**
   - `backdrop-blur-sm` (`backdrop-filter: blur(4px)` and `-webkit-backdrop-filter: blur(4px)`) for a crisp, light frosted aesthetic.
3. **Delicate Translucent Border:**
   - `--chart-tooltip-border: rgb(255 255 255 / 0.12);` (1px subtle border, plus internal header divider line `border-b border-chart-tooltip-border`).
4. **Soft Layered Elevation:**
   - Deep diffused shadow `shadow-2xl` with 1px inner edge highlight (`before:` pseudo-element ring).

### 20.2 Proper Case for Legends and Tooltip Data Labels
Chart series keys and legend labels must never render raw developer keys (camelCase, snake_case, or lower case). They must always be transformed into clean **Proper Case / Title Case**:
- **Automatic Formatter:** Powered by `toProperCase()` in `components/bklit/charts/chart-formatters.ts`.
- **Examples:**
  - `netWorth` → **`Net Worth`**
  - `balance` → **`Balance`**
  - `income` → **`Income`**
  - `expenses` → **`Expenses`**
  - `dailyAvg` → **`Daily Avg`**
  - `monthlyIncome` → **`Monthly Income`**
  - `loan_balance` → **`Loan Balance`**
  - `cost-per-km` → **`Cost Per Km`**
  - `desktop` → **`Desktop`**
- **Acronym Preservation:** Established financial and technical abbreviations (`USD`, `EUR`, `LTV`, `APY`, `ROI`, `APR`) preserve their uppercase presentation.
- **Components Enforcing Proper Case:**
  - `ChartTooltip` (maps series rows and band labels through `toProperCase`)
  - `TooltipContent` (formats `row.label` with `toProperCase`)
  - `LegendLabel` (formats `item.label` with `toProperCase`)

### 20.3 Split-Weight Currency Formatting in Tooltips
Numeric data values in chart tooltips must be rendered with proper currency and the app's standard split-weight typographic hierarchy (§1.2 rule 1):
- **Currency Resolution:** Inherits from the chart's `currency` prop (e.g. `<AreaChart currency={currency} ...>` or `<ChartTooltip currency={currency} />`), falling back to chart context or `'EUR'`.
- **Typographic Anatomy:**
  - **Currency Symbol:** formatted cleanly in `text-chart-tooltip-muted` (e.g., `€`, `$`, `£`).
  - **Whole Number (Digits):** bold/prominent in `text-chart-tooltip-foreground` with `tabular-nums`.
  - **Decimal Fraction:** smaller and lighter in `text-chart-tooltip-muted text-xs` (e.g., `.00` or `.50`).
- **Formatter Utility:** Powered by `formatCurrencyAmount()` in `chart-formatters.ts` and rendered in `TooltipContent`.

### 20.4 Rounded Line & Area Chart Curves
All line and area charts must feature smooth, rounded continuous curves rather than sharp or angular zigzag edges:
- **Default Curve Interpolation (amended 2026-10-29, decision Q4):** money series use `curveMonotoneX`, which never overshoots between points, so a balance chart cannot draw a dip or peak that never happened. `curveNatural` stays only for non-money series where smoothness matters more than exact values. Single-series balance charts carry no decorative `TrendLine` or dotted `Background`.
- **Path Joins & Terminals:** All rendered chart strokes (`<Area>`, `<Line>`, `<TrendLine>`) specify `strokeLinecap="round"` and `strokeLinejoin="round"` to guarantee fully rounded corners, smooth path transitions, and soft stroke terminals.
- **Visual Feel:** Delivers a fluid, premium financial aesthetic matching modern finance dashboard standards (Ref D / Ref M) across net worth, historical balance, compounding, and cashflow charts.

### 20.5 Account Logos 3-Tier Resolution Order (Brandfetch → Uploaded Image → Icon)
All account visuals across balance sheet rows, bento cards, wallet carousels, account detail hero views, archetype views, and modals follow a strict 3-tier cascade via `<AccountLogo />` (`components/new/EntityIcon.tsx`):
1. **Tier 1 — Brandfetch (Strictly User-Configured URLs Only):**
   - Active only when `preferences.brandfetchClientId` is non-empty **AND** a valid domain/URL has been configured by the user.
   - Evaluates user-configured identifiers via `getAccountBrandfetchUrl()` (`utils/brandfetch.ts`):
     a. `account.website`: Explicit website/portal domain or URL entered by the user.
     b. `account.financialInstitution`: Only if it contains an explicit domain with a valid TLD (e.g. `belfius.be`) or matches a user-defined mapping in `merchantLogoOverrides`.
     c. `account.name`: Only if it contains an explicit domain or matches an override.
   - **No Unconfigured Guessing:** The system never guesses or synthesizes domains (no auto-appending `.com` to bank or account names, and no automatic card network fallbacks like `visa.com`). If no domain or URL is configured by the user, Brandfetch is **never queried**, returning `null` immediately.
   - Requests Brandfetch with `fallback: '404'`. If Brandfetch returns 404 or image fails to load, `onError` automatically cascades to Tier 2.
2. **Tier 2 — User's Uploaded Image:**
   - Active if Brandfetch has no configured URL, is not enabled, or fails to load.
   - Loads the user's custom URL / uploaded asset (`account.imageUrl`).
   - If `account.imageUrl` is absent or encounters a network error / 404, `onError` cascades to Tier 3.
3. **Tier 3 — Icon:**
   - Fallback when no Brandfetch or uploaded image is available or both fail.
   - Renders `account.icon` if matching a recognized entity icon glyph (`EntityGlyph`).
   - Otherwise, renders archetype icon from `accountTypeIcon(account)` (e.g. `bank`, `piggy`, `card`, `invoice`, `home`, `pin`, `investments`, `wallet`, `warning`).

### 20.6 Card & Account Wallet Priority Hierarchy
**Removed 2026-10-29 (N24).** The Card & account wallet rail (`CardWalletRail`, `getCardWalletAccounts`, `MomentumRail`) is gone from every view: it repeated the accounts list. `CardFlip` stays for the credit-card detail page, and `AccountCard` draws the card in the account hero and overview sheet.

### 20.7 Account Type Grouping in the Split Sheet
The `/accounts-new` list has one layout, the split sheet (N24); the list and bento grid were removed because they look the same on a phone. Accounts are grouped by type with `groupAccountsByType()` in `utils/accountsModel.ts`:

1. **Assets** (Checking $\rightarrow$ Savings $\rightarrow$ Meal Vouchers $\rightarrow$ Investments $\rightarrow$ Lending $\rightarrow$ Property & Real Estate $\rightarrow$ Vehicles $\rightarrow$ Other Assets) and **Liabilities** (Credit Cards $\rightarrow$ Loans & Mortgages $\rightarrow$ Other Liabilities) sit side by side from 1280 px and stack on smaller screens.
2. Each group subheader shows the archetype icon, type title, count badge and the converted subtotal in `displayCurrency`. Intra-group order follows the sort chosen in the Filters sheet.
3. A side with no accounts is hidden while a segment tab or a filter is on (`hideEmptySides`); in the unfiltered "All" view it shows its empty state and an Add button.

### 20.8 Account Type & Segment Selector Icons in the Header Cockpit
The balance-sheet hero card (`AccountsHeroCard` in `components/new/accounts/overview.tsx`) and the segment tabs include archetype icons:
1. **Capital & Debt Allocation Selector Buttons (Hero Card):**
   - Each allocation button renders a `5x5` (`20px`) soft badge containing its semantic archetype icon:
     - **Liquid Cash:** `bank` in `bg-nv-violet-soft text-nv-violet-text`
     - **Savings & Pension:** `piggy` in `bg-nv-green-soft text-nv-green-text`
     - **Property & Physical:** `home` in `bg-nv-sky-soft text-nv-sky-text`
     - **Credit Cards:** `card` in `bg-nv-orange-soft text-nv-orange-text`
     - **Loans & Mortgages:** `invoice` in `bg-nv-red-soft text-nv-red-text`
   - Active state displays an ink ring (`ring-1.5 ring-nv-violet`) when the corresponding segment is selected.
2. **Summary Strip Metrics (Hero Card — bklit AreaSparkline KPI Cards):**
   - The triplet tiles (**Total Assets**, **Total Liabilities**, and **Liquid Cash**) are implemented as interactive bklit `AreaSparkline` KPI cards (`useSparklineHover`):
     - **Total Assets:** `wallet` icon with `text-nv-green-text`, `var(--nv-green)` 40px monotone area sparkline, gross holdings subtitle.
     - **Total Liabilities:** `invoice` icon with `text-nv-orange-text`, `var(--nv-orange)` 40px monotone area sparkline, debt obligations subtitle.
     - **Liquid Cash:** `bank` icon with `text-nv-grad-from`, `var(--nv-grad-from)` 40px monotone area sparkline, runway / 30d net flow subtitle.
   - **Hover Interaction:** Moving across the sparkline updates the date badge to the hovered day (`shown.day`) and scrubs the displayed value to that specific point in time. When not hovering, shows the current total and 30-day percentage change delta (`<Delta pct={...} good={...} />`).
3. **Segment Tabs (in the page body above the list, N21):**
   - Segment tabs display archetype icons (`wallet` for All, `card` for Cash & Cards, `piggy` for Savings & Yield, `invoice` for Loans & Debt, `home` for Property & Vehicles, `archive` for Archived).

---

## 21. Header, toolbar and filters on phones (N20 to N24, 2026-10-29)

The first New pages rearranged the same desktop controls on a phone: the header stacked a title row, a tabs row, a tools row and a controls row, which took about 350 px of an 812 px screen, and the Accounts page offered three layouts that look identical at 375 px. This section replaces N5 and N6. The parts are in `components/new/PageToolbar.tsx`.

| # | Topic | Decision | Replaces |
|---|---|---|---|
| N20 | Header | **The shell header is one row**: menu (phones), title (with its subtitle from 640 px), search, the page's one violet action (N4), notifications (640 px up) and the account menu. A page gives the header only `usePageSearch` and `usePageAction`. **There are no tab, tool or control slots** (`usePageTabs`, `HeaderTools`, `HeaderControls` are deleted). On a phone the band is about 68 px tall | N5, N6, Q7's tabs in the top bar |
| N21 | Tabs | **Segment and view tabs live in the page body, directly above what they switch**: on Accounts and Transactions under the hero and above the list; on Budget at the top of the page, because they swap the whole page. `SegmentedTabs` scrolls sideways when it does not fit | Page tabs in the header band |
| N22 | One Filters button | **Every filter and the sort live in one Filters sheet** (`FilterButton` opens `FilterSheet`; the ink counter is the number of filters on; search and sort are not counted). The footer has Reset and "Show N accounts". Inside: a long list is a multi-select `FilterList` with search (institutions, merchants, categories); a few options are `ChoiceChips`; a yes/no is a `FilterToggle` with an icon. **Filters that are on show as removable chips** under the toolbar (`ActiveFilters`, a scrolling line on a phone) with an icon each (D12) and Clear all. A control that sets the data range (Transactions' period, Budget's month) stays visible beside the button | The Sort, Currency, Institution and status pills and chips in the band |
| N23 | Tools | **Tools sit right of the Filters button in the same row** (`PageToolbar`, `ToolbarSpacer`, `ToolButton`): a labelled button from 640 px, a 44 px icon button on a phone. Sync is green (N7), also on Accounts. More than two tools collapse into a ⋯ menu (`ToolMenu`: Transactions has Select and Export). The page's violet action stays in the header and is not repeated in the body (N4), so Budget's category card lost its "Add budget" button | N6 |
| N24 | One layout, no filler | **A view switcher must change what you see on a phone, or it does not ship.** Accounts has only the split sheet; the list and bento grid are gone. The Card & account wallet is gone from every view. Rule for new pages: a section that repeats another, or a switcher whose views look alike at 375 px, is left out | §20.6, §20.7's three layouts |

### 21.1 Migration notes (Accounts, Transactions, Budget)

- **Kept:** every filter (currency, bank synced, analytics included, institution, type, amount, merchants, accounts, categories, locations, tags, status), sort, search, Sync, Export, Select, month navigation, Auto-fill, recommendations and unbudgeted chips.
- **Moved:** tabs, filters, sort and tools from the header band into the page body (above). Transactions' type chips (Expenses, Income, Transfers) moved into the sheet; Sort moved into the sheet on all three pages.
- **Changed:** Institutions is multi-select (`institutionFilter: string[]` in `filterAndSortAccounts`; empty means all). Bank synced and Analytics included are toggles with icons in the sheet and chips with icons when on. Sync banks is green. Budget's month navigation and Auto-fill show only on the budgets tab.
- **Dropped:** Accounts' list and bento layouts (`AccountCardNew`), the Card & account wallet (`CardWalletRail`, `MomentumRail`, `getCardWalletAccounts`), the two helper lines under Assets and Liabilities, Budget's in-card Add budget button.
- **Where the logic lives:** `components/new/PageToolbar.tsx` (the parts), `utils/accountsModel.ts` (`filterAndSortAccounts`), each page file (its filter state and the sheet's contents).
- **Keyboard route:** the Filters button, the toggles and the chips are buttons; the sheet traps focus and returns it to the button; the ⋯ menu opens with Enter and arrow keys.
- **Verified:** lint, unit tests, the three pages at 375 px (light and dark), 768 px and desktop width on demo data: header 68 px on a phone, one toolbar row, no sideways scroll; multi-select, toggles, chips, Clear all and Reset in the sheet.
- **Not verified:** the Select flow from the ⋯ menu on a phone; Accounts' Currency chips (demo data has one currency).

---

## 22. Migration notes: AccountsNew and AccountDetailNew (2026-10-29)

`pages/new/AccountsNew.tsx` (`/accounts-new`) and `pages/new/AccountDetailNew.tsx` (`/accounts-new/:id`); features from `pages/Accounts.tsx`, `pages/AccountDetail.tsx`, the classic account views (`components/*AccountView.tsx`), `PaymentPlanTable`, `AccountOverviewModal`, `AddAccountModal` / `EditAccountModal`, `BalanceAdjustmentModal`, `PropertyValuationModal`, `AddMileageLogModal`, `CloseAssetModal` and `EnableBankingSyncModal`. The classic pages are untouched apart from the shared numbers below. Built in phases 1–4 of `docs/ACCOUNTS_BUDGET_REVIEW_PLAN.md`; the header, toolbar and filters follow §21.

### 22.1 Decisions

| # | Topic | Decision |
|---|---|---|
| Q1 | Exchange rates | One table everywhere: the built-in defaults overridden by the saved rates (`resolveRates`) |
| Q2 | Loan balance | Outstanding principal plus interest accrued so far; the interest still to pay is shown on the loan's Overview, not in the balance. Shared with classic |
| Q3 | One net worth | `calculateAccountTotals` and the New pages use the same balance service (`resolveAccountBalance`), so classic and New show the same figures |
| Q4 | Chart curve | `curveMonotoneX` for money series (§20.4 amended) |
| Q5 | Leased vehicles | Not an asset unless `residualValue` is set, then at that value; the hero shows the payment and the months left |
| Q10 | Account page | Body tabs per kind of account (below) |

### 22.2 Notes

- **Kept (list):** every account except market holdings (on Investments); assets beside liabilities grouped by type (checking, cards, savings, meal vouchers, loans, pension and round-ups, lending, property, vehicles, other) with signed subtotals; the quick overview sheet; add, edit, reconcile, archive / reopen, delete; manual order (move up / down); sort, filters, search, Sync and CSV export (§21); the net-worth hero with 90-day chart, assets / liabilities / liquid cash and their trends; allocation; attention items.
- **Kept (account page):** balance with the 90-day history and the forward forecast; every classic archetype view (operating, card, savings, pension, round-ups, loan, lending, property, vehicle); the ledger with type filter, search and balance-adjustment toggle; recording a transaction, interest payout or card payment; valuations; mileage readings (single and batch); bank sync; sell, return or retire an asset and reopen it.
- **Moved:** the account page is a workspace of body tabs under the hero (N21): **Overview · Activity · Details** for every account, plus **Payment plan** for loans with a schedule and **Valuations** (property) or **Valuations & logs** (vehicles). The URL hash opens a tab (`#plan`, `#activity`, `#details`, `#valuations`) and the last tab is remembered per kind of account. The loan schedule, the mileage log and valuation history moved off Overview; "connected cards & goals" became Details → Connections. The hero's back pill and buttons moved: Sync, Reconcile and Edit into a toolbar under the tabs (N23), the main action into the header (N4).
- **Changed on purpose:** the header action follows the account (Add transaction; Pay statement for cards; Record payment for loans, which opens the Payment plan; Add valuation for property and owned vehicles; Log mileage for leased ones; Log interest for savings; Add contribution for pensions). The account name opens a quick switcher to any other account. Clicking a row opens the quick overview, Enter opens the page. The list's totals are figures, not links; allocation is two bars (assets, liabilities), each 100 %. Every balance excludes future-dated items; loans are principal + accrued interest; leased vehicles count only with a residual value. Pension return is money-weighted (XIRR) and there is no projection without a retirement year and an expected return. Savings interest is estimated only after the last recorded payout. Reconcile is measured against the balance on the chosen date and is not offered for scheduled loans.
- **Payment plan:** skip a payment, interest only, edit a payment (total, principal, interest), extra principal, mark paid, clear one, reset all, each with Undo; a Changed filter. Same override shape as the classic plan (`{ status: 'Deferred', deferralType }`, `{ totalPayment, principal, interest }`, `extraPrincipal`), through `applyLoanOverride`.
- **Dropped:** the list and bento layouts and the card wallet (§21 N24); the in-page "All accounts" back pill; the "Solvency %" badge; the helper lines under headings and in sheets (§10.1); the decorative trend line and dotted background on balance charts; the classic bulk edit of many payments at once (each payment is edited from its own menu; reset covers "undo everything"); the "safe to spend below zero" attention rule on the list (the account page shows safe to spend).
- **Where the logic lives:** `utils.ts` (`resolveAccountBalance`, `computeLoanBalanceBreakdown`, `classifyAccountBalanceEur`, `calculateAccountTotals`, `resolveRates`, `advanceRecurrenceDate`, `expandRecurringOccurrences`), `utils/accountsModel.ts` (list: hero, trends, allocation, attention, groups, filters and sort), `utils/accountDetailModel.ts` (account page: archetype metrics, tabs `detailTabsFor` / `resolveDetailTab`, `applyLoanOverride`, `computeXirr`, `monthlyRateFromApy`), `hooks/useAccountsData.ts` and `hooks/useAccountDetailData.ts` (contexts and writes with an `undo`). UI in `components/new/accounts/` (`overview.tsx`, `parts.tsx`, `sheets.tsx`, `AccountFormSheet.tsx`, `detailHero.tsx`, `detailTabs.tsx`, `detailShared.tsx`, `AccountCard.tsx`, `views/*`). Tests: `tests/unit/accountsModel.test.ts`, `accountDetailModel.test.ts`, `phase1Numbers.test.ts`, `phase2Logic.test.ts`, `accountDetailTabs.test.ts`, `paymentPlan.test.ts`, `leasedVehicle.test.ts`, `accountsList.test.ts`; `new-tokens.test.ts` guards the type floor, shadows, CTAs and glass in these files.
- **KokonutUI-first check:** Hold Button (delete, through `confirmNew`), Amount Pad (reconcile, valuations, entries), Smooth Tab (segment and account tabs), Card Flip (the credit card on its Overview). Momentum Rail is no longer used here (the wallet went with N24). Base UI `Menu` and `ContextMenu` for the row actions and the switcher. Bklit `AreaChart` / `Area` for balance, forecast and mileage charts. Plain components: the payment plan rows, the Details tab, the valuation history.
- **Keyboard and tap route:** a row is one button (Enter: the account page; Space or click: quick overview); its ⋯ menu and the right-click menu share one list and open with Enter and arrow keys; the switcher is a menu (arrow keys, Enter); the account tabs are a tablist (arrow keys, Home, End); payment-plan actions are in each payment's ⋯ menu; every control is 44 px or has a 44 px hit area.
- **Verified:** lint and the unit tests above; in the browser on demo data at desktop width, 768 (light) and 375 (light and dark): list hero, bars, rows (click, Enter, right-click), the switcher (mouse and keys), every tab of checking, card, savings, pension, loan (with a schedule added to the demo mortgage), property and vehicle, the payment-plan actions with Undo and reset, Details (archive with Undo, delete confirm cancelled), opening and editing a ledger transaction, the mileage chart with test readings, the per-kind header actions, no sideways scroll, no console errors.
- **Not verified:** a leased vehicle on screen (the demo car is owned: the lease rule and the allowance line are unit-tested only); "Show all" on a group (no demo group has more than 8 accounts); hold-to-delete completing (only the confirm opening was checked); 1024 px.

---

## 23. Migration notes: ScheduleNew (2026-10-29)

`pages/new/ScheduleNew.tsx` (`/schedule-new`); features from `pages/Schedule.tsx`, `MobileScheduleView`, `CalendarView`, `ScheduleHeatmap`, `ScheduledItemRow` and the recurring, override, edit-recurrence, bill and add-transaction modals. Plan: `docs/SCHEDULE_NEW_PLAN.md` (its Status table lists what differs). The classic page is untouched.

- **Kept:** every upcoming payment grouped Overdue / Today / Next 7 days / by month, with group totals; the month calendar; every recurring series, with loan installments, card settlements and property costs as read-only rows that link to their account; one-time bills (unpaid, paid, expired) with expire all old, restore, mark paid and delete; the next-30-days totals; search; add a series or a bill; edit one payment (date, amount, name), this and future, or every payment; skip and bring back; end a series; mark paid as a transaction pre-filled from the payment; delete a series or a bill; merchant logos.
- **Moved:** the overdue filter (all / recurring / one-time) into the Filters sheet ("Comes from"); the category breakdown to the Series tab as monthly cost by category; the three summary cards and the largest-in / largest-out cards into the hero.
- **Changed on purpose:** one header action, "Add schedule", with a Repeats / Once switch instead of two buttons; skip, change, end, expire and mark paid apply at once with Undo, deletes ask with the Hold Button; transfers count as money out when they go to a card, a loan or outside Crystal and as "between your accounts" otherwise (classic left every transfer out of the totals); totals are in the display currency with the saved rates; a transaction pays the occurrence it was posted for, and one transaction pays at most one occurrence; paying a later payment early no longer hides the earlier unpaid ones; a paid bill keeps its due date; recurring payments stay overdue for 31 days (classic: 7); a series that starts on the 29th but pays on the 5th first pays on the next 5th; heatmap colours dropped with the heatmap.
- **Dropped:** the per-tab hero gradients (R9); the largest-inflow card; the year heatmap (not built yet, see the plan); the mobile-only view (one responsive page).
- **Where the logic lives:** `utils/scheduleModel.ts` (occurrences, matching, `nextDueAfterPaying`, summary, groups, committed cash per day, series groups, monthly equivalents, month grid, bills, filters, series drafts; `tests/unit/scheduleModel.test.ts`, 21 cases) and `hooks/useScheduleData.ts` (contexts, display currency, writes that return an `undo`). New optional fields: `Transaction.recurringOccurrenceDate`, `BillPayment.paidDate` (the server schemas pass them through). UI in `components/new/schedule/` (`overview.tsx`, `parts.tsx`, `calendar.tsx`, `lists.tsx`, `sheets.tsx`).
- **KokonutUI-first check:** Hold Button (deletes, through `confirmNew`), Smooth Tab (the tabs). Bklit `ComposedChart` + `SeriesBar` + `Line` for the committed-cash chart (out and in per day, net so far; `SeriesBar` patched to grow from the zero line, marked "Crystal patch"); Budget's `AllocationRing` (Bklit `PieChart`) for fixed costs. Plain components: the payment rows, the month grid, the sheets' forms (no KokonutUI part covers them). Magic UI: none needed.
- **Keyboard and tap route:** tabs are a tablist; a row is a button (Enter: the payment sheet) with its ⋯ menu beside it (Enter, arrow keys); the calendar is a grid (arrows move a day, PageUp / PageDown a month, Home / End the week); sheets trap focus and return it.
- **Verified:** lint (including the strict config), unit tests (`scheduleModel`, `new-tokens`, `new-isolation`, `transactionsModel`, `newRoutes`); in the browser on demo data in a separate origin (no real data on screen) at desktop width in dark and light and at 375 px: hero and chart, skip and Undo, mark paid and Undo, change one payment and Undo, expire old bills and Undo, add a series (European amount "35,50", first payment on the 5th), delete a series with Hold and the app's Undo toast, calendar keyboard moves, Series and Bills tabs; no sideways scroll and no text under 11 px on the phone.
- **Not verified:** "This and future" and "End series" in the browser (both are unit-tested); a USD series on screen (demo data is all EUR); loan installments and card settlements on screen (the demo has none configured); 768 and 1024 px; the page with the restored real data.
