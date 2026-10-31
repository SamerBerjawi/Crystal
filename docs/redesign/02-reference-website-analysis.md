# Crystal: Reference Website Analysis

Phase 4 deliverable. It records how six reference products work, so that Crystal can borrow patterns deliberately. These sites are design references, not templates to copy.

| Reference | Product it imitates | Closest Crystal fit | Owner's reason for choosing it |
|---|---|---|---|
| [Rapport](https://demo.codeandchill.store/rapport/#/overview) | CRM | Schedule, tasks, invoices | General layout, colour accents, calendar, to-do list |
| [Orvel](https://demo.codeandchill.store/orvel/#/overview) | Business money app | Transactions, reconciliation, rules, dashboard | Scatter chart, animation, expanded menus, summary subtitles |
| [Talvo](https://demo.codeandchill.store/talvo/#/close) | Business finance | Forecasting, budgets, loans, reports | PIN lock, charts, forecast cards, transactions |
| [Rivolo](https://demo.codeandchill.store/rivolo/#/today) | Personal money app | Dashboard, goals, merchants, calendar | Control and search centre, payees |
| [Rivet](https://demo.codeandchill.store/rivet/#/portfolio) | Personal finance and investing | Investments, bank sync | Investment and portfolio |
| [Tilvo](https://demo.codeandchill.store/tilvo/#/services) | Business money app | Subscriptions | Subscriptions |

**Dates.** Explored on 31 October 2026, in the browser pane at 1440 × 900, 768 × 1024 and 375 × 812. The brief asked for 390 × 844; the pane's phone preset is 375 wide, which is slightly stricter.

## Coverage

These are demos, so some actions are simulated.

| Site | Routes opened | Viewports | Not exercised |
|---|---|---|---|
| Rapport | All 8 main routes, deal drawer, customer page, create menu, search, notifications, account menu | Overview, Schedule, Pipeline, Finance on phone; Schedule on tablet | Week view, Reset demo data, every card menu |
| Orvel | All 21 listed routes | Overview, Transactions, Review queue on phone; Overview on tablet | Completing an invoice or bill flow; 13-week scatter view; drag-selecting dots |
| Talvo | All 26 listed routes, plus the September locked state | Overview, Forecast, Transactions on phone; Budgets on tablet | Assistant conversation, Payroll editing, Treasury actions |
| Rivolo | All 17 listed routes | Today, Calendar, Payees, Move menu on phone; Cards on tablet | Send money through to the end, Inbox conversations |
| Rivet | All 11 listed routes, holding panel, ticker menu | Portfolio and holding panel on phone | Buying through to the end, Help |
| Tilvo | All 9 main routes, service panel, paused tab | Services on phone | Payments planner in depth, Income details |

**Not every button on every page was clicked.** Each route's controls were listed from the live page, and the key flows were opened. Drag and arrow-key rescheduling was tested only on Talvo. Bank, payment and invite actions are simulated, and "buy template" links were not used. Hover states and motion were seen only in part.

---

## 1. Rapport

### 1.1 Visual language

| Item | Finding |
|---|---|
| Character | Warm, editorial and confident. Soft gradient canvas, large rounded cards, and blocks of strong colour |
| Colour | Canvas `#EBE8E1`, surface `#FBF8F2`, ink `#17191A`, muted `#676A66`. Accents: rust `#C8431F`, forest `#2F5C50`, yellow `#F2C94C` |
| Type | Urbanist. Large page titles over two lines, about 37 px. Body 13 to 14 px, labels 11 to 12 px |
| Shape | Cards 26 px, inner 22 and 16 px, pill controls and circular icon buttons |
| Depth | Soft and low. Colour blocks provide the hierarchy |
| Density | Low. Generous spacing, fewer items per screen |
| Iconography | Thin line icons in circles |

### 1.2 Components

| Component | Behaviour | Why it works | Crystal use |
|---|---|---|---|
| Pill top navigation | Seven destinations, dark pill on the active one | Calm and very clear | Crystal has more than seven destinations, so it needs a second level |
| Floating tool rail | Left capsule: search, create, favourites, agenda, call, email, copy link, export, settings, theme | Keeps global tools one click away on any page | Global actions, separate from page navigation |
| KPI strip | Icon, value and label beside the title | Three figures, with no card clutter | Page summaries |
| Colour deal cards | Whole cards tinted by stage | Status reads at a glance | Bill status or goals, used sparingly |
| Calendar | Coloured day cells with owner avatars, type chips; Month and Week; Today panel with checkboxes | Combines calendar and to-do list | Schedule & Bills, Tasks |
| Filter pills | People and event type together | Fast, visible filtering | Schedule filtering |
| Stage track | Horizontal steps in the deal drawer | Status and next step shown together | Invoice or bill status |
| Stage mix bar | Chunky proportional blocks | Simple part-to-whole view | Budget or asset split |
| Quota ring | Large gauge on a colour card | Single strong number | Goal progress |
| Create dialog | Centred on desktop | Short and focused | Short forms |
| Bottom sheet | Grabber, sticky Cancel and Add, native date and time pickers | Native feel on phone | All phone forms |

### 1.3 UX analysis

**Strengths**
- The agenda works everywhere: the Today panel is on the schedule, and the rail opens it from any page.
- Rows become purpose-built cards on phone. The invoice table stacks into a customer, reference, date, amount and status block.
- Pop-overs open beside the tool that launched them.

**Weaknesses**
- Two navigation systems sit at right angles, top pills and left rail, which splits attention.
- Rail icons have no labels on screen.
- The Kanban board stays horizontal on phone, so you see one column and a slice.
- In the one dark-mode screenshot taken, calendar cells stayed pale. It may have been caught mid-transition, so this needs rechecking.
- Colour blocks are loud. Used on many items, they would compete with money figures, which must be the first thing read in Crystal.

### 1.4 Phone and tablet

| Area | Desktop | Tablet | Phone |
|---|---|---|---|
| Main navigation | Pill row | Pill row | Scrolling pill row |
| Tools | Left rail | Left rail | Bottom toolbar, with a More menu |
| KPI strip | One row | One row | Stacked pairs |
| Calendar | Month grid and side panel | Month grid; panel below | Month grid; dots replace event text |
| Table | Table | Table | Stacked cards |
| Forms | Centred dialog | Centred dialog | Bottom sheet |

On phone, 14 of 56 measured targets on Overview were under 44 px, the smallest at 16 px.

### 1.5 Apple HIG notes

| Category | Note |
|---|---|
| Accessibility requirement | Icon-only rail buttons do have screen-reader labels. Colour-coded stages also need a text label, which the cards have. Contrast is unmeasured |
| General UX principle | The bottom toolbar puts actions in thumb reach. `sheets.md › Best practices` supports its grabber and focused tasks |
| Apple platform convention | `tab-bars.md › Best practices`: "Use a tab bar to support navigation, not to provide actions." Rapport's bottom bar holds tools, so it isn't a tab bar. This is information, not a defect |
| Optional visual | Warm, gentle brand expression; no Apple styling needed |

---

## 2. Orvel

### 2.1 Visual language

| Item | Finding |
|---|---|
| Character | Warm, precise, grown-up. The most "bank-grade" of the four |
| Colour | Canvas `#F2EFE8`, surface `#FFFDF8`, ink `#1B1813`, amber `#F0A31A`. Green for money in; category colours as tints |
| Type | Manrope at 13 to 15 px, weights up to 800; monospace account numbers; tabular amounts |
| Shape | Tighter: 10 to 13 px, pills for chips |
| Density | Medium to high, while staying readable |
| Motion | Live events appear as a pill at the bottom, such as a new card payment; the overview balance updates |

### 2.2 Components

| Component | Behaviour | Why it works | Crystal use |
|---|---|---|---|
| Written summary | "€3,445 came in yesterday, 9 bills need your approval and 13 card payments need filing." The bold phrases are links | Turns data into a to-do list | Dashboard greeting |
| Grouped sidebar | Money, Business, Insight. Items expand into children, with count badges | Handles many pages without a second bar | Crystal's page count |
| Runway footer | Cash cover in the sidebar | Key health number is always visible | Runway, on every page |
| Cash summary | Total, proportional bar, account rows, runway note | One card answers "what do I have" | Accounts, Dashboard |
| Needs you | Short list of counts, each a link | Everything awaiting action in one place | Reconciliation, bills |
| Payment scatter | One dot per payment, above or below a zero line. Size is amount, colour is category. Drag across days to filter | Shows patterns and outliers in a month | Transactions header |
| Review queue | One payment at a time, suggested categories on keys 1 to 3, skip, side list, progress | Makes cleanup quick and even satisfying | Reconciliation and uncategorised transactions |
| Rules list | Plain sentence: counterparty contains X → category, on/off, matches, delete | No rule builder to learn | Rules rework |
| Rules worth making | Suggestions from repeated filing | Automation arrives when it's useful | Rule suggestions |
| "Always file like this" | Rule created from a transaction | Rule creation at the point of need | Rules rework, merchants |
| Transaction drawer | Status, account, category, receipt, note, Mark reviewed | Compact and action-led | Transaction detail |
| Bill timeline | 30-day day bars with amounts; balance after each payment | Shows when cash leaves | Schedule, bills |
| Analytics builder | Tile picks a report, with "What it says" text and a table | A report in one click, with an explanation | Reports |
| Contact cards | Paid, payments, last paid, open invoices | Merchant summary at a glance | Merchants |

### 2.3 UX analysis

**Strengths**
- Sections read as sentences, such as "Where it went" and "Who did what".
- Every summary links to the place where you act on it.
- The sidebar collapses to an icon rail that keeps its badges.

**Weaknesses**
- The scatter's scale isn't linear, so small and large amounts sit oddly close. It needs its caption to make sense.
- Dense category chips can feel busy.
- Multi-user concepts, such as approvals and team cards, don't apply to Crystal.

### 2.4 Phone and tablet

| Area | Desktop | Tablet | Phone |
|---|---|---|---|
| Navigation | Full sidebar | Icon rail with badges | Bottom bar: Overview, Ledger, Cards, Invoices, More |
| Secondary pages | Sidebar | Rail | Pop-over from More |
| Global actions | Top bar | Top bar | Icon buttons at the top |
| Scatter | Full width, stats beside it | Full width | Kept full width, stats below |
| Transactions | Table | Table | Grouped rows, chips, a **Select** mode |
| Review queue | Card and side list | Card | One card, list hidden |

### 2.5 Apple HIG notes

| Category | Note |
|---|---|
| Accessibility requirement | The scatter has a text alternative only through the list below it. Size and colour alone can't carry meaning, so a Crystal version needs labels and a list |
| General UX principle | Queue with undo-free skip and suggestions matches "feedback in context". `charting-data.md`: "Aid comprehension by adding descriptive text to the chart" supports the caption |
| Apple platform convention | Tab bar with counts. `tab-bars.md › Best practices` advises against overflow, so More is a trade-off in an app of Crystal's size |
| Optional visual | Amber accent; suits Crystal's existing orange `#fa9a1d`, which you may or may not keep |

---

## 3. Talvo

### 3.1 Visual language

| Item | Finding |
|---|---|
| Character | Crisp, modern and energetic |
| Colour | Canvas `#E9ECE5`, surface `#FBFCF9`, near-black `#131714`, lime `#CBEA3F`, with lavender `#D8D1FA` and mint `#BFE8D3` for secondary data |
| Type | Manrope at 14 to 15 px, page titles about 39 px at weight 800; small uppercase labels at 10 px |
| Shape | 11 to 12 px cards, pills |
| Character device | Dark sidebar and a hero dark card against a pale canvas |
| Density | High on Overview; clear on sub-pages |

### 3.2 Components

| Component | Behaviour | Why it works | Crystal use |
|---|---|---|---|
| PIN lock | **The lock mode the owner means.** Full-screen dark screen with name, four PIN dots and a keypad, plus keyboard digits, Backspace and "Sign out instead" | Protects a visible screen without a full sign-out | New privacy feature for Crystal |
| Month-end close | Progress ring, tasks grouped by area, owners, due dates, books lock date | Turns a chore into a finish line | Separate idea, not the lock mode |
| Closed month | Success panel, read-only tasks, "locked Oct 6" | Clear closure | Separate idea, not the lock mode |
| Cash Horizon | Line, buffer line, income and bill bubbles, fixed items, Chart or List, 30/60/90 days | Everything that moves the balance in one chart | Forecasting |
| Drag to reschedule | Drag or use arrow keys; the low point recalculates. **Tested**: moving a $31,200 bill changed the low from $43,066 to $64,957 | Test a decision before making it | Forecasting |
| What moves the line | Start, expected in, going out, end, lowest, days under buffer | Explains the forecast | Forecasting summary |
| Stay above your buffer | Suggests moving a bill, with Apply | The app proposes the fix | Forecasting |
| Budget card | Spent, pace tick, projection, inline limit stepper | Edit in place, with no modal | Budget |
| Filters by state | All, Over, Running hot | Sorts by what needs attention | Budget |
| Loan page | Ring, details, schedule, "What if you paid extra?" slider | A what-if at the point of need | Loans |
| Saved reports | Named views with sparklines | Reports become a library | Reports |
| Ask bar | Question box and suggested prompts | Quick answers | Crystal has no AI today |
| Card stack | Fanned card visual | Memorable | Credit card views |
| Undo pill | Bottom pill after an action | Safe, unobtrusive recovery | Everywhere |

### 3.2a PIN lock in detail

| Item | Finding |
|---|---|
| Manual lock | Account menu → **Lock Talvo**, or press `L` |
| Automatic lock | After 15 idle minutes, stored as a setting. Clicks, key presses and scrolling reset the timer |
| Unlocking | Four digits, on the on-screen keypad or physical keyboard |
| Escape route | "Sign out instead" on the keypad |
| Phone and tablet | Not viewed |
| Wrong PIN handling | Not tested. I didn't enter the PIN |

**Limits.** In this demo, the PIN is a plain value in client settings, and the screen shows it, so it's only a visual cover. Crystal would need a real design: the data is already loaded in the browser, so a lock on its own hides the screen but doesn't protect the data. Secure PIN storage and repeated-failure handling need deciding in Phase 6.

### 3.3 UX analysis

**Strengths**
- Forecasting is an active tool, not just a chart.
- Text explains a number, such as "dips under your buffer around Oct 31".
- Filters show counts, so you know what's there before clicking.

**Weaknesses**
- Overview is dense, and the top of the page competes for attention.
- Dark sidebar, dark hero and a lime accent form a strong look that can tire over long sessions.
- 10 px uppercase labels are small.
- Payroll, Treasury and approvals don't apply to Crystal.

### 3.4 Phone and tablet

| Area | Desktop | Tablet | Phone |
|---|---|---|---|
| Navigation | Dark sidebar | Dark icon rail | Bottom bar: Overview, Accounts, Cash flow, Payments, More |
| Ask | Top bar and card | Same | Icon, and a card on Overview |
| Forecast | Chart and side panel | Chart, panel below | Chart with fewer days first |
| Transactions | Table | Table | Stacked rows, scrolling filter chips |
| Budgets | Two columns | Two columns | One column |

### 3.5 Apple HIG notes

| Category | Note |
|---|---|
| Accessibility requirement | Arrow keys for the drag are a strong example: `gestures.md › Best practices`: "Give people more than one way to interact with your app." The bubbles' 36 px size is under a 44 px target on phone |
| General UX principle | Undo pill follows `alerts.md`: "Avoid displaying alerts for common, undoable actions." Talvo does still use chips and rings heavily, so the chart guidance to keep charts simple is a watch-out |
| Apple platform convention | Five tabs with one being More |
| Optional visual | Dark rail and lime are brand choices |

---

## 4. Rivolo

### 4.1 Visual language

| Item | Finding |
|---|---|
| Character | Friendly, tidy and consumer-grade. The most like a personal banking app |
| Colour | Canvas `#EEF1F4`, surface `#FCFDFE`, navy sidebar, blue `#1765CF`, orange `#E9773F`, peach `#F4A77C` |
| Type | Instrument Sans at 14 to 15 px, balance about 35 px at weight 800 |
| Shape | 10 to 14 px, pills |
| Density | Medium, with clear section titles |

### 4.2 Components

| Component | Behaviour | Why it works | Crystal use |
|---|---|---|---|
| Command centre | ⌘K searches pages, payees and **payments**, with highlighted matches | One box finds anything | Command Center |
| Payees workspace | List with favourites beside a live profile: paid, pays in, owed, monthly bars, details, invoices, payments | No page change between merchants | Merchants |
| Safe to spend | After bills and cushion, with a daily figure and a breakdown | The most useful personal number | Dashboard, accounts |
| Your money | Total, split bar, four pot tiles | Instant overview | Dashboard |
| Activity | KPIs, one filter row, day-grouped list, "This view at a glance" side panel | The summary follows your filters | Transactions |
| Transaction drawer | Status, details, tap-chip categories, toggle, receipt | Fast categorising | Transaction detail |
| Calendar | Daily spend figures, markers, day panel, drag to reschedule | Spending and plans in one view | Schedule & Bills |
| Compared with usual | "$58 over your usual" per category | Insight without a chart | Reports, budget |
| Goals | Progress ring, monthly need, Add money, Move back; summary across goals | Actions on the card | Goals |
| Scheduled page | Standing orders, direct debits and savings, with Pause | Clear grouping of recurring money | Schedule rules |
| Move menu | Send, move between pots, invoice, schedule, add payee, goal, card | Create menu focused on money | Quick actions |
| Connections | App cards with status, Sync now, Disconnect, Sync all | Integrations in one place | Integrations |
| Card controls | Freeze, limit, details hide after a timeout | Sensitive data handled carefully | Privacy ideas |

### 4.3 UX analysis

**Strengths**
- It's built around questions a person asks, such as "What can I spend?".
- Payees is the best merchant pattern of the four, and you pointed to it yourself.
- The search result shows the actual payment, which suits a ledger.

**Weaknesses**
- Navy sidebar, blue primary and orange active state give it three strong colours that compete a little.
- Some business concepts, such as an inbox and invoices, are less personal.
- A category chip list in the drawer gets long at Crystal's category count.

### 4.4 Phone and tablet

| Area | Desktop | Tablet | Phone |
|---|---|---|---|
| Navigation | Navy sidebar | Navy icon rail with badges | Bottom bar: Today, Activity, Wallet, Payments, More |
| Quick actions | Header buttons | Header buttons | Blue button opening a pop-over |
| Pots | Four tiles | Four tiles | Two by two |
| Calendar | Month grid and day panel | Month grid | **Swipeable week strip** with a day agenda |
| Payees | List and profile | List and profile | List, then profile as its own step |

### 4.5 Apple HIG notes

| Category | Note |
|---|---|
| Accessibility requirement | Calendar items need text, not just dots. Rivolo's day buttons carry full spoken descriptions, such as "spent $62" |
| General UX principle | The week strip reduces density without losing the task, which is what `charting-data.md` and progressive disclosure aim for |
| Apple platform convention | Icon and label tabs; rail on tablet. `layout.md` supports layouts that follow available space |
| Optional visual | Card art, which Apple's own Wallet also uses, is purely a brand choice here |

---

## 5. Rivet

Added on the owner's request as the investment and portfolio reference.

### 5.1 Visual language

| Item | Finding |
|---|---|
| Character | Dark, sharp and trader-like |
| Colour | Near-black `#050507`, surfaces `#111218` and `#1A1B24`, text `#F4F5F9`. Lime `#D4FF3F`, cyan `#3EF2FF`, amber `#FFBE4D` |
| Type | Urbanist at 12 to 13.5 px; tabular figures in tables |
| Shape | 8 to 10 px controls, 18 px cards |
| Density | Medium to high. Clean table rhythm |

### 5.2 Components

| Component | Behaviour | Why it works | Crystal use |
|---|---|---|---|
| Portfolio KPIs | Value, total gain, today, cash to invest | The four numbers an investor checks first | `INV-01` |
| Performance chart | Value line and area, 1M, 3M, 6M | A plain line is honest with logged data | `INV-03`, as a possible answer to DEF-03 |
| Allocation | Stacked bar, then value and share by asset type, with a concentration warning | Reads faster than a donut, and adds advice | `INV-02` |
| Holdings table | Holding, units, price, 30-day sparkline, value, gain | Compact and scannable | `INV-04` |
| Rebalance check | Current mix against a target, with the gap | Turns data into a decision | New idea for Crystal |
| Watchlist | Tickers you don't own, details, remove | Research beside holdings | New idea for Crystal |
| Holding panel | Price, chart, units, market value, buy or sell, remove | Everything for one ticker, with no page change | `INV-15`, `INV-09` |
| Bank sync page | Each bank's status, accounts, last sync, Sync now, Reconnect, Resume | Clear health view of every connection | `BNK` |
| Statements | Month list with CSV downloads | Simple archive | `DAT-03` |
| Subscription nudge | "Trim what you never open", with Cancel it | Helps you act | `SUB` |
| Health score | Overview score | Compare with Crystal's Challenges score | `CHL-01` |
| Academy | Short lessons with progress | Education | Not in Crystal |

### 5.3 UX analysis

**Strengths**
- The Portfolio page tells a story from top to bottom: value, trend, split, holdings, then what to do.
- The trade is built into the holding panel.
- Bank sync states are explicit, including "Needs attention" and paused.

**Weaknesses**
- Near-black everywhere suits a trading mood, but it conflicts with `D-001`, which chose Orvel's warm light look.
- Only stocks, funds, bonds, crypto and cash. There are no warrants, pension or spare-change equivalents, which Crystal has.
- I found no sold-position history or multi-currency holdings on this page.
- Candlesticks aren't used, so it doesn't settle that decision by itself.

### 5.4 Phone and tablet

| Area | Desktop | Phone |
|---|---|---|
| Navigation | Sidebar | **Hamburger menu**, with no bottom bar |
| Holdings | Six-column table | Rows: name, value and gain, with units, price and sparkline removed |
| Holding details | Side panel | Tall bottom sheet |
| Create | Header button | Lime button at the top |

Tablet was not viewed separately for Rivet.

### 5.5 Apple HIG notes

| Category | Note |
|---|---|
| Accessibility requirement | Gain and loss use colour, but also a plus or minus sign, which is the right pattern. Lime on black needs measuring for small text |
| General UX principle | Dropping columns on phone is good prioritising. `charting-data.md`: "Keep a chart simple, letting people choose when they want additional details" |
| Apple platform convention | A hamburger hides navigation; it isn't relevant under `D-003` |
| Optional visual | Dark trading style is a brand choice |

---

## 6. Tilvo

Added on the owner's request as the subscriptions reference.

**Loyalty cards are not covered.** Tilvo's Cards page is company payment cards. No reference yet shows a loyalty wallet.

### 6.1 Visual language

| Item | Finding |
|---|---|
| Character | Calm, soft and airy |
| Colour | Canvas `#EEF1F5`, surface `#FBFCFD`, blue `#1F55D6`, with pastel blue, green, amber and rose summary cards |
| Type | Urbanist at 11 to 12 px, section figures 22 px |
| Shape | 18 px cards, 9 to 12 px controls |
| Navigation | Icon-only top bar, active item in solid blue |

### 6.2 Components

| Component | Behaviour | Why it works | Crystal use |
|---|---|---|---|
| Service summary | Every month, over a year, renewing in 30 days, saved by pausing | Totals in terms that matter | `SUB-01` |
| Renewal timeline | Next 30 days on one line, labelled | See clusters of renewals | `SUB-03`, Schedule |
| Service cards | Name, purpose, price, next charge, card, seats | A subscription is more than a recurring amount | `SUB-03` |
| Service panel | Price, status, next charge, card, category, customer since, recent charges, Pause, Cancel | One place for each service | `SUB-03` |
| Paused & cancelled | Separate tab, with Resume and Restart | History isn't lost | New for Crystal |
| Card art | Colour cards, frozen state, spend bars | Attractive wallet | Visual idea for `SUB-04` |
| Payments planner | Timeline or list, with earlier and later | Plan money movement | `SCH`, `FCT` |

### 6.3 UX analysis

**Strengths**
- "Saved by pausing" shows the value of acting.
- Paused and ended services keep their history.
- The summary uses plain words.

**Weaknesses**
- Icon-only top navigation relies on tooltips, which is hard for new users.
- 11 to 12 px text is small.
- Pastel summary cards are pleasant but carry little meaning.
- Pause and Cancel imply a provider action. In Crystal, they would only change tracking, so the wording must make this clear.

### 6.4 Phone

| Area | Desktop | Phone |
|---|---|---|
| Navigation | Icon top bar | Bottom bar with labels: Overview, Accounts, Payments, Cards, More |
| Summary | Four across | Two by two |
| Timeline | Horizontal line | Vertical list, a good example of rethinking a chart |
| Service panel | Side panel | Not viewed |

Tablet was not viewed separately for Tilvo.

### 6.5 Apple HIG notes

| Category | Note |
|---|---|
| Accessibility requirement | Icon-only navigation must keep accessible names, which it does in the phone bar through visible labels |
| General UX principle | The vertical phone timeline keeps the task while reducing width |
| Apple platform convention | Bottom bar with labels and a More tab |
| Optional visual | Pastel cards are a brand choice |

---

## 7. Immediate observations for Crystal

These feed Phases 5 and 6. Nothing here is decided.

1. **Rules:** Orvel's plain-sentence rules, suggestions and "Always file like this" together offer a far simpler model than Crystal's Rule Engine.
2. **Reconciliation on a phone:** Orvel's Review queue is now the chosen model (`D-008`).
3. **Forecasting:** Talvo's buffer and drag-to-test model maps well to `FCT`.
4. **Merchants:** Rivolo's Payees fits `MER`, while Orvel's "Always file" fits autofill.
5. **Safe to spend:** Rivolo's figure could join Crystal's runway. Crystal already calculates something similar for checking accounts.
6. **Privacy lock:** Talvo's PIN lock would be a new feature for Crystal, not a redesign of an existing one. See section 3.2a.
7. **Month close:** Talvo's close remains a separate idea. It would need thought, because bank sync can add older transactions after a month is closed.
8. **Investments:** Rivet gives the portfolio structure, but Crystal has warrants, pensions, spare change, web-scraped prices and candlesticks that Rivet doesn't.
9. **Subscriptions:** Tilvo fits. Rivet adds the "trim what you never open" nudge.
10. **Bank connections:** Rivet's Bank sync page suits `BNK`, and live sync is the owner's main source.
11. **Remaining gaps:** Loyalty cards, challenges and gamification, data import, and property or vehicle assets have no reference.
