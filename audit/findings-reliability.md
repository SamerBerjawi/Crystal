# Crystal — Reliability Findings

Reviewed 2026-10-13 at commit `2073eda`. Scope is reliability only. Routes, endpoints and workflow IDs (W1–W40) follow `audit/inventory.md`. No application code was modified. All harnesses and scripts lived in the session scratchpad.

**Verification labels**
- **Reproduced**: confirmed by running the code. That covers the test suite, `tsc`, the real Express routers against an in-memory DB stub (`FOR UPDATE` row locks implemented, 20 ms of query latency), the backend pointed at an unreachable Postgres, `tsx` probes of utility functions, and a browser check in Chrome 152.
- **Code**: confirmed by reading the cited code paths.

Suspicions that couldn't be confirmed are under **Unverified** at the end.

---

### [REL-001] `/api/enable-banking/pending` races with `/api/data`: an acknowledged save is reverted and the client is left permanently out of sync
- Severity: **Critical**
- Location: `server/src/enableBanking.ts:275-298` (and the `DELETE` at `:331-356`) does a read-modify-write with no transaction or row lock, while `server/src/data.ts:41-46` uses `SELECT … FOR UPDATE`. The trigger is `App.tsx:1941-1946`, which fires `POST /pending` without awaiting it and in the same tick calls `savePartialDataWithRetry({ enableBankingConnections })`. `pages/EnableBankingCallback.tsx:154-160` does the same with `DELETE`.
- Evidence (reproduced): the real `data` and `enableBanking` routers were mounted against the DB stub and the two requests were sent concurrently, exactly as `App.tsx` does.
  ```
  == pending request lands 5–25 ms after the data save
  pending -> 200 Pending connection stored
  save    -> 200 Data saved successfully, lastUpdatedAt T1        ← client told it succeeded
  stored  -> {"enableBankingConnections":[],"lastUpdatedAt":"T0",…} ← save overwritten, timestamp rolled back
  client next save (prev=T1) -> 409 Data conflict: your local copy is stale

  == requests start together
  stored  -> {…"lastUpdatedAt":"T1"}  ← enableBankingPendingConnections lost instead
  ```
  The plain `SELECT` in `/pending` doesn't wait for the `FOR UPDATE` lock that `/api/data` holds. Whichever writes last overwrites the whole JSONB blob with its stale snapshot.
- Impact: connecting a bank (W13) can do either of two things.
  - It can silently revert the user's last acknowledged save and roll `lastUpdatedAt` back. Every later save from that tab then gets a 409, which the client ignores (REL-002). All edits for the rest of the session are lost on the next reload.
  - Or it can drop the pending connection, so the OAuth callback can't recover it on another device.
- Suggested fix:
  - Do the `/pending` and `DELETE /pending` writes inside a transaction with `SELECT … FOR UPDATE`, or better, an atomic `UPDATE financial_data SET data = jsonb_set(...)`. Neither should touch `lastUpdatedAt`.
  - Longer term, store pending connections in their own table.
  - On the client, `await` the `/pending` call before triggering the save.
- Effort: **S**

### [REL-002] Save failures (409, 401/403, 5xx, offline) are silently dropped and never recovered
- Severity: **High**
- Location: `App.tsx:920-934` (`postData` returns `false` for any non-OK response and swallows exceptions), `:936-958`, `:1154-1195` (`persistDirtySlices`); `server/src/authConfig.ts:6` (`SESSION_DURATION_MS` default 12 h, with no refresh)
- Evidence (code):
  - `grep -n "409\|conflict" App.tsx hooks/*.ts` finds **no** client handling of conflicts.
  - On a failed save, `lastUpdatedAtRef` is never refreshed from the server's `currentUpdatedAt`. Dirty slices stay set, but the effect only re-runs when `debouncedDirtySignal` changes, which means on the next edit.
  - There's no toast, banner or "unsaved" indicator for save status anywhere in the app. Only 12 `toast` calls exist in `App.tsx`, none of them in the save path.
