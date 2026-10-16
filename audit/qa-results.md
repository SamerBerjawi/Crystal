# Crystal — QA Results

Started 2026-10-13 at commit `2073eda`. Chunks follow `audit/inventory.md` §5. Each chunk has:
- a results table, run at **desktop 1440×900** and **mobile 375×812**
- a bug report for every failure
- items found in the app but missing from the inventory

## Test environment

| Component | Setup |
|---|---|
| Database | Real **PostgreSQL 18** (`embedded-postgres`, scratchpad, port 54329). Tables are created by the app's own `initializeDatabase()`. |
| Backend | `server/src/index.ts` via `tsx` on :3001, `NODE_ENV=development`, random `JWT_SECRET` |
| Frontend | Production build (`vite build`) served by `vite preview` on :4173, `/api` proxied to :3001 |
| Host | `http://crystal.localhost:4173`. **Not** `localhost`, so the client's `isDevEnvironment` branch (REL-007) doesn't change behavior; this matches a real self-hosted install. |
| Accounts | No credentials were supplied (the prompt kept the `[credentials]` placeholder). Every test registers its **own throwaway account** through `POST /api/auth/register` and seeds it with the demo dataset (`tests/e2e/fixtures/seed.json`: 15 accounts, 24 transactions, 8 investment transactions, 8 recurring, 5 budgets, 4 goals, 6 tasks, 2 warrants, 2 invoices). The shared password is in `tests/e2e/fixtures/test.ts`. |
| Tests | Playwright 1.56.1, Chromium. `tests/e2e/` has its own `package.json`, so the app's `package.json` is untouched. Run with `cd tests/e2e && npx playwright test <chunk-dir>`. |

"Pass/Fail" is per viewport. A row marked **Pass (1440) / Fail (375)** behaves differently by width.

---

## Chunk A — Auth, session & persistence (W1–W10)

Spec: `tests/e2e/chunk-a-auth/auth.spec.ts`. **Runs: 54** (27 tests × 2 viewports) → **29 pass, 24 fail, 1 skipped** (mobile-only test on desktop).

| # | Workflow | Item tested | 1440 | 375 | Bug |
|---|---|---|---|---|---|
| A1 | W1 Sign up | Happy path: account created, onboarding opens | Pass | Pass | |
| A2 | W1 | Duplicate email → "Email already in use." | Pass | Pass | |
| A3 | W1 | Invalid email blocked by `type=email` | Pass | Pass | |
| A4 | W1 | Password shorter than advertised "Min. 8 characters" rejected | **Fail** | **Fail** | QA-A-007 |
| A5 | W1 | 300-char first name → specific validation | **Fail** | **Fail** | QA-A-008 |
| A6 | W2 Sign in | Happy path: seeded data shown | Pass | Pass | |
| A7 | W2 | Wrong password → "Invalid credentials" | Pass | Pass | |
| A8 | W2 | 6th wrong attempt → rate-limit message | Pass | Pass | |
| A9 | W2 | Double-click Sign In → one login request | Pass | Pass | |
| A10 | W3 Session restore | Refresh keeps session and data | Pass | Pass | |
| A11 | W3 | Transient 500 on `GET /api/data` at startup doesn't sign user out | **Fail** | **Fail** | QA-A-006 |
| A12 | W4 Sign out | Sign out → sign-in screen; refresh and Back don't restore; `/api/auth/me` = 401 | Pass | Pass* | |
| A13 | W4 | Mobile: Sign Out reachable from Dashboard | n/a | **Fail** | QA-A-010 |
| A14 | W5 Password reset | "Forgot password?" starts a reset flow | **Fail** | **Fail** | QA-A-011 |
| A15 | W6 Change password | Mismatched confirmation rejected | Pass | **Fail** | QA-A-005 |
| A16 | W6 | Wrong current password → error | Pass | **Fail** | QA-A-005 |
| A17 | W6 | Happy path: signed out; new password works, old fails | Pass | **Fail** | QA-A-005 |
| A18 | W7 Edit profile | Change persists (`PUT /api/users/me` 200, server value updated) | Pass | Pass | |
| A19 | W7 | Failed save (500) reported, not "success" | **Fail** | **Fail** | QA-A-009 |
| A20 | W8 Demo mode | Loads demo data; zero `POST /api/data` | Pass | Pass | |
| A21 | W9 Onboarding | Skip → doesn't reappear on refresh | Pass | Pass | |
| A22 | W9 | Completion follows the account to a new browser | **Fail** | **Fail** | QA-A-012 |
| A23 | W10 Autosave | Edit saved to server (after app settles) | Pass | Pass | |
| A24 | W10 | Edit made right after page load is saved | **Fail** | **Fail** | **QA-A-001** |
| A25 | W10 | Network failure on save surfaced to user | **Fail** | **Fail** | QA-A-002 |
| A26 | W10 | Two tabs: stale tab told about 409 conflict | **Fail** | **Fail** | QA-A-003 |
| A27 | W10 | Session revoked elsewhere → re-login prompt on next edit | **Fail** | **Fail** | QA-A-004 |

\* A12 on mobile passes only via Settings → menu drawer → avatar → Sign Out (see QA-A-010).

### Bug reports — Chunk A

#### QA-A-001 — Edits made in the first ~1 s after a page load are silently discarded
- **Severity:** Critical (silent data loss on the most common path: open the app and immediately change something)
- **Steps:**
  1. Sign in and open `/preferences`, or refresh any page.
  2. Within about 1 s of load, toggle "Exclude Internal Transfers from Charts".
  3. Wait 5 s, then refresh.
- **Expected:** a `POST /api/data` is sent and the toggle stays on after refresh.
- **Actual:** the switch flips in the UI, but **no request is ever sent**, and the change is gone after refresh. Measured with a request log (`tests/e2e/diagnostics/autosave-probe.spec.ts`):

  | edit delay after load | UI changed | POST sent | server updated |
  |---|---|---|---|
  | 0 ms | yes | no | **no** |
  | 300 ms | yes | no | **no** |
  | 1000 ms | yes | yes | yes |
  | 2500 ms | yes | yes | yes |
- **Suspected cause:**
  - `App.tsx:1003` (`loadAllFinancialData(data, { skipNextSave: true })`) sets `skipNextSaveRef`.
  - The next debounced autosave pass, `App.tsx:1156` (`if (skipNextSaveRef.current) { skipNextSaveRef.current = false; dirtySlicesRef.current.clear(); return; }`), then clears **the user's** dirty slices along with the load's.
  - With the 900 ms debounce (`App.tsx:912`), any edit inside that window is dropped.
  - Fix: snapshot the load signature and skip only if nothing changed since load, or clear only the slices the load marked.

#### QA-A-002 — Save failures (network down) are invisible
- **Severity:** High
- **Steps:** Open Preferences. Block `POST /api/data` (offline). Toggle a preference and wait.
- **Expected:** an "unsaved / retrying / offline" indicator.
- **Actual:** nothing. The UI shows the change as applied, and it's lost on reload.
- **Suspected cause:** `App.tsx:920-934` `postData` swallows errors and returns `false`; `persistDirtySlices` (`App.tsx:1154-1195`) shows no UI and doesn't retry. Same root cause as REL-002.

#### QA-A-003 — Two-tab conflict (409) silently drops every later edit in the stale tab
- **Severity:** High
- **Steps:**
  1. Open `/preferences` in tab 1 and tab 2.
  2. Toggle a switch in tab 1, which saves with 200.
  3. Toggle a different switch in tab 2.
