# Crystal Audit — Stakeholder Summary

*October 2026 · commit `2073eda` · full detail in `audit/plan.md`*

## What was done
Six reviews of the app:
- inventory
- security
- reliability
- performance
- UI and accessibility
- hands-on QA: 288 automated browser test runs at desktop and mobile width, against a real database

They produced **110 findings**. Many describe the same problem from different angles, so they merge into **75 distinct issues**.

## Issues by category and severity

| Category | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| Data integrity | 3 | 4 | 1 | — | 8 |
| Security | — | 4 | 4 | 9 | 17 |
| Reliability | — | 2 | 5 | 3 | 10 |
| Functional bugs | — | 2 | 6 | 6 | 14 |
| Performance | — | 4 | 5 | 3 | 12 |
| UI and accessibility | — | 5 | 5 | 4 | 14 |
| **Total** | **3** | **21** | **26** | **25** | **75** |

*Raw findings before merging: 110 (Critical 3, High 32, Medium 44, Low 31).*

## Top 10 risks
1. **Edits silently lost.** A change made in the first second after a page loads, or while a save is in progress, never reaches the server (AUD-01).
2. **Saves undone by a race.** Connecting a bank can overwrite a save the user was told succeeded, after which every later save fails (AUD-02).
3. **Orphaned transactions.** Importing a CSV or linking a bank to a "new" account never creates the account, so imported money has no home (AUD-03).
4. **Failures are invisible.** Network errors, conflicts between two tabs and expired sessions show nothing to the user, and data is lost on the next reload (AUD-04).
5. **Server can reach anything.** A public endpoint lets anyone make the server fetch internal or LAN addresses (AUD-10).
6. **Weak protection when installed per the README.** The documented install runs a mock server where any password works (AUD-11). Login throttling can be bypassed with one header (AUD-12).
7. **Bank credentials exposed.** The private key used to read bank accounts is stored in plain text in the browser and the database (AUD-13).
8. **Wrong money figures.** CSV import turns €12,50 into €12, bank sync drops real duplicate purchases, and holdings with no price show −100% (AUD-06, AUD-07, AUD-15).
9. **Fake data in real accounts.** Every real user sees two demo bank connections that come back after deletion (AUD-05).
10. **Mobile and accessibility blockers.** On phones, the bottom bar covers form buttons (password change, restore, predictions). Zoom is disabled, contrast fails on most pages, and many controls are unusable by keyboard or screen reader (AUD-20 to AUD-24).

## Plan at a glance

| Phase | Focus | Packages | Effort |
|---|---|---|---|
| **Quick wins** | 10 small, high-value fixes: orphaned accounts, demo data, routing, invoice conversion, SSRF, login throttling, XSS, crash resilience, logo caching, zoom | 10 | ~1 week |
| **Phase 1** | Critical security and data integrity: autosave, race-free saves, bank sync, CSV import, password policy, data validation, bank key handling | 11 | ~2–3 weeks |
| **Phase 2** | High-severity bugs and reliability: save status and conflicts, modals on mobile, feature gaps, investments valuation, test infrastructure and CI | 13 | ~3 weeks |
| **Phase 3** | Performance: bundle size (−45% startup JS), compression, caching, fonts | 5 | ~1 week |
| **Phase 4** | UI consistency and accessibility: dialogs, keyboard and screen readers, contrast, design tokens, copy | 8 | ~2 weeks |

**Decisions needed (12):** listed in `plan.md` §2 (K1–K12). Each has a proposed resolution; the most consequential are how to resolve save conflicts (K4), the minimum password length (K9) and how to value unpriced holdings (K8).

**How "fixed" is proven:** each package names the automated tests that must pass. Known open bugs are tracked as expected failures in the browser suite, so the suite stays green and flips when a fix lands.
