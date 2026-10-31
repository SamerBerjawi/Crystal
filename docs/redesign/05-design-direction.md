# Crystal: Design Direction

Phase 7 deliverable, approved by the owner (`D-056`). It brings the [Decision Register](DECISION_REGISTER.md) together into one direction. See the [visual preview](https://claude.ai/artifact/WtYCfvz6Li5dgitnoLq5Va), which uses sample data and text placeholders for rail icons. Exact tokens and components come in Phase 8. Nothing here changes the app yet.

## 1. The idea

**Crystal is a calm, precise money workspace that tells you what happened, what you can spend, and what needs you.**

It should feel warm and trustworthy like Orvel, roomy and confident like Rapport, and useful like Talvo: not a wall of numbers, but something that helps you decide.

| Principle | Meaning |
|---|---|
| Figures come first | Colour and decoration never compete with money |
| Say it in words | Short, plain sentences explain the numbers (`S-005`) |
| Every summary leads somewhere | A number or phrase links to the place to act |
| Automation stays quiet | Autofill, rules and sync keep working without a fuss, and you can always see or undo the result |
| Designed for each screen | A phone isn't a smaller desktop (`S-006`) |

## 2. Visual language

### Colour

Values are proposed, and checked against WCAG 2.2 AA with computed ratios. Phase 8 finalises the full scale.

| Role | Light | Ratio | Dark | Ratio |
|---|---|---|---|---|
| Canvas | `#F2EFE8` warm paper | | `#14130F` warm near-black | |
| Surface | `#FFFDF8` | | `#1E1C17` | |
| Text | `#1B1813` | 17.41:1 on surface | `#F4F1EA` | 15.09:1 |
| Muted text | `#6B655A` | 5.68:1 | `#A9A396` | 6.78:1 |
| Primary | `#2F5C50` forest green | 7.59:1 with white | `#7FC4AE` | 9.21:1 with dark text |
| Attention | `#F0A31A` amber, dark text | 8.39:1 | `#F0A31A` | 8.07:1 |
| Attention text | `#9A5F00` | 5.15:1 | `#F0A31A` | 8.07:1 |
| Money in | `#167A4E` | 5.26:1 | `#4CC38A` | 7.68:1 |
| Money out or error | `#B3361E` | 5.96:1 | `#F08A6E` | 6.94:1 |

**Category colours (`D-049`).** These label categories and chart series only, and never mean good or bad.

| Colour | Light | Ratio on surface | Dark | Ratio on surface |
|---|---|---|---|---|
| Ocean blue | `#1F6F8B` | 5.58:1 | `#6DBBD6` | 7.89:1 |
| Terracotta | `#B5562F` | 4.76:1 | `#E59A78` | 7.48:1 |
| Purple | `#6F4AA8` | 6.41:1 | `#B79BE6` | 7.17:1 |
| Indigo | `#3F51B5` | 6.76:1 | `#9AA8F0` | 7.48:1 |

**Rule:** gain, loss and status always also use a sign, word or icon, never colour alone. Terracotta is close to the money-out red, so it's never used for money out.

**Replaces:** the orange in `DESIGN.md` (`D-031`).

### Type, shape and depth

| Item | Direction |
|---|---|
| Typeface | Manrope. Crystal's typeface choices in Preferences stay (`D-057`) |
| Numbers | Tabular figures for amounts |
| Titles | Large, confident page titles |
| Smallest text | No body or label text under 12 px in normal use |
| Corners | Soft: about 16 to 22 px for cards, pills for navigation |
| Depth | Quiet. Separation comes from surface colour, with soft shadows only on floating items |
| Density | Spacious pages, with a Comfortable or Compact switch on large tables (`D-036`) |
| Motion | Expressive: number count-ups, staggered cards and chart reveals, and reduced when your system asks for it (`D-059`) |
| Glass | Frosted glass stays on floating items only: the rail, the phone bar, tooltips and similar. Never on content cards. A solid fallback applies when your system reduces transparency (`D-055`) |

## 3. Navigation and structure

| Hub | Tabs |
|---|---|
| Overview | None |
| Accounts | Cards, Accounts, Loans, Assets (`D-081`) |
| Transactions | Ledger, Review queue, Rules, Merchants |
| Planning | Budget, Forecast, Goals, Calendar, Subscriptions, Tasks |
| Investments | Portfolio, Holdings, Activity |
| Reports | Reports, Invoices, Challenges |
| Settings | Profile, Preferences, Connections, Categories, Tags, Data, Help |

**Global tools (`D-018`):** Search, Create, Today, Review queue, Sync banks, Settings, Theme, Lock. On phones, Search and Create sit in the top bar, and More holds Investments, Reports, Settings, Sync, Privacy, Theme and Lock.

## 4. Three experiences

| | Desktop | Tablet | Phone |
|---|---|---|---|
| Navigation | Top pills, tab row, vertically centred rail with tooltips | The same, compressed | Bottom bar: Overview, Accounts, Transactions, Planning, More |
| Layout | Wide, multi-column | One or two columns | One column, in a deliberate order |
| Tables | Tables with a density switch | Key columns | Rows, with day groups |
| Editing | Dialog, side panel or full panel | The same | Bottom sheet or full-height sheet |
| Actions | Header buttons, row menus | The same, with bigger targets | Create in the top bar, tap for details, swipe shortcuts |
| Touch targets | Pointer sizing | 44 px | 44 px |
| Search | Palette from the rail | The same | Top bar, full screen |

### Phone: what changes, not just what shrinks

| Screen | Phone design |
|---|---|
| Overview | Sentence, Net Worth, Needs you, Safe to spend (can be hidden), then Forecast, Accounts, Recent |
| Calendar | Week strip and day agenda |
| Transactions | Day rows, filter sheet, Select mode |
| Review queue | One card at a time |
| Forecast | List by default, and tap a bubble to move it |
| Merchants | List, then profile as a separate step |
| Holdings | Name, value and gain only |
| Renewal timeline | Vertical list |
| Reports | One report at a time |
| Data import | Simplified steps, with full mapping on desktop (`D-030`) |

## 5. Signature moments

These are what make Crystal feel like itself.

1. **The written summary:** "€412 came in yesterday, 3 bills are due and 5 transactions need review."
2. **Net Worth hero and Safe to spend:** where you stand, and what you can spend.
3. **The Review queue:** one quick card at a time, on any device.
4. **The forecast you can move:** drag a bill and watch the low point change.
5. **"Always file like this":** a rule made in one tap, from a real transaction.

## 6. What stays exactly the same

- All 47 automations in section 11 of the inventory, especially merchant autofill.
- Crystal's financial calculations, apart from approved fixes.
- Authentication, the data model and bank connections.
- Every function in the inventory, except the removals below.

## 7. Changes in function

**Removed by decision:** Scenario Playground (`D-010`), page-number pagination (`D-040`), the Settings tile page (`D-045`), and non-working items (`S-003`).

**Replaced:** the four categorisation setups combine into one Rules model (`D-009`), and pending-match screens move into the Review queue (`D-008`).

**New:** PIN lock, Safe to spend, forecast buffer and drag, paused services, automatic reports, comparison with usual, loan pay-extra slider, and synced browser choices.

**Fixed in Phase 9:** `DEF-01`, `DEF-02`, `DEF-04`, `DEF-05`, `DEF-06`, plus any-currency support (`S-010`).

## 8. Known risks

| Risk | Mitigation |
|---|---|
| More hides three hubs on phones (`D-054`) | Clear labels. Testing in Phase 9 will show if any should move to the main bar |
| Glass reduces contrast over busy content (`D-055`) | Keep opacity high, test text over charts, and use the solid fallback |
| Rail icons have no labels (`D-002`) | Tooltips, accessible names and a familiar set of icons |
| Spacious layout plus a data-heavy app (`D-032`) | Density switch, Show more |
| The Dashboard combines many ideas (`D-004`) | A fixed default order, with a free grid for those who want to change it |
| Forest green is close to "money in" (`D-037`) | Separate hues, plus signs and words |
| Rules is a functional rebuild (`D-009`) | Tests first, and fix `DEF-06` before it |

## 9. Apple HIG position

**Followed as requirements:** contrast, text alternatives for charts, keyboard routes, and reduced motion.

**Followed as principles:** feedback in context, Undo over alerts, one focused sheet at a time, and progressive disclosure.

**Followed as a convention:** a labelled bottom bar on phones, though Apple advises against a More tab, which Crystal needs for its seven hubs.

**Intentionally not followed:** Apple's visual style. These are conventions, not defects.