- **Expected:** tab 2 explains the conflict and offers reload or merge.
- **Actual:** `POST /api/data` → **409** (confirmed by the test). No message. Tab 2 keeps sending stale saves.
- **Suspected cause:** no 409 handling anywhere in the client (`grep 409 App.tsx hooks/*` is empty); `lastUpdatedAtRef` is never refreshed (`App.tsx:945,955`).

#### QA-A-004 — Revoked or expired session: edits fail with 403 and the user isn't told
- **Severity:** High
- **Steps:**
  1. Open Preferences.
  2. Change the password from another device (this revokes all sessions).
  3. Toggle a preference in the first browser.
- **Expected:** a "Session expired — sign in again" prompt, with unsaved changes kept.
- **Actual:** `POST /api/data` → **403** (confirmed). The UI stays "signed in", and the edit is lost.
- **Suspected cause:** `App.tsx:930`, where `postData` treats 401/403 like any other failure.

#### QA-A-005 — Mobile: modal footer buttons sit under the bottom nav bar and can't be tapped (password can't be changed on mobile)
- **Severity:** High (mobile)
- **Steps:** At 375×812, go to Personal Info → "Rotate Credentials", fill the form, and tap "Update Password" (or "Cancel").
- **Expected:** buttons tappable above the bottom navigation.
- **Actual:** the fixed `MobileNavbar` covers the sheet's footer. Playwright reports `<button aria-label="Forecasting" …> intercepts pointer events` on every retry, and the click times out after 45 s. The screenshot shows "CANCEL / UPDATE PASSWORD" behind the tab bar.
- **Suspected cause:** z-index and stacking. `components/Modal.tsx:61` puts its own `zIndexClass` on the sheet, while `components/MobileNavbar.tsx` is fixed and stacked above it. The sheet body has `pb-7` but no bottom inset for the 80 px nav. **This is likely to affect every `Modal`-based form on mobile.** Re-checked in later chunks.

#### QA-A-006 — A single failed data request during startup signs the user out and revokes their session
- **Severity:** Medium
- **Steps:** Signed in, reload while the first `GET /api/data` returns 500. Then reload again normally.
- **Expected:** a retry or error state; still signed in afterwards.
- **Actual:** the sign-in screen appears, and stays after the backend recovers. The server session was revoked.
- **Suspected cause:** `hooks/useAuth.ts:173-176`, where `checkAuthStatus` calls `signOut()` (which POSTs `/api/auth/logout`) for any non-401 error. Same as REL-008.

#### QA-A-007 — Sign-up accepts a 1-character password despite "Min. 8 characters"
- **Severity:** Medium
- **Steps:** Sign up with password `a`.
- **Expected:** a validation error and no account.
- **Actual:** account created. `POST /api/auth/register` → 201, and a later login with `a` succeeds.
- **Suspected cause:** `pages/SignUp.tsx:122-135` has no `minLength` or validation; `server/src/auth.ts:60-66` checks only that the password isn't empty. (SEC-009)

#### QA-A-008 — 300-character first name → HTTP 500 "Failed to register user."
- **Severity:** Medium
- **Steps:** Sign up with a 300-character first name.
- **Expected:** a field-level "too long" message (or a client-side `maxLength`).
- **Actual:** `POST /api/auth/register` → **500**, with the generic "Failed to register user.".
- **Suspected cause:** `users.first_name VARCHAR(255)` (`server/src/database.ts:38`). No length validation in `server/src/auth.ts:60` or `pages/SignUp.tsx`.

#### QA-A-009 — Profile save shows "Profile updated successfully!" even when the server rejects it
- **Severity:** Medium
- **Steps:** Personal Info → change Given Name → "Commit Changes" while `PUT /api/users/me` returns 500.
- **Expected:** an error message; the field isn't shown as saved.
- **Actual:** the browser `alert("Profile updated successfully!")` appears, and the local name changes.
- **Suspected cause:** `pages/PersonalInfo.tsx:46-49` calls `setUser` and then alerts success immediately. `hooks/useAuth.ts:183-205` `setUser` is fire-and-forget, and the error only goes to the auth `error` state, which this page doesn't display.

#### QA-A-010 — Mobile: no way to sign out from the main pages
- **Severity:** Medium (mobile)
- **Steps:** At 375 px, on Dashboard, Accounts or Transactions, look for Sign Out, in the page and in the "More" sheet.
- **Expected:** Sign Out reachable from anywhere, e.g. in the More sheet.
- **Actual:** these pages render no "Open navigation menu" button, and the More sheet has no Sign Out. The only path is More → Settings → menu button → avatar → Sign Out.
- **Suspected cause:** the menu button lives in `components/PageHeader.tsx:85-93` (Settings sub-pages); the mobile Dashboard/Accounts/Transactions views don't render it. `components/MobileNavbar.tsx` has no sign-out item.

#### QA-A-011 — "Forgot password?" does nothing
- **Severity:** Low
- **Steps:** Click "Forgot password?" on Sign In.
- **Expected:** a reset flow, or at least instructions.
- **Actual:** no navigation, no message.
- **Suspected cause:** `pages/SignIn.tsx:72` has no `onClick`, and no reset endpoint exists (SEC-010).

#### QA-A-012 — Onboarding reappears on every new browser or device
- **Severity:** Low
- **Steps:** Sign up, skip onboarding, then sign in from a fresh browser profile.
- **Expected:** onboarding stays completed for the account.
- **Actual:** the "Welcome, Qa!" onboarding opens again, as long as the account still has no accounts or budgets.
- **Suspected cause:** the completion flag is stored only in `localStorage` (`App.tsx:735`, `crystal-onboarding-complete`), not in the user's data.

### In the app but missing from the inventory — Chunk A
- **Sign-out on mobile** goes through a drawer (`Open navigation menu` in `PageHeader`) that only some pages render. The inventory implies the Sidebar is desktop-only.
- **Personal Info has a profile-picture upload** (`pages/PersonalInfo.tsx:30-44`, click the avatar → file input → data URL sent in `PUT /api/users/me`). It isn't listed under W7.
- **Onboarding includes a "Set a financial goal (Optional)" step** (`components/OnboardingModal.tsx:220`). The inventory lists currency → account → recurring only.
- **Changing your password signs you out everywhere** (all sessions revoked, `server/src/users.ts:69`, plus a client `signOut()`). This isn't described in W6.
- **Personal Info field labels differ from the inventory:** "Given Name", "Family Name", "Email Protocol", "Mobile Number", "Mailing Address", "Default City (Transactions)".

---

## Chunk B — Accounts & open banking (W11–W15)

Specs: `tests/e2e/chunk-b-accounts-banking/accounts.spec.ts`, `banking.spec.ts`. **Runs: 72** (36 tests × 2 viewports) → **46 pass, 21 fail, 5 skipped**. The skips are 3 width-specific tests that don't apply at the other width, plus the real-provider test, which is Blocked at both widths.

**How banking was tested.** The real Enable Banking API needs production credentials and a sandbox bank, so the backend-to-provider leg is **Blocked**. Everything else was exercised by mocking the provider responses of `/api/enable-banking/*` in the browser: the real UI, the real callback page, the real save pipeline, and the real `/pending` endpoints. The mock fixture includes **two genuine €3.50 "COFFEE BAR" purchases on the same day with different `transaction_id`s**, plus a salary credit.

