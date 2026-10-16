# Crystal — UI Consistency & Accessibility Findings

Reviewed 2026-10-13 at commit `2073eda`. Scope is UI consistency and accessibility only. Pages and workflows follow `audit/inventory.md`. No application code was modified.

**How findings were verified**
- **Measured**:
  - **axe-core 4.10.2** injected into the production build (`vite preview`, demo mode) in the built-in browser (Chrome 152):
    - all 22 authenticated pages plus Sign In in **dark** theme
    - 14 pages in **light** theme (color-contrast only)
  - Keyboard tests with real Tab key presses.
  - A responsive sweep of 22 pages at **375×812**.
  - **Second pass with populated data (added after review).** The first pass ran on the built-in demo set, and the light-theme and mobile sweeps partly ran on empty state (e.g. Merchants showed all zeros), so data-heavy UI wasn't really exercised. I re-ran on a seeded dataset: 10,000 transactions, 15 accounts, 600 merchants, plus the demo budgets, goals, holdings and recurring items. I confirmed data rendered on each page before scanning (e.g. Transactions 30 rows, Merchants 610 rows, Reports 73 rows, Forecasting 52 rows). That pass covered:
    - 16 pages with all axe rules (dark)
    - 10 pages for contrast (light)
    - 10 pages at 375 px
    - keyboard tests on Transactions, Accounts, Investments and Forecasting
    - the transaction detail modal

    Results from both passes are marked **[empty]** or **[data]** where they differ.
- **Code**: Node scripts counting class and token usage across 282 `.tsx` files (202 under `App.tsx`/`pages`/`components` for the a11y scan), plus reading the cited code.

---

## The intended design system

Three sources define "the system", and they disagree (see UI-001).

| Aspect | `DESIGN.md` (documented intent) | `index.css` `@theme` (**what actually ships**) |
|---|---|---|
| Style | Apple HIG + frosted glassmorphism; dense data UI | same |
| Brand | Primary amber `#FA9A1D`, 50–900 scale | same, but **overridden per page** at runtime by `applyPageAccentTheme` (`utils/theme.ts`) using `ITEM_COLORS` (amber, teal, pink, purple, blue, …) |
| Surfaces | `glass-card` / `ios-regular`; light `#FAFAFA` / text `#2D2D2D`; dark `#050505` | light `#fafafa` / text `#171717`; dark `#0a0a0a`; `light-card` 45% white |
| Text tokens | `text-light-text(-secondary)` / `text-dark-text(-secondary)` | same |
| Status colors | `STATUS_DANGER/SUCCESS/WARNING/INFO_*` constants (`constants.tsx:94-130`), Apple red/green/amber/blue | `semantic-red/green/yellow/blue` tokens |
| Type scale | Large Title → Caption via Tailwind sizes; `text-2xs` for micro labels | `text-2xs` defined; **`text-3xs` not defined** |
| Radii | `rounded-md/lg` badges, `rounded-xl` (16px) controls, `rounded-2xl/3xl` cards, `rounded-full` pills | same (`--radius-xl: 16px`) |
| Elevation | Named z-index scale: `z-dropdown` 50, `z-sticky` 100, `z-popover` 200, `z-modal` 500, `z-toast` 1000, `z-max` 9999 | **not defined** in `@theme` |
| Touch | ≥ 44×44 px targets | n/a |
| Components | `Modal` (sheet on mobile, card on desktop), `HeaderButton`, `BTN_PRIMARY_STYLE`/`BTN_SECONDARY_STYLE` (`constants.tsx`), `Card`, `EmptyState`, `ConfirmationModal`, Sonner toasts | n/a |

The findings below measure deviations against the `DESIGN.md` intent, using `@theme` as the source of truth for what renders.

---