- Impact: once any save fails, every later save fails the same way and the user never finds out. Common triggers:
  - a second tab or device editing the same account (the older tab gets 409s forever)
  - the 12-hour session expiring while the tab stays open (403)
  - REL-001
  - a brief network or server blip

  Everything the user enters afterwards exists only in memory and is lost on reload.
- Suggested fix:
  - Have `postData` return the status code.
  - On **409**: fetch `/api/data`, merge or offer "reload / overwrite", and update `lastUpdatedAtRef`.
  - On **401/403**: show a re-login prompt and keep dirty state.
  - On **5xx or offline**: back off and retry on a timer, independent of new edits.
  - Show a persistent "Saving… / Saved / Not saved" status in the header.
- Effort: **M**

### [REL-003] Edits made while a save is in flight are dropped; overlapping saves conflict with each other
- Severity: **High**
- Location: `App.tsx:1154-1195`
- Evidence (code):
  ```ts
  const dirtyKeys = Array.from(dirtySlicesRef.current);       // snapshot taken
  …
  succeeded = await savePartialData(partialPayload);          // network round-trip
  if (succeeded) { dirtySlicesRef.current.clear(); … }        // clears keys dirtied DURING the await
  ```
  - If a slice is edited while the request is in flight, its key is cleared on success even though its new value was never sent. The follow-up effect run then sees `dirtySlicesRef.current.size === 0` and returns.
  - There's also no in-flight guard. When a save takes longer than the 900 ms debounce, a second `persistDirtySlices` starts with the same `previousUpdatedAt`. One of the two gets a 409, which feeds into REL-002.
- Impact: on slow connections, or with large payloads, quick consecutive edits are silently lost. That covers typing in forms, bulk categorizing, drag-reordering, and rules applying to many transactions (W17, W22, W35). The loss only shows after a reload.
- Suggested fix:
  - Take a snapshot and remove only the keys that were sent: `dirtyKeys.forEach(k => set.delete(k))`, and only if the slice's value hasn't changed since the snapshot (compare by reference).
  - Serialize saves with an in-flight promise or ref. Queue a follow-up save if anything became dirty during the request.
- Effort: **S**

### [REL-004] The save on tab close / reload fails once data passes 64 KiB, which is roughly 250 transactions
- Severity: **High**
- Location: `App.tsx:1197-1208` (`beforeunload` calls `saveData(currentData, { keepalive: true })` with the **full** dataset); the error is swallowed by `.catch(() => { })`
- Evidence (reproduced):
  - In the built-in browser (Chrome/152):
    ```
    keepalive_34KB : sent, HTTP 405
    keepalive_64KiB: TypeError: Failed to fetch
    keepalive_70KB : TypeError: Failed to fetch
    plain_70KB     : sent, HTTP 405
    ```
  - The demo dataset is already 34,994 bytes with 24 transactions, about 266 bytes each. **Any user with more than about 247 transactions** goes over the 64 KiB keepalive quota.
- Impact: changes made within the last ~900 ms (the debounce window), plus anything still unsaved because of REL-002 or REL-003, are lost on close, reload, or the error screen's "Reload" button (REL-011). This hits essentially every real user, silently.
- Suggested fix:
  - In `beforeunload`, send only the dirty slices as a partial payload (usually small).
  - Fall back to `navigator.sendBeacon` with a size check.
  - Save more eagerly on `visibilitychange` → `hidden`.
  - Warn with `event.preventDefault()` when unsaved changes exceed the limit.
- Effort: **S**

### [REL-005] Backend process crashes when Postgres is unreachable or the pool is exhausted
- Severity: **High**
- Location: `server/src/auth.ts:66` and `server/src/data.ts:39` (`const client = await db.connect();` **outside** `try`); Express `^4.19.2` doesn't catch rejected async handlers; `server/src/database.ts:5-15` (no `pool.on('error')` handler); `max: 20`, `connectionTimeoutMillis: 5000`
- Evidence (reproduced): backend started with `DATABASE_HOST=127.0.0.1 DATABASE_PORT=1`, then one unauthenticated request was sent:
  ```
  $ curl -X POST .../api/auth/register -d '{…}'    →  HTTP 000 (connection dropped)
  $ curl .../api                                   →  server no longer responding
  log: Error: connect ECONNREFUSED 127.0.0.1:1 … Node.js v24.18.0
       PROCESS EXITED code=1
  ```