| # | Workflow | Item tested | 1440 | 375 | Bug |
|---|---|---|---|---|---|
| B1 | W11 Accounts | Add account: listed, saved with correct balance | Pass | Pass | |
| B2 | W11 | Empty name blocked (`required`) and nothing saved | Pass | Pass | |
| B3 | W11 | Double-click "Create Account" → one account | Pass | Pass | |
| B4 | W11 | 300-char name saved; no horizontal overflow | Pass | Pass | |
| B5 | W11 | Balance rejects non-numeric input | Pass | Pass | |
| B6 | W11 | Edit name (Overview → Edit) persists after refresh | Pass | Pass | |
| B7 | W11 | Adjust balance updates UI and server | Pass | Pass | |
| B8 | W11 | Delete needs typed `DELETE` (lowercase rejected); account and its transactions removed | Pass | Pass | |
| B9 | W11 | Desktop right-click menu → View Full Account | Pass | n/a | |
| B10 | W11 | View toggles persist across refresh | Pass | n/a | |
| B11 | W11 | Mobile list shows seeded accounts | n/a | Pass | |
| B12 | W12 Detail | Open detail; **refresh keeps the detail**; Back returns | **Fail** | **Fail** | QA-B-006 |
| B13 | W12 | Unknown account deep link doesn't hang on a loader | Pass | Pass | (silently goes to Dashboard) |
| B14 | W12 | Add transaction from detail (required: category and description) | Pass | Pass | QA-B-009 (copy) |
| B15 | W12 | Enter in the amount field submits the form | **Fail** | **Fail** | QA-B-008 |
| B16–20 | W12 | Detail views render without errors or overflow: Property, Vehicle, Loan, Credit Card, Savings | Pass | Pass | |
| B21 | W12 | Property: update valuation | Pass | Pass | |
| B22 | W12 | Vehicle: add mileage log | Pass | Pass | |
| B23 | W12 | Vehicle: mileage below the previous reading rejected | **Fail** | **Fail** | QA-B-010 |
| B24 | W12 | Asset closing actions (Record Sale / Retire Vehicle) available | Pass | **Fail** | QA-B-007 |
| B25 | W13 Connect | User with no connections sees none | **Fail** | **Fail** | QA-B-002 |
| B26 | W15 Delete | Deleting all connections is permanent | **Fail** | **Fail** | QA-B-003 |
| B27 | W13 | Find Banks without credentials → validation | Pass | Pass | |
| B28 | W13 | Provider error shown for bad credentials | Pass | Pass | |
| B29 | W13 | Happy path: authorize → callback → connection `ready` **persisted** | **Fail** | **Fail** | QA-B-005 (intermittent; passed once serially) |
| B30 | W13 | Callback without code → error + "Back to integrations" | Pass | Pass | |
| B31 | W13 | Real Enable Banking API | Blocked | Blocked | needs credentials |
| B32 | W14 Sync | All 3 provider transactions imported | **Fail** (2/3) | **Fail** (2/3) | QA-B-004 |
| B33 | W14 | Imported transactions belong to an existing account | **Fail** | **Fail** | **QA-B-001** |
| B34 | W14 | Row shows linked after "New" → Save | **Fail** | **Fail** | QA-B-001 |
| B35 | W14 | Re-sync doesn't duplicate | Pass | Pass | |
| B36 | W14 | Sync failure (balances 503) shown to user | **Fail** | **Fail** (timeout) | QA-B-011 |

### Bug reports — Chunk B

#### QA-B-001 — Linking a bank account to a "New" destination never creates the account, so every imported transaction is orphaned
- **Severity:** Critical (silent data corruption; synced transactions belong to no account)
- **Steps:**
  1. Integrations → connect a bank (mocked provider).
  2. For the discovered account choose **New**, keep or enter a name, and click **Save**.
  3. Click **Sync** → confirm.
- **Expected:** a new account "QA Bank Current" exists, the row says "Linked to …", and the transactions are attached to it.
- **Actual:**
  - The row still says **"Not linked"**.
  - No new account exists in the UI or on the server.
  - The synced transactions are saved with `accountId: "acc-<uuid>"`, an id that **doesn't exist**. Reproduced 3/3 in `diagnostics/link-probe.spec.ts` (`ORPHANS: ["acc-2370ee0a-…"]`) and in the suite (2 orphaned transactions per run).
- **Suspected cause:**
  - `App.tsx:2629-2631` pre-generates `acc-${uuid}` and calls `handleSaveAccount({ ...newAccount, id })`.
  - `handleSaveAccount` treats any payload with an `id` as an **update** (`isNew` is set only when no id is given; the update branch `prev.map(acc => acc.id === finalAccountId ? … )` at ~`App.tsx:1301` matches nothing). So the account is never added, while the connection is linked to the phantom id (`App.tsx:2634-2637`).
  - The same pattern exists in `handlePublishImport` (`App.tsx:2642`), to be checked in Chunk F.

#### QA-B-002 — Every real user is shown two fake "demo" bank connections
- **Severity:** High
- **Steps:** Register a new account (no bank connections) → Integrations.
- **Expected:** "Active Connections" is empty.
- **Actual:**
  - "BNP Paribas Fortis" and "Revolut Bank" appear as **Active**, with placeholder credentials and accounts already "Linked to Everyday Checking / Rainy Day Savings".
  - "Sync Banks" on Dashboard, Accounts and Transactions will call the provider with these fake credentials.
- **Suspected cause:** `App.tsx:846-848`: `resolvedConnections = data.enableBankingConnections?.length > 0 ? data.enableBankingConnections : (initialFinancialData.enableBankingConnections || [])`. Demo data is used as a fallback for real users.

#### QA-B-003 — Deleted bank connections come back after refresh
- **Severity:** High
- **Steps:** Integrations → delete every connection → wait for the save → refresh.
- **Expected:** no connections.
- **Actual:** the demo connections reappear.
- **Suspected cause:** same as QA-B-002. An empty list is "resolved" to the demo list on every load (`App.tsx:846-848`).

#### QA-B-004 — Bank sync drops genuine identical same-day transactions
- **Severity:** High (missing spending; the ledger no longer matches the bank)
- **Steps:** Sync an account whose provider returns two €3.50 "COFFEE BAR" purchases on 2026-10-10 with different `transaction_id`s (`tx-coffee-1`, `tx-coffee-2`), plus one salary.
- **Expected:** 3 transactions imported.
- **Actual:** **2 imported.** `tx-coffee-2` is silently discarded as a duplicate.
- **Suspected cause:** `App.tsx:2548-2575` falls back to a `date|amount|description|merchant` fingerprint even when both transactions have distinct provider IDs, and it adds each imported transaction to `existingFingerprints` within the same batch (`:2574`). Confirms REL-009 end to end.

#### QA-B-005 — A newly connected bank can disappear after refresh (connect flow not reliably persisted)
- **Severity:** High (intermittent)
- **Steps:** Connect a bank (mocked provider) → callback → back on Integrations the connection shows "Active" → refresh.
- **Expected:** the connection is stored as `ready` with its `sessionId`.
- **Actual:** failed in the parallel suite at both widths (server `status` `undefined` or `pending`), and passed once when run serially. In `diagnostics/callback-probe.spec.ts` the UI showed "QA Test Bank — Active" while the **server had no such connection**, and it was gone after refresh. The request trace shows three writes racing around the OAuth redirect:
  1. `POST /api/data` (partial)
  2. `POST /api/enable-banking/pending`
  3. a full `keepalive` `POST /api/data` from `beforeunload`, all within ~15 ms

  Then, after the callback's full page load, the "ready" update happens within the first second and is dropped (QA-A-001).