### [UI-001] Three conflicting token sources; documented tokens (z-index scale, `text-3xs`) never reach the CSS
- Severity: **Medium**
- Location: `DESIGN.md`; `tailwind.config.js` (whole file); `index.css:122-252` (`@theme`); `pages/Schedule.tsx:1167-1188`
- Evidence (code + build):
  - Tailwind v4 reads `@theme` in `index.css`. There's no `@config` directive, so **`tailwind.config.js` is never loaded**.
  - Values conflict across the three files. For example `light-text` is `#2D2D2D` (doc), `#0f172a` (config) and `#171717` (theme). `semantic-red` is `#FF3B30` (doc) and `#EF4444` (config/theme). `light-bg` is `#FAFAFA`, `#f8fafc` and `#fafafa`.
  - The z-index scale and `3xs` exist **only** in the dead config. In the built CSS, `.z-modal`, `.z-dropdown`, `.z-toast` and `.text-3xs` have **0 rules**.
  - `text-3xs` is used 8 times (`Schedule.tsx:1167,1170,…`), so those labels silently fall back to inherited size.
- Impact: designers and contributors following `DESIGN.md` or the config get classes that do nothing. Token values drift between docs and product.
- Suggested fix:
  - Delete `tailwind.config.js` (or add `@config`) and make `@theme` the single source.
  - Add `--z-index-*` and `--text-3xs` there.
  - Regenerate `DESIGN.md` values from `@theme`.
- Effort: **S**

### [UI-002] The design-system layer is largely bypassed: raw palette classes, hex values, arbitrary sizes
- Severity: **Medium**
- Location: across `pages/` and `components/` (282 `.tsx` files scanned)
- Evidence (code, counted):

  | pattern | uses | files | examples |
  |---|---|---|---|
  | Named z-index tokens (`z-modal`, …) | **0** | 0 | — |
  | Numeric z-index | 341 | 108 | `z-10`×200, `z-50`×34, `z-[9999]`×14 |
  | `STATUS_*` constants (documented) | **0** | 0 | defined at `constants.tsx:118-130`, never imported |
  | `semantic-*` color tokens | **0** | 0 | — |
  | Raw `red-*`/`rose-*` for negatives | 860 | 121 | `text-rose-500`×173, `text-red-500`×40, `text-red-600`×36 |
  | Raw `green-*`/`emerald-*` for positives | 943 | 105 | `text-emerald-400`×177, `text-green-400`×32 |
  | Raw `gray/slate/zinc/neutral` text/bg/border | 2,147 | 137 | `text-gray-400`×449, `border-slate-200`×176 (vs 3,400 uses of the `light/dark-text` tokens) |
  | Hex colors in classes | 200 | 25 | `text-[#a3e635]`×20, `bg-[#2c2d30]`×20 |
  | Hex literals anywhere in TSX | 585 | 71 | `#a3e635`×40, `#6366f1`/`#6366F1`×47 |
  | Arbitrary radii | 141 | 48 | `rounded-[2.5rem]`×41, `rounded-[2rem]`×37, `rounded-[22px]`×7 |
  | Arbitrary px font sizes | 85 | 23 | `text-[10px]`×68, `text-[9px]`×3, `text-[7px]`×1 |
- Impact:
  - "Negative" money appears in two different reds (`red` vs `rose`) and "positive" in two greens, depending on the page.
  - Gray and slate tones don't follow the theme's neutral ramp, so light/dark surfaces shift subtly from page to page.
  - A brand or theme change can't be made centrally.
- Suggested fix:
  - Adopt the existing `STATUS_*` constants (or `semantic-*` tokens) for all money signs and states.
  - Map `gray-*`/`slate-*` usages to `light/dark-text(-secondary)`/`-separator`/`-fill`.
  - Add a lint rule (`eslint-plugin-tailwindcss` `no-arbitrary-value` / `no-custom-classname`) to stop regressions.
- Effort: **L** (incremental)

