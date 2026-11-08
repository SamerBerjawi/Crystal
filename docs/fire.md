# Financial independence (FIRE)

Planning, **FIRE**. Where you stand, when you are on course to be financially independent, and what would change it.

## The arithmetic

All of it is in [`utils/fireModel.ts`](../utils/fireModel.ts): pure functions, tested in [`tests/unit/fireModel.test.ts`](../tests/unit/fireModel.test.ts) against hand-worked numbers and the textbook closed form.

| | |
|---|---|
| **FI number** | yearly spending ÷ withdrawal rate. 30,000 a year at 4% is 750,000. |
| **Spending** | the last 12 finished months, or the number you enter. With under a year of history it is the average so far, scaled to a year, and the page warns when there are fewer than three months. |
| **Portfolio** | cash, savings and investment accounts by default (not a home, a car or debt), or the accounts you choose. |
| **Monthly saving** | the average of income less spending over the same months, or the number you enter. |
| **Date** | grow the portfolio monthly at the expected *real* return and add the monthly saving, until it reaches the FI number. More than 100 years away is "not at this pace". The cautious and optimistic dates use the return two points lower and higher. |
| **Coast FI** | `FI ÷ (1 + r)^years` to retirement: what you need now for growth alone to reach FI by then. The amount you need rises as retirement nears, so the date you reach it is worked out against that moving number, not today's. |
| **Savings rate** | (income − spending) ÷ income per month. Transfers are neither, so moving money into savings or investments counts as saved. |

Returns are **real** (after inflation), so the FI number does not drift and saving needs no inflation adjustment. Everything is in the main currency.

## The past

The history of the portfolio is worked out the way the Overview's net worth chart does it: from today's value, walking the transactions backwards, ignoring a transfer between two counted accounts and counting one to an account outside them. Market gains and losses are not in the transactions, so the past is "what was paid in and out" and is least exact for investments. Stages and milestones are dated from it ("since Jun 2026"), and "already passed when your records begin" is said when the history starts above them.

## Net-worth milestones

Round numbers (1k, 2.5k, 5k, 7.5k, 10k, 25k ...). Net worth includes what is outside the counted accounts, such as a home. For the dates ahead those are held flat and the portfolio does the climbing.

## Settings

Stored with your other preferences (`preferences.fire`), so they follow you across devices. Unset values use the defaults; values outside a sensible range are pulled back in (`normalizeFireSettings`).

## What it is not

A projection from your own figures, not advice. It assumes steady saving and a steady return, ignores tax, and takes no account of changes in what you spend.
