# Changelog

All notable changes to Crystal are documented here. Versions before 3.0.0 were tagged `v1.x`–`v2.x`.

## [3.0.1] - 2026-11-07

Enable Banking fixes and settings.

### Fixed
- **Enable Banking errors are no longer hidden.** When Enable Banking rejected a request, a proxy in front of the server (Cloudflare, nginx) replaced the answer with its own HTML page, so renewing or adding a bank showed a wall of HTML. The server now answers with a status proxies pass through, and the app shows the real message.
- **Callback URL.** A `REDIRECT_URI_NOT_ALLOWED` answer now names the exact URL that was sent and how to fix it. The URL can be set in Connections, Enable Banking (saved on the server) as well as with `ENABLE_BANKING_REDIRECT_URL`, which still wins. The connect dialog shows the URL to register.
- `docker-compose.yml` now passes `ENABLE_BANKING_REDIRECT_URL` to the backend; a value in `.env` was previously ignored.

### Added
- **Enable Banking application settings** on the Connections page: enter or change the application ID and private key (paste it or choose the `.pem` file), verified with Enable Banking before it is saved, with a clear message when a certificate is chosen instead of the private key. Remove them again at any time.

## [3.0.0] - 2026-11-07

Crystal 3.0 is a ground-up visual and structural redesign ("Rapport" look), plus a security hardening pass on the server and a rebuilt Enable Banking integration. It is the first release published as a multi-architecture (`linux/amd64` + `linux/arm64`) image and the first one packaged for the Umbrel App Store.

### Highlights

- **New design system.** A warm light canvas, forest green and amber accents, design tokens instead of raw colours, and a shared UI kit in `components/ui`. Every page was rebuilt on it.
- **New app shell.** Collapsible tree sidebar, top-level tab pills per hub, a bottom tool rail (search, quick add, sync, shortcuts, theme, privacy blur) and an animated theme toggle.
- **Server-enforced PIN lock**, a three-way sync merge and a hardened API (see Security).
- **Any main currency**, not just a fixed set.
- **Multi-arch images** and Umbrel App Store packaging.

### Added

#### Overview
- Overview tabs (Summary, Spending, Wealth, Coming up) with size-responsive widgets and vertical widget resizing with automatic layout switching.
- Net worth hero card with cash / investments / property / debts breakdown, "Needs you" action card, "Safe to spend" widget and a cash-horizon style net-worth chart.
- Gauges, spending calendar, goal rings, money-flow view, timeline agenda, cards widget and Bklit sparklines.
- Written summary sentence ("2 bills are due soon and 3 transactions need review") and KPI chips with period-over-period deltas.

#### Accounts
- Redesigned account pages with per-type layouts (cash, cards, loans, assets), linked accounts, tabs with deep links and a quick switcher.
- New **All Accounts** page with a flexible board layout, wallet-style cards with drag-and-drop ordering, and an "own vs. owe" breakdown.
- Rebuilt Activity tab with in/out charts; leased vehicles, future interest and honest balance curves; card APR and fees.
- Merchant logos on transactions and transfers, with a single, consistent logo-resolution rule across all views.

#### Transactions
- Rebuilt ledger, review queue and add/edit form with merchant suggestions and autofill from merchant rules.
- Hero card combining balance, cash flow and a places map; transaction scatter chart; row context menus, cell filters and improved selection.
- Category search and grouping in the transaction detail modal; icon-led segmented controls.

#### Planning
- **Forecast** rebuilt around a Bklit "cash horizon" chart: lowest-point marker, buffer suggestions, goal markers, a monthly ledger list view, and overdue items no longer stacking on Today.
- Budgets with exclusions and sub-goals; goals with monthly targets by account and by month; recurring-transaction lifecycle fields; insight cards.
- Planning hub, Calendar, Subscriptions and Tasks rebuilt on the new kit.

#### Investments
- Redesigned Portfolio, Holdings and Activity pages with an allocation ring, a portfolio rail and unit-price support.
- Honest valuation: positions without a current price are valued at their last trade and left out of the gain.

#### Banking & data
- **Enable Banking:** credential self-test, webhook ingestion, live rate-limit tracking, consent-expiry handling, sign-in methods and account types, automatic merchant and category detection, and sync that no longer undoes your manual edits.
- A single **Rules** model replaces the previous rule types.
- Rebuilt Settings, Data management, Reports, Invoices and Challenges pages.
- Rebuilt sign-in and onboarding.
- Maps: the MapLibre worker now ships with the build and falls back to raster tiles when vector tiles are unavailable.

#### Packaging & operations
- Docker images are built for `linux/amd64` and `linux/arm64` and published to `ghcr.io/samerberjawi/crystal` as `backend-vX.Y.Z` / `frontend-vX.Y.Z`.
- Umbrel App Store package (`crystal/`) with pinned image digests and derived secrets.
- `reset-password` CLI for administrators (`docker compose exec backend node dist/cli/reset-password.js <email>`).

### Changed
- Navigation: planning home and tab order now lead with Forecast; hubs are a collapsible tree with page tabs as top pills.
- Icon system unified on free-stroke rounded Hugeicons, with documented semantic classes (`docs/ICON_SYSTEM.md`).
- Dark mode: refreshed canvas and mesh colours, consistent checkbox and border styling, extra-large radius on surface cards.
- The abandoned "New UI" work-in-progress was removed; the redesign now lives in the main app.
- Unreachable code and unused chart components were deleted.

### Security
- Server-enforced PIN lock with rate limiting and lock rules.
- Hardened server: stricter validation, auth configuration, URL guard for outbound fetches, credential encryption.
- Dependency audit failures cleared (zod 4, body-parser, qs); CI now fails on high-severity production advisories.
- Three-way merge on save conflicts instead of last-write-wins.

### Fixed
- Focus outlines on overlays, ComboBox lock-up on account selection, date inputs not following the preference date format.
- Hook-order violation when opening the review queue; account tab lost when navigating back from a detail page.
- Cash accounts no longer load external logos; merchant logos are not assumed when none is configured.
- Sparkline spline overshoot, notification-bell alignment, keyboard-shortcuts modal not dismissing, dock backdrop scaling.
- Balances, forecasts and budget edits now add up consistently after account-model hardening.

### Upgrade notes
- The data format is unchanged; existing accounts load as before. Back up (Settings → Data management) before upgrading as usual.
- `JWT_SECRET` and `POSTGRES_PASSWORD` are required by the Docker stack. Pin the image tag to `v3.0.0` rather than `latest` for reproducible deployments.
- `npm run build` no longer rewrites the version once it is a release version (`X.Y.Z`); bump `version.ts` and `package.json` explicitly for releases.

[3.0.0]: https://github.com/SamerBerjawi/Crystal/releases/tag/v3.0.0
