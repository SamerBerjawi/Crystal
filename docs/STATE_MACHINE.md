# Crystal State Machines Reference

This document maps the core state machines governing authentication, persistence, bank synchronization, and scheduled obligations in Crystal.

---

## 1. Authentication, Session & PIN Lock State Machine

**Owners**: [`hooks/useAuth.ts`](../hooks/useAuth.ts), [`server/src/lock.ts`](../server/src/lock.ts), [`App.tsx`](../App.tsx)

```mermaid
stateDiagram-v2
  [*] -->BootChecking: Mount App
  BootChecking --> Unauthenticated: 401 / No Cookie
  BootChecking --> SessionLocked: 423 Locked (PIN Required)
  BootChecking --> AuthenticatedUnlocked: 200 OK (Data Payload)
  Unauthenticated --> DemoMode: Enter Demo Mode (DEV only)
  Unauthenticated --> AuthenticatedUnlocked: Sign In / Sign Up
  AuthenticatedUnlocked --> SessionLocked: Idle Timer / Manual Lock (POST /api/lock/lock)
  SessionLocked --> AuthenticatedUnlocked: Valid 4-Digit PIN (POST /api/lock/unlock)
  SessionLocked --> Unauthenticated: 5 Failed Attempts or Sign Out
  AuthenticatedUnlocked --> Unauthenticated: Sign Out (POST /api/auth/logout)
```

### Invariants
- When `isAuthenticated` is `true`, `isDemoMode` and `crystal_dev_mode_active` are forcibly cleared so live financial data is never written to browser dev storage.
- While in `SessionLocked` (`HTTP 423`), the server blocks all `/api/data` and `/api/enable-banking/*` endpoints; the client renders only [`components/LockScreen.tsx`](../components/LockScreen.tsx).

---

## 2. Client-Server Persistence & 3-Way Merge State Machine

**Owners**: [`hooks/useFinancialPersistence.ts`](../hooks/useFinancialPersistence.ts), [`utils/threeWayMerge.ts`](../utils/threeWayMerge.ts), [`server/src/index.ts`](../server/src/index.ts)

```mermaid
stateDiagram-v2
  [*] --> BaselinePending: loadAllFinancialData()
  BaselinePending --> Saved: Capture savedSlicesRef
  Saved --> Unsaved: Slice Reference Changed (markSliceDirty)
  Unsaved --> Saving: 900ms Debounce Elapsed
  Saving --> Saved: 200 OK (Update savedSlicesRef & lastUpdatedAtRef)
  Saving --> MergingConflict: 409 Conflict (currentUpdatedAt mismatch)
  MergingConflict --> Saved: GET /api/data + threeWayMerge + Retry 200 OK
  MergingConflict --> UnsavedError: Retry Failed
  Saving --> UnsavedRetry: Network / 5xx Error (Exponential Backoff 5s..30s)
  UnsavedRetry --> Saving: Backoff Timer or 'online' Event
```

### Keyed Merge Rules ([`utils/threeWayMerge.ts`](../utils/threeWayMerge.ts))
- Standard entity arrays merge by `item.id`.
- `recurringTransactionOverrides` merges by composite key `${recurringTransactionId}::${originalDate}`.
- `priceHistory` (per-ISIN array) merges by `entry.date`.
- On a successful 409 retry, `savedSlicesRef.current` is updated with the **merged** slices (`mergedSlicesRef.current`), and `refreshFromServer()` adopts the merged server state if no newer local edits are pending.

---

## 3. Enable Banking Connection & Sync State Machine

**Owners**: [`hooks/useEnableBankingSync.ts`](../hooks/useEnableBankingSync.ts), [`pages/EnableBankingCallback.tsx`](../pages/EnableBankingCallback.tsx), [`server/src/index.ts`](../server/src/index.ts)

```mermaid
stateDiagram-v2
  [*] --> PendingAuth: POST /api/enable-banking/authorize
  PendingAuth --> Ready: OAuth Callback -> POST /api/enable-banking/session
  PendingAuth --> RequiresUpdate: Authorization Failed / Cancelled
  Ready --> Syncing: Manual or Sync-All Triggered
  Syncing --> Ready: Accounts + Pages Fetched & Deduped
  Syncing --> RateLimited: ASPSP_RATE_LIMIT_EXCEEDED (Backoff 6h)
  Syncing --> RequiresUpdate: Expired / Revoked Consent Error Code
  RateLimited --> Syncing: Cooldown Elapsed
  RequiresUpdate --> PendingAuth: Reconnect Bank
```

### Invariants
- `syncingConnectionIdsRef` prevents concurrent sync runs for the same `connectionId`.
- `status` is never persisted as `'pending'` during a routine sync so closing the browser mid-sync does not strand the connection.
- `transactionsRef.current` is updated synchronously inside `handleSaveTransaction`, ensuring sequential multi-bank syncs (`Sync All`) deduplicate against transactions imported by earlier banks in the same batch.

---

## 4. Recurring Obligation & Occurrence Lifecycle

**Owners**: [`utils/scheduleModel.ts`](../utils/scheduleModel.ts), [`utils/subscriptionsModel.ts`](../utils/subscriptionsModel.ts)

- **Series States**: `active` (`!pausedAt && (!endDate || endDate >= today)`), `paused` (`Boolean(pausedAt)`), `cancelled` (`endDate < today`).
- **Occurrence States**:
  - `upcoming`: `date >= today` and not yet posted or skipped.
  - `overdue`: `date < today` (within `OVERDUE_DAYS` window) and no matching ledger transaction (`recurringSourceId === series.id` or fuzzy date/amount match).
  - `posted`: Matched to a ledger transaction.
  - `skipped`: Matched to a `RecurringTransactionOverride` with `isSkipped: true`.
  - `expired`: Archived one-time `BillPayment` (`status === 'expired'`).
