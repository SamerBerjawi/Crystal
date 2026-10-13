# Crystal — Performance Findings

Reviewed 2026-10-13 at commit `2073eda`. Scope is performance only. Routes, endpoints and workflow IDs follow `audit/inventory.md`. No application code was modified.

**How things were measured**
- **Bundle**
  - `ANALYZE=true npx vite build --mode production --outDir <scratch>`. I bypassed `npm run build` because it bumps `version.ts` and `package.json`.
  - A second build with `--sourcemap`, with byte attribution from `source-map-explorer@2.5.3`.
  - gzip sizes from `gzip -9`.
- **Runtime**
  - The production build served with `vite preview` and driven in the built-in browser (Chrome 152, Apple Silicon Mac, **no CPU throttling**, so slower devices will be several times worse).
  - Data was a **synthetic 10,000-transaction dataset** (2.6 MB JSON, generated from `demoData.ts`) loaded via demo mode's dev cache. One variant had 600 distinct merchants.
  - Timings come from the `long-animation-frame` and `event` PerformanceObservers.
- **Server**: the real `server/src/data.ts` router against a DB stub that reproduces node-postgres' JSONB parse and stringify behavior. **No real Postgres was available**, so DB-internal costs (TOAST, WAL) are excluded and the server numbers are a lower bound.
- **Not available**: Lighthouse (not installed). Throttled-device profiling (not possible in the pane).

Labels: **Measured** = numbers from a run. **Code** = confirmed by reading the cited code.

---

### [PERF-001] The 1.35 MB entry chunk is mostly an icon library that ships all 6 weights, but the app uses only one
- Severity: **High**
- Location: `components/ui/Icon.tsx:1-234` (231 named imports from `@phosphor-icons/react`); `index.tsx:7` sets `IconContext` `weight: 'duotone'`
- Evidence (measured, source-map attribution of `index-B9YGBIPV.js`, 1,351.7 kB minified):
  ```
  649.9 kB  @phosphor-icons/react   ← 48% of the entry chunk
  174.7 kB  react-dom
   92.4 kB  motion-dom
   67.5 kB  App.tsx
   64.5 kB  components/AddTransactionModal.tsx
  ```
  - Tree-shaking does work: 230 icons are bundled out of about 1,500.
  - But each icon pulls in `dist/defs/<Icon>.es.js`, which holds the SVG for **all six weights** (thin/light/regular/bold/fill/duotone). That's 2,662 bytes per icon versus 289 bytes for the component wrapper.
  - `grep` finds only `duotone` used anywhere in the app.
- Impact: every visitor, including the sign-in page, downloads and parses about 520 kB of SVG path data that's never rendered. Parse and compile time is the biggest single contributor to startup on mid-range phones.
- Suggested fix: generate a duotone-only icon set (e.g. from `@phosphor-icons/core` SVGs, or a build-time script emitting one small component per icon), or switch to an SVG sprite. Expected entry-chunk drop is about 500 kB minified, roughly 130 kB gzipped.
- Effort: **M**

### [PERF-002] `manualChunks` pulls Recharts and Leaflet into the startup path of every page
- Severity: **High**
- Location: `vite.config.ts` (`manualChunks: { leaflet: [...], recharts: [...], reactQuery: [...] }`)
- Evidence (measured):
  - The built `index.html` contains:
    ```html
    <script type="module" src="/assets/index-B9YGBIPV.js">
    <link rel="modulepreload" href="/assets/reactQuery-BTark1rd.js">
    <link rel="modulepreload" href="/assets/leaflet-DU6OOoQT.js">
    <link rel="modulepreload" href="/assets/recharts-B2JIrS0-.js">
    ```
  - The entry chunk has static `import{…}from"./leaflet-…js"` and `"./recharts-…js"` statements, yet **no eagerly loaded source module imports `recharts` or `leaflet`**. I checked all 47 app files in the entry chunk.
  - The cause: shared modules were placed inside the manual chunks. The `reactQuery` chunk contains `react` (7.9 kB) and the `leaflet` chunk contains part of `react-dom` (3.5 kB). The entry has to import those whole chunks to reach them.
  - Startup payload before first render:

    | file | raw | gzip |
    |---|---|---|
    | index (entry) | 1,351 kB | 356 kB |
    | recharts | 369 kB | 107 kB |
    | leaflet | 154 kB | 45 kB |
    | reactQuery | 47 kB | 14 kB |
    | index.css | 520 kB | 62 kB |
    | **total** | **2,443 kB** | **586 kB** |