- **Suspected cause:** REL-001 (`server/src/enableBanking.ts:275-298` read-modify-write without a row lock, racing `data.ts`) plus QA-A-001 (`App.tsx:1003`/`:1156`), triggered by the fire-and-forget calls at `App.tsx:1940-1947` and `pages/EnableBankingCallback.tsx:154-160`.

#### QA-B-006 — Refreshing an account detail page (or opening its link) redirects to the Dashboard
- **Severity:** Medium
- **Steps:** Open any account's full view (`/accounts/acc-checking`) → press F5, or paste the URL into a new tab.
- **Expected:** the same account detail page.
- **Actual:** lands on `/` (Dashboard), at both widths.
- **Suspected cause:**
  - The effect at `App.tsx:2748-2752` runs `if (isDataLoaded && viewingAccountId && !viewingAccount) → setCurrentPage('Dashboard')`.
  - `loadAllFinancialData` sets `accounts` inside `startTransition` (`App.tsx:811`), so for one render `isDataLoaded` is true while `accounts` is still empty.
  - The same logic applies to holdings (`:2751`).

#### QA-B-007 — Mobile: no way to sell or close a property or vehicle
- **Severity:** Medium (mobile)
- **Steps:** At 375 px open "Canal View Apartment" or "Tesla Model 3 LR".
- **Expected:** "Record Sale" and "Retire Vehicle" are available, as on desktop.
- **Actual:**
  - Mobile shows only "Valuation" (property) and "Add Log" / "Value Update" (vehicle).
  - There's no close or sell action and no revert-closure action.
- **Suspected cause:** the mobile header (`components/MobileAccountHeader.tsx`, used by the account views below `md`) doesn't render `onCloseAsset` / `onRevertClosure`, which `PropertyAccountView.tsx:167-173` and `VehicleAccountView.tsx:292-305` render only in the desktop header.

#### QA-B-008 — Pressing Enter in the transaction drawer does nothing
- **Severity:** Low
- **Steps:** Account detail → Transaction (mobile: "Log Tx") → fill every field → press Enter in the amount field.
- **Expected:** the form submits (as "Confirm Transaction" does).
- **Actual:** the drawer stays open and nothing is saved. Keyboard users must tab to the button.
- **Suspected cause:** the amount field in `components/AddTransactionModal.tsx` handles its own key events, and/or the first `type="submit"` button in the form is the header's "Close drawer" button (found by DOM inspection). Implicit submission doesn't reach "Confirm Transaction".

#### QA-B-009 — "Internal Memo / Description" is silently required
- **Severity:** Low (copy/UX)
- **Steps:** Add a transaction from account detail without a description.
- **Expected:** optional (as "Memo" suggests), or clearly marked required.
- **Actual:** native "Please fill out this field." appears on submit; there's no required indicator. Category is also required, with no marker.
- **Suspected cause:** `components/AddTransactionModal.tsx` description input is `required` with no visual marker.

#### QA-B-010 — Vehicle mileage can go backwards
- **Severity:** Low
- **Steps:** Tesla Model 3 LR → Add Log → enter `1` (lower than existing readings) → Record Mileage.
- **Expected:** validation ("must be ≥ last reading"), or at least a warning.
- **Actual:** accepted and saved without a message.
- **Suspected cause:** no comparison against previous logs in `components/AddMileageLogModal.tsx`.

#### QA-B-011 — A failed bank sync gives the user no feedback
- **Severity:** Medium
- **Steps:** Linked account → Sync while the provider's balances call returns 503.
- **Expected:** an error toast or banner with the reason.
- **Actual:** nothing visible. The connection may switch to `requires_update`, but `lastError` is never rendered. On mobile the step also timed out.
- **Suspected cause:** `App.tsx:2602-2604` stores `lastError`, but no component renders it (`grep lastError components pages` finds writes only). Same as REL-010.

### In the app but missing from the inventory — Chunk B
- **Clicking an account card opens an "Account Overview" modal**, not the detail page. Detail is reached through its "Full View" / "Open Full Account View" button. On mobile, Edit / Adjust Balance are **only** reachable via this modal (`Edit Details`, `Adjust Balance`).
- **Edit Account modal has its own Delete button** (`components/EditAccountModal.tsx:1601`), which routes to the same typed-`DELETE` confirmation.
- **The delete confirmation requires typing the literal `DELETE`** (case-sensitive), not the account name.
- **Mobile detail pages use different labels for the same actions:** "Log Tx" (desktop "Transaction"), "Valuation" (desktop "Value Update"), plus "Back to Accounts".
- **Vehicle "Add Log" has a "Batch import (CSV)" mode** (`AddMileageLogModal`), not in the inventory.
- **Bank Sync shows a sync-options prompt** (`EnableBankingSyncModal`) before syncing a single account.
- **The Integrations page triggers a `session/fetch` call to the provider every time it's opened**, an implicit background refresh.
- **Integrations hosts the API-key fields** for Twelve Data, Brandfetch and CARTO ("Data & Asset APIs", "Stored locally"). The inventory mentions only the CARTO key.

---

## Chunk C — Transactions & categorization (W16–W23)

Spec: `tests/e2e/chunk-c-transactions/transactions.spec.ts`. **Runs: 48** (24 tests × 2 viewports) → **31 pass, 4 fail, 13 skipped**. The skips are 12 width-specific tests (desktop-only table actions, mobile-only list actions) plus 1 Blocked.

| # | Workflow | Item tested | 1440 | 375 | Bug |
|---|---|---|---|---|---|
| C1 | W16 Add | Add transaction: saved with correct sign and amount | Pass | Pass | |
| C2 | W16 | Missing amount rejected (nothing saved) | Pass | Pass | |
| C3 | W16 | Double-click Confirm → exactly one transaction | Pass | Pass | |
| C4 | W16 | 1000-char description saved; no horizontal overflow | Pass | Pass | |
| C5 | W16 | `n` shortcut opens quick add | Pass | n/a | |
| C6 | W16 Edit | Desktop context menu → Edit Transaction persists | Pass | n/a | |
| C7 | W16 | Mobile: tap row → detail sheet → "Edit Entry" persists | n/a | Pass | |
| C8 | W16 Delete | Desktop context menu → Delete Transaction (confirmed) | Pass | n/a | |
| C9 | W16 | Mobile: delete (swipe-left only) | n/a | Blocked | gesture not automatable |
| C10 | W16 | Mobile list + Income chip filters | n/a | Pass | |
| C11 | W17 Split | "Confirm Split" disabled until parts sum to total | Pass | n/a | |
| C12 | W17 | Valid split: 2 parts saved, total preserved | Pass | n/a | |
| C13 | W17 | Duplicate creates a copy | Pass | n/a | |
| C14 | W17 Bulk | Bulk categorize two rows ("Assign Category") | Pass | n/a | |
| C15 | W18 Filter | Search narrows; no-match shows empty state | Pass | Pass | |
| C16 | W18 Export | Export downloads a `.csv` with all rows | Pass | n/a | |
| C17 | W19 Matches | Unmatched transfer pair suggested → Approve sets `transferId` on both | Pass | n/a | |
| C18 | W20 Categories | Add category; empty name rejected | Pass | Pass | |
| C19 | W20 | Delete category: confirmation is usable and removes it | **Fail** | **Fail** | QA-C-001 |
| C20 | W21 Tags | Register tag → saved | Pass | Pass | |
| C21 | W21 | Tag cards expose named edit/delete actions | **Fail** | **Fail** | QA-C-002 |
| C22 | W22 Rules | Create rule (Description contains "Netflix" → Entertainment) → Apply to existing → "Run Optimization" updates the transaction | Pass | Pass | |
| C23 | W23 Merchants | Lists seeded merchants; Protocol Configuration opens | Pass | Pass | |
| C24 | W23 | Hide merchant persists | Pass | Pass | |