- Impact: a DB restart, a network blip, or more than 20 concurrent saves (the pool times out after 5 s) turns into an unhandled rejection that kills the whole API for all users. `restart: unless-stopped` brings it back, but in-flight saves fail (and REL-002 then loses them). Anyone can trigger this unauthenticated through `/register`.
- Suggested fix:
  - Move `db.connect()` inside `try`/`finally`. Guard `client.release()`.
  - Add `db.on('error', …)` and a `process.on('unhandledRejection')` logger.
  - Wrap async routes (`express-async-errors`, or upgrade to Express 5, which the frontend already uses).
  - Add a final error-handling middleware that returns JSON.
- Effort: **S**

### [REL-006] CSV import silently corrupts European-format and thousands-separated amounts
- Severity: **High**
- Location: `components/ImportWizard.tsx:323-342`
- Evidence (reproduced with the exact parsing expressions):
  ```
  "12,50"      single-column → 12        in/out columns → 1250
  "1.234,56"   single-column → 1.234     in/out columns → 1.23456
  "-1,234.56"  single-column → -1        in/out columns → -1234.56
  ```
  `parseFloat` stops at the first `,` in single-column mode. In in/out mode every comma is stripped, so a decimal comma multiplies the value by 100. Both pass the `!isNaN` check, so no row error is shown.
- Impact: importing a typical EU bank export (decimal comma; the app targets 2,500 EU banks and defaults to EUR) writes wrong amounts into the ledger. Balances, budgets, forecasts and reports are then wrong (W37). Fixing it means finding and deleting the bad import.
- Suggested fix:
  - Add a decimal-separator option to the wizard, auto-detected from samples.
  - Parse with a strict, locale-aware parser that rejects ambiguous values.
  - Flag rows where the parsed value round-trips differently from the source text.
- Effort: **S**

### [REL-007] Self-hosted installs opened on `localhost` are treated as dev: restoring a backup switches the app into demo mode, and later edits are never saved
- Severity: **High**
- Location: `App.tsx:914-918` (`isDevEnvironment` = hostname is `localhost`/`127.0.0.1` **or** `import.meta.env.DEV`); `:1134-1142` (`handleRestoreData` → `setIsDemoMode(true)` when `isDevEnvironment`); `:922` (`postData` returns `false` when `isDemoMode`); `:1006-1018` (startup prefers the IndexedDB dev cache over an empty server response and enters demo mode)
- Evidence (code): `isDevEnvironment` is computed in the browser from the hostname, not the build mode. A production Docker install browsed at `http://localhost:7157` (the compose default) therefore qualifies. In that case, Data Management → Smart Restore:
  1. saves the restored snapshot once (`saveData` runs before the state update lands),
  2. then sets `isDemoMode = true`.

  From then on, `postData` short-circuits and every edit is local only, while the UI still looks signed in.
- Impact: a self-hoster restoring a backup on the same machine (W37) loses everything they do afterwards. In addition, every state change is mirrored into IndexedDB (`saveDevCache`), and a fresh account with an empty server blob can come up in demo mode showing stale cached data.
- Suggested fix: gate all dev-cache and demo-mode behavior on `import.meta.env.DEV` only. Never turn on demo mode as a side effect of restore.
- Effort: **S**

### [REL-008] A temporary error during startup signs the user out and revokes their server session
- Severity: **Medium**
- Location: `hooks/useAuth.ts:136-178` (`checkAuthStatus`), `:47-59` (`signOut` POSTs `/api/auth/logout`)
- Evidence (code): any non-401/403 failure triggers `catch → signOut()`. That includes a 5xx from `/api/auth/me` or `/api/data`, a network error, or a JSON parse error. `signOut()` calls `/api/auth/logout`, which sets `revoked_at` on the session.
- Impact: a backend restart (REL-005), a deploy, or flaky Wi-Fi during page load logs the user out. Their valid session is destroyed server-side instead of being retried.
- Suggested fix:
  - Only clear auth on 401/403.
  - For other errors, show a "Can't reach server — Retry" state, and retry with backoff without calling logout.
