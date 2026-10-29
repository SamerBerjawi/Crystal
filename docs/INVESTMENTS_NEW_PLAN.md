# InvestmentsNew plan (`/investments-new`, `/investments-new/:symbol`, Warrants tab)

Written 2026-10-29. Planning only. Shared rules and the library inventory are in [NEW_PAGES_PLAN_INDEX.md](NEW_PAGES_PLAN_INDEX.md). Decision Q10 merged Warrants into this page as a tab; `utils/newRoutes.ts` already sends the classic Warrants page there.

| | |
|---|---|
| Target files | `pages/new/InvestmentsNew.tsx` (`export const InvestmentsNew`, same props as `Investments`: `accounts`, `cashAccounts`, `investmentTransactions`, `saveInvestmentTransaction`, `saveAccount`, `deleteInvestmentTransaction`, `saveTransaction`, `warrants`, `saveWarrant`, `deleteWarrant`, `manualPrices`, `onManualPriceChange`, `prices`, `onOpenHoldingDetail`, `onToggleAccountStatus`, `deleteAccount`, `transactions`, `onViewAccount`, `holdingsOverview`, `priceHistory`) and `pages/new/HoldingNew.tsx` (same props as `HoldingDetail`) |
| Routes | `/investments-new` and `/investments-new/:symbol` (`HoldingDetail` takes an id segment in `newRoutes.ts`) |
| Classic sources | `pages/Investments.tsx`, `pages/HoldingDetail.tsx`, `pages/Warrants.tsx`, `components/MobileInvestmentsView.tsx`, `AddInvestmentTransactionModal.tsx` / `InvestmentModal.tsx` (trade with optional cash leg), `WarrantModal.tsx`, `WarrantPriceModal.tsx`, `InvestmentCandlestickChart.tsx`, `PriceHistoryChart.tsx`, `PortfolioDistributionChart.tsx`, `AccountsListSection.tsx`, `AccountOverviewModal.tsx`, `BalanceAdjustmentModal.tsx`, `EditAccountModal.tsx`, `utils/investments.ts`, `utils/portfolioHistory.ts`, `src/services/twelveDataService.ts`, `/api/smart-fetch` |
| Logic | `utils/investmentsModel.ts` (new, replaces the page's inline maths; `utils/investments.ts` keeps its exports as wrappers for classic), `hooks/useInvestmentsData.ts`, `hooks/useHoldingData.ts`, `hooks/usePriceUpdater.ts` |
| Purpose in one line | What your market holdings are worth, what they cost, how they did, and keeping their prices current. |

---

## 1. Feature inventory and decisions

### 1.1 Investments page

| # | Classic feature | Where | Decision |
|---|---|---|---|
| F1 | Segments All / Stock / ETF / Crypto / Warrant / Spare Change / Pension Fund / Other with a value per segment | `Investments.tsx:60, 99, 220-290, 807` | **Change**: type becomes a filter (as Transactions T2) and the allocation ring's segments filter too; Warrants is its own tab (Q10); Pension Fund and Spare Change are shown on Accounts since Phase 4 (§22), so here they appear only as a linked line (Q-I1) |
| F2 | Hero: current valuation, cost basis, gain | `:290-300`, render `:1000-1100` | **Keep**, with converted values (I-02) and gain excluding unpriced holdings |
| F3 | Trend sparkline of the portfolio | `trendData`, Recharts `AreaChart` | **Change**: a real portfolio-value chart with invested capital (C1) |
| F4 | Candlestick of the selected segment | `InvestmentCandlestickChart` | **Moved** to the holding page (a candle of a mixed basket has no meaning); the portfolio uses C1 |
| F5 | Holdings table grouped by type: instrument, last price, quantity, cost, market value, gain, actions (log price, trade, details); unavailable price flag | `:651-730, 1130-1330` | **Keep**, plus weight and a 30-day sparkline; cards below `lg` |
| F6 | Show inactive (sold) holdings toggle | `:149, 1096-1105` | **Keep** in Filters ("Sold positions") |
| F7 | Update all prices (Twelve Data, or a custom web binding through `/api/smart-fetch`), toast with failures | `:536-650` | **Keep** as the green "Update prices" tool (N7, N23) with progress, a rate-limited queue and a per-holding result (I-06) |
| F8 | Account menu (right-click): edit, adjust balance, overview, close / reopen, delete | `:494-530, 1225-1250` | **Keep** in each holding's ⋯ menu; the overview modal is replaced by the holding page; delete uses Hold |
| F9 | Closed portfolios section | `:1520-1545` | **Keep** as a Filters toggle "Closed accounts" (N24: no separate section repeating the list) |
| F10 | Recent activity | `recentActivity :379-404` | **Moved** to the *Activity* tab |
| F11 | Realized performance: total, wins / losses, biggest win and loss | `:405-493, 1433-1515` | **Keep** in the *Performance* tab |
| F12 | Exposure breakdown pie | `:1380-1430` (Bklit `PieChart`) | **Keep** as the allocation ring (C2) |
| F13 | Add trade (buy / sell), optional cash transaction from a cash account | `AddInvestmentTransactionModal`, `InvestmentModal.tsx:36-110` | **Keep** as `TradeSheet` with the cash leg |
| F14 | Adjust balance of an investment account without a symbol | `handleSaveAdjustment :336-353` | **Keep** in that account's menu (Reconcile, as Accounts) |
| F15 | Migrate local price bindings to preferences | `:110-140` | **Keep** as a one-time effect in `usePriceUpdater` (logic only) |
| F16 | Mobile layout | `MobileInvestmentsView.tsx` | **Replaced** by the responsive page |
| F17 | `CACHE_KEYS.INVESTMENT_INSIGHTS` | `:33-35` | **Dropped** (declared, not read) |

### 1.2 Holding page

| # | Classic feature | Where | Decision |
|---|---|---|---|
| H1 | Current value, cost, price per unit, last logged price | `HoldingDetail.tsx:265-340` | **Keep** in the hero |
| H2 | Candlestick from price history | `:360-370` | **Keep** as one mode of C6 |
| H3 | Price history chart and table, edit / delete entries | `:108-190, 397-520` | **Keep** in the *Prices* tab, Undo on delete |
| H4 | Activity: buys, sells and warrant grants, edit / delete | `:71-107` | **Keep** in the *Trades* tab |
| H5 | Log a price (`WarrantPriceModal`), trade, edit grant | modals `:195-225` | **Keep** as sheets |
| H6 | Back to the portfolio | `:228` | **Dropped** in the body (the shell header has back, as Accounts D3) |

### 1.3 Warrants (now a tab)

| # | Classic feature | Where | Decision |
|---|---|---|---|
| W1 | Portfolio value, total gain / loss, holdings count | `Warrants.tsx:131-160` | **Keep** in the tab's summary |
| W2 | Distribution chart | `PortfolioDistributionChart` | **Keep** only with two or more ISINs (N24) |
| W3 | Holdings by ISIN with "Set a price" | `:170-210` | **Keep** |
| W4 | Grant history table | `:213-225` | **Keep** |
| W5 | Grant tax (`taxType`, `taxValue`, `taxAmount`, `taxPayments` → bills with `warrantId`) | `types.ts:823-834`, `WarrantModal` | **Keep**, and show the tax bills' status with a link to Schedule (Schedule plan N4) |

### 1.4 New

| # | Feature | Why |
|---|---|---|
| N1 | Money-weighted return (XIRR) per holding and for the portfolio | `computeXirr` already exists (`utils/accountDetailModel.ts:881`); gain % ignores *when* money went in |
| N2 | Price status per holding: source (Live, Web, Manual, Last trade, Cost) and age ("3 days old") | `priceUnavailable` exists but only says yes/no |
| N3 | Weight in the portfolio and a 30-day sparkline per holding | Data exists (`priceHistory`) |
| N4 | Holdings CSV export | Every other New list page exports |

---

## 2. Logic audit

| # | Sev | Where | Finding | Fix | Found by |
|---|---|---|---|---|---|
| I-01 | **P0** | `utils/investments.ts:46-75`, used by `Investments.tsx:162-290` | `buildHoldingsOverview(accounts, transactions, …)` adds a holding for **every symbol in the transactions**, whatever accounts it was given. So each segment's overview holds every traded position, the segment list shows other segments' holdings (AAPL under ETF), and `segmentValues.all`, the sum of the seven segments, counts each position once per segment, up to **7×** (an empty Crypto segment still contains every position). Reproduced: two accounts (AAPL stock, VWCE ETF) → stock segment 2,600, ETF segment 2,600, real total 2,600, sum of segments 5,200. | Holdings belong to the account whose `symbol` they carry; a segment takes only its accounts' symbols; traded symbols without an account go to "Unassigned" (one place, counted once). Test with the reproduction. | **run** |
| I-02 | **P0** | `utils/investments.ts:93-100`, `utils/portfolioHistory.ts:70-90`, `Investments.tsx:204-218` | Holding values are `quantity × price` in the instrument's currency and are **added across currencies** without conversion; only accounts without a symbol are converted (`nonSymbolDataByType`). A USD stock and a EUR ETF are summed as if the same currency. | Each holding has a currency (its account's `currency`; trades inherit it, Q-I2); values converted with `resolveRates` into the display currency; native shown on the row. | read |
| I-03 | P1 | `Investments.tsx:425` vs `utils/investments.ts:48` | Realized gains upper-case the symbol; holdings don't. "aapl" and "AAPL" are one position for gains and two for holdings. | Normalise symbols once (upper-case, trimmed) in the model, and on save. | read |
| I-04 | P1 | `types.ts:329-337` | Trades have no fees, no currency and no account, so cost basis, gains and the cash leg can't include fees, and a symbol held in two accounts is merged. | Optional `fees`, `currency` and `accountId` on `InvestmentTransaction` (`investmentTransactions` is `z.array(z.any())`, so no server change); old trades default to the symbol's account (Q-I2). | read |
| I-05 | P1 | `utils/investments.ts:14-25, 93-102` | An account with a `symbol` and a balance but no trades starts at `currentValue: acc.balance`, is then overwritten with `0 × price` and filtered out, so it **vanishes** from the page and its total. | A symbol account without trades is valued at its balance (flagged "No trades recorded"), never dropped. | read |
| I-06 | P1 | `Investments.tsx:613` | "Update prices" fires every displayed holding at once (`Promise.allSettled`). Twelve Data's free plan allows a few requests a minute (8 at the time of writing; check your plan), so most requests fail; with "Show inactive" on, sold positions are fetched too, and manual-only holdings are fetched from Twelve Data anyway. | Queue with a configurable per-minute limit; only open positions; skip holdings whose source is Manual; per-holding status in the progress view. | read |
| I-07 | P1 | `utils/investments.ts:40-45` | Warrant cost = `quantity × grantPrice`; tax paid on the grant (`taxAmount` / `taxPayments`) is not in the cost, so the gain on a taxed grant is overstated. | Cost = grant value + tax paid (Q-I3). | read |
| I-08 | P1 | `HoldingDetail.tsx:80, 96` | Trade and grant prices formatted as `'EUR'` whatever the instrument's currency. | Holding currency (I-02). | read |
| I-09 | P1 | `Investments.tsx:220-290` | `buildHoldingsOverview` runs 14 times for the segment values and cost bases, plus 3 more, on every render with new prices. | One pass producing per-holding rows; segments are sums over rows. | read |
| I-10 | P2 | `utils/investments.ts:60-75` | Selling more than you hold clamps to 0 silently; the extra sale gains nothing and loses nothing. | `TradeSheet` warns ("You hold 8"); the model keeps the clamp but flags the trade. | read |
| I-11 | P2 | `utils/investments.ts:126, 148` | Hex colours for holdings and types. | Type colours from chart tokens; holdings by rank. | read |
| I-12 | P2 | `utils/portfolioHistory.ts:43-60` | Points only on dates when something happened (a trade or a logged price), so a month without events is one straight segment. | Fine for a time scale; label the chart "from your logged prices" and draw points as markers so the gaps read as gaps. | read |

