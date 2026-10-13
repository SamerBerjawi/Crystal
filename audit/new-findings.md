# New findings noticed during remediation

Issues seen while fixing audit packages that were **out of scope** for the package being worked on.
They are recorded here rather than fixed in place.

| # | Found during | Location | Finding |
|---|---|---|---|
| N-001 | WP-3.4 | `pages/Merchants.tsx` (spend-trend months) | The six-month window is anchored to a hard-coded date (`new Date(2026, 4, 23)`), so the merchant sparklines always show Dec 2025 – May 2026 regardless of today's date. (Also noted in `findings-performance.md` → Unverified.) |
| N-002 | WP-4.1 | `index.css` | iOS-only rule `input, select, textarea { font-size: max(16px, 1em) }` was added to prevent focus-zoom now that pinch-zoom is allowed; it slightly enlarges small inputs on iOS and should be reviewed visually on a device. |
