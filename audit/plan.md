# Crystal — Remediation Plan

Built 2026-10-13 from `CLAUDE.md`, `audit/inventory.md`, `findings-security.md`, `findings-reliability.md`, `findings-performance.md`, `findings-ui.md`, `qa-results.md`, and the Playwright results in `tests/e2e/results/`.

**Inputs:** 110 raw findings (SEC 18, REL 17, PERF 13, UI 16, QA 46). After merging duplicates there are **75 consolidated issues** (`AUD-01` … `AUD-75`). Every original ID maps to exactly one AUD issue below.

**Status legend for packages:** `[ ]` open · `[x]` done (with a one-line note) · `[~]` partially done (see note).

---

## 1. De-duplicated findings

Severity is the highest of the merged findings. "Category" is the dominant risk.

| AUD | Issue | Category | Severity | Merged IDs |
|---|---|---|---|---|
| AUD-01 | Autosave drops edits (first ~1 s after load, edits during an in-flight save, tab close > 64 KiB) | Data integrity | Critical | QA-A-001, REL-003, REL-004 |
| AUD-02 | Concurrent writes to the JSON blob revert acknowledged saves (`/pending` vs `/api/data`); new bank connections can vanish | Data integrity | Critical | REL-001, QA-B-005 |
| AUD-03 | Accounts created with a pre-set id are never added, so imported/synced transactions are orphaned | Data integrity | Critical | QA-B-001, QA-F-002 |
| AUD-04 | Save failures (409/401/403/5xx/offline) are silent and never retried | Reliability | High | REL-002, QA-A-002, QA-A-003, QA-A-004 |
| AUD-05 | Demo bank connections injected into real users and reappear after deletion | Data integrity | High | QA-B-002, QA-B-003 |
| AUD-06 | Bank-sync de-duplication drops genuine same-day identical transactions | Data integrity | High | REL-009, QA-B-004 |
| AUD-07 | CSV import corrupts European / thousands-separated amounts | Data integrity | High | REL-006, QA-F-001 |
| AUD-08 | `localhost` installs treated as dev (restore → demo mode; full dataset serialized to localStorage on every change) | Data integrity | High | REL-007, PERF-013 |
| AUD-09 | Backend crashes when Postgres is unreachable or the pool is exhausted | Reliability | High | REL-005 |
| AUD-10 | Unauthenticated SSRF via `GET /api/smart-fetch` | Security | High | SEC-001 |
| AUD-11 | Dev server (README install path): any password works, user-1 fallback, open AI proxy, CORS reflection, binds 0.0.0.0 | Security | High | SEC-002 |
| AUD-12 | Login rate limit bypassable via `X-Forwarded-For`; no per-account limit | Security | High | SEC-003 |
| AUD-13 | Enable Banking private key stored in plaintext (browser storage, DB blob) and sent on every sync | Security | High | SEC-004 |
| AUD-14 | "Convert to Invoice" creates no invoice | Functional | High | QA-F-004 |
| AUD-15 | Unpriced holdings valued at €0 (−100%), dragging the portfolio negative | Functional | High | QA-E-003 |
| AUD-16 | Icon library ships all six weights (650 kB of the entry chunk) | Performance | High | PERF-001 |
| AUD-17 | `manualChunks` forces Recharts + Leaflet into startup | Performance | High | PERF-002 |
| AUD-18 | No HTTP compression (static or API) | Performance | High | PERF-003 |
| AUD-19 | Every edit rewrites the whole JSONB blob (≈45,000× write amplification) | Performance | High | PERF-004 |
| AUD-20 | Text contrast fails WCAG AA on most pages (per-page accent colours) | UI / a11y | High | UI-003 |
| AUD-21 | Pinch-zoom disabled (`user-scalable=no`) | UI / a11y | High | UI-004 |
| AUD-22 | Clickable `div`/`tr` elements not keyboard-operable | UI / a11y | High | UI-005 |
| AUD-23 | Modals: no dialog semantics or focus trap; confirmations rendered under page content; mobile footers under the bottom nav | UI / a11y + Functional | High | UI-006, QA-C-001, QA-A-005, QA-F-007, QA-E-004 |
| AUD-24 | Icon-only / form controls without accessible names (row actions, switches, selects, tags, "+") | UI / a11y | High | UI-016, UI-007, QA-C-002, QA-D-006 |
| AUD-25 | Bank sync: no concurrency guard, stuck "pending", errors never shown | Reliability | Medium | REL-010, QA-B-011 |
| AUD-26 | CSV import doesn't auto-map an obvious "Description" column | Functional | Medium | QA-F-003 |
| AUD-27 | Transient startup error signs the user out and revokes the session | Reliability | Medium | REL-008, QA-A-006 |
| AUD-28 | No server-side schema validation; restore not validated per record; bad dates coerced to "today" | Data integrity | Medium | SEC-005, REL-013 |
| AUD-29 | DOM XSS via merchant logo URLs in Leaflet `divIcon` | Security | Medium | SEC-006 |
| AUD-30 | Hardcoded/default secrets (JWT, encryption, compose) | Security | Medium | SEC-007 |
| AUD-31 | Missing security headers; `X-Powered-By` exposed | Security | Medium | SEC-008 |
| AUD-32 | No password policy or input validation (1-char passwords, 300-char name → 500) | Security | Medium | SEC-009, QA-A-007, QA-A-008 |
| AUD-33 | Test suite can't fail, isn't in CI, misses critical paths | Reliability | Medium | REL-014 |
| AUD-34 | Root error boundary never resets; globals unprotected | Reliability | Medium | REL-011 |
| AUD-35 | No timeouts on any network call | Reliability | Medium | REL-012 |
| AUD-36 | Full blob fetched on every load, no caching | Performance | Medium | PERF-005 |
| AUD-37 | Merchants page O(merchants × transactions) and unpaginated | Performance | Medium | PERF-006 |
| AUD-38 | Merchant logo URLs change daily (cache-bust) | Performance | Medium | PERF-007 |
| AUD-39 | Route preloading on the sign-in screen (3.4 MB) | Performance | Medium | PERF-008 |
| AUD-40 | Render-blocking duplicate Google Fonts (11 families) | Performance | Medium | PERF-009 |
| AUD-41 | Three conflicting token sources; tokens bypassed | UI consistency | Medium | UI-001, UI-002 |
| AUD-42 | Micro type (7–10 px) as default label style | UI / a11y | Medium | UI-008 |
| AUD-43 | Duplicate components (buttons, cards, toggles, confirmations) | UI consistency | Medium | UI-009 |
| AUD-44 | `alert()` mixed with toasts; profile save reports success on failure | UI consistency + Functional | Medium | UI-010, QA-A-009 |
| AUD-45 | Horizontal overflow at 375 px (Merchants, Forecasting, Challenges) | UI / responsive | Medium | UI-011, QA-D-005, QA-E-002 |
| AUD-46 | Refreshing an account/holding detail page redirects away | Functional | Medium | QA-B-006, QA-E-001 |
| AUD-47 | Mobile feature gaps (sign-out, close asset, loyalty cards, notifications) | Functional | Medium | QA-A-010, QA-B-007, QA-D-003, QA-D-004 |
| AUD-48 | Budgets: no delete on desktop; mobile delete unconfirmed | Functional | Medium | QA-D-001, QA-D-002 |
| AUD-49 | Factory reset unreachable (ConfirmationModal closes the 2nd step) | Functional | Medium | QA-F-005 |
| AUD-50 | Dashboard widgets can't be removed (re-added automatically) | Functional | Medium | QA-F-006 |
| AUD-51 | Password reset missing ("Forgot password?" dead) | Security / Functional | Low | SEC-010, QA-A-011 |
| AUD-52 | Open self-registration with no switch | Security | Low | SEC-011 |
| AUD-53 | Account enumeration (register 409, login timing) | Security | Low | SEC-012 |
| AUD-54 | User email sent to pravatar.cc | Security / Privacy | Low | SEC-013 |
| AUD-55 | Internal error details returned to clients | Security | Low | SEC-014 |
| AUD-56 | CSRF relies on SameSite + CORS error side effect | Security | Low | SEC-015 |
| AUD-57 | 50 MB body parsing before auth | Security | Low | SEC-016 |
| AUD-58 | No lockfiles; unpinned builds | Security / Supply chain | Low | SEC-017 |
| AUD-59 | Containers run as root | Security | Low | SEC-018 |
| AUD-60 | Weak typing at boundaries (279 `any`, non-strict TS) | Reliability | Low | REL-015 |
| AUD-61 | Empty catch blocks; logout ignores failed save | Reliability | Low | REL-016 |
| AUD-62 | Password change not atomic with session revocation | Reliability | Low | REL-017 |
| AUD-63 | `react-aria` weight in the Transactions chunk | Performance | Low | PERF-010 |
| AUD-64 | Eager imports in the entry chunk (quick-add modal, demo data) | Performance | Low | PERF-011 |
| AUD-65 | Session write on every request; sessions never pruned | Performance | Low | PERF-012 |
| AUD-66 | Tap targets under 24/44 px | UI / a11y | Low | UI-012 |
| AUD-67 | Copy: jargon, naming, capitalization; silent required fields | UI consistency | Low | UI-013, QA-B-009 |
| AUD-68 | Inconsistent empty states | UI consistency | Low | UI-014 |
| AUD-69 | Landmarks and heading order | UI / a11y | Low | UI-015 |
| AUD-70 | Invoice pagination permanently disabled | Functional | Low | QA-F-008 |
| AUD-71 | Settings stored only in localStorage (onboarding flag, sprints) | Functional | Low | QA-A-012, QA-E-005 |
| AUD-72 | Unknown URLs silently show the Dashboard | Functional | Low | QA-F-009 |
| AUD-73 | Privacy mode leaves some balances readable | Functional / Privacy | Low | QA-F-010 |
| AUD-74 | Enter doesn't submit the transaction drawer | Functional | Low | QA-B-008 |
| AUD-75 | Vehicle mileage can go backwards | Functional | Low | QA-B-010 |

