# Architecture and Performance Review

## Overview
The application is a single-page React app built with Vite. Almost all stateful logic for authentication, data persistence, and feature behavior is concentrated in `App.tsx`, while feature pages such as the dashboard contain extensive client-side calculations. Current performance bottlenecks stem from heavy, synchronous work performed on every render and broad component re-renders triggered by global state changes.

## Key Findings

### 1) Monolithic global state in `App.tsx`
* Dozens of independent `useState` hooks for every data domain live in `App.tsx`. Any update forces the entire component tree—including lazy-loaded pages once mounted—to re-render, even if only one slice of data changed. This increases render time and makes interactions feel sluggish, especially as data grows.
* Example: `App.tsx` tracks all entities (accounts, transactions, investments, budgets, tasks, warrants, scraper configs, tags, preferences, orders, etc.) and passes them down as props. These state updates trigger large prop cascades and reconciliation across the whole page hierarchy.【F:App.tsx†L111-L169】

### 2) Expensive warrant price scraping on the client
* Warrant price updates are executed client-side with DOM parsing and retry logic over multiple proxy URLs. Each run fetches and parses remote HTML for every configured item, with abort controllers and timeouts inside nested loops. This blocks the main thread and competes with UI work, making the interface feel choppy while requests are in flight.【F:App.tsx†L200-L275】
* After scraping, the code walks all investment accounts and recomputes balances on every price change, comparing arrays via `JSON.stringify`. That deep stringify comparison and per-account recomputation are O(n²) with growing data and can stall rendering for larger portfolios.【F:App.tsx†L283-L305】

### 3) Persistent autosave on every data change
* The app builds a large `dataToSave` object that includes every state slice, debounces it by 1.5s, and posts to `/api/data` whenever anything changes (except in demo mode). This means typing, toggling UI filters, or minor preference changes can trigger full payload serialization and network I/O, which slows the app and risks request piling when users make rapid edits.【F:App.tsx†L391-L476】
* A `beforeunload` handler also serializes and sends the latest state, adding work during navigation and potentially blocking unload in slower environments.【F:App.tsx†L478-L494】

### 4) Heavy synchronous dashboard calculations
* The dashboard recomputes income/expense summaries and change metrics by filtering and scanning the entire transaction list for each render. Transfer handling traverses transactions multiple times and uses sets to de-duplicate pairs inside the render path. With larger datasets, this synchronous processing (including repeated currency conversions) increases render time and makes the dashboard scroll/filters feel laggy.【F:pages/Dashboard.tsx†L85-L200】

## Recommendations (without removing features)

1. **Introduce domain-specific context providers** (transactions, accounts, preferences, warrants, etc.) or a light state manager to localize re-renders. Memoize selector hooks so only components that depend on a slice update.
2. **Move scraping and enrichment off the main thread** by delegating to a backend endpoint or using Web Workers. Cache successful price fetches per ISIN and throttle update frequency. Replace `JSON.stringify` equality checks with stable identifiers or memoized selectors.
3. **Scope autosave to meaningful changes**: split persisted data into logical groups, persist only dirty slices, and debounce per-slice. For UI-only toggles (sidebar state, filters), keep them out of the persisted payload. Consider batching saves on blur/submit events rather than every keystroke.
4. **Precompute dashboard aggregates** using memoized selectors keyed by transaction hash and filters. Consider incremental aggregation when transactions change instead of recalculating the full dataset each render. For lists, add virtualization to avoid rendering all rows at once.
5. **Audit render-heavy components** (charts, lists) for unnecessary prop changes; wrap in `React.memo` with stable props and derive view models outside render where possible.

Applying these changes will keep all current features but significantly reduce main-thread work and unnecessary re-renders, making the app feel snappier.
