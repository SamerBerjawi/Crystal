# 12 — Account pages redesign (draft for review)

Status: **built 2026-11-06** (`D-143` to `D-148`). Still to do: a map on the property page (needs coordinates), and a candlestick for single-coin crypto accounts (needs OHLC prices). Once they're answered, the decisions go into `DECISION_REGISTER.md`.

## What changes, and which decisions it revises

| Today | Proposed | Revises |
|---|---|---|
| Tabs: Cards (default), Accounts, Loans, Assets. No All | Tabs: **All** (default), Cash, Cards, Loans, Assets | `D-081` (it removed All) |
| Every account type shares one frame: hero, one chart, tabs (`AccountPanels.tsx`) | Each type has its **own layout** built from shared blocks. Only the header and the Activity/Details tabs are shared | `D-038` |
| Links between accounts are scattered: a "Linked" panel on some types, a note on pots | Every page has a **Connections strip** under the header, and the type layouts put linked accounts inside the panels where they matter (the card's pay-from account next to the due date, and so on) | New |
| Account charts mix recharts (`AccountFrame`, `AccountPanels`, pension) and bklit | **bklit only** (`src/components/charts`). recharts leaves the account pages | New |
| Cards wallet strip | **Kept as is.** It is the one part the owner likes | — |

Unchanged: the type colours of `D-080`, URL tabs (`D-079`), the account form (`D-023`), and the copy buttons of `D-117`.

## References and what we take from each

- **Pursa / Penvo** (Code and Chill): a cash runway that draws the past month and the coming 30 days, with every bill and payday pinned on the line and the lowest point ahead marked. → Checking.
- **Ardena** (Code and Chill): value, equity, LTV and yield for a home; a loan repayment chart with an overpayment planner; costs and rent. → Property and Loan.
- **Brindo / Kinby / Zesto**: cards as physical objects you fan through. → Already in Crystal's wallet strip; we reuse it as a switcher.
- **Saffra**: a "money river" following money from income through accounts. → The All tab's Money map (bklit Sankey).
- **Dribbble "finance dashboard"** shots: a bento grid with one large hero figure, a row of 3–4 small KPI tiles with sparklines, a gauge for utilisation or score, and donut breakdowns. → The KPI row and gauges on every page. We keep Crystal's warm light look rather than their dark neon.

## Shared building blocks

Every detail page is: **Header → Connections strip → type layout (bento) → tabs**.

1. **Header.** Type-coloured hero (`D-080`): name, institution logo, type and sub-type, balance or value, change over 30 days, sync status and last sync, and actions (Add transaction, Adjust balance or Update value, Edit, a menu). Prev/next arrows step through accounts of the same type.
2. **KPI row.** 3–4 tiles, each a label, an `Amount`, and an optional `Sparkline` or delta.
3. **Connections strip.** Chips for every linked record, each opening its page: account ↔ account, account ↔ goal, account ↔ recurring payment. Each chip shows the other side's live figure, such as "Pays from Main checking · €2,140". It is built from the links already stored:

| Link | Stored on | Shown on both sides |
|---|---|---|
| Credit card → pay-from account | `settlementAccountId` | Card: "Pays from X". Checking: "Settles N cards" |
| Loan → payment account | `linkedAccountId` | Loan: "Paid from X". Checking: "Pays N loans" |
| Loan ↔ property or vehicle | `linkedAssetId` / `linkedLoanId` | Loan: "Secures X". Asset: "Mortgage / Car loan Y" |
| Leased vehicle → payment account | `leasePaymentAccountId` | Both |
| Spare change → source account | `linkedAccountId` | Both |
| Goal → from / into account | `paymentAccountId` / `destinationAccountId` | Account: "Funds goal X" / "Holds goal X" |
| Sold asset → account paid into | `closureDetails.incomeAccountId` | Both |
| Recurring payments and bills | `accountId` | Account's Upcoming panel |
| Frequent transfers (derived) | transactions | "Money usually goes to X" |

4. **Tabs below the layout.** *Overview* (the type layout), *Activity* (the transaction ledger, filtered), *Schedule* (where the type has one: loan payments, statements, lease), *Details* (every stored field, with copy buttons), and the type's extra tabs (Valuations, Mileage).
5. **Closed accounts** keep their layout read-only with a closure banner (date, type, value, the account paid into as a link).
6. **Phones.** One column. Header, KPI row as a 2×2 grid, then panels in the order listed below. The tabs become a segmented control.

### bklit charts used

`LineChart` + `ProjectionLine` + reference areas and markers (runways, value history, amortisation), `BarChart` stacked (in/out, interest, statements), `PieChart` (categories), `RingChart` (progress, goals), `Gauge` (utilisation, LTV), `Sankey` (money map), `Sparkline` (KPI tiles, list rows). No new chart primitive is needed.

## The Accounts hub

### All (new default tab)
- **Wallet strip** at the very top (same component as the Cards tab), then the rest.
- **Hero:** net worth of all accounts, assets vs liabilities as one split bar, change over 30 days and 1 year.
- **Net worth over time:** `LineChart` with assets and liabilities lines and the net line, range 3M / 1Y / All.
- **Composition:** `PieChart` by type group (Cash, Investments, Property, Vehicles, Other assets, Cards, Loans, Other debts). Click a slice to jump to that tab.
- **Money map:** `Sankey` of the last 90 days: income → cash accounts → cards, loans, savings and investments → spending. It shows how the accounts feed each other.
- **Needs attention:** today's list, all tabs (a card due soon with too little in its pay-from account, a lease over its mileage pace, a fixed term maturing, a stale valuation, a sync needing renewal).
- **Groups by type**, each with a subtotal: rows show logo, name, institution, a 30-day sparkline, balance, and link badges ("→ Main checking", "Secures Apartment"). Investments appear as one group whose rows open the Investments hub.
- **Closed**, collapsed.

### Cash, Cards, Loans, Assets
- **Cash:** today's pots and the split bar, plus a combined 30-day runway across cash accounts.
- **Cards:** the wallet strip at the top (kept). Below it, a total owed / total limit / utilisation gauge, and the next due dates in order, each with its pay-from account's balance.
- **Loans:** total still to pay, a payoff timeline (one bar per loan from today to its end date), and monthly debt service as a share of income.
- **Assets:** total value and equity, a value-over-time line per asset, and the assets as cards with their linked loan.

## Layouts per account type

### Checking
- **KPIs:** Balance · Safe to spend (`D-076`, primary account only) · In this month · Out this month.
- **Cash runway** (hero chart): `LineChart` of the last 30 days and a `ProjectionLine` for the next 30. Every scheduled item from this account is a marker (recurring payments, bills, card settlements, loan instalments, lease payments, goal contributions). The lowest point ahead is marked, and a reference area shades below your cushion.
- **In and out:** stacked `BarChart`, 12 months.
- **Where it went:** `PieChart` of categories this month; click a slice to see its transactions.
- **Top merchants** this month, with logos.
- **Upcoming:** a 30-day list of everything leaving or arriving, each linked to its source (card, loan, goal).
- **Cards on this account:** the debit card face, and every credit card that settles here with its next statement amount and due date.
- **Connections strip** as above.
- **Details:** IBAN and BIC with copy, opened, institution site, bank connection.

### Savings
- **KPIs:** Balance · APY · Interest this year · Saved this year (net deposits).
- **Growth:** stacked `BarChart` by month: deposits, withdrawals, interest.
- **Balance and projection:** `LineChart` of 24 months plus a `ProjectionLine` for 12 months at the APY and the average monthly deposit.
- **Goals held here:** `RingChart`, one ring per goal (`destinationAccountId`), each linking to the goal.
- **Where deposits come from:** the source accounts, with amounts over 12 months.
- **Fixed term** (if `maturityDate`): a countdown to maturity, rollover status, and the ladder (`FixedTermLadderWidget`) when there are several terms.
- **Withdrawal watch:** how often money left in the last 6 months, against the goal plan.

### Credit card
- **Header:** the card face from the wallet strip, large, with the strip of other cards as a switcher.
- **KPIs:** Owed now · Available credit · Utilisation (`Gauge`, warning above 30%) · Next due (date and days left).
- **This statement:** the cycle dates, statement balance, minimum payment, due date, and the **pay-from account** with its projected balance on the due date and a clear "enough" or "short by €X".
- **Cycle pace:** `LineChart` of cumulative spending this cycle against the last cycle and the average of three cycles.
- **Categories this cycle:** `PieChart`.
- **Statements:** a 12-month stacked `BarChart` of spending with payments overlaid, and a table of past statements (balance, paid, paid on time or late).
- **Recurring charges on this card:** subscriptions and memberships billed here, with their monthly total.
- **Cost of the card:** annual fee and next date, APR, and interest paid this year.
- **Details:** network, last four, expiry, cardholder, limit.

### Debit card and meal voucher
A debit card is a checking or savings account with card details, so it uses the Checking layout and appears in the wallet. A meal voucher gets a small layout: balance, monthly top-up, spend per working day this month against the top-up pace, and top merchants.

### Loan (mortgage, car loan, personal loan)
- **KPIs:** Still to pay · Paid off (`RingChart`, %) · Next payment (amount and date) · Payoff date.
- **Amortisation:** `LineChart` of the remaining balance over the full term with today marked, and principal vs interest per year as a stacked `BarChart`.
- **Overpayment planner:** an extra-per-month and a one-off amount. A `ProjectionLine` shows the new payoff date and interest saved against the plan. It saves with Add to plan (`D-118`).
- **Interest:** paid so far against still to come.
- **Secured by:** the linked property or vehicle card with its value, **LTV** (`Gauge`) and equity, linking to it.
- **Paid from:** the payment account and its balance on the next payment date.
- **Schedule tab:** `PaymentPlanTable` with Pay, Defer and Early payment.
- **Details:** original amount, down payment, rate, term, start date, payment day.

### Lending (money you lent)
- **KPIs:** Still owed to you · Received so far · Next expected · Counterparty.
- Repayments received against the schedule (`BarChart`), late repayments flagged, and the account they're paid into as a link.

### Other liabilities (tax, private debt, legal, business debt)
- **KPIs:** Owed · Due date · Counterparty · Paid so far.
- Payments made over time, a payoff projection at the current pace, and the account it's paid from.

### Property
- **KPIs:** Value · Equity · Gain since purchase (amount and %) · LTV (`Gauge`).
- **Value and debt:** `LineChart` with two lines, the property value and the mortgage balance, so the gap between them is the equity. Valuations are markers; the purchase is marked.
- **Mortgage:** a summary card linking to the loan page (balance, rate, next payment, payoff date).
- **Cost of owning:** property tax, insurance and HOA, as a yearly total, monthly equivalent, `PieChart` split, and next due dates.
- **Rental** (if `isRental`): rent this year, gross and net yield, rent received vs expected by month (`BarChart`).
- **Return:** value plus rent received, against purchase price plus costs and mortgage interest paid.
- **Place:** map of the address (`PlaceMap`), type, size, price per m², year built, rooms, parking, garden and terrace.
- **Valuations tab** (kept).

### Vehicle
- **KPIs:** Value · Depreciation since purchase (amount and % per year) · Odometer · Cost per km (if expenses can be linked, see question 4).
- **Value:** `LineChart` of valuations with a `ProjectionLine` along the depreciation trend.
- **Mileage:** odometer over time, km per month, projected yearly km.
- **Lease** (if leased): months left, payments made and to come, residual value, allowance used vs the pace line, and the over-mileage estimate. Pays from links to its account.
- **Car loan:** linked loan card, if any.
- **Details:** make, model, year, plate (`LicensePlate`), VIN, fuel.
- **Mileage tab** (kept).

### Other assets (metals, collectibles, art, business equity, private loan, electronics, furniture, cash)
- **KPIs:** Value · Bought for · Gain or loss · Held for.
- Value over time with valuations, plus condition, location and notes. Electronics and furniture show a straight-line depreciation projection. Cash uses the Checking layout, as today.

### Investment: brokerage, ETF and stock accounts
The Investments hub stays as the portfolio view; this is the page for one investment account, opened from the All tab or the hub.
- **KPIs:** Value · Total return (amount and %) · Contributed · Income this year (dividends, interest).
- **Value vs contributed:** `LineChart` with two lines, market value and cumulative net contributions, so the gap is the return. Range 1M / 6M / 1Y / All.
- **Holdings:** `PieChart` by holding, plus the holdings table (`HoldingsTable`) with weight, cost, value and return, each row opening the holding page.
- **Contributions:** monthly `BarChart` of money in and out, with the source account linked (usually a checking account).
- **Income:** dividends and interest by month.
- **Connections:** the funding account, goals held here, and spare change accounts that feed it.

### Crypto
Same as brokerage, plus a `CandlestickChart` for a single-coin account, and the 24-hour and 7-day change in the KPI row.

### Warrant
- **KPIs:** Value · Units · Price (manual or bound) · Change since grant.
- Price history (`LineChart` from `priceHistory`), the grant schedule, and the price-binding source.

### Pension fund
- **KPIs:** Value · Contributed this year · Years to retirement (`expectedRetirementYear`) · Projected at retirement.
- History plus a `ProjectionLine` to the retirement year, with a low/expected/high band as a reference area. Contributions by year as a `BarChart`, and the employer or source account linked.

### Spare change
- **KPIs:** Balance · Saved this month · Average per transaction · Source account.
- Saved by month (`BarChart`), the round-ups that fed it, and the **source account** and the investment account it moves to, both linked.

## Build order (after sign-off)
1. Connections model (a pure, tested `utils/accountLinks.ts`) and the shared header, KPI row and Connections strip.
2. The `assetId` field on transactions: type, zod schema, form picker, rules, demo data.
3. The All tab, then the hub tabs.
4. Credit card and Checking, which link to each other.
5. Loan and Property, which link to each other.
6. Savings, Vehicle, Lending, Other liabilities, Other assets.
7. Investment, Crypto, Warrant, Pension, Spare change.
8. Remove recharts from the account pages, check at 1440 / 768 / 390 in light and dark, and log the decisions (revising `D-038` and `D-081`).

## Answered (2026-11-06)
1. **Tabs:** grouped — All (default), Cash, Cards, Loans, Assets.
2. **Investments:** redesigned here too. Investment accounts show as a group on All, and each gets its own page (above). The Investments hub keeps the portfolio view.
3. **Wallet strip:** on the Cards tab and at the top of the All tab. A card's own page shows its large card face, not the strip.
4. **Asset costs:** a new optional field on transactions, `assetId`, linking an expense to a property or vehicle. This needs `types.ts`, the zod schema, the transaction form (a "For asset" picker, shown when assets exist), and rules so fuel or a garage can set it automatically. It feeds Cost of owning, cost per km and the property Return.

5. **Property and loan link:** the loan's `linkedAssetId` is the only source; the property side is derived (`D-145`).
6. **Rental:** empty months are tracked (`vacantMonths`) for occupancy and net yield (`D-147`).
7. **Mockup:** skipped; built straight to code.