### Bug reports — Chunk C

#### QA-C-001 — Category delete confirmation renders *behind* the category list and can't be used
- **Severity:** High (a core management action is effectively broken)
- **Steps:** Settings → Categories → hover a category → Delete (trash icon).
- **Expected:** a confirmation dialog on top with usable "Abort" / "Execute Deletion".
- **Actual:**
  - The backdrop dims the page, but the dialog sits **under** the category cards. The screenshot shows "Education & Self-Improvement", "Health & Wellness" and "Travel" painted over it.
  - `document.elementFromPoint` at the centre of "Execute Deletion" returns a category card, not the button. Clicks hit the card. Reproduced at both widths.
- **Suspected cause:** the inline confirm in `pages/Categories.tsx:~220-236` is rendered inside the page's stacking context with a lower z-index than the category items (`CategoryItem` uses `relative`/z-indexed layers). It should portal to `document.body` (as `components/Modal.tsx` does) or use the shared `ConfirmationModal`. UI-009 noted the duplicate confirm implementations; this one is broken.

#### QA-C-002 — Tag edit/delete buttons have no accessible name
- **Severity:** Medium (accessibility)
- **Steps:** Settings → Tags. Inspect the edit/delete controls on a tag card.
- **Expected:** buttons named "Edit tag Work" / "Delete tag Work" (or similar).
- **Actual:** `getByRole('button', { name: /delete/i })` finds nothing. The icon-only buttons are unnamed, so screen readers announce "button".
- **Suspected cause:** `pages/Tags.tsx:280,286,356,359` (icon-only `<button>`s without `aria-label`). Same class as UI-016.

### Observations in this chunk (not failures)
- **Mobile delete is swipe-only.** On a phone, a transaction can only be deleted by swiping its row left (`SwipeableRow`). The detail sheet has "Edit Entry" but no Delete. There's no visible alternative for users who can't perform swipe gestures. I couldn't confirm by automation (C9 Blocked).
- **Category requires a choice and description is required** in the add-transaction drawer (see QA-B-009). Validation works; only the "required" markers are missing.

### In the app but missing from the inventory — Chunk C
- **Transactions (desktop):** an "Advanced filters" toggle. Also a persistent bulk action bar with **Edit, Categorize, Combine, Split, Unsplit, Uncombine, Recurring, Delete**, and **Previous/Next** pagination. The inventory lists only some of these as context-menu actions.
- **Transactions (mobile):** a different UI.
  - Type chips **All / Expenses / Income / Transfers**, plus a **Filters** sheet.
  - Rows have **swipe actions (Edit, Delete)**.
  - Tapping a row opens a **detail sheet** with "Edit Entry" and a **Google Maps** link for the location.
- **Dashboard → "Pending Matches" tab:**
  - "Configure Matching Thresholds"
  - filters **All Matches / Synced Bills / Potential Transfers**
  - **Select All Filtered**, **Dismiss Selected (n)**, **Approve Selected (n)**
- **Rules:**
  - Tabs **Rules Workspace / Merchant Overrides / Interactive Sandbox / Execution History & Logs**
  - Buttons **Suggest Rules**, **Scan Database**, **Create First Rule**, and the **"Apply to existing transactions"** banner whose confirm button is **"Run Optimization"**
- **Merchants:** **Enrich Logos** (bulk logo refresh) and **Accept Rule** (smart suggestion), in addition to Hide/Protocol Configuration.
- **Categories:** **Debit (Expenses) / Credit (Income)** tabs and per-item **Add Sub-category**.

---

## Chunk D — Planning & scheduling (W24–W28)

Spec: `tests/e2e/chunk-d-planning/planning.spec.ts`. **Runs: 36** (18 tests × 2 viewports) → **23 pass, 5 fail, 8 skipped**. The skips are 5 width-specific, 1 Blocked (mobile swipe), and 1 test with no detected subscriptions in the seed data (skipped at both widths).

| # | Workflow | Item tested | 1440 | 375 | Bug |
|---|---|---|---|---|---|
| D1 | W24 Budgets | Create budget ("Deploy Budget") | Pass | Pass | |
| D2 | W24 | Budget without amount rejected | Pass | Pass | |
| D3 | W24 | Mobile "+" add-budget button has an accessible name | n/a | **Fail** | QA-D-006 |
| D4 | W24 | Quick Budget → confirm "Generate Budgets" → result or message ("No spending data…") | Pass | n/a | uses `alert()` (UI-010) |
| D5 | W24 | Delete a budget (with confirmation) | **Fail** | Blocked | QA-D-001, QA-D-002 |
| D6 | W25 Goals | Create goal ("Deploy Goal") | Pass | Pass | |
| D7 | W25 | Goal without a name rejected | Pass | Pass | |
| D8 | W25 | Negative goal amount rejected | Pass | Pass | |
| D9 | W26 Forecast | All horizons (3M/6M/EOY/1Y) render with no errors and no overflow | Pass | **Fail** | QA-D-005 |
| D10 | W26 | Forecast for an empty account → no crash | Pass | Pass | |
| D11 | W27 Schedule | Create recurring ("Commit Recurring Series"; desktop "New Recurring", mobile Rules → "Add Rule") | Pass | Pass | |
| D12 | W27 | Add one-time bill | Pass | n/a | |
| D13 | W27 | Mobile: Overdue → "Pay Now" records a transaction | n/a | Pass | |
| D14 | W27 | Desktop: calendar "Post Transaction" records a transaction | Pass | n/a | |
| D15 | W27 | Notification center reachable, lists bills, Clear All | Pass | **Fail** | QA-D-004 |
| D16 | W28 Subs | Add subscription service (desktop "New Service", mobile "Add Subscription") | Pass | Pass | |
| D17 | W28 | Add loyalty card (Wallet → Add Card → "Store Card") | Pass | **Fail** | QA-D-003 |
| D18 | W28 | Ignored suggestion stays ignored on another device | Skipped | Skipped | no detected subscriptions in seed; code shows localStorage-only (inventory §6) |

### Bug reports — Chunk D

#### QA-D-001 — Budgets can't be deleted on desktop
- **Severity:** Medium
- **Steps:** At 1440 px, open Budget → "Edit Budget" on any budget card. Also look for a delete control on the cards themselves.
- **Expected:** a Delete action, as the inventory says ("Budget cards → edit/delete") and as the Edit Budget modal itself suggests ("Category domain is anchored to this budget allocation. **Delete** or reset to change domain classification.").
- **Actual:** no delete button in the Edit Budget modal (only Clear Fields / Cancel / Save Changes) and none on the cards.
- **Suspected cause:** `pages/Budgeting.tsx:251-253` passes `onDeleteBudget` only to `MobileBudgetView`. The desktop render path never wires `deleteBudget` to any control.