- Effort: **S**

### [REL-009] Bank-sync de-duplication drops genuine transactions that look alike
- Severity: **Medium**
- Location: `App.tsx:2548-2575` (fingerprint is `accountId|date|amount|description|merchant`), with the IDs built at `:2430-2443`
- Evidence (code): the match is `existing = byId || bySureId || byFingerprint`. Inside one import batch, the first transaction is added to `existingFingerprints`. A second transaction with a **different** provider `transaction_id` but the same date, amount and description therefore matches by fingerprint and is skipped.

  Repro: one sync containing two €3.50 "COFFEE BAR" card payments on the same day, with distinct `transaction_id`s. Only one is imported.
- Impact: real spending goes missing (W14). Ledger totals stop matching the synced bank balance, and nothing tells the user why.
- Suggested fix:
  - Use the fingerprint only when the provider gives no stable ID.
  - Never fingerprint-match two transactions that both have different provider IDs.
  - Count duplicates (multiset) rather than using set membership.
- Effort: **S**

### [REL-010] Bank sync: no guard against concurrent runs, interrupted syncs stay stuck as "pending", and failures aren't shown
- Severity: **Medium**
- Location: `App.tsx:2456-2605` (`handleSyncEnableBankingConnection`), `:2607-2619` (`handleSyncAllEnableBankingConnections`)
- Evidence (code):
  - **No in-flight guard.** Per-account or per-connection "Sync" buttons (AccountDetail views, Integrations) aren't gated on `isSyncingBanks`. A second run dedupes against the `transactions` captured when it started, so overlapping runs can import the same new transactions twice.
  - **Stuck status.** The sync first persists `status: 'pending'` (autosaved after 900 ms). If the tab closes mid-sync, `pending` stays saved, and "Sync all" filters out `c.status !== 'pending'` forever.
  - **Silent failure.** `lastError` is written at `:2603` but **rendered nowhere** (`grep lastError components pages` finds only writes). The Dashboard, Accounts and Transactions sync buttons give no success or failure feedback.
  - **Silent truncation.** Paging stops at 100 pages with no warning, but `lastSyncedAt` is still advanced (`:2537-2540`), so incremental syncs skip the missed range for good.
- Impact: duplicate or missing transactions, and connections that quietly stop syncing (W14).
- Suggested fix:
  - Add a per-connection in-flight lock and use a separate `syncing` status that isn't persisted.
  - Show `lastError` and a toast summary ("12 new, 3 updated").
  - Only advance `lastSyncedAt` when paging completed.
- Effort: **M**

### [REL-011] One page crash breaks every page until reload; global components have no error boundary
- Severity: **Medium**
- Location: `App.tsx:301-345` (`ErrorBoundary`), `:2872-2887` (the only placement: around `renderPage()` inside `<main>`)
- Evidence (code):
  - `ErrorBoundary` has no reset path (no `componentDidUpdate`, no `key`, no reset prop) and stays mounted across navigation. After any page throws, clicking another page in the sidebar keeps showing "Something went wrong".
  - `Sidebar`, `MobileNavbar`, `CommandCenter`, `OnboardingModal`, `NotificationCenter`, the quick-add `AddTransactionModal` and all providers are **outside** any boundary. There's none in `index.tsx` either, so a throw there unmounts the whole app to a blank page.
  - `WidgetErrorBoundary` is used only on the Dashboard.
- Impact: one bad record (see REL-013) makes the app unusable until reload. The only recovery offered is "Reload", which loses unsaved changes (REL-004).
- Suggested fix:
  - Key the boundary on the current route (`key={currentPage + viewingAccountId}`) or reset it on navigation.
  - Add a top-level boundary in `index.tsx`.
  - Flush pending saves before reloading from the error screen.
  - Use `WidgetErrorBoundary` around heavy sections on the other pages.