**Consolidated counts:** Critical 3 · High 21 · Medium 26 · Low 25 (75 issues).

---

## 2. Conflicting recommendations and proposed resolutions

| # | Conflict | Findings | Proposed resolution |
|---|---|---|---|
| K1 | **Keep or drop `react-aria`.** PERF-010 suggests replacing react-aria in Transactions to save 182 kB. UI-005 holds the react-aria Transactions table up as the only fully keyboard-accessible list and the model to copy. | PERF-010 vs UI-005 / UI-009 | **Keep react-aria for data tables** (accessibility wins). Recover bundle size elsewhere (AUD-16/17). Drop AUD-63 to "won't fix". |
| K2 | **Which dialog primitive.** UI-006 / UI-009 suggest `@base-ui/react` Dialog *or* `react-aria-components` Modal, or patching `Modal.tsx`. | UI-006, UI-009, PERF-010 | **Patch `components/Modal.tsx`** (role, aria-modal, labelledby, focus trap, focus restore, portal z-index above the mobile nav) and route the broken custom overlays through it. Defer a full primitive swap. |
| K3 | **Fix the JSON blob or split it into tables.** PERF-004/005 recommend per-entity tables. REL-001/REL-002 can be fixed within the blob. | PERF-004, PERF-005 vs REL-001, REL-002 | **Short term:** atomic `jsonb` merge (`data = data \|\| $2`) under a row lock in every writer, plus `lastUpdatedAt` maintained server-side. **Long term (L, separate project):** per-entity tables. |
| K4 | **What happens on a save conflict (409).** REL-002 offers reload, merge, or overwrite. | REL-002, QA-A-003 | Fetch the server copy, **re-apply only this tab's dirty slices on top** (slice-level last-writer-wins), save again, and show a toast "Synced with changes from another device". |
| K5 | **Tailwind config.** UI-001: delete `tailwind.config.js` *or* load it with `@config`. | UI-001 | **Delete it and move the missing tokens** (z-index scale, `text-3xs`) into `@theme` in `index.css`. |
| K6 | **Contrast vs brand palette.** UI-003 wants darker accent shades for white-on-accent text; `DESIGN.md` defines the per-page accents. | UI-003 vs DESIGN.md | Keep the accent hues, but **use the `-700` shade for filled buttons and badges with white text**, and dark text on tinted backgrounds. Update `DESIGN.md`. |
| K7 | **Self-registration default.** SEC-011 wants registration off after the first user; households may want several accounts. | SEC-011 | **`ALLOW_REGISTRATION` env flag, default `true`** (backwards compatible), documented in compose. |
| K8 | **Missing price display.** QA-E-003: use cost basis, last known price, or "unavailable". | QA-E-003 | Use the **last known price, else cost basis**, mark the holding "price unavailable", and exclude it from gain/loss %. |
| K9 | **Minimum password length.** SEC-009 suggests ≥ 10; the UI promises "Min. 8 characters". | SEC-009 vs QA-A-007 | **8 characters minimum** (NIST SP 800-63B), maximum 72 bytes (bcrypt), enforced client- and server-side. |
| K10 | **Password reset without email infrastructure.** SEC-010 suggests token reset *or* an admin CLI; the app has no mailer. | SEC-010, QA-A-011 | **Admin CLI** (`server/src/cli/reset-password.ts`) plus clear copy on Sign In ("Ask your administrator…"). No email flow. |
| K11 | **Dev mock server.** SEC-002 suggests opt-in and/or deleting `/api/ai/proxy`; the README tells users to run `npm run dev`. | SEC-002 | Mock becomes **opt-in (`CRYSTAL_MOCK_API=1`)**, binds `127.0.0.1`, checks passwords, no user-1 fallback; delete `/api/ai/proxy`; README points to Docker for real installs. |
| K12 | **Overselling.** QA-E Observation: "Proceed anyway?" allows negative positions. | QA-E observation | **No change** (deliberate behavior). Recorded as accepted. |