### [UI-003] Text contrast fails WCAG AA on most pages, in both themes; per-page accent colors are the main cause
- Severity: **High**
- Location: `utils/theme.ts:~195-205` (`applyPageAccentTheme` rewrites `--primary-*` per page from `ITEM_COLORS`, `constants.tsx:~198-216`); buttons using `bg-primary-500/600 text-white` (e.g. `HeaderButton`, `#btn-add-rule`); secondary text using `opacity-60/70` on top of `text-*-secondary`
- Evidence (measured, axe `color-contrast`):
  - **Dark:** **49 nodes on 13 of 22 pages**. **Light:** **42 nodes on 8 of 14 pages**. Examples:
    ```
    /transactions  white on amber  primary #f59e0b  2.14:1  (11.4px)   [dark]
    /investments   white on teal   primary #14b8a6  2.48:1  (11.4px)   [dark]
    /rules         "Add Rule"      white on #14b8a6 2.48:1             [dark]
    /tags          white on pink   #ec4899          3.52:1             [dark]
    /categories    white on amber  #d97706          3.18:1             [light]
    /investments   teal on tint    #0d9488/#e3f3f2  3.27:1  (11px)     [light]
    /merchants     #696969 on #111111 (opacity-60)  3.43:1             [dark]
    /data-management #858585 on #fdfdfd (opacity-70) 3.62:1            [light]
    ```
  - All of these are small text (≤ 11.4 px), where AA requires **4.5:1**.
  - **[data]** With populated pages:
    - **Dark:** 31 nodes on 9 of 16 pages. Subscriptions alone has 18 (white on rose `#f43f5e` 3.67:1; `#656565`/`#080808` 3.43:1).
    - **Light:** 22 nodes on 4 of 10 pages, mostly tinted badges: Investments ×18 (`#0d9488` on `#e3f3f2` 3.27:1, 11 px), Subscriptions (`#e11d48`/`#f9e7ea` 3.94:1), Reports (`#2563eb`/`#e7eefa` 4.43:1), Merchants (`#009689`/`#e1f4f2` 3.24:1).
    - The transaction detail modal adds 4 more (9.5 px category labels, 3.62:1).
- Impact: primary action labels and secondary descriptions are hard to read for low-vision users and in bright light. The accent swap means a button that passes on one page fails on the next.
- Suggested fix:
  - Pick each page accent's button shade so white text reaches ≥ 4.5:1 (e.g. use `-700` for teal/amber/pink), or use dark text on light accents.
  - Stop stacking `opacity-60/70` on secondary text; use the secondary token directly.
  - Add axe to CI (`@axe-core/playwright`).
- Effort: **M**

