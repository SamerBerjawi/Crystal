# Crystal Domain Rules & Financial Invariants

This document specifies the canonical financial rules enforced across Crystal's calculation engines (`utils/`).

---

## 1. Monetary Precision & Currency Conversion

1. **Decimal-Safe Arithmetic**:
   - All balance mutations, interest accruals, and currency conversions must use `safeAdd`, `safeSub`, `safeMul`, `safeDiv`, or `safeRound` in [`utils.ts`](../utils.ts) (backed by `big.js`).
   - Standard currencies round to `2` decimal places (`safeRound(val, 2)`); `BTC` rounds to `8` decimal places (`safeRound(val, 8)`).
2. **Conversion Rates Table (`CONVERSION_RATES_TO_EUR`)**:
   - Rates in `preferences.conversionRates` represent **units of 1 Currency in EUR** (e.g., `EUR: 1`, `USD: 0.92`), or are normalized by [`convertCurrency`](../utils.ts).
   - **Rule**: Never chain `convertToMain` (`getMainCurrency()`) with `convertCurrency(val, 'EUR', getMainCurrency())`.
     - `calculateAccountTotals` ([`utils.ts`](../utils.ts)) returns values in **main currency** (`getMainCurrency()`).
     - `challengesModel.ts` ([`utils/challengesModel.ts`](../utils/challengesModel.ts)) operates internally in **EUR** and converts `calculateAccountTotals` outputs into EUR via `eurOf(val, getMainCurrency())` so downstream consumers (`Challenges.tsx`, `wrappedModel.ts`) can convert from `'EUR'` to `getMainCurrency()` once.

---

## 2. Account Archetypes & Balance Resolution

Defined in [`resolveAccountBalance`](../utils.ts) and [`utils/accountArchetypes.ts`](../utils/accountArchetypes.ts):

| Account Type | Balance Sign Convention | Balance Resolution Rule |
|---|---|---|
| `Checking`, `Savings`, `Cash` | Positive = Asset, Negative = Overdraft | Uses `account.balance`, updated atomically on transaction save/delete via [`utils/transactionChanges.ts`](../utils/transactionChanges.ts). |
| `Credit Card` | Negative = Debt Owed, Positive = Credit Balance | Uses `account.balance`. Credit utilization is `0%` when `balance >= 0`. |
| `Loan` (`Loan` / `Mortgage`) | Negative = Liability | Uses `resolveAccountBalance(account)` which derives remaining principal from `principalAmount`, `interestRate`, `duration`, `startDate`, and `loanPaymentOverrides`. |
| `Lending` | Positive = Receivable Asset | Uses `resolveAccountBalance(account)`. |
| `Property`, `Vehicle`, `Other Assets` | Positive = Asset Valuation | Uses latest valuation or `account.balance`. Linked mortgages/loans are tracked via `loan.linkedAssetId` ([`utils/accountLinks.ts`](../utils/accountLinks.ts)). |
| `Investment` (`Stock`, `ETF`, `Crypto`, `Warrant`) | Positive = Market Value | Recomputed from net share quantity (`investmentTransactions` + `warrants`) multiplied by latest price (`assetPrices[symbol]`). |

---

## 3. Transactions, Transfers & Balance Deltas

Defined in [`utils/transactionChanges.ts`](../utils/transactionChanges.ts):

1. **Signed Amounts**:
   - `income` transactions have `amount >= 0`.
   - `expense` transactions have `amount < 0`.
   - `transfer` transactions consist of two linked legs sharing a `transferId` (or a single record with `toAccountId` in recurring rules), excluded from income/expense spending totals (`isTransferTransaction` / `category === 'Transfer'`).
2. **Edit Locks on Synced Transactions (`lockedFields`)**:
   - When a user manually edits `description`, `merchant`, `category`, or `notes` on a bank-synced transaction, [`withEditLocks`](../utils/lockedFields.ts) records those field names in `tx.lockedFields`.
   - Subsequent Enable Banking syncs ([`syncFill`](../utils/lockedFields.ts)) never overwrite locked fields.
3. **Deleted Synced Transactions (`deletedTransactionIds`)**:
   - Deleting a bank-synced transaction records its `sureId` on the parent `EnableBankingAccount.deletedTransactionIds` ([`rememberDeleted`](../utils/deletedSync.ts)) so future bank syncs do not re-import it (unless the user deletes an entire CSV/batch with `{ resyncable: true }` or resets deleted IDs).

---

## 4. Scheduled Obligations (`RecurringTransaction` & `BillPayment`)

Defined in [`utils/scheduleModel.ts`](../utils/scheduleModel.ts), [`utils/forecastModel.ts`](../utils/forecastModel.ts), and [`utils/subscriptionsModel.ts`](../utils/subscriptionsModel.ts):

1. **Single Underlying Entity (`RecurringTransaction`)**:
   - Both **Schedule & Bills** (`pages/Schedule.tsx`) and **Subscriptions** (`pages/Subscriptions.tsx`) read and mutate the same `recurringTransactions` slice.
   - `Subscriptions.tsx` defaults its scope filter to `'services'` (`isDigitalOrService`), hiding mortgages, rent, loans, and taxes unless the user switches to `'all'`.
2. **Lifecycle States**:
   - **Active**: `(!startDate || startDate <= date) && (!endDate || endDate >= date) && !pausedAt`
   - **Paused**: `Boolean(pausedAt)` — excluded from active subscription totals, future schedule occurrences, and cashflow forecast curves until resumed.
   - **Ended / Cancelled**: `endDate < todayStr`.
3. **Occurrence Overrides (`RecurringTransactionOverride`)**:
   - Keyed by composite key `(recurringTransactionId, originalDate)`.
   - Supports skipping a single occurrence (`isSkipped: true`) or overriding its date, amount, or description without mutating the parent series.
4. **Posting an Occurrence**:
   - Posting a recurring occurrence creates a ledger `Transaction` with `recurringSourceId: rt.id` and `recurringOccurrenceDate: occurrenceDate`, and advances `rt.nextDueDate`.
   - Overdue occurrences (`date < today`) are surfaced in the `"Needs you"` / `"Overdue"` queue and are **not** automatically deducted from future projected balances in `forecastModel.ts`.

---

## 5. Investments & Warrants

Defined in [`utils/investments.ts`](../utils/investments.ts):

1. **Unified Chronological Stream**:
   - Both [`buildHoldingsOverview`](../utils/investments.ts) and [`realizedGains`](../utils/investments.ts) merge `investmentTransactions` (`buy`/`sell`) and `warrants` (grant date, quantity, strike/grant price) into a **single chronological stream** sorted by date (`grant` / `buy` before `sell` on the same date).
   - Selling shares reduces average cost basis proportionally (`avgCost * remainingQuantity`) and records FIFO realized gain/loss.
2. **Currency Resolution**:
   - Symbol currency is resolved via `preferences.investmentPriceConfigs?.[symbol]?.currency ?? account.currency ?? 'EUR'`.