- Effort: **S**

### [REL-012] No timeouts on any network call
- Severity: **Medium**
- Location:
  - 22 `fetch(` call sites across `server/src`, `App.tsx`, `pages`, `components`, `hooks`, `utils` and `src`. There are **0** `AbortController` / `AbortSignal.timeout` uses (the one `signal` match is a process signal in `server/src/index.ts`).
  - Key spots:
    - server: `enableBanking.ts:52` (outbound to Enable Banking), `smartFetcher.ts:19`
    - client: `src/services/twelveDataService.ts:15,42,73`
    - `App.tsx:2505-2535` (up to 100 sequential page fetches per account)
    - `pages/Investments.tsx:702` and `:734`
- Evidence (code):
  - None of these calls passes a `signal`.
  - `Investments.handleUpdateAllPrices` sets `isUpdatingAllPrices` and only clears it in `finally` (`:768`). One hanging smart-fetch target keeps the "Syncing…" state and blocks re-runs (`:721`) indefinitely.
  - Server-side outbound calls hold an Express request (and its client) for as long as the remote host stalls.
- Impact: a slow third party freezes the UI (price sync, bank sync) and ties up backend connections. Nothing tells the user it's stuck.
- Suggested fix:
  - Add a shared `fetchWithTimeout` (e.g. `AbortSignal.timeout(15000)`).
  - Add bounded retries with jitter for idempotent GETs.
  - Use a per-request timeout plus an overall deadline for paged bank syncs.
- Effort: **S**

### [REL-013] Restored or saved data isn't validated per record, and bad dates are silently coerced
- Severity: **Medium**
- Location:
  - `components/SmartRestoreModal.tsx:87-105` (only checks that the file is a non-empty object or array)
  - `App.tsx:1100-1152` (`handleRestoreData` loads the data and immediately does a **full** `saveData` to the server)
  - `server/src/data.ts` (no schema check; see SEC-005)
  - `utils.ts` `parseLocalDate`
- Evidence (reproduced): `parseLocalDate` never throws and never returns Invalid Date:
  ```
  undefined      -> Tue Oct 13 2026  (today)
  null           -> Tue Oct 13 2026  (today)
  123            -> Tue Oct 13 2026  (today)
  "2026-13-45"   -> Sun Feb 14 2027  (rolled over)
  ```
- Impact:
  - A hand-edited or older-version backup with missing or invalid fields is written straight to the server.
  - Transactions with bad dates silently land on "today" or a shifted date, which distorts reports, budgets and forecasts.
  - Structurally wrong records (e.g. a string where an array is expected) can crash pages. With REL-011 that crash comes back on every load, because the bad data is now on the server.
- Suggested fix:
  - Validate restores with the existing zod schemas (`server/src/schemas.ts`), shared with the client, and show a per-record error report.
  - Make `parseLocalDate` return `null` or throw on invalid input, and handle that at call sites.
  - Validate on the server too.
- Effort: **M**

### [REL-014] The test suite can't fail, isn't run in CI, and doesn't cover the critical paths
- Severity: **Medium**
- Location: `utils.test.ts`; `server/src/*.test.ts`; `.github/workflows/build-and-publish.yml`
- Evidence (reproduced): all 7 test scripts pass:
  ```
  utils.test.ts           9/9 ✓   EXIT 0
  concurrency.test.ts     3/3 ✓   crypto.test.ts 2/2 ✓   partialSync.test.ts 2/2 ✓
  rateLimit.test.ts       3/3 ✓   savePath.test.ts 4/4 ✓  schemas.test.ts 4/4 ✓
  npm run lint (tsc --noEmit)  → exit 0;  server tsc --noEmit → clean
  ```
  - **They can't fail the build.** Each case is wrapped in `try { … } catch (e) { console.error(...) }`, and no file sets `process.exitCode`, so a failing assertion still exits 0.
  - **They test copies.** `concurrency.test.ts`, `partialSync.test.ts` and `savePath.test.ts` import nothing; they redefine `checkConflict`, the merge, and `saveDataWithRetry` locally. They'd still pass if `data.ts` or `App.tsx` broke. `schemas.test.ts` tests a validator production never calls (SEC-005).
  - **CI runs no tests.** The workflow only builds and pushes Docker images. There's no `test` script in either `package.json`.