#### QA-D-002 — Mobile budget delete has no confirmation (code-confirmed)
- **Severity:** Low
- **Steps:** At 375 px, swipe a budget row left → Delete.
- **Expected:** a confirmation step (the inventory lists `ConfirmDialog` for budget delete).
- **Actual (from code; the swipe couldn't be automated):** `onDeleteBudget={(id) => deleteBudget(id)}` deletes immediately.
- **Suspected cause:** `pages/Budgeting.tsx:253`.

#### QA-D-003 — Mobile: loyalty/membership cards can't be added
- **Severity:** Medium (mobile)
- **Steps:** At 375 px, open Subscriptions and look for "Wallet" / "Add Card".
- **Expected:** the same Wallet → Add Card flow as desktop.
- **Actual:** the mobile Subscriptions view offers only "Add Subscription". No Wallet tab and no Add Card.
- **Suspected cause:** `components/MobileSubscriptionsView.tsx` has no `onAddMembership` prop or Wallet section; `pages/Subscriptions.tsx:478,891` renders "Add Card" only in the desktop layout.

#### QA-D-004 — Mobile: no notification center (bill reminders) on the Dashboard
- **Severity:** Medium (mobile)
- **Steps:** At 375 px, open the Dashboard and look for the bell / "View bill notifications".
- **Expected:** the bill-notification center, as on desktop.
- **Actual:** no notification button. Overdue bills appear only as a badge inside Schedule.
- **Suspected cause:** `NotificationCenter` is injected through `HeaderContext` into `PageHeader`. The mobile Dashboard (`components/MobileDashboardView.tsx`) doesn't render `PageHeader`.

#### QA-D-005 — Mobile: Forecasting page scrolls horizontally
- **Severity:** Medium (mobile)
- **Steps:** At 375 px, open Forecasting and step through 3M / 6M / EOY / 1Y.
- **Expected:** no horizontal scrolling.
- **Actual:** `main.scrollWidth` = **401 px** at a 375 px viewport, on every horizon. Same as UI-011.
- **Suspected cause:** a non-wrapping toolbar row (`div.flex.items-center.gap-2`) in `components/MobileForecastView.tsx` (horizon buttons plus Combined/Split).

#### QA-D-006 — Mobile "+" (add budget) button has no accessible name
- **Severity:** Low (accessibility)
- **Steps:** At 375 px, open Budget and inspect the purple "+" button.
- **Expected:** `aria-label="Add budget"`.
- **Actual:** an icon-only button with no `aria-label`, `title` or text.
- **Suspected cause:** `components/MobileBudgetView.tsx:267-273`.

### In the app but missing from the inventory — Chunk D
- **Budget:**
  - an "Active cycle" month navigator (Previous/Next)
  - "Set Budget" and "+ Set Budget Guide" on unbudgeted category cards
  - mobile tabs **Auto / Envelopes / Charts & Pace / Smart Auto**, and filters **All / Near Cap / Over / Healthy**
  - the Budget modal has "Domain & Classification" / "Pacing & Guidelines" tabs and €100–€1000 presets
- **Goals:**
  - the goal modal has three goal types (**Target date / Recurring / Goal bucket**), a "Saving Strategy / Spending Target" select and an auto-computed contribution
  - Forecasting has "Group by Bucket", "Mark as complete", "List All", and mobile tabs **Projection / Goals / Ledger**
- **Schedule:**
  - views **Calendar / Timeline / Rules / Expired archive**, plus a month navigator and "Post Transaction" on calendar items
  - mobile has an **Overdue** tab with **Pay Now**
  - the recurring modal doubles as the one-time bill form ("Recurring Series" / "One-time Obligation" toggle) and supports Expense / Income / Transfer
- **Subscriptions:**
  - tabs **Overview / Payments / Wallet**
  - the loyalty-card form has holder name, tier, points, member since, expiry, online portal and private notes, with an icon/tint picker

---

## Chunk E — Investments & insights (W29–W33)

Spec: `tests/e2e/chunk-e-investments/investments.spec.ts`. **Runs: 30** (15 tests × 2 viewports) → **20 pass, 6 fail, 4 skipped** (all width-specific).

| # | Workflow | Item tested | 1440 | 375 | Bug |
|---|---|---|---|---|---|
| E1 | W29 Trade | Buy a new holding (quantity/price saved) | Pass | Pass | |
| E2 | W29 | Zero/negative quantity rejected | Pass | Pass | |
| E3 | W29 | Overselling warns ("Exceeds Current Quantity … Proceed anyway?"); Cancel saves nothing | Pass | Pass | see observation |
| E4 | W29 | Holding with no price data isn't shown as a −100% loss | **Fail** | n/a | QA-E-003 |
| E5 | W29 | Holding detail opens and survives refresh | **Fail** | n/a | QA-E-001 |
| E6 | W29 | Mobile: holdings render; "Add Investment Action" opens the trade form | n/a | Pass | |
| E7 | W31 Prices | Log a manual price (saved) | Pass | n/a | |
| E8 | W31 | Price sync without an API key explains what's missing | Pass | Pass | |
| E9 | W32 Reports | All six predefined periods render without errors or overflow | Pass | Pass | |
| E10 | W32 | Period with no data → empty/zero state | Pass | Pass | |
| E11 | W32 | Leaderboard link → Merchants | Pass | Pass | |
| E12 | W32 | Save View: disabled until named; named view survives refresh | Pass | Pass | |
| E13 | W33 Challenges | All 7 tabs render; no horizontal overflow | Pass | **Fail** | QA-E-002 |
| E14 | W33 | Create a prediction ("Lock in Prediction") | Pass | **Fail** | QA-E-004 (+ QA-A-005) |
| E15 | W33 | A started savings sprint is visible on another device | **Fail** | **Fail** | QA-E-005 |

### Bug reports — Chunk E

#### QA-E-001 — Refreshing a holding detail page bounces back to Investments
- **Severity:** Medium
- **Steps:** Investments → "Holding Details" on VWCE (`/investments/VWCE`) → refresh.
- **Expected:** the VWCE detail page.
- **Actual:** lands on `/investments`.
- **Suspected cause:** `App.tsx:2751`, the same `startTransition` race as QA-B-006 (`viewingHolding` is briefly null after load).

#### QA-E-002 — Mobile: Challenges page scrolls horizontally
- **Severity:** Medium (mobile)
- **Steps:** At 375 px, open Challenges.
- **Actual:** `main.scrollWidth` = **530 px**.
- **Suspected cause:** an absolutely-positioned hero decoration (`top-44 left-1/3`) in `pages/Challenges.tsx` isn't clipped (UI-011).

#### QA-E-003 — Holdings without a price are valued at €0, shown as a −100% loss, and drag the whole portfolio negative
- **Severity:** High (misleading financial figures for every user without a Twelve Data key)
- **Steps:** With no Twelve Data API key and no manual prices, open Investments.
- **Expected:** "price unavailable" (or last known price / cost basis); performance excludes unpriced holdings.
- **Actual:**
  - VWCE (25 units, €2,749.50 cost) shows market €0.00 and **−100.0%**.
  - The portfolio header shows Invested €209,503.40 and **Gain/Loss −€158,372.90, Performance −75.6%**.
  - "Stocks" and "ETFs" segments show €0.00.
- **Suspected cause:** `utils/investments.ts:90-91` (`const price = prices[h.symbol] ?? 0; h.currentPrice = price;`), so a missing price becomes 0 instead of "unknown".

#### QA-E-004 — Mobile: Challenges tab bar is drawn over the "Create Prediction" sheet, and its submit button sits under the bottom nav
- **Severity:** Medium (mobile; predictions can't be created at 375 px)
- **Steps:** At 375 px → Challenges → Predictions → Create Prediction → fill the form.
- **Expected:** the sheet is on top; "Lock in Prediction" is tappable.
- **Actual:**
  - The page's sticky tab bar (Sprints / Predictions / Records) is painted **above** the sheet header.
  - "Cancel" / "Lock in Prediction" are hidden behind the bottom navigation, so the save never happens (QA-A-005 again).
- **Suspected cause:** the sticky tab bar in `pages/Challenges.tsx` has a higher z-index than `PredictionModal`. The `MobileNavbar` covers modal footers (QA-A-005).

#### QA-E-005 — Savings sprints don't follow the account
- **Severity:** Low
- **Steps:** Start "The Zero Day" sprint, then sign in from another browser.
- **Expected:** the active sprint appears there too.
- **Actual:** it doesn't. Sprints live only in `localStorage` (`crystal_active_sprints`, `pages/Challenges.tsx:535`).
- **Suspected cause:** as noted in inventory §6; sprints aren't part of `FinancialData`.

### Observation — Chunk E
- **Overselling is allowed after a warning.** "Proceed anyway?" lets a user record a sale larger than the holding (9,999 BTC vs 0.12 held), producing negative positions. This looks like a deliberate choice, but worth confirming.

### In the app but missing from the inventory — Chunk E
- **Investments:**
  - segment tiles with totals (All Assets, Stocks, ETFs, Crypto, Warrants, Spare Change, Pension)
  - a portfolio candlestick chart with **Raw logs / Weekly** and **1M/3M/6M/1Y/All time** ranges
  - an "Exposure Breakdown" donut
  - per-row Edit / Adjust / Trade / Detail icon actions
  - the desktop button reads "Sync Prices"
- **Mobile Investments:**
  - "Update Live Prices", "Add Investment Action"
  - tabs **Holdings / Accounts / Charts & P&L / Trades**, and per-row **Detail / Adjust / Price**
- **Reports:**
  - custom **start/end date**, **Account**, **Merchant**, **Category** and **Group by** filters
  - saveable named views ("Name this report view…")
  - KPI tiles (Total spend, Savings rate, Transactions, Avg. transaction, Recurring impact)
  - "Spending Velocity" (current vs previous) chart
- **Challenges:**
  - seven tabs (**Score, Battles, Badges, Mastery, Sprints, Predictions, Records**)
  - 11 predefined sprints
  - three prediction types (**Spending cap / Net worth / Price target**)

---

## Chunk F — Productivity, settings & data (W34–W40)

Spec: `tests/e2e/chunk-f-productivity-data/productivity.spec.ts`; CSV fixture `tests/e2e/fixtures/files/eu-transactions.csv`. **Runs: 48** (24 tests × 2 viewports) → **24 pass, 18 fail, 6 skipped** (all width-specific).

| # | Workflow | Item tested | 1440 | 375 | Bug |
|---|---|---|---|---|---|
| F1 | W34 Invoices | Issue an invoice (2 × €150 → €300 saved) | Pass | Pass | |
| F2 | W34 | Invoice without a client rejected | Pass | Pass | |
| F3 | W34 | Draft a quote → "Convert to Invoice" creates an invoice | **Fail** | **Fail** | QA-F-004 |
| F4 | W34 | Pagination arrows usable | **Fail** | **Fail** | QA-F-008 |
| F5 | W35 Tasks | Create a task ("Initialize Objective") | Pass | Pass | |
| F6 | W35 | Task without a title rejected | Pass | Pass | |
| F7 | W35 | 400-char title doesn't overflow | Pass | Pass | |
| F8 | W36 Preferences | Dark theme applies and survives refresh | Pass | Pass | |
| F9 | W36 | Currency change saved to the account | Pass | Pass | |
| F10 | W37 Import | European amounts kept (−12,50 / 1.234,56) | **Fail** | **Fail** | QA-F-001 |
| F11 | W37 | "Description" column auto-mapped | **Fail** | **Fail** | QA-F-003 |
| F12 | W37 | Import that creates a new account → no orphaned transactions | **Fail** | **Fail** | QA-F-002 |
| F13 | W37 Export | Full JSON backup downloads valid JSON | Pass | Pass | |
| F14 | W37 | CSV tables export downloads | Pass | Pass | |
| F15 | W37 Restore | Restore a JSON backup brings deleted tasks back | Pass | **Fail** | QA-F-007 |
| F16 | W37 Reset | "Execute Wipe" → Continue → final "type RESET" step | **Fail** | **Fail** | QA-F-005 |
| F17 | W38 Dashboard | Add a widget and it persists | **Fail** | n/a | QA-F-006 |
| F18 | W38 | Remove a widget | **Fail** | n/a | QA-F-006 |
| F19 | W39 Nav | ⌘K → "Budget" → Enter navigates | Pass | n/a | |
| F20 | W39 | `g` `t` → Transactions; `?` → shortcuts list | Pass | n/a | |
| F21 | W39 | Privacy mode hides amounts | **Fail** | n/a | QA-F-010 |
| F22 | W39 | Mobile "More" sheet → Tags | n/a | Pass | |
| F23 | W39 | Unknown URL tells the user | **Fail** | **Fail** | QA-F-009 |
| F24 | W40 Docs | Documentation renders; section nav works; no overflow | Pass | Pass | |

### Bug reports — Chunk F

#### QA-F-001 — CSV import silently corrupts European-format amounts
- **Severity:** High
- **Steps:** Data Management → Import → Transactions (CSV) → upload a file with `"-12,50"` and `"1.234,56"` → accept the defaults → Publish Import.
- **Expected:** −12.50 and 1,234.56.
- **Actual:** saved as **−12** and **1.23**. The wizard preview already shows −12 / 1.23. The step-2 select is only the CSV field delimiter, and there's no decimal-separator option.
- **Suspected cause:** `components/ImportWizard.tsx:323-342` (`parseFloat` on the raw string). Confirms REL-006 end to end.

#### QA-F-002 — CSV import "create new account" never creates the account, so the imported transactions are orphaned
- **Severity:** High
- **Steps:** Import a CSV whose Account column names an account that doesn't exist (`QA Import Account`). In the account-mapping step keep "Create new: QA Import Account" → Publish.
- **Expected:** a new account "QA Import Account" with 3 transactions.
- **Actual:**
  - The audit trail says "Imported 3 transactions and created 1 new accounts — Complete".
  - The server has **no** such account. The 3 transactions reference `accountId: "new-3bbdf5c1-…"`, which doesn't exist, so they appear under no account.
- **Suspected cause:** `App.tsx:2642` (`newAccountsArg.forEach(acc => handleSaveAccount(acc))`) passes accounts with pre-set ids. `handleSaveAccount` treats any id as an update (same root cause as QA-B-001, `App.tsx` ~1283-1301).

#### QA-F-003 — CSV import doesn't map an obvious "Description" column
- **Severity:** Medium
- **Steps:** As above, with a header row `Date,Description,Amount,Account`.
- **Expected:** "Description" is auto-mapped.
- **Actual:** the description mapping stays empty, and every row is saved as **"Imported Transaction"**.
- **Suspected cause:** the `autoMapColumns` heuristics in `components/ImportWizard.tsx` (~line 270) don't match the plain header "Description".

#### QA-F-004 — "Convert to Invoice" doesn't create an invoice
- **Severity:** High (a core billing workflow)
- **Steps:** Quotes & Invoices → Draft Quote → fill client and line item → Create Quote → Proposals → "Convert to Invoice".
- **Expected:** a new draft invoice `INV-…` appears, and the quote is marked accepted.
- **Actual:** the quote is only marked **accepted** (`{type: "quote", status: "accepted"}`). **No invoice exists.**
- **Suspected cause:** `pages/Invoices.tsx:87-95`. The new invoice is built with `{ ...quote, type: 'invoice', … }`, which copies the quote's `id`. `saveInvoice` therefore updates the quote, and the next line overwrites it again with `{ ...quote, status: 'accepted' }`. Fix: omit `id` when building `newInvoice`.

#### QA-F-005 — Factory reset can't be reached
- **Severity:** Medium
- **Steps:** Data Management → Execute Wipe → "Continue".
- **Expected:** the "Final Confirmation" dialog asking to type `RESET`.
- **Actual:** both dialogs close and nothing happens. The server keeps all data.
- **Suspected cause:**
  - `components/ConfirmationModal.tsx:147` runs `onConfirm(); onClose();`.
  - `onConfirm` (`pages/DataImportExport.tsx:321-327`) opens the final modal. `onClose` then calls `setConfirmingAction(null)`.
  - The final modal renders only when `isFinalConfirmOpen && confirmingAction` (`:384`), so it never shows.

#### QA-F-006 — Dashboard widgets can't be removed (and therefore none can be added)
- **Severity:** Medium
- **Steps:** Dashboard → Customize → "Remove widget" on Financial Overview → then "Add Widget".
- **Expected:** the widget disappears and is then offered in Add Widget.
- **Actual:**
  - The widget moves to the **end** of the grid instead of disappearing (before: Financial Overview, Today's Agenda, Forecast Horizon, Credit Card Statements, Net Worth Over Time; after: Today's Agenda, …, Net Worth Over Time, Financial Overview).
  - Add Widget always says "All available widgets are already on display."
- **Suspected cause:** the `useEffect` at `pages/Dashboard.tsx:1311-1345` treats every widget of the tab (`WIDGET_TABS[activeTab]`) as **required** and re-appends any missing one right after `removeWidget` (`:1390`) saves.

#### QA-F-007 — Mobile: "Restore Selected Data" is hidden under the bottom nav
- **Severity:** Medium (mobile)
- **Steps:** At 375 px → Data Management → Restore → choose a backup → tap "Restore Selected Data".
- **Actual:** the `MobileNavbar` intercepts the tap ("Forecasting … intercepts pointer events"), so the restore can't be completed. Same root cause as **QA-A-005**, which now affects at least three modals: Change Password, Create Prediction and Restore.

#### QA-F-008 — Invoice pagination arrows are permanently disabled
- **Severity:** Low
- **Actual:** both arrows are `disabled` with no handlers (`pages/Invoices.tsx:352-357`). Inventory §6 already flagged this; now confirmed in the UI.

#### QA-F-009 — Unknown URLs silently show the Dashboard
- **Severity:** Low
- **Steps:** Open `/this-page-does-not-exist`.
- **Actual:** the Dashboard renders at `/` with no "page not found" notice. Broken links and typos go unnoticed.
- **Suspected cause:** `App.tsx:179-208`, where `parseRoute` falls back to Dashboard.

#### QA-F-010 — Privacy mode leaves some balances readable
- **Severity:** Low
- **Steps:** Accounts → enable Privacy Mode in the sidebar.
- **Expected:** all money values hidden.
- **Actual:** many values are blurred (18 blurred elements), but the account card balance pill (e.g. "€3,450.75") stays fully readable, with no blur on it or its ancestors.
- **Suspected cause:** that balance pill in `components/AccountRow.tsx` doesn't apply the privacy blur class used elsewhere.

### In the app but missing from the inventory — Chunk F
- **Invoices:**
  - **Invoices / Proposals** tabs and status filters (**Draft, Sent, Paid, Overdue, Accepted, Rejected**)
  - the editor's **Invoice / Quote** and **Receivable (Sent) / Payable (Recv)** toggles, "Add line item", client email/address, payment notes, discount and tax fields
- **Tasks:** priorities (**Low / Medium / High**), status (**To Do / In Progress / Done**), due and reminder dates, details text.
- **Data Management:**
  - the buttons are **Import / Export / Backup / Restore / Execute Wipe**
  - Export has **CSV tables / Full JSON backup** modes with per-entity checkboxes and a date range
  - the Import wizard has ~6 steps (upload → mapping incl. date format, amount mode, delimiter, account source → review with row filters and checkboxes → account mapping with "Create new") ending in "Publish Import"
  - the Audit Trail has per-entry inspect and delete
  - Factory Reset requires typing `RESET` (unreachable, QA-F-005)
- **Dashboard edit mode:** "Customize" / "Finish Editing", per-widget width selector ("1/2"), "Toggle Forecast" / "Toggle Goals" and "Post" buttons on agenda items.
- **Command Center (⌘K):** two filter selects plus a search box ("What are you looking for?").

---

## Final summary

| Chunk | Runs | Pass | Fail | Skipped / Blocked |
|---|---|---|---|---|
| A Auth & persistence | 54 | 29 | 24 | 1 |
| B Accounts & banking | 72 | 46 | 21 | 5 |
| C Transactions & categorization | 48 | 31 | 4 | 13 |
| D Planning & scheduling | 36 | 23 | 5 | 8 |
| E Investments & insights | 30 | 20 | 6 | 4 |
| F Productivity, settings & data | 48 | 24 | 18 | 6 |
| **Total** | **288** | **173** | **78** | **37** |

Skips are mostly width-specific tests (a desktop-only control at 375 px, or the reverse). **Blocked** items:
- the real Enable Banking API (needs credentials)
- the mobile swipe-only deletes of transactions and budgets (couldn't be automated)
- ignoring subscription suggestions (no detected subscriptions in the seed data)

**Bug reports: 46** (QA-A-001…012, QA-B-001…011, QA-C-001…002, QA-D-001…006, QA-E-001…005, QA-F-001…010).

**Highest-impact bugs:**
1. **QA-A-001 (Critical):** edits made in the first ~1 s after any page load are silently discarded.
2. **QA-B-001 / QA-F-002 (Critical/High):** creating a new account while linking a bank or importing a CSV never creates the account. The imported transactions are orphaned. Same root cause: `handleSaveAccount` treats pre-set ids as updates.
3. **QA-B-002 / B-003 (High):** fake demo bank connections are injected into every real user and come back after deletion.
4. **QA-B-004 / QA-F-001 (High):** bank sync drops genuine duplicate-looking transactions; CSV import corrupts European amounts.
5. **QA-F-004 (High):** "Convert to Invoice" creates no invoice.
6. **QA-E-003 (High):** holdings without a price are valued at €0, showing −100% and a −75% portfolio.
7. **QA-C-001 (High):** the category delete confirmation renders under the page.
8. **QA-A-005 / QA-F-007 / QA-E-004 (High, mobile):** the bottom nav covers modal footers, blocking password change, predictions and restore on phones.