- Impact: the sign-in screen and every page download and evaluate about 520 kB of charting and mapping code before anything renders, which defeats the existing lazy page splitting.
- Suggested fix: remove the object-form `manualChunks` and let Rollup split automatically, or use a function form that assigns **only** `node_modules/recharts|d3-*|victory-*` and `node_modules/leaflet|react-leaflet` and leaves `react`/`react-dom` to the vendor/entry chunk. Then confirm the `modulepreload` links are gone.
- Effort: **S**

### [PERF-003] No HTTP compression on static assets or API responses
- Severity: **High**
- Location: `nginx.conf` (no `gzip`/`brotli` directives); `server/src/index.ts` (no `compression()` middleware). The `nginx:1.27-alpine` base `nginx.conf` ships with `gzip` commented out, which is the stock config I know of; I couldn't pull the image to recheck.
- Evidence (measured):
  - `grep -n "gzip\|compression\|brotli" nginx.conf server/src/index.ts …` → **no matches**.
  - `GET /api/data` from the real router returned `content-encoding: null`, with a **2,635 kB** body for 10,000 transactions. The same JSON gzips to **150 kB** (17.6×).
  - The startup JS/CSS is 2,443 kB raw vs 586 kB gzipped (PERF-002 table).
- Impact: every cold load transfers about 4× more than it needs to, and every page refresh downloads the full uncompressed data blob (2.6 MB at 10k transactions, growing linearly). This hurts most on mobile and remote access to a home server (Umbrel over Tailscale or a VPN).
- Suggested fix:
  - In nginx: `gzip on; gzip_types application/javascript text/css application/json image/svg+xml; gzip_min_length 1024;`, optionally with `gzip_static` plus pre-compressed assets.
  - In Express, `app.use(compression())` for `/api/data`, or let nginx compress proxied responses with `gzip_proxied any`.
- Effort: **S**

### [PERF-004] Every edit rewrites the user's entire data blob on the server
- Severity: **High**
- Location: `server/src/data.ts:41-108` (`SELECT data … FOR UPDATE` → `{ ...currentData, ...incomingData }` → `INSERT … ON CONFLICT DO UPDATE SET data = EXCLUDED.data`); the client sends a partial save about 900 ms after each edit (`App.tsx:1154-1195`)
- Evidence (measured, real router, 10k-transaction blob, 20 runs):
  ```
  partial-save request body   : 59 bytes  (one task)
  blob re-serialized & written : 2,634 kB per save
  server time (Node only)      : p50 12 ms, p95 14 ms  (excludes Postgres)
  ```
- Impact:
  - **Write amplification ≈ 45,000×.** Postgres must de-TOAST, parse and re-store the whole JSONB value, and write about 2.6 MB of WAL per edit. That's on top of the measured Node CPU.
  - Saves for one user serialize on the row lock.
  - This scales linearly with history size and will dominate disk I/O on SD-card or eMMC home servers such as Raspberry Pi or Umbrel hardware.
- Suggested fix:
  - Short term: update only the changed top-level keys with `UPDATE financial_data SET data = data || $2::jsonb`. Postgres still rewrites the value, but Node no longer parses or serializes the blob.
  - Proper fix: store large collections (transactions, investment transactions, price history) in their own tables keyed by `(user_id, id)` and save diffs.
- Effort: **S** (short term) / **L** (proper)

### [PERF-005] The full dataset is fetched on every page load with no pagination or caching
- Severity: **Medium**
- Location: `hooks/useAuth.ts:141-143` (`fetch('/api/data')` on every boot); `server/src/data.ts:9-31`; also `POST /api/auth/login` returns the full `financialData` (`auth.ts:52-56`)
- Evidence (measured): `GET /api/data` → **2,635 kB** for 10k transactions, 40 ms on loopback, uncompressed (PERF-003). There's no `ETag`/`Last-Modified` and no date range or pagination parameters, and the client keeps no cached copy for authenticated users.
- Impact: load time and data usage grow with total history, not with what's on screen. A 5-year ledger is downloaded and parsed on every refresh.
- Suggested fix: add an `ETag` (e.g. the `lastUpdatedAt`) and honor `If-None-Match` → 304. Longer term, serve transactions in pages or by date range once they live in their own table (PERF-004).
- Effort: **S** (ETag) / **L** (pagination)