Tests (`tests/unit/investmentsModel.test.ts`; the existing `investments.test.ts` and `portfolioHistory.test.ts` keep passing through the wrappers): the I-01 reproduction; USD + EUR holdings in a EUR display (I-02); "aapl" + "AAPL" one position (I-03); fees raise cost basis (I-04); symbol account with balance and no trades stays (I-05); queue respects the per-minute limit and skips manual (I-06, pure scheduler function); warrant cost includes tax (I-07); XIRR of buy 1,000 then value 1,100 a year later ≈ 10 % (N1); weights sum to 100 %.

---

## 3. Investments page layout

### 3.1 Header (N20)

- Title "Investments".
- `usePageSearch({ placeholder: 'Search holdings' })`: symbol, name, ISIN, account.
- `usePageAction`: *Holdings*, *Performance*, *Activity* → "Add trade"; *Warrants* → "Add grant".

### 3.2 Desktop

```
┌ Hero (split tile) ─────────────────────────────────────────────────────────────────┐
│ top (white): PORTFOLIO VALUE  €48,210.55                    [ 1M 3M YTD 1Y All ]   │
│   +€6,140 (+14.6 %) unrealized · €42,070 invested · 12 holdings · prices 2 h old    │
│   C1: value area (violet slot) + invested capital step line (ink, dashed)           │
│ bottom (grey): Unrealized +€6,140 │ Realized +€820 (all time) │ Return 9.8 %/yr (XIRR) │ ⚠ 2 without a price │
└─────────────────────────────────────────────────────────────────────────────────────┘
[ Holdings · Performance · Activity · Warrants ]                    (SegmentedTabs, N21)
[ Filters (1) ]  × ETF                             [ Update prices ] [ ⋯ Export ]  (N23)
┌ Allocation (4 cols) ────────┐ ┌ Holdings (8 cols) ───────────────────────────────────┐
│ C2 ring by type, centre     │ │ ETF · 3 · €30,100                                    │
│ total; legend: ETF 62 % …   │ │  VWCE  Vanguard FTSE All-World   72 × €118.20 · Live │
│ Top holdings (bars, top 8)  │ │        €8,510  +€1,210 (+16.6 %)  17.6 %  ╱╲╱ ⋯      │
│ Also invested: Pension €x → │ │ STOCK · 5 · €14,900  …                (cap 8, Show all)│
└─────────────────────────────┘ └──────────────────────────────────────────────────────┘
```