- Critical areas with **no** tests:
  - the client save pipeline (REL-002/003/004)
  - `data.ts` and `enableBanking.ts` route handlers, including REL-001
  - auth routes and session expiry
  - Enable Banking mapping and dedupe (REL-009)
  - the CSV import parser (REL-006)
  - the forecasting engine and synthetic loan/card payments beyond one utility
  - the rule engine (`utils/rules.ts`)
  - investment cost basis (`utils/investments.ts`)
  - restore/merge
- Impact: none of the regressions above would be caught, and the passing output gives a false sense of safety.
- Suggested fix:
  - Adopt Vitest (it fits the Vite toolchain) and convert the scripts to real assertions.
  - Test the real modules: supertest against the routers with a pg-mem or Testcontainers DB, and extract the save pipeline into a hook that can be tested.
  - Add `npm test` to the workflow before the image push.
- Effort: **M**

### [REL-015] Weak typing at the boundaries: 279 `any`s, non-strict TS, and API data cast without checks
- Severity: **Low**
- Location:
  - root `tsconfig.json` (no `strict`)
  - 279 occurrences of `: any` / `as any` / `any[]` (App.tsx 29, Rules.tsx 17, Dashboard.tsx 14, enableBanking.ts 10)
  - `hooks/useAuth.ts:171` (`return data as FinancialData`)
  - `App.tsx:2463, 2517` (`session?.accounts || []`, `txResponse?.transactions?.booked || … || []` typed `any`)
- Evidence (code / `grep -c`): API responses from `/api/data`, Enable Banking and Twelve Data go straight into state with no runtime checks. For example, `fetchAllExchangeRates` assigns `result.rate` without confirming it's a number. Missing rates then fall back to `|| 1` in `convertToEur` (`utils.ts:142`), silently treating a foreign amount as EUR 1:1.
- Impact: unexpected shapes surface as runtime crashes (REL-011) or silently wrong numbers instead of type errors or handled cases.
- Suggested fix:
  - Turn on `strict` (starting with `strictNullChecks`).
  - Validate external responses with zod at the fetch boundary.
  - Treat a missing FX rate as an error state, not 1.
- Effort: **L** (incremental)

### [REL-016] Empty catch blocks hide failures, including the save before logout
- Severity: **Low**
- Location: 11 empty `catch {}` blocks and 5 `.catch(() => {})` handlers outside tests. Notable ones:
  - `App.tsx:1273`: `saveData(latestDataRef.current).catch(err => { }).finally(finalizeLogout)`. Logout continues whether or not the save worked, and `saveData` reports failure by returning `false`, which nobody checks.
  - `App.tsx:1204`: the unload save (REL-004).
  - `App.tsx:385, 763, 2062, 2153, 2169, 2188`
  - `utils/browserCache.ts:42, 115, 126`
  - `hooks/useSyncedBillMatcher.ts:211`
  - `pages/Investments.tsx:733`
- Evidence (code): see the lines above.
- Impact: signing out with unsaved changes discards them with no warning. Other swallowed errors make field problems impossible to diagnose.
- Suggested fix:
  - Check the save result on logout; on failure, ask "You have unsaved changes — retry / sign out anyway".
  - Log, at minimum, in the remaining catches.
- Effort: **S**

### [REL-017] Password change: the password update and session revocation aren't atomic
- Severity: **Low**
- Location: `server/src/users.ts:65-69`
- Evidence (code): `UPDATE users SET password` and `UPDATE user_sessions SET revoked_at` are two separate `db.query` calls with no transaction.
- Impact: if the second query fails, the client gets a 500 ("Failed to update password") even though the password **was** changed, and old sessions stay valid.
- Suggested fix: run both statements in one transaction.
- Effort: **S**

---

## Unverified