### [PERF-006] Merchants page: per-merchant scans of all transactions and an unpaginated grid
- Severity: **Medium**
- Location: `pages/Merchants.tsx:372-410` (`spendTrendsMap`: `entities.forEach(entity => transactions.forEach(tx => … normalizeMerchantKey(tx.merchant) …))`); the entity grid at `:816-1080` renders every entity with no pagination or virtualization; 49 of 50 `<img>` tags in `pages/` and `components/` lack `loading="lazy"`
- Evidence (measured, 10,000 transactions, 600 merchants, navigating to `/merchants`):
  ```
  long animation frames : 177 ms, 309 ms   (total 486 ms main-thread blocking)
  worst script          : index chunk @188 ms
  DOM nodes after render: 22,047
  ```
  The scan is O(merchants × transactions): 600 × 10,000 = 6M iterations, each one trimming and lowercasing a string (`normalizeMerchantKey`). With a Brandfetch key set, the grid also requests every merchant logo at once.
- Impact: the page freezes for about half a second on a fast laptop. Expect 2–3 s on a mid-range phone, and the cost grows with both merchant count and history size.
- Suggested fix:
  - Build one `Map<merchantKey, number[6]>` in a single pass over transactions, normalizing each merchant once.
  - Virtualize or paginate the grid.
  - Add `loading="lazy" decoding="async"` to logo `<img>`s.
- Effort: **S**

### [PERF-007] Merchant logo URLs change every day, defeating the browser cache
- Severity: **Medium**
- Location: `utils/brandfetch.ts:97-105`
- Evidence (code):
  ```ts
  const version = options?.refreshTimestamp ? String(options.refreshTimestamp) : new Date().toISOString().split('T')[0];
  const params = new URLSearchParams({ c: clientId, …, v: version });
  ```
- Impact: every logo in the Transactions list, Dashboard, Merchants and Reports gets a new URL each calendar day, so all of them are re-downloaded daily. That spends Brandfetch quota and bandwidth for no visual change.
- Suggested fix: drop `v` by default, and set it only from an explicit per-merchant `refreshTimestamp` when the user clicks "refresh logo".
- Effort: **S**

### [PERF-008] Idle route preloading downloads about 1.3 MB of page chunks on the sign-in screen
- Severity: **Medium**
- Location: `App.tsx:655-682` (preloads 8 page chunks via `requestIdleCallback`, regardless of auth state or connection)
- Evidence (measured): on a cold load of the **sign-in page** with no session, the browser fetched **45 JS files, 3,436 kB decoded**. That includes `Transactions` (396 kB), `Forecasting` (160 kB), `Accounts` (89 kB), `Schedule` (86 kB), `Investments` (64 kB) and `Budgeting` (58 kB), plus their dependencies (`AccountOverviewModal` 122 kB, `ring` 120 kB, …).
- Impact: unauthenticated visitors, and users on metered or mobile connections, download all the main pages before signing in. It also competes for bandwidth with the sign-in page's own resources.
- Suggested fix:
  - Run the preloader only after authentication.
  - Skip it when `navigator.connection?.saveData` is set or `effectiveType` is `2g`/`3g`.
  - Preload one route ahead (hover/focus on a nav item) instead of eight.
- Effort: **S**

### [PERF-009] Render-blocking third-party fonts: 11 Google Font families requested twice, plus self-hosted duplicates
- Severity: **Medium**
- Location: `index.html` (`<link href="https://fonts.googleapis.com/css2?family=Crete+Round&…&family=Ubuntu">`); `index.css:1` (`@import url('https://fonts.googleapis.com/css2?…same 11 families…')`); `index.css:2-11` (`@fontsource` Inter and Plus Jakarta Sans, 5 weights each)
- Evidence (measured / code):
  - The same Google Fonts stylesheet is linked from `index.html` **and** `@import`ed at the top of `index.css`. The `@import` chains a blocking third-party request inside the app's render-blocking CSS.
  - Inter and Plus Jakarta Sans are declared both by Google Fonts and by `@fontsource`. The built CSS has 55 `@font-face` rules, and 100 font files (50 woff2 + 50 woff, 1.4 MB) are emitted to `dist/assets`.
  - The user picks a **single** app font (`hooks/useFont.ts`), yet all 11 families are declared at startup.
- Impact: first paint waits on `fonts.googleapis.com`, and a slow or blocked Google CDN (offline home network, privacy blockers) delays the first render. Duplicate `@font-face` declarations can trigger duplicate font downloads.
- Suggested fix:
  - Self-host only the default font (`@fontsource`, woff2 only, `font-display: swap`).
  - Remove both Google Fonts references.
  - Load an alternative font's CSS on demand in `applyAppFont` when the user selects it.
- Effort: **S**