### 3.3 Phone

```
Hero: figure, meta (wraps), C1 160 px, range pill under it, grey part 2×2
Tabs · [Filters] [Update prices icon] [⋯]
Holdings as cards: logo/ticker, name, value + gain right, second line qty × price · source; ⋯
Allocation ring below the list (collapsed "Allocation" tile)
```

---

## 4. Tabs

### 4.1 Holdings

- **Allocation tile:** C2 by type (Stock, ETF, Crypto, Other, Warrants, Unassigned); legend rows are buttons that set the type filter (chip). "Top holdings": horizontal bars of the 8 largest weights. "Also invested" (Q-I1): pension and round-up pots with their values and links to `/accounts-new/:id`; not in the hero total unless Q-I1 says so.
- **Holdings list:** groups by type with count and subtotal (classic `holdingsByType`). Row: `LogoTile` (Brandfetch by the account's `website` if set, else a ticker chip), symbol + name, account; quantity × last price, price source badge with icon and age (N2; orange "Stale" after 7 days, red "No price" when valued at cost); value (display currency, native under it when different); gain abs and % (green / red text); weight; 30-day `LineSparkline` (from `priceHistory`); ⋯.
- **Menu:** Trade, Log price, Price source…, Open holding, Edit account, Reconcile (symbol-less accounts, F14), Close / reopen account (Undo), Delete account (Hold).
- **Sort** (Filters sheet): value (default), gain, gain %, weight, name, price age.
- Caps: 8 per group, "Show all N".
- Row click / Enter → `/investments-new/:symbol`.

### 4.2 Performance

- **Return summary:** portfolio XIRR (N1), total unrealized, total realized, best and worst holding (by XIRR, then by %).
- **C4 Realized gains by month:** bars, green above / red below zero, last 12 months; wins / losses count; biggest win and loss (F11).
- **C5 Gain by holding:** horizontal diverging bars (unrealized), sorted; click → holding page.
- **Sold positions:** list of closed positions with realized gain and holding period.

### 4.3 Activity

- Trades and grants grouped by month: Buy / Sell / Grant badge (icons), symbol, quantity × price, total, fees (I-04), cash account of the cash leg when there is one; click → `TradeSheet` in edit mode.
- Delete one: applies with Undo (as Transactions); delete several: select mode + Hold.
- Filters: type (Buy, Sell, Grant), holdings, accounts, date range.

### 4.4 Warrants

- **Summary:** value, gain / loss (after tax, I-07), number of grants, tax still to pay (from bills with `warrantId`, link to Schedule's Bills tab).
- **By ISIN:** rows with quantity, grant price range, current price (manual price, "Set a price" when none), value, gain; menu: Log price, Add grant, Open.
- **Grants:** table (cards on phones): grant date, ISIN / name, quantity, grant price, tax (type, value, amount), tax payments status, ⋯ (Edit grant, Delete grant with Hold since the tax bills go with it — the confirm says so).
- **C7** (only with ≥ 2 grants): value by grant year, bars.

---

## 5. Holding page (`/investments-new/:symbol`)

### 5.1 Layout

```
Hero (split tile): logo + symbol + name + type badge + account
  top: VALUE €8,510.40   72 units × €118.20 (Live · 2 h ago)
       +€1,210 (+16.6 %) · avg cost €101.40 · return 11.2 %/yr
       C6 [ Line | Candles ]  [ 1M 3M 1Y All ]
  bottom: Quantity │ Avg cost │ Invested │ Realized
[ Overview · Trades · Prices · Price source ]          (N21)
```

- **Header action:** "Trade" (opens `TradeSheet` for this symbol). Tools row (N23): green "Update price", "Log price".
- **Overview:** position facts (first buy, holding period, XIRR, weight in portfolio), linked account, and for warrants the grant list and tax.
- **Trades:** this symbol's buys, sells, grants (H4), with running quantity and average cost after each.
- **Prices:** price history table (date, price, change vs previous, source), add / edit / delete (Undo); bulk paste "YYYY-MM-DD, price" lines like the mileage import in Accounts (preview before saving).
- **Price source:** Twelve Data (ticker override, `investmentPriceConfigs[symbol].ticker`), Web (URL, CSS selector, optional cookies; "Test" fetches once through `/api/smart-fetch` and shows the parsed price), Manual. Last fetched price and time. Saved in preferences (`investmentPriceConfigs`, `smartPriceBindings`) as today.

### 5.2 Chart C6

- **Line** (default): `AreaChart` of logged prices (`curveMonotoneX`), avg-cost reference line (ink, dashed), trade markers (buy ▲ green, sell ▼ orange, grant ◆ violet slot) using Bklit markers; tooltip: date, price, and the trade on that date.
- **Candles:** `CandlestickChart` with weekly candles built from logged prices (open = first, close = last, high/low = extremes of the week), shown only when there are at least 8 weeks with two or more prices (N24: otherwise the two modes look alike); optional Bollinger overlay (`bollinger.ts`) is **not planned** (Q-I5).

---

## 6. Sheets

| Sheet | Contents | Safety |
|---|---|---|
| `TradeSheet` | Buy / Sell tabs; holding picker (or new symbol + name + type + account); quantity, price (`AmountPad`), fees (new), date; "Record cash movement" switch (on by default for new trades) with cash account picker (grouped, bank logos) and the computed amount ("€2,404.40 from Main checking"); warning when selling more than held (I-10). Save `cta` "Save trade". | Undo on save; the cash leg is undone with it |
| `PriceSheet` | Price, date, source note; for warrants by ISIN (`manualWarrantPrices` via `onManualPriceChange`) | Undo |
| `GrantSheet` | Replaces `WarrantModal`: ISIN, name, grant date, quantity, grant price, tax (amount or percentage, value), tax payment terms (creates / updates bills with `warrantId`) | Undo; delete with Hold |
| `PriceUpdateSheet` (or KokonutUI `status-island`) | Progress of "Update prices": queue position, done / failed per holding, retry failed | — |
| Account sheets | Edit, Reconcile, Close, Delete: reuse `components/new/accounts/AccountFormSheet.tsx` and `sheets.tsx` (New → New import is allowed) | as Accounts |

---

## 7. Charts summary

| # | Chart | Bklit parts | Data (model function) |
|---|---|---|---|
| C1 | Portfolio value vs invested capital | `ComposedChart` (or `AreaChart` + `Line`), `XAxis`, `YAxis`, `ChartTooltip`, `DateTicker` | `portfolioSeries(rows, trades, priceHistory, range)` → `{ date, value, invested }` in the display currency |
| C2 | Allocation by type | `RingChart` + `RingCenter`, `Legend` | `allocation(rows)` |
| C3 | Row sparkline | `LineSparkline` | `priceSparkline(symbol, 30)` |
| C4 | Realized gains by month | `BarChart` (diverging) | `realizedByMonth(trades)` |
| C5 | Unrealized gain by holding | `BarChart` horizontal, diverging | `gainByHolding(rows)` |
| C6 | Holding price | `AreaChart` / `CandlestickChart`, markers, reference line | `holdingPriceSeries(symbol)`, `weeklyCandles(symbol)` |
| C7 | Warrant value by grant year | `BarChart` | `grantsByYear(warrants, prices)` |

Encoding: balances / value in the violet slot; invested capital ink dashed; gains green, losses red (status: a loss is a "down" state, as Ref D's red arrow); type colours from `--chart-1…5`. Money series `curveMonotoneX`. Range pill (1M, 3M, YTD, 1Y, All) sets the x-domain; default 1Y.

Considered and **not planned**: Magic UI `marquee` ticker (repeats the holdings list, N24); KokonutUI `metric-card` for C1 (its breakdown by segment would fit, but it draws one series and C1 needs value and invested together; reconsider if you prefer the scrub, Q-I4); radar and scatter (no question they answer here).

---

## 8. Components and files

| Need | Choice | Status |
|---|---|---|
| Tabs, toolbar, filters | `SegmentedTabs`, `PageToolbar`, `FilterSheet`, `ChoiceChips`, `FilterList`, `FilterToggle`, `ActiveFilters`, `ToolButton` (green Update prices), `ToolMenu` (Export) | exists |
| Hero | `Card` with `top`, `Money`, `PeriodPill` for the range | exists |
| Logos | `LogoTile` / `AccountLogo` | exists |
| Amount entry | KokonutUI `amount-pad` | exists |
| Delete | `confirmNew` + `hold-button` | exists |
| Price update progress | KokonutUI `status-island` (port) or a sheet | to port (optional) |
| Charts | Bklit as §7 | exists |
| Mango UI | Pending X-Q1 | — |

| File | Contents |
|---|---|
| `utils/investmentsModel.ts` | `buildHoldingRows` (I-01, I-02, I-03, I-05, I-07, I-09), `portfolioTotals`, `allocation`, `portfolioSeries`, `investedSeries`, `realizedSales`, `realizedByMonth`, `gainByHolding`, `holdingXirr`, `portfolioXirr`, `priceStatus`, `weeklyCandles`, `holdingsCsv`, `planPriceQueue` (I-06, pure) |
| `utils/investments.ts` | `buildHoldingsOverview` becomes a wrapper over `buildHoldingRows` so classic gets I-01…I-05 too (Q-I6) |
| `hooks/useInvestmentsData.ts` | Props + preferences → model; writes with `undo`: `saveTrade` (with cash leg), `deleteTrade`, `saveGrant`, `deleteGrant`, `logPrice`, `deletePrice`, `setPriceSource` |
| `hooks/usePriceUpdater.ts` | Queue, rate limit, Twelve Data and `/api/smart-fetch` calls, progress state, F15 migration |
| `hooks/useHoldingData.ts` | One symbol: row, trades, prices, candles |
| `components/new/investments/overview.tsx` | Hero + C1 |
| `components/new/investments/holdings.tsx` | Allocation tile, holdings list |
| `components/new/investments/performance.tsx`, `activity.tsx`, `warrants.tsx` | Tabs |
| `components/new/investments/sheets.tsx` | `TradeSheet`, `PriceSheet`, `GrantSheet`, `PriceUpdateSheet` |
| `components/new/investments/holding.tsx` | Holding page parts |
| `pages/new/InvestmentsNew.tsx`, `pages/new/HoldingNew.tsx` | Pages |
| Tests | `tests/unit/investmentsModel.test.ts`; existing `investments.test.ts`, `portfolioHistory.test.ts`; `new-tokens.test.ts` |

---

## 9. States, accessibility, motion

- **Loading:** skeletons; prices loading show the last known value with a muted "Updating…" badge, never a jump to 0.
- **No holdings:** `EmptyState` "No investments yet" with ink "Add trade".
- **No Twelve Data key:** "Update prices" opens a short sheet pointing to Settings → Integrations (link to the classic page until SettingsNew exists); web and manual sources still work.
- **Privacy mode:** `Money` everywhere; quantities stay visible (they are not amounts; Q-I7).
- **Multi-currency:** native price on the row, converted value as the main figure (§5.4 "=$46.32 USD" pattern).
- **Reduced motion:** chart reveal off; progress without animation.
- **Keyboard route:** tablist; rows are links (Enter opens the holding), ⋯ menu with arrows; chart scrub with arrows; Prices table rows editable through their menu.

---

## 10. Phases

| Phase | Scope | Done when |
|---|---|---|
| I1 | `investmentsModel.ts` with I-01…I-09 and tests; `buildHoldingsOverview` wrapper | I-01 reproduction passes; classic page totals change only where a bug is fixed (record the before / after on demo data) |
| I2 | Holdings tab: hero + C1, allocation, list, filters, export | Hero total = Σ rows = Σ allocation segments |
| I3 | Trade, price, grant sheets with Undo; price updater with queue and progress | Each write round-trips; a 20-holding update respects the limit |
| I4 | Performance, Activity, Warrants tabs | F10, F11, W1–W5 reachable |
| I5 | Holding page (C6, tabs, price source with Test) | H1–H5 reachable |
| I6 | Docs: migration notes for Investments, Holding and the merged Warrants page | Notes complete |

---

## 11. Open questions

| # | Question | Recommendation |
|---|---|---|
| Q-I1 | Pension Fund and Spare Change accounts: show them on Investments (as classic), or only on Accounts (as the New Accounts page does) with a linked line here? | Only on Accounts; an "Also invested" line here with links, outside the portfolio total. |
| Q-I2 | Add optional `accountId`, `currency` and `fees` to `InvestmentTransaction`? | Yes; old trades default to the symbol's account and its currency. |
| Q-I3 | Warrant cost basis: grant value only, or grant value + tax paid? | Grant value + tax paid (that is what the grant cost you); show both on the warrant row. |
| Q-I4 | Hero chart: Bklit composed (value + invested) or KokonutUI `metric-card` (scrub + breakdown by type)? | Bklit composed. |
| Q-I5 | Bollinger bands on the holding's candles? | No (needs dense daily prices you rarely have). |
| Q-I6 | Ship I-01…I-05 to the classic page too? | Yes, as with Accounts Q3: one set of numbers. |
| Q-I7 | Blur quantities in privacy mode? | No; only amounts blur. |