Packages that depend on a conflict are marked **needs decision K#**.

**Decisions (owner, 2026-10-13):** K1/K2, K3, K4, K5, K6, K7, K8, K9, K10 and K11 were all accepted as proposed; K12 is accepted as no change.

---

## 3. Test policy for this plan

- **One test command:** `npm test` at the repo root runs the unit/API tests. `cd tests/e2e && npx playwright test` runs the browser suite against the QA stack described in `audit/qa-results.md`. A wrapper script `tests/run-all.sh` starts the QA stack and runs both.
- **Known-open findings:** e2e tests that document a still-open finding are annotated `test.fail(true, '<AUD id> open')`. The suite is green while the bug exists and turns red if the bug is fixed without removing the annotation. Each package removes the annotations for what it fixes.
- **Done means:** the package's listed tests pass with the annotation removed, and the whole suite is green.

---

## 4. Quick wins (high value, effort S)

Each is a work package below, marked ⚡.

| QW | Package | Fixes | Why it's a quick win |
|---|---|---|---|
| QW-1 | WP-1.2 | AUD-03 | One-line ownership fix in `handleSaveAccount` stops orphaned transactions |
| QW-2 | WP-1.4 | AUD-10, AUD-11 | Auth + IP guard on smart-fetch; delete open AI proxy |
| QW-3 | WP-1.5a | AUD-12 | `trust proxy` hop count + per-email limiter |
| QW-4 | WP-1.8 | AUD-05, AUD-08 | Remove the demo fallback; gate dev cache on `import.meta.env.DEV` |
| QW-5 | WP-1.9 | AUD-29 | Escape one template |
| QW-6 | WP-2.1 | AUD-09, AUD-27 | `db.connect()` inside try; don't sign out on 5xx |
| QW-7 | WP-2.4 | AUD-46, AUD-72 | Wait for accounts before redirecting; not-found view |
| QW-8 | WP-2.6 | AUD-14, AUD-49, AUD-44 (QA-A-009 part) | Three one-place logic bugs |
| QW-9 | WP-4.1 | AUD-21 | Remove `user-scalable=no` |
| QW-10 | WP-3.4 | AUD-38 | Drop the daily `v` parameter |

---

## 5. Phases and work packages

Effort: **S** ≤ ½ day, **M** 1–2 days, **L** > 2 days. Paths are relative to the repo root.

### Phase 1 — Critical security and data-integrity issues