### [PERF-010] Transactions chunk carries 182 kB of `react-aria` for a sort-type import and a few primitives
- Severity: **Low**
- Location: `pages/Transactions.tsx:33` (`import type { SortDescriptor } from 'react-aria-components'`); `components/application/table/table.tsx`, `components/base/dropdown/dropdown.tsx`
- Evidence (measured, `Transactions-CrfX9Z9l.js`, 395.6 kB):
  ```
  182.2 kB react-aria · 40.5 kB react-aria-components · 25.2 kB react-stately · 53.6 kB Transactions.tsx
  ```
  `react-aria*` and `react-stately` make up 248 kB (63%) of the chunk.
- Impact: the most-used page after the Dashboard is a 396 kB chunk. It's also among the eight preloaded at startup (PERF-008).
- Suggested fix: confirm which `react-aria-components` primitives the table and dropdown actually need and import them via deep paths, or replace them with the existing headless components (`@base-ui/react` is already a dependency).
- Effort: **M**

### [PERF-011] Eager imports in the entry chunk that only some sessions need
- Severity: **Low**
- Location: `App.tsx:12` (`import AddTransactionModal`, statically, for the quick-add shortcut); `App.tsx:94` (`demoData`); `components/AddressAutocomplete.tsx` and `hooks/useAddressSearch.ts` (pulled in through the modal)
- Evidence (measured, entry-chunk attribution): `AddTransactionModal.tsx` **64.5 kB**, `demoData.ts` **21.4 kB**, `AddressAutocomplete` 5.4 kB, `useAddressSearch` 4.4 kB, all in the 1.35 MB entry chunk.
- Impact: about 95 kB of code for a modal opened with `n` and for demo-only data is parsed on every startup.
- Suggested fix: `lazy()` the quick-add modal (it's already conditionally rendered at `App.tsx:2909`) and dynamically `import('./demoData')` inside `handleEnterDemoMode`/`loadAllFinancialData` when demo defaults are needed.
- Effort: **S**

### [PERF-012] Each request does a session write, and the sessions table is never pruned
- Severity: **Low**
- Location: `server/src/middleware.ts:56-71` (a `SELECT` plus an `UPDATE user_sessions SET last_seen_at = NOW()` on **every** authenticated request); `server/src/database.ts:64-73` (no index on `user_sessions.user_id`, no cleanup job); `server/src/users.ts:69` (`UPDATE … WHERE user_id = $1`)
- Evidence (code): two DB round-trips before any handler runs, one of them a write. Rows are only inserted (each login) and soft-revoked, never deleted. `WHERE user_id = …` on password change, and the `ON DELETE CASCADE` from `users`, scan the table without an index.
- Impact: every API call (each autosave, each bank-sync page) adds a write and WAL. The sessions table grows without bound. The effect is small per request but constant.
- Suggested fix:
  - Throttle `last_seen_at` updates (e.g. only if older than 5 minutes: `… WHERE id=$1 AND last_seen_at < NOW() - interval '5 min'`).
  - Add `CREATE INDEX ON user_sessions(user_id)`.
  - Delete expired or revoked rows periodically.
- Effort: **S**

### [PERF-013] Every state change triggers synchronous full-dataset serialization (on `localhost` this includes `localStorage`)
- Severity: **Low**
- Location:
  - `App.tsx:960-965` (on **every** `dataToSave` change while `isDevEnvironment`, which includes self-hosted installs on `localhost`; see REL-007 → `saveDevCache`)
  - `utils/browserCache.ts:36-60` (`JSON.stringify` + `localStorage.setItem` of the whole dataset, plus a new IndexedDB connection that's never closed)
  - `App.tsx:1163` (a full `JSON.stringify(currentData)` "signature" on every autosave pass)
- Evidence (measured in the page, 10k transactions, 2,637 kB, 5 runs): `JSON.stringify` ≈ 2.3 ms + `localStorage.setItem` ≈ 5.3 ms → **≈ 7.5 ms median** of main-thread work per state change on Apple Silicon. The autosave signature adds another full stringify.
- Impact: small on fast hardware, but it runs on every keystroke-driven state change and grows linearly. Expect 30–50 ms per change on mid-range phones. It also fills the about 5 MB `localStorage` quota at roughly 20k transactions, at which point every change throws and logs a warning.
- Suggested fix:
  - Gate the dev cache on `import.meta.env.DEV` only.
  - Debounce it, and drop the `localStorage` copy (IndexedDB alone is enough).
  - Replace the signature stringify with per-slice reference tracking, since slices are already immutable.
- Effort: **S**

---

## Unverified

- **Duplicate font downloads**: Inter and Plus Jakarta Sans are declared by both Google Fonts and `@fontsource` (PERF-009). I didn't confirm in DevTools whether Chrome downloads both sources for the same weight. On the sign-in page I saw 5 font files and 1 Google Fonts CSS request.
- **Runtime on slower devices**: every runtime number here came from an unthrottled Apple Silicon Mac. Headline measurements at 10k transactions:
  - Dashboard LCP 656 ms
  - page navigations with long frames of 0–151 ms
  - search 88 ms on the worst keystroke
  - preference toggle 18–22 ms to paint
  - privacy toggle on the Dashboard 24–34 ms to paint

  These look fine on this machine. I couldn't apply CPU throttling in the pane, so I can't confirm phone-class behavior.
- **Postgres-side cost of PERF-004**: TOAST de/compression and WAL volume for a 2.6 MB JSONB rewrite weren't measured (no Postgres available). The 12 ms figure is Node-only.
- **Forecasting at scale**: the forecasting page rendered with a single 60 ms long frame at 10k transactions. I didn't test larger recurring-item counts or 2-year horizons with many accounts.
- **Enable Banking sync throughput**: accounts are synced sequentially (`App.tsx:2470`, with `details` and `balances` in parallel per account), and each backend call re-signs an RS256 JWT (`enableBanking.ts:30`). Parallelizing accounts would likely shorten multi-account syncs, but I didn't measure it without real credentials.
- **Unrelated correctness bug spotted** (out of scope, noted for the functional review): `pages/Merchants.tsx:374` hardcodes `const now = new Date(2026, 4, 23)`, so the merchant spend-trend sparklines always show Dec 2025–May 2026.

---

## Coverage

**Covered**
- **Bundle:** full production build, per-chunk sizes (81 JS chunks, 4.5 MB total JS), source-map attribution of the entry chunk and the largest page chunks (Transactions, Dashboard, Forecasting, AccountOverviewModal, recharts, leaflet, reactQuery), `modulepreload` analysis, CSS and font output.
- **Startup:** cold load of the sign-in page (requests, decoded bytes); authenticated Dashboard load with 10k transactions (LCP, long frames).
- **Runtime:** navigation to 8 main pages, typing in Transactions search, preference toggle, Dashboard privacy toggle, and Merchants with 600 merchants. Checked list virtualization and pagination: Transactions paginates at 25 and `TransactionList` is virtualized, both fine.
- **Server:** cost of a real `POST /api/data` partial save and `GET /api/data` with a 10k blob; middleware queries per request; schema and index review. DB queries are single-row primary-key lookups, so there's **no N+1** pattern. The real problem is the single-blob design (PERF-004/005).
- **Network:** compression, caching headers (`/assets` is correctly `immutable`), third-party fonts, logo URLs.
- **Assets:** `public/` holds only `favicon.svg` (2.7 kB) and `manifest.json`. There are no raster images to optimize. Logos come from Brandfetch (PERF-006/007).

**Not covered or partial**
- No Lighthouse run (not installed) and no CPU or network throttling. All runtime numbers are best case.
- No real Postgres. DB timings and the index review come from schema reading plus a stub.
- I didn't profile React component render counts with React DevTools. The re-render analysis relied on measured interaction latency, which was low enough on this hardware that memoization work isn't a priority yet.
- Mobile-specific views (`Mobile*View.tsx`) weren't measured separately.
- I didn't use subagents. The work followed measurement-driven targets.

**Side effects:** the build output, synthetic datasets and harnesses live in the session scratchpad. The `vite preview` server on port 4173 was stopped, and its origin's localStorage and IndexedDB in the built-in browser were cleared. Your own `npm run dev` (PID 59364) wasn't touched.

---

## Top 5

1. **PERF-001**: 650 kB (48%) of the 1.35 MB entry chunk is Phosphor icon data for all 6 weights, but the app only uses duotone. A duotone-only icon set saves about 500 kB minified.
2. **PERF-002**: Object-form `manualChunks` makes the entry statically import the Recharts (369 kB) and Leaflet (154 kB) chunks. Every page, including sign-in, loads **2.4 MB raw / 586 kB gzipped** before first render.
3. **PERF-003**: No gzip or brotli anywhere. `GET /api/data` is 2,635 kB uncompressed at 10k transactions and would be 150 kB gzipped. Static assets are sent at roughly 4× their compressed size.
4. **PERF-004**: Every edit rewrites the user's whole JSONB blob. A 59-byte change leads to 2.6 MB re-serialized and written, plus 12 ms of server CPU before Postgres even starts, and all of it grows with history size.
5. **PERF-006**: The Merchants page scans every transaction once per merchant and renders an unpaginated grid: 486 ms of main-thread blocking and 22k DOM nodes at 10k transactions and 600 merchants, on a fast laptop.