- **Account deletion may remove unrelated warrants or investment transactions** (`App.tsx:1453-1455`). It filters with `tx.symbol !== accountToDelete.symbol` and `w.isin !== accountToDelete.symbol`. For a cash account `symbol` is `undefined`, so any warrant without an `isin` (or transaction without a `symbol`) would be deleted too. The types mark those fields as required, and I didn't confirm whether real or legacy data contains records without them.
- **Chunk-reload loop key** (`App.tsx:15-31`): the sessionStorage key uses the first 40 characters of `factory.toString()`. In a minified build, the `import()` wrappers for different pages may share that prefix, causing a needless reload or skipped retry. I didn't build and inspect production output.
- **StrictMode double-exchange of the OAuth code** (`pages/EnableBankingCallback.tsx`): in dev, React StrictMode runs effects twice, so the single-use code may be exchanged twice and show a spurious error. Production isn't affected; not tested.
- **Twelve Data rate limits**: `handleUpdateAllPrices` fires all holdings at once with `Promise.allSettled`. On the free tier (8 req/min), portfolios with more than 8 holdings will probably see partial failures every run. Failures are reported, but there's no throttling. Not tested against the live API.
- **The `lastUpdatedAt` token is a local-time string with seconds precision** (`utils.ts:174`). I couldn't build a false-positive or false-negative conflict from equality checks alone. Still, a client-generated clock value is a fragile version token compared with a server-side counter.

---

## Coverage

**Covered**
- **Error handling:** `App.tsx` save, load, logout and sync paths; `useAuth`; all server routes; counts of empty catches.
- **UI states:** the global loading gate; save-status feedback (none); sync and price-sync feedback; error boundaries.
- **External calls:** every `fetch` call site, checked for timeouts, retries and fallbacks.
- **Races:**
  - the client dirty-slice pipeline (code)
  - `/pending` vs `/api/data` (reproduced with the real routers)
  - bank sync concurrency (code)
- **DB transactions:** every multi-statement handler (`register`, `data POST`, `change-password`, `pending`).
- **Validation:** CSV import amounts and dates, restore, `parseLocalDate`, the server-side blob.
- **Typing:** `any` counts, tsconfig strictness, boundary casts.
- **Tests:** ran all 7 scripts and both type checks.

**Not covered or partial**
- The ~25k lines of page components were reviewed through targeted searches and the main flows (save, sync, import, restore, prices), not line by line. Per-page empty and loading states in Forecasting, Reports, Rules and Schedule weren't checked one by one.
- I didn't use subagents. The review followed the data-integrity paths instead.
- The forecasting and rule-engine math wasn't reviewed for correctness. That's functional rather than reliability, and it's untested (REL-014).
- No live Postgres was available (no Docker or `psql`). REL-001 used a DB stub that models `FOR UPDATE` locking and plain-`SELECT` non-blocking. Real interleavings depend on timing, but the client fires both requests in the same tick.
- No real Enable Banking or Twelve Data calls were made.

---

## Top 5

1. **REL-001 (Critical):** Connecting a bank fires `/pending` and a data save in the same tick. The pending handler overwrites the blob without a lock. Reproduced: an acknowledged save is reverted, `lastUpdatedAt` rolls back, and the tab gets 409 on every later save.
2. **REL-002 (High):** All save failures are silent and never recovered. There's no 409 handling, no session-expiry prompt, no retry timer and no "unsaved" indicator. A second tab, a 12-hour session expiry, or a brief outage quietly loses all later edits.
3. **REL-004 + REL-003 (High):** The tab-close save uses a keepalive request, which Chrome rejects at 64 KiB or more (reproduced; reached at roughly 250 transactions). Edits made while a save is in flight are dropped from dirty tracking.
4. **REL-005 (High):** One request while Postgres is unreachable (or the pool is exhausted) crashes the backend process (reproduced, exit code 1), because `db.connect()` sits outside `try` on Express 4.
5. **REL-006 + REL-007 (High):** The CSV import silently turns `12,50` into 12 or 1250 (reproduced). Restoring a backup on a `localhost` self-hosted install flips the app into demo mode, and nothing is saved after that.