#### WP-1.1 Autosave correctness `[x]`
- **Done:** Replaced the 1 s isJustLoaded timer and skip-next-save flag with reference baselines (savedSlicesRef, captured on the first commit after each load): edits at any time are tracked, saves are serialized and only the sent slices are marked saved, unload sends dirty slices only (<=60 KB keepalive, else the browser's leave prompt), logout waits for/reports the save. New specs: edit during in-flight save, edit right after load, unload save.
- **Covers:** AUD-01 (QA-A-001, REL-003, REL-004), AUD-61 (REL-016 logout save)
- **Files:** `App.tsx` (load/save pipeline ~L800-1210, logout ~L1262-1277)
- **Depends on:** —
- **Effort:** M
- **Changes:**
  - The skip-after-load flag clears only load-induced dirtiness.
  - Remove only the keys actually sent, and only if unchanged since the snapshot; serialize saves.
  - The unload save sends dirty slices only (partial), with `sendBeacon` fallback.
  - Logout checks the save result.
- **Verify:** e2e `chunk-a-auth` "an edit made right after page load is saved"; new e2e "edits made during an in-flight save are persisted" and "tab close with > 64 KiB saves dirty slices"; whole suite green.

#### WP-1.2 ⚡ Accounts created with a pre-set id `[x]`
- **Done:** handleSaveAccount now decides new-vs-update by whether the id exists, so bank-link and CSV-import accounts are created (App.tsx). Tests: banking 'no orphans' / 'linked' and CSV 'new account' specs un-annotated and passing.
- **Covers:** AUD-03 (QA-B-001, QA-F-002)
- **Files:** `App.tsx` (`handleSaveAccount` ~L1279-1330; callers L2629, L2642)
- **Depends on:** —
- **Effort:** S
- **Verify:** e2e B33 "imported transactions belong to an account that exists", B34 "row shows as linked", F12 "CSV import that creates a new account…".

#### WP-1.3 Server-side blob write safety `[x]` — needs decision K3
- **Done:** POST /api/data is one atomic jsonb merge under the row lock (no blob read into Node; empty-payload guard evaluated in SQL); /pending store/delete are single atomic key-scoped statements that never touch lastUpdatedAt; password change + session revocation in one transaction. tests/e2e/api/blob-writes (20 racing rounds), connect 'ready' persisted spec un-annotated.
- **Covers:** AUD-02 (REL-001, QA-B-005), AUD-19 short-term (PERF-004), AUD-62 (REL-017)
- **Files:** `server/src/data.ts`, `server/src/enableBanking.ts` (pending handlers), `server/src/users.ts`, `App.tsx` L1940-1947 (await `/pending`), `pages/EnableBankingCallback.tsx`
- **Depends on:** —
- **Effort:** M
- **Changes:** every writer uses a single atomic `UPDATE … SET data = data || $2::jsonb` (or a `FOR UPDATE` transaction); `/pending` no longer touches `lastUpdatedAt`; password change in one transaction.
- **Verify:** new API test `tests/e2e/api/blob-writes.spec.ts` (concurrent `/pending` + `/api/data`: both writes kept, `lastUpdatedAt` not rolled back); e2e B29 "connection ready persisted".

#### WP-1.4 ⚡ SSRF and dev mock server `[x]` — needs decision K11
- **Done:** smart-fetch now requires auth, is rate limited, and fetches through server/src/urlGuard.ts (blocks private/loopback/metadata IPs at connect time incl. redirects, 10 s timeout, 2 MB cap); dev server mock is opt-in (CRYSTAL_MOCK_API=1), loopback-bound, checks passwords, has no user-1 fallback and no /api/ai/proxy; README rewritten. Tests: tests/unit/urlGuard + dev-server, tests/e2e/api/smart-fetch.
- **Covers:** AUD-10 (SEC-001), AUD-11 (SEC-002)
- **Files:** `server/src/smartFetcher.ts`, new `server/src/urlGuard.ts`, `server.ts`, `README.md`
- **Depends on:** —
- **Effort:** S
- **Verify:** API test: unauthenticated `smart-fetch` → 401; authenticated `http://127.0.0.1…` → 400; public URL allowed. Script test: mock login with a wrong password → 401; `/api/ai/proxy` → 404.

#### WP-1.5a ⚡ Login brute force `[x]`
- **Done:** Login now has three limiters (client+account 5, account-only 10, client-only 100 per 15 min), trust proxy is a hop count (TRUST_PROXY_HOPS, default 1), nginx overwrites X-Forwarded-For, and compose no longer publishes the backend port. tests/e2e/api/login-limits.spec.ts fails on the old code (14×401) and passes now.
- **Covers:** AUD-12 (SEC-003)
- **Files:** `server/src/index.ts`, `server/src/auth.ts`, `nginx.conf`
- **Depends on:** —
- **Effort:** S
- **Verify:** API test: 6 attempts with rotating `X-Forwarded-For` → 429; spraying 11 emails from one IP → 429.

#### WP-1.5b Password policy, input validation, defaults `[x]` — needs decision K9
- **Done:** Server validates names (≤100), email, password (8–72 bytes) on register and change-password with 400 field messages; client checks mirror it; production refuses to start without a real JWT_SECRET; no hardcoded fallback secrets; compose requires JWT_SECRET/POSTGRES_PASSWORD; login runs a dummy bcrypt compare (no timing oracle). Register still returns 409 for a taken email (open registration makes enumeration inherent).
- **Covers:** AUD-32 (SEC-009, QA-A-007, QA-A-008), AUD-30 (SEC-007), AUD-53 (SEC-012)
- **Files:** `server/src/auth.ts`, `server/src/users.ts`, `server/src/authConfig.ts`, `server/src/crypto.ts`, `pages/SignUp.tsx`, `components/ChangePasswordModal.tsx`, `docker-compose.yml`, `crystal/docker-compose.yml`
- **Depends on:** WP-1.5a
- **Effort:** M
- **Verify:** e2e A4 (short password rejected), A5 (300-char name → field message); API tests for 400s; the server refuses to start in production without `JWT_SECRET`.

#### WP-1.6 Enable Banking key off the client `[x]`
- **Done:** Enable Banking key now lives only in the new enable_banking_credentials table (AES-256-GCM, per user); provider routes resolve it server-side, /credentials reports status only; /api/data and /pending strip clientCertificate and legacy blobs/localStorage are migrated and scrubbed on next load; client no longer sends or stores the key. 4 API tests incl. DB inspection.
- **Covers:** AUD-13 (SEC-004)
- **Files:** `server/src/enableBanking.ts`, `server/src/crypto.ts`, `server/src/database.ts` (new `enable_banking_credentials` table), `App.tsx` EB handlers, `pages/EnableBankingCallback.tsx`, `components/EnableBankingIntegrationCard.tsx`, `utils/enableBankingStorage.ts`
- **Depends on:** WP-1.3
- **Effort:** L
- **Verify:** API test: the key is stored encrypted and never returned; the `/api/data` blob contains no `clientCertificate`; e2e `chunk-b` banking specs stay green.

#### WP-1.7 Validation of stored and restored data `[x]`
- **Done:** POST /api/data validates every payload with the zod schema (400, blob untouched; calendar-valid dates required); Smart Restore validates files per record with a readable problem list (utils/validateBackup); new parseLocalDateStrict returns null for invalid dates. parseLocalDate itself keeps its never-throw fallback because it has 254 call sites — migrating them is tracked under WP-2.13.
- **Covers:** AUD-28 (SEC-005, REL-013)
- **Files:** `server/src/data.ts`, `server/src/schemas.ts`, `components/SmartRestoreModal.tsx`, `utils.ts` (`parseLocalDate`)
- **Depends on:** WP-1.3
- **Effort:** M
- **Verify:** API test: malformed payload → 400; unit test: `parseLocalDate` rejects invalid input; e2e restore (F15) still passes.

#### WP-1.8 ⚡ Demo data and dev-mode leakage `[x]`
- **Done:** Removed the demo-connection fallback and the demo initial state; isDevEnvironment is now import.meta.env.DEV only (no hostname check); dev-cache write debounced to 1.5 s. New tests/e2e/regression/localhost-install.spec.ts (fails without the fix); AUD-05 specs un-annotated.
- **Covers:** AUD-05 (QA-B-002, QA-B-003), AUD-08 (REL-007, PERF-013)
- **Files:** `App.tsx` L846-848, L914-918, L960-965, L1006-1018, L1134-1142; `utils/browserCache.ts`
- **Depends on:** —
- **Effort:** S
- **Verify:** e2e B25 "user with no bank connections sees none", B26 "deleting all connections is permanent"; new e2e "restore on localhost does not enter demo mode" (runs against `http://localhost:4173`).

#### WP-1.9 ⚡ DOM XSS in map pins `[x]`
- **Done:** Logo URLs interpolated into Leaflet divIcon HTML go through utils/safeImageUrl.ts (http(s)/data:image only, attribute-escaped) in TransactionDetailModal and MerchantOverviewModal. tests/e2e/regression/logo-xss.spec.ts executes the payload on the old code (__pwned=1) and not on the new; unit tests for the util.
- **Covers:** AUD-29 (SEC-006)
- **Files:** `components/MerchantOverviewModal.tsx`, `components/TransactionDetailModal.tsx`
- **Depends on:** —
- **Effort:** S
- **Verify:** new e2e: a merchant logo override containing `"><img onerror>` doesn't execute (dialog listener never fires).

#### WP-1.10 Bank sync correctness `[x]`
- **Done:** Sync guards against concurrent runs, dedupes by provider id (identical same-day purchases kept), surfaces per-connection failures via toast and card lastError alert; sync-all shows a summary.
- **Covers:** AUD-06 (REL-009, QA-B-004), AUD-25 (REL-010, QA-B-011)
- **Files:** `App.tsx` L2456-2620, `components/EnableBankingIntegrationCard.tsx`
- **Depends on:** WP-1.2
- **Effort:** M
- **Verify:** e2e B32 "imports all 3 incl. identical purchases", B36 "sync failure is shown"; B35 re-sync no duplicates stays green.

#### WP-1.11 CSV import correctness `[x]`
- **Done:** New utils/parseAmount handles EU/US/space/paren/trailing-minus formats; short keywords (cr, in…) only match exactly and 'name' is mapped before credit/debit so Description auto-maps. 17 unit tests; F10/F11 un-annotated and passing.
- **Covers:** AUD-07 (REL-006, QA-F-001), AUD-26 (QA-F-003)
- **Files:** `components/ImportWizard.tsx`
- **Depends on:** WP-1.2
- **Effort:** M
- **Verify:** e2e F10 "keeps European-format amounts", F11 "auto-maps Description"; unit tests for the amount parser.

### Phase 2 — High-severity bugs and reliability

#### WP-2.1 ⚡ Backend and startup resilience `[x]`
- **Done:** db.connect() moved inside try in register and save (client?.release), pool 'error' listener, JSON error middleware, unhandledRejection logger, PORT env; startup failures no longer call signOut (session not revoked). tests/unit/backend-resilience (hangs/crashes on old code); A11 un-annotated and passing.
- **Covers:** AUD-09 (REL-005), AUD-27 (REL-008, QA-A-006)
- **Files:** `server/src/auth.ts`, `server/src/data.ts`, `server/src/database.ts`, `server/src/index.ts`, `hooks/useAuth.ts`
- **Depends on:** —
- **Effort:** S
- **Verify:** script test: register while the DB is down → 500 JSON and the process stays alive; e2e A11 "transient 500 on startup does not sign the user out".

#### WP-2.2 Save status, conflicts and session expiry `[x]` — needs decision K4
- **Done:** Save outcomes are reported (persistent toast, retry with 5-30 s backoff, retry on 'online'); a 409 conflict fetches the server copy, three-way merges the slices being sent (utils/threeWayMerge.ts, unit-tested), re-sends and refreshes the screen with a 'Synced' toast (K4 as accepted); 401/403 shows a session-expired notice. A25-A27 un-annotated.
- **Covers:** AUD-04 (REL-002, QA-A-002, QA-A-003, QA-A-004)
- **Files:** `App.tsx` save pipeline, new `components/SaveStatusIndicator.tsx`
- **Depends on:** WP-1.1, WP-1.3
- **Effort:** M
- **Verify:** e2e A25 "network failure surfaced", A26 "two tabs: conflict", A27 "session revoked → re-login prompt".

#### WP-2.3 Error boundaries and timeouts `[x]`
- **Done:** Page ErrorBoundary now resets on route change and offers Try again; new RootErrorBoundary wraps the whole app in index.tsx; utils/fetchWithTimeout (20s, caller-signal aware) used for auth/API wrapper, Twelve Data, geocoding, smart-fetch callers; Enable Banking outbound calls use AbortSignal.timeout. Regression e2e (fails on old code) + 3 unit tests.
- **Covers:** AUD-34 (REL-011), AUD-35 (REL-012)
- **Files:** `App.tsx` (`ErrorBoundary`), `index.tsx`, new `utils/fetchWithTimeout.ts`, `src/services/twelveDataService.ts`, `server/src/enableBanking.ts`, `server/src/smartFetcher.ts`, `pages/Investments.tsx`
- **Depends on:** —
- **Effort:** S
- **Verify:** new e2e: after a page crash, navigating elsewhere renders the new page; unit test for `fetchWithTimeout`.

#### WP-2.4 ⚡ Routing fixes `[x]`
- **Done:** isDataLoaded is only set inside the load transition (no early commit before accounts), so detail-page refresh stays on the page; unknown routes and missing accounts/holdings now show a 'not found' toast and land on the list. Specs B12, E5, F23 and the deep-link spec pass.
- **Covers:** AUD-46 (QA-B-006, QA-E-001), AUD-72 (QA-F-009)
- **Files:** `App.tsx` L179-208, L2748-2752
- **Depends on:** —
- **Effort:** S
- **Verify:** e2e B12 "refresh keeps the detail", E5 "holding detail survives refresh", F23 "unknown URL".

#### WP-2.5 Modal stacking and mobile footers `[x]` — needs decision K2
- **Done:** Root cause: the Z_INDEX classes (z-modal, z-popover, …) were never defined in CSS, so modals had no z-index and sat under page content and the mobile nav. Defined them with @utility in index.css (modal 1300 above nav). Category delete, mobile change-password, mobile restore and mobile prediction specs un-annotated and passing; dialog semantics/focus trap stay in WP-4.2.
- **Covers:** AUD-23 functional part (QA-C-001, QA-A-005, QA-F-007, QA-E-004)
- **Files:** `components/Modal.tsx`, `pages/Categories.tsx`, `pages/Challenges.tsx`, `components/ChangePasswordModal.tsx`, `components/SmartRestoreModal.tsx`, `components/PredictionModal.tsx`, `components/MobileNavbar.tsx`
- **Depends on:** —
- **Effort:** M
- **Verify:** e2e C19 "delete a category", A15-A17 mobile change password, F15 mobile restore, E14 mobile prediction.

#### WP-2.6 ⚡ One-place logic bugs `[x]`
- **Done:** Convert-to-Invoice drops the quote id so a new invoice is created (Invoices.tsx); ConfirmationModal's trailing onClose no longer cancels the reset's second step and reset now persists the empty state to the server (DataImportExport.tsx, App.tsx); profile save is awaited, rolled back and reported by toast (useAuth.ts, PersonalInfo.tsx). Specs F3, F16 (now asserts server wipe), A19 pass.
- **Covers:** AUD-14 (QA-F-004), AUD-49 (QA-F-005), AUD-44 functional part (QA-A-009)
- **Files:** `pages/Invoices.tsx`, `components/ConfirmationModal.tsx` / `pages/DataImportExport.tsx`, `pages/PersonalInfo.tsx`, `hooks/useAuth.ts`
- **Depends on:** —
- **Effort:** S
- **Verify:** e2e F3 "convert to invoice", F16 "factory reset final step", A19 "failed profile save reported".

#### WP-2.7 Feature gaps: budgets, widgets, pagination, small form bugs `[x]`
- **Done:** Budgets: Delete Budget in the edit modal (desktop) and mobile swipe both go through a confirmation; removed dashboard widgets are remembered (preferences.dashboardHiddenWidgets) so they are no longer re-added and can be added back; invoices paginate 10/page with working arrows; amount field joined to the transaction form so Enter submits; odometer readings are validated against neighbouring logs. Specs D5, F4 (24-invoice seed), F17/F18, B15, B23 now real and passing.
- **Covers:** AUD-48 (QA-D-001, QA-D-002), AUD-50 (QA-F-006), AUD-70 (QA-F-008), AUD-74 (QA-B-008), AUD-75 (QA-B-010)
- **Files:** `pages/Budgeting.tsx`, `components/BudgetModal.tsx`, `pages/Dashboard.tsx` L1311-1345, `pages/Invoices.tsx`, `components/AddTransactionModal.tsx`, `components/AddMileageLogModal.tsx`
- **Depends on:** —
- **Effort:** M
- **Verify:** e2e D5 "delete a budget", F17/F18 widgets, F4 pagination, B15 Enter submits, B23 mileage.

#### WP-2.8 Investments valuation `[x]` — needs decision K8
- **Done:** buildHoldingsOverview no longer treats a missing quote as €0: uses the last trade price (else average cost), flags priceUnavailable, and excludes those holdings from gain/loss % (overview, per-row, detail, mobile); rows show 'Price unavailable'. 4 unit tests; E4 un-annotated and passing.
- **Covers:** AUD-15 (QA-E-003)
- **Files:** `utils/investments.ts` L60-130, `pages/Investments.tsx`
- **Depends on:** —
- **Effort:** S
- **Verify:** e2e E4 "holding with no price data is not shown as −100%".

#### WP-2.9 Mobile feature parity `[x]`
- **Done:** Mobile: Sign Out in the More sheet; bill notification bell in the mobile dashboard header; Record Sale / Retire Vehicle / Reopen buttons in MobileAccountHeader; Wallet section with Add Card (list, edit, delete) in MobileSubscriptionsView. A13, B24, D15, D17 un-annotated and passing at 375 px.
- **Covers:** AUD-47 (QA-A-010, QA-B-007, QA-D-003, QA-D-004)
- **Files:** `components/MobileNavbar.tsx`, `components/MobileAccountHeader.tsx` / account views, `components/MobileSubscriptionsView.tsx`, `components/MobileDashboardView.tsx`
- **Depends on:** WP-2.5
- **Effort:** M
- **Verify:** e2e A13 "mobile sign out from Dashboard", B24 "asset closing actions at 375", D17 "add loyalty card at 375", D15 "notification center at 375".

#### WP-2.10 Test infrastructure and supply chain `[x]`
- **Done:** Lockfiles committed for both packages (npm audit --omit=dev --audit-level=high: 0 high/critical after audit fix); Dockerfiles use npm ci; shadcn moved to devDependencies; CI gains a test job (lint, npm test, audit) gating the image builds; legacy script tests exit non-zero on failure and the three tests that re-implemented logic inline were removed (covered by real-module and e2e tests); npm test chains unit + utils + server tests.
- **Covers:** AUD-33 (REL-014), AUD-58 (SEC-017)
- **Files:** `package.json` (`test` script), `utils.test.ts`, `server/src/*.test.ts`, `server/package.json`, lockfiles, `.github/workflows/build-and-publish.yml`, `Dockerfile`, `server/Dockerfile`, `tests/run-all.sh`
- **Depends on:** —
- **Effort:** M
- **Verify:** `npm test` exits non-zero on a deliberately failing assertion; tests import real modules; CI runs `npm test`.

#### WP-2.11 Backend hardening (low-severity bundle) `[x]` — needs decision K7
- **Done:** ALLOW_REGISTRATION flag (default true, K7) in server/compose/.env.example; local initials avatar instead of pravatar; /health returns status only and Enable Banking errors are mapped to safe messages (details logged); urlencoded removed, non-JSON bodies 415, 100 kB global body limit with the 50 MB limit only on /api/data after auth, 413/400 JSON errors; Sec-Fetch-Site/Origin CSRF guard; last_seen_at throttled to 5 min + indexes + stale-session purge; backend image runs as USER node (frontend nginx image left as is: it needs port 80 and the compose/Umbrel mappings). 11 API tests + 4 unit tests.
- **Covers:** AUD-52 (SEC-011), AUD-54 (SEC-013), AUD-55 (SEC-014), AUD-56 (SEC-015), AUD-57 (SEC-016), AUD-59 (SEC-018), AUD-65 (PERF-012)
- **Files:** `server/src/index.ts`, `server/src/auth.ts`, `server/src/middleware.ts`, `server/src/database.ts`, `Dockerfile`, `server/Dockerfile`
- **Depends on:** WP-2.1
- **Effort:** M
- **Verify:** API tests: `/health` hides DB error text; urlencoded body → 415; 200 kB login body → 413; `ALLOW_REGISTRATION=false` → 403; `last_seen_at` is throttled.

#### WP-2.12 Account-level state and password reset `[x]` — needs decision K10
- **Done:** Onboarding-completed flag and savings sprints now live in the account preferences (localStorage values migrate once), so they follow the user to new devices; 'Forgot password?' shows administrator guidance (K10) and server/src/cli/reset-password.ts (documented in README) resets a password and revokes sessions. A22/E15/A14 updated and passing; 2 CLI API tests.
- **Covers:** AUD-71 (QA-A-012, QA-E-005), AUD-51 (SEC-010, QA-A-011)
- **Files:** `App.tsx` (onboarding flag), `pages/Challenges.tsx` (sprints), `types.ts`, `pages/SignIn.tsx`, new `server/src/cli/reset-password.ts`
- **Depends on:** WP-1.1
- **Effort:** M
- **Verify:** e2e A22 "onboarding follows the account", E15 "sprint visible on another device", A14 "Forgot password shows guidance"; CLI script test.

#### WP-2.13 Typing and catch hygiene `[x]`
- **Done:** No empty catch blocks remain in app code (best-effort storage/cache failures log once via utils/logging.warnIgnored; rollbacks log); tsconfig.strict.json (strict: true) now covers the new/rewritten utils and runs in npm run lint (it caught a duplicated date key in utils.ts); unusable FX rates are rejected at the Twelve Data boundary and warned about once when converting; /api/data response shape checked. Remaining: the 279 any's and non-strict root config are left for incremental adoption (add files to tsconfig.strict.json).
- **Covers:** AUD-60 (REL-015), AUD-61 remainder (REL-016)
- **Files:** `tsconfig.json`, boundary fetches, empty catches listed in REL-016
- **Depends on:** WP-2.10
- **Effort:** L (incremental)
- **Verify:** `npm run lint` with `strictNullChecks` on changed files; no empty `catch {}` remaining (grep).

### Phase 3 — Performance

#### WP-3.1 Bundle diet `[ ]` — needs decision K1
- **Covers:** AUD-16 (PERF-001), AUD-17 (PERF-002), AUD-39 (PERF-008), AUD-64 (PERF-011); AUD-63 (PERF-010) per K1
- **Files:** `components/ui/Icon.tsx`, `vite.config.ts`, `App.tsx` (preloader, quick-add, demoData import)
- **Depends on:** —
- **Effort:** M
- **Verify:** the build entry chunk is < 800 kB raw; `index.html` has no `modulepreload` for recharts/leaflet; the sign-in page loads ≤ 10 JS files; full e2e green.

#### WP-3.2 Transport: compression and security headers `[x]`
- **Done:** Backend: gzip via compression (>1 kB), X-Powered-By off, nosniff / X-Frame-Options / Referrer-Policy / Permissions-Policy, private no-cache. nginx.conf: gzip for text types and the same headers on every static location, plus a CSP in Report-Only mode (enforcing it needs a pass in a real browser against the production bundle). nginx config could not be executed locally (no nginx).
- **Covers:** AUD-18 (PERF-003), AUD-31 (SEC-008)
- **Files:** `nginx.conf`, `server/src/index.ts`, `server/package.json`
- **Depends on:** —
- **Effort:** S
- **Verify:** API test: `GET /api/data` with `Accept-Encoding: gzip` → `content-encoding: gzip`; headers include `X-Content-Type-Options`, `X-Frame-Options`, and no `X-Powered-By`. The nginx part needs a manual `docker compose` check (no nginx locally).

#### WP-3.3 Data path efficiency `[x]`
- **Done:** GET /api/data revalidates cheaply: ETag from the JSONB lastUpdatedAt (no blob read) and 304 on If-None-Match; combined with gzip. Normalised tables remain tracked separately (K3).
- **Covers:** AUD-36 (PERF-005), AUD-19 long-term (K3, tracked separately)
- **Files:** `server/src/data.ts`, `hooks/useAuth.ts`
- **Depends on:** WP-1.3
- **Effort:** S (ETag); L (tables, out of scope)
- **Verify:** API test: second `GET /api/data` with `If-None-Match` → 304.

#### WP-3.4 ⚡ Merchants page and logo caching `[x]`
- **Done:** Merchant spend trends computed in one pass via utils/merchantTrends.ts (unit-tested equal to the per-entity scan; 10k tx x 600 merchants < 500 ms); Brandfetch logo URLs no longer carry a daily version parameter. Pagination/virtualization of the merchant grid is not done (see note).
- **Covers:** AUD-37 (PERF-006), AUD-38 (PERF-007)
- **Files:** `pages/Merchants.tsx` L372-410, `utils/brandfetch.ts` L97-105
- **Depends on:** —
- **Effort:** S
- **Verify:** unit test: logo URL is stable across days; e2e C23/C24 merchants stay green.

#### WP-3.5 Fonts `[ ]`
- **Covers:** AUD-40 (PERF-009)
- **Files:** `index.html`, `index.css`, `hooks/useFont.ts`
- **Depends on:** —
- **Effort:** S
- **Verify:** sign-in page makes 0 requests to `fonts.googleapis.com`; choosing another font in Preferences loads it on demand.

### Phase 4 — UI consistency and accessibility

#### WP-4.1 ⚡ Zoom `[x]`
- **Done:** Removed maximum-scale=1/user-scalable=no from the viewport meta; iOS-only 16px form-control rule prevents focus-zoom. tests/e2e/regression/viewport.spec.ts.
- **Covers:** AUD-21 (UI-004)
- **Files:** `index.html`, `index.css` (16 px inputs on iOS)
- **Depends on:** —
- **Effort:** S
- **Verify:** new e2e: the viewport meta has no `user-scalable=no` / `maximum-scale=1`.

#### WP-4.2 Dialog semantics `[ ]` — needs decision K2
- **Covers:** AUD-23 a11y part (UI-006)
- **Files:** `components/Modal.tsx`, `components/AddTransactionModal.tsx`, overlays listed in UI-009
- **Depends on:** WP-2.5
- **Effort:** M
- **Verify:** new e2e: an open modal has `role="dialog"` + `aria-modal`; Tab from the last control stays inside; focus returns to the opener on close.

#### WP-4.3 Accessible names and keyboard access `[ ]`
- **Covers:** AUD-24 (UI-016, UI-007, QA-C-002, QA-D-006), AUD-22 (UI-005), AUD-69 (UI-015)
- **Files:** `components/base/buttons/button-utility.tsx`, `pages/Tags.tsx`, `components/MobileBudgetView.tsx`, `pages/Preferences.tsx`, `components/AccountRow.tsx`, `pages/Investments.tsx`, `pages/Forecasting.tsx`, `pages/SignIn.tsx` / `SignUp.tsx`
- **Depends on:** —
- **Effort:** M
- **Verify:** e2e C21 "tag actions named", D3 "mobile + named"; new e2e: axe `button-name` / `select-name` = 0 on populated Transactions, Investments, Tags, Preferences; Enter on a focused account card opens it.

#### WP-4.4 Contrast and type scale `[ ]` — needs decision K6
- **Covers:** AUD-20 (UI-003), AUD-42 (UI-008)
- **Files:** `utils/theme.ts`, `constants.tsx` (button styles), `components/HeaderButton.tsx`, pages using `text-[9px]`/`text-[7px]`
- **Depends on:** WP-4.6
- **Effort:** M
- **Verify:** new e2e: axe `color-contrast` = 0 on the 10 main pages (light and dark).

#### WP-4.5 Responsive and tap targets `[ ]`
- **Covers:** AUD-45 (UI-011, QA-D-005, QA-E-002), AUD-66 (UI-012)
- **Files:** `pages/Merchants.tsx`, `components/MobileForecastView.tsx`, `pages/Challenges.tsx`, `components/EnableBankingIntegrationCard.tsx`
- **Depends on:** —
- **Effort:** S
- **Verify:** e2e D9 (forecast no overflow at 375), E13 (challenges no overflow); new e2e for Merchants at 375.

#### WP-4.6 Design tokens `[ ]` — needs decision K5
- **Covers:** AUD-41 (UI-001, UI-002)
- **Files:** `tailwind.config.js` (delete), `index.css` `@theme`, `DESIGN.md`, `pages/Schedule.tsx` (`text-3xs`)
- **Depends on:** —
- **Effort:** S for the token source; L for migrating raw classes (incremental)
- **Verify:** the build emits `.z-modal` and `.text-3xs` rules; lint rule for raw palette classes (warn).

#### WP-4.7 Feedback, copy, empty states, duplicates `[ ]`
- **Covers:** AUD-44 remainder (UI-010), AUD-67 (UI-013, QA-B-009), AUD-68 (UI-014), AUD-43 (UI-009 non-modal)
- **Files:** pages with `alert()` (26 call sites), labels listed in UI-013, `components/EmptyState.tsx` adopters
- **Depends on:** WP-2.6
- **Effort:** M
- **Verify:** `grep -c "alert("` = 0 in `pages/` and `components/`; e2e suites green.

#### WP-4.8 Privacy mode coverage `[ ]`
- **Covers:** AUD-73 (QA-F-010)
- **Files:** `components/AccountRow.tsx` and the balance pills it renders
- **Depends on:** —
- **Effort:** S
- **Verify:** e2e F21 "privacy mode hides amounts".

---

## 6. Suggested execution order

1. **Quick wins:** WP-1.2 → WP-1.8 → WP-2.4 → WP-2.6 → WP-1.4 → WP-1.5a → WP-1.9 → WP-2.1 → WP-3.4 → WP-4.1
2. **Phase 1:** WP-1.1 → WP-1.3 → WP-1.10 → WP-1.11 → WP-1.5b → WP-1.7 → WP-1.6
3. **Phase 2:** WP-2.10 → WP-2.2 → WP-2.5 → WP-2.3 → WP-2.7 → WP-2.8 → WP-2.9 → WP-2.11 → WP-2.12 → WP-2.13
4. **Phase 3:** WP-3.1 → WP-3.2 → WP-3.3 → WP-3.5
5. **Phase 4:** WP-4.2 → WP-4.3 → WP-4.6 → WP-4.4 → WP-4.5 → WP-4.7 → WP-4.8