### [UI-004] Pinch-zoom disabled on every page
- Severity: **High**
- Location: `index.html:6`
- Evidence (measured, axe `meta-viewport`, critical, all 23 pages):
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
  ```
- Impact: low-vision mobile users can't zoom (WCAG 1.4.4). Combined with the small type (UI-008) and contrast failures (UI-003), dense financial tables become unreadable for them.
- Suggested fix: remove `maximum-scale=1, user-scalable=no`. To prevent iOS auto-zoom on focus, use ≥ 16 px font in inputs instead.
- Effort: **S**

### [UI-005] Clickable `div`/`tr`/`span` elements can't be reached or used by keyboard
- Severity: **High**
- Location: 114 `onClick` handlers on non-interactive elements across `pages/` and `components/`. **113** have no `role`, `tabIndex` or key handler. Examples: `pages/Accounts.tsx:450,506` (net-worth segment switch), `pages/Investments.tsx:1314` (`<tr onClick>` account rows), `:1347`, `:1383`, `pages/Forecasting.tsx:1723`.
- Evidence (code): e.g. `pages/Investments.tsx:1313-1316`:
  ```tsx
  <tr key={acc.id} className="… cursor-pointer" onClick={…}>
  ```
  There's no `tabIndex`, `role="button"`/`link` or `onKeyDown`. Tab skips the row, and screen readers announce plain text.
- Evidence **[data]** (measured: elements with `cursor: pointer` and no focusable equivalent, on populated pages):

  | page | pointer-only click targets | keyboard-reachable |
  |---|---|---|
  | `/accounts` | 22 (summary tiles plus every account card) | **0** |
  | `/investments` | 21 (`<tr>` holding/account rows) | **0** |
  | `/forecasting` | 36 (`<tr>` schedule rows) | **0** |

  On Accounts, the card's main action (open the account, `components/AccountRow.tsx:254,397` `onClick={onClick}` on a `div`) can't be reached by keyboard. Only its secondary "Adjust Balance" and "Edit Account" buttons (named via `title`) can.

  **Contrast:** the Transactions table *does* work by keyboard. It's built on react-aria `Table`: rows are focusable, show a visible 2 px focus ring, and Enter opens the detail. So the accessible pattern already exists in the codebase.
- Impact: keyboard and screen-reader users can't open accounts (from Accounts or Investments), switch segments on Accounts, or open forecast schedule rows and goal cards. Each of these is reachable only by mouse or touch.
- Suggested fix:
  - Use `<button>` (or wrap the row content in a `<button>`/`<a>`).
  - Where a row must stay a `tr`, add `tabIndex={0}`, `role="link"`, and Enter/Space handlers.
  - Add `eslint-plugin-jsx-a11y` (`click-events-have-key-events`, `no-static-element-interactions`).
- Effort: **M**

### [UI-006] Modals aren't announced as dialogs, and focus escapes them
- Severity: **High**
- Location: `components/Modal.tsx:58-100` (shared modal, used in 19 files); `components/AddTransactionModal.tsx` (separate implementation); 39 files render their own `fixed inset-0` overlays (UI-009)
- Evidence:
  - (code) `Modal.tsx` renders plain `<div>`s. There's no `role="dialog"`, `aria-modal`, `aria-labelledby` (the `<h2>` title isn't linked), focus trap, initial focus, or focus restore on close. Its Escape handler is a global `window` listener, so with stacked modals one Escape closes every open modal.
  - (measured, keyboard) I opened the quick-add transaction modal (`n`) and focused its last control ("Confirm Transaction"). **One Tab press moved focus to an unnamed `<button>` in the page behind the modal**, with the modal still open. `document.querySelector('[role="dialog"]')` → `null`.
  - **[data]** I opened the **transaction detail modal** from a populated Transactions row, both by click and with Enter. Again there was no `role="dialog"`, and **focus stayed on the table row/cell behind the modal** instead of moving into it. Escape did close it.
- Impact: screen-reader users aren't told a dialog opened and can wander into the obscured page. Keyboard users tab "behind" the overlay. After closing, focus lands at the top of the document.
- Suggested fix:
  - Build all overlays on one accessible primitive. `@base-ui/react` `Dialog` and `react-aria-components` `Modal` are both already dependencies.
  - Or add `role="dialog" aria-modal="true" aria-labelledby`, a focus trap, and focus return to `Modal.tsx`, then migrate the custom overlays to it.
- Effort: **M**

### [UI-007] Form controls without accessible names
- Severity: **Medium**
- Location (measured, axe):
  - **`select-name`** (13 nodes, 9 pages): Dashboard date-range selects (`3M/6M/EOY/1Y`, `Today…All time`), Accounts sort, Transactions, Preferences, Merchants sort, Tags sort, Tasks sort, Reports ×3, Integrations ×2
  - **`button-name`** (9 nodes): Preferences toggles ×3, Merchants ×2, Tags ×2, Invoices ×2 (the disabled pagination arrows, `pages/Invoices.tsx:352,355`)
  - **`aria-required-attr`** (2): Preferences switches
  - **`label`** (3): Reports and Integrations date inputs (`input[value="2026-09-13"]`)
  - plus 15 icon-only `<button><Icon/></button>` without `aria-label`/`title` found in code: `CashAccountView.tsx:164`, `CreditCardAccountView.tsx:164`, `GeneralAccountView.tsx:283` (Back buttons), `ImportWizard.tsx:629`, …
- Evidence (code): `pages/Preferences.tsx:791-794`:
  ```tsx
  <button type="button" role="switch" aria-checked={preferences.excludeTransfersFromAnalytics} onClick={…}>
  ```
  There's no `aria-label`/`aria-labelledby` (the visible `<h4>` isn't linked). When the preference is unset, `aria-checked` is `undefined`, which is why axe reports the missing required attribute.
- Impact: screen readers announce "button", "switch" or "combo box" with no purpose, so settings and filters can't be identified.
- Suggested fix:
  - Link visible labels (`id` + `aria-labelledby` / `<label htmlFor>`) and add `aria-label` to icon-only buttons.
  - Coerce `aria-checked={!!value}`.
  - Use the existing `components/base/toggle` (currently used by **0** files) for all switches.
- Effort: **S**

### [UI-008] Micro type below readable size is the default label style
- Severity: **Medium**
- Location: 446 uses of `text-2xs` (10 px)/`text-3xs`; 85 arbitrary px sizes (`text-[10px]`×68, `text-[9px]`×3, `text-[7px]`×1)
- Evidence (code + axe): counted by the token script. axe's contrast failures are concentrated on 9.5–11.4 px text, e.g. `/investments .max-w-md` at **9.5 px**, 4.34:1, and `/budget .text-[10px]` at 3.32:1.
- Impact: 7–10 px labels (chart captions, badges, table metadata) are illegible for many users, especially since zoom is disabled (UI-004). `DESIGN.md` uses `text-xs` (12 px) for its smallest role (Caption).
- Suggested fix: use 12 px (`text-xs`) as the floor for meaningful text, keep `text-2xs` for non-essential decoration only, and remove sub-10 px sizes.
- Effort: **M**

### [UI-009] Several components doing the same job: modals, confirmations, buttons, cards, toggles
- Severity: **Medium**
- Location / evidence (code, counted):
  - **Modal shells:** `components/Modal.tsx` (19 files) and `components/BottomSheet.tsx` (7). **39 files** hand-roll a `fixed inset-0` overlay, `AddTransactionModal` among them (UI-006).
  - **Confirmations:**
    - `ConfirmationModal` (18 files) and `FinalConfirmationModal` (3)
    - a `ConfirmDialog` hook from `ConfirmationModal.tsx:191` (6 files)
    - Categories' inline "Abort / Execute Deletion" panel (`pages/Categories.tsx:232-233`)
    - Rules' own `customConfirm`/`confirmConfig` dialog (`pages/Rules.tsx:3389-3396`)
  - **Buttons:**
    - `HeaderButton` (21 files)
    - `BTN_PRIMARY_STYLE`/`BTN_SECONDARY_STYLE` string constants (155 uses)
    - `components/ui/button.tsx` (shadcn, 1 import) and `components/base/buttons/*` (1 import)
    - many bespoke `className` buttons
  - **Cards:** `components/Card.tsx` and the unused `components/ui/card.tsx` (see inventory §6), plus `glass-card`/`glass-tile`/`glass-section` utility classes.
  - **Toggles:**
    - `components/base/toggle` (0 users)
    - a custom `role="switch"` in Preferences
    - plain checkboxes (`CHECKBOX_STYLE`) for equivalent on/off settings in Transactions and Forecasting
- Impact: the same action looks and behaves differently by page, accessibility fixes have to be repeated N times, and new screens copy whichever variant they find first.
- Suggested fix: pick one primitive per role (`Dialog`, `ConfirmDialog`, `Button` with variants, `Card`, `Switch`), migrate page by page, and delete the rest.
- Effort: **L**

### [UI-010] User feedback mixes native `alert()` with toasts
- Severity: **Medium**
- Location: **26** `alert()` / `window.alert()` calls vs **112** Sonner `toast()` calls. Examples:
  - `App.tsx:2689` ("Client-side data reset.")
  - `pages/Budgeting.tsx:110,126`
  - `pages/Investments.tsx:761-767`
  - `pages/PersonalInfo.tsx:48` ("Profile updated successfully!")
  - `pages/DataImportExport.tsx:313`
  - `pages/Transactions.tsx:1101`
  - `components/SplitTransactionModal.tsx:91`
  - `components/EnableBankingSyncModal.tsx:94`
- Evidence (code): `grep -c` as above. Validation errors (split sum, missing sync date) use blocking `alert()`, while similar validation elsewhere shows inline messages or toasts.
- Impact: blocking browser dialogs break the glass UI, can't be styled or localized, interrupt flows (and steal focus on mobile), and give success messages ("Profile updated successfully!") the same weight as errors.
- Suggested fix: replace `alert()` with `toast.success/error`, and use inline field errors for validation inside forms.
- Effort: **S**

### [UI-011] Pages overflow horizontally at mobile width
- Severity: **Medium**
- Location: `/merchants`, `/forecasting`, `/challenges`
- Evidence (measured at 375×812): `<main>` `scrollWidth` vs 375 px viewport:
  ```
  /merchants    421 px  (screenshot: "Recently Active" sort select cut off at right edge; horizontal scrollbar on main)
  /forecasting  401 px  (DIV.flex.items-center.gap-2 toolbar)
  /challenges   530 px  (absolutely-positioned decoration at left-1/3 not clipped)
  ```
  The other 19 pages fit. Some decorative `-right-12` blobs extend past the edge, but their parents clip them.
  **[data]** With 10k transactions, Merchants (421 px) and Forecasting (401 px) still overflow. Dashboard, Accounts, Transactions, Investments, Budget, Schedule, Subscriptions and Reports fit at 375 px, with no truncated currency amounts even for 7-digit totals (€3,846,316.61). The `Mobile*View` variants handle real data well.
- Impact: on phones these pages scroll sideways and controls are cut off, which conflicts with the mobile-first sheet and navbar design.
- Suggested fix:
  - Let the Merchants and Forecasting toolbars wrap (`flex-wrap`, or stack below `sm`).
  - Add `overflow-hidden` to the Challenges hero container.
  - Add a 375 px visual check to CI.
- Effort: **S**

### [UI-012] Tap targets smaller than the 44 px the design system specifies
- Severity: **Low**
- Location (measured at 375 px; interactive elements under 24×24 px): `/integrations` 15, `/preferences` 8, `/personal-info` 2, `/forecasting` 2, and one each on several other pages
- Evidence: `DESIGN.md`: "Minimum `44x44px` … on interactive buttons and mobile elements". The sweep counted elements **under 24 px** (even below the WCAG 2.2 AA 24 px minimum), e.g. the Integrations per-account controls and sync-start presets (`EnableBankingIntegrationCard.tsx:860`, `px-1.5 py-0.5`).
- Impact: mis-taps on mobile, especially on dense settings and integration screens.
- Suggested fix: apply `min-h-[44px] min-w-[44px]` (or padding) to icon and pill buttons, or enlarge the hit area with a pseudo-element.
- Effort: **S**

### [UI-013] Copy: jargon, inconsistent naming and capitalization
- Severity: **Low**
- Location / evidence (code):
  - **Jargon labels for simple actions:**
    - `Categories.tsx:232-233`: "Abort" / "Execute Deletion"
    - `Categories.tsx:339`: "Initialize Root Category"
    - `PersonalInfo.tsx:245,269`: "Rotate Credentials" (change password), "Commit Changes" (save)
    - `DataImportExport.tsx:554,562`: "Inspector", "Evict Log"
    - `Merchants.tsx:1073`: "Protocol Configuration"
    - `Tags.tsx:175`: "Register New Tag"
    - Sort options: "Utility Rank / Volume Rank / Lexical Alpha" (`Tags.tsx:227`), "Manual Sequence / Priority Sift / Temporal Sort" (`Tasks.tsx:253`)
    - "Search registry" (Transactions label)
    - "telemetric" (README/Tasks)
    - "Cloud Snapshot" for a local file restore (`App.tsx:1120`)
  - **One concept, several names:**
    - Recurring items are "Schedule & Bills" (nav), "Recurring Transactions", "repeating items" (`App.tsx:1109`) and "Scheduled".
    - The quotes/invoices area is "Quotes & Invoices" in nav but "Invoices" in the route and page header.
    - The transactions page is "Transactions" in the sidebar, "Activity" in the mobile tab bar and mobile page title, and "ACTIVITY FEED · Transactions" in the desktop header. **[data]**, measured at 375 px.
    - Destructive verbs vary: "Delete" (6), "Remove", "Purge", "Execute Deletion", "Evict".
  - **Capitalization:** headings mix sentence case ("Needs vs. wants", "Spend breakdown", "Budget vs actual") with Title Case ("Available Liquidity", "Spending Velocity", "Category Allocation"). Buttons mix "Update balance only" with "Save Valuation", "Apply to Past Ledger". "vs." and "vs" are both used.
  - No misspellings found by the common-typo scan.
- Impact: first-time users have to decode the labels, and each screen feels written by a different author. Screen-reader users hear the jargon with no visual context.
- Suggested fix:
  - Write a short content guide: sentence case, plain verbs (Save, Delete, Cancel), one name per concept (e.g. "Recurring").
  - Rename the labels above.
  - Centralize nav labels in `constants.tsx` and reuse them for page titles.
- Effort: **S**

### [UI-014] Inconsistent empty states
- Severity: **Low**
- Location: `components/EmptyState.tsx` (used in **3** files: Tags, Tasks, and one other); 10+ hand-written "No … yet / found" blocks elsewhere (e.g. Categories "Initialize Root Category", Dashboard "No upcoming obligations", Forecasting "Create New Goal")
- Evidence (code, counted). Measured: on an empty Merchants list the grid area renders a large blank card with a faint search icon and no message or action (seen in the 375 px screenshot).
- Impact: users get different guidance, or none, depending on the page. Some empty states offer a primary action, others don't.
- Suggested fix: use `EmptyState` (icon, title, description, optional action) everywhere a list can be empty.
- Effort: **S**

### [UI-015] Landmarks and heading structure
- Severity: **Low**
- Location (measured, axe):
  - Sign In has **no `<main>`** (`landmark-one-main`), and 18 content blocks sit outside any landmark (`region`). Sign Up has the same structure in code but wasn't scanned.
  - `heading-order` fails in 16 places on 12 pages (e.g. `h3` directly after `h1` in card headers).
  - `landmark-unique` fails once.
  - `empty-table-header` fails twice (Accounts/Investments table action column `th:nth-child(8)`).
- Impact: screen-reader users can't jump to main content on the auth screens, and the outline skips levels, which makes navigating by headings unreliable.
- Suggested fix:
  - Wrap the auth screens in `<main>`.
  - Use `PageHeader` → `h1`, section → `h2`, card → `h3` consistently.
  - Give action columns a visually hidden header ("Actions").
- Effort: **S**

### [UI-016] Row action buttons in data lists have no accessible name, and some only appear on mouse hover **[data]**
- Severity: **High**
- Location:
  - `pages/Transactions.tsx:2561-2569` (`<ButtonUtility tooltip="Options" icon={DotsVertical} …/>`) together with `components/base/buttons/button-utility.tsx:62-63`, where `tooltip` is only passed to a visual `<Tooltip>` and never becomes `aria-label`
  - `pages/Investments.tsx:1483-1489` (delete button: icon only, no label, inside `opacity-0 group-hover:opacity-100`)
  - similar row actions on Forecasting (blue/rose icon buttons), Subscriptions, Tags and Invoices
- Evidence (measured, axe `button-name` on populated pages):
  - **67 unnamed buttons**, versus 9 in the empty-state pass: Transactions **25**, Investments **10**, Tags 10, Forecasting 8, Subscriptions 8, Invoices 3, Merchants 2, Tasks 1.
  - On Transactions, every visible row (25 per page) contributes one unnamed "⋮" options button. I matched this with a DOM count: 25 unnamed buttons, all inside table rows, all the same `DotsVertical` icon.
  - The Investments delete control stays at `opacity: 0` unless the mouse hovers the row. There's no `focus-within`/`focus-visible` reveal, so a keyboard user tabbing onto it focuses an invisible button.
- Impact: screen-reader users hear "button" 25 times per Transactions page with no indication it opens the row's menu (edit, split, duplicate, delete). On Investments, keyboard users can trigger a **destructive** action they can't see.
- Suggested fix:
  - In `ButtonUtility`, forward `tooltip` as `aria-label` when it's a string (fixing all call sites at once).
  - Add `aria-label`s that include the row context (e.g. `Options for Merchant 395, −€27.13`).
  - Add `group-focus-within:opacity-100 focus-visible:opacity-100` wherever controls are hidden until hover.
- Effort: **S**

---

## Unverified

- **Focus visibility across components**: the code scan found 46 `outline-none` uses, but only 4 lack a replacement `focus:`/`focus-visible:` style (`CommandCenter.tsx:160`, `InvoiceModal.tsx:625,639`, `WidgetWrapper.tsx:78`). The one control I tested by keyboard showed a 3 px focus ring. I didn't tab through every page to confirm focus is visible everywhere, especially on the glass surfaces in light mode.
- **Color as the only signal**: income/expense and over/under-budget appear to rely on green/red color, often with a sign or icon. I didn't audit every chart and badge for a non-color cue.
- **Charts**: Recharts and visx charts have no text alternatives that I could find (no `aria-label`/`<title>` or data-table fallback). axe doesn't flag SVG charts, and I didn't confirm with a screen reader.
- **Reduced motion**: motion and framer animations, plus `animate-*` classes, are used heavily. I didn't confirm whether `prefers-reduced-motion` is respected.
- **Mobile views**: the 375 px sweep checked layout overflow and tap-target size only. I didn't run axe separately on the `Mobile*View.tsx` variants, or on light theme at mobile width.
- **`autoFocus`** is used 28 times. That's fine inside dialogs, but I didn't check whether any are on page-level elements that would move focus unexpectedly on navigation.

---

## Coverage

**Covered**
- Design tokens: a full-codebase class and literal scan (z-index, colors, radii, font sizes, status tokens); the three token sources compared; the built CSS checked for token rules.
- Duplicate components: modals, confirmations, buttons, cards, toggles, empty states, feedback (alert vs toast).
- Copy: labels, verbs, terminology, capitalization, common-typo scan.
- Responsive: all 22 authenticated pages at 375×812 (overflow and tap targets), with a screenshot to confirm Merchants.
- Accessibility (measured with axe-core 4.10.2): Sign In plus 22 pages in dark theme (all rules), 14 pages in light theme (contrast), a real-keyboard focus-trap test on the quick-add modal, and a static scan for click handlers on non-interactive elements, icon-only buttons, `alt` text (50 `<img>`: 4 without `alt`, 11 with `alt=""`), and `outline-none`.

**Not covered or partial**
- No screen-reader session (VoiceOver/NVDA). The ARIA findings come from axe and code.
- Not every modal was opened and tested. Only the quick-add modal was keyboard-tested; `Modal.tsx` was reviewed in code.
- Sign Up, onboarding and Enable Banking callback screens weren't run through axe. Sign In was.
- **Correction:** the first pass ran on demo or partly empty data, so data-heavy UI was under-tested. The second, populated pass (see the top of the report) covered Dashboard, Accounts, Transactions, Investments, Budget, Forecasting, Schedule, Subscriptions, Reports, Merchants, Tags, Tasks, Invoices and Challenges. It **still didn't cover**:
  - Rules and Categories with data (the seed has no rules; categories didn't render as rows)
  - AccountDetail per account type (Loan, Property, Vehicle views)
  - HoldingDetail
  - modals other than quick-add and transaction detail (Edit Account, Split, Bulk Edit, Import Wizard)
- I didn't use subagents. Measurement and code scans covered the codebase.

**Side effects:** the build, scripts and axe runs used the session scratchpad and a temporary `vite preview` on port 4173, which has been stopped. That origin's browser storage was cleared, and the viewport and color-scheme emulation were reset. Your own `npm run dev` wasn't touched.

---

## Top 5

1. **UI-006 (High):** Modals aren't announced as dialogs, have no focus trap, and don't restore focus. Measured: one Tab from the last button of the quick-add modal lands on a control behind it. 39 files hand-roll their own overlays on top of the shared `Modal`.
2. **UI-005 + UI-016 (High):** With real data, **0 of 22** account cards, 0 of 21 Investments rows and 0 of 36 Forecasting rows can be opened by keyboard. 67 row-action buttons have no accessible name: every Transactions "⋮" button (25 per page), because `ButtonUtility` never turns its tooltip into a label. The Investments delete button is invisible unless hovered. The Transactions table itself is fully keyboard-accessible (react-aria) and is the model to copy.
3. **UI-003 (High):** Contrast fails on 13 of 22 pages in dark theme (49 nodes) and 8 of 14 in light theme (42 nodes). Per-page accent colors put white text on teal (2.48:1) and amber (2.14:1).
4. **UI-004 (High):** `user-scalable=no, maximum-scale=1` disables pinch-zoom on every page, compounded by 7–10 px micro text (UI-008).
5. **UI-001 + UI-002 (Medium):** Three conflicting token sources, and Tailwind v4 never loads `tailwind.config.js`, so the documented z-index scale and `text-3xs` produce no CSS. The documented `STATUS_*` and `semantic-*` tokens are used 0 times, against 1,800+ raw red/rose/green/emerald classes and 585 hex literals.
