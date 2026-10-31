# Crystal: Design System Specification

Phase 8 deliverable, approved by the owner (`D-073`). It turns the approved [Design Direction](05-design-direction.md) into exact values and rules. The [live design system](https://claude.ai/artifact/SGwRVwFbQawmPaMc5XXBvh) shows the same tokens and components as working samples.

Companion documents: [Component Inventory](07-component-inventory.md) and [Responsive Behavior Specification](08-responsive-behavior-specification.md).

**Order of authority:** Decision Register, then the Feature Inventory, then the references, then Apple HIG. Findings use the HIG tiers from `H-002`: **A** accessibility requirement, **B** general UX principle, **C** Apple convention, **D** optional visual idea.

## 1. How tokens work

- Every colour, size, radius, shadow and duration is a CSS variable, defined once in `index.css` under `@theme`.
- Components use semantic names such as `--surface` or `--primary`, never raw hex.
- Dark mode swaps the values. Components don't branch on theme.
- `DESIGN.md` and the orange scale are retired in Phase 9, once no page uses them.
- A value that isn't here is a gap to raise, not something to hardcode.

## 2. Colour

### 2.1 Surfaces and text

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#F2EFE8` | `#14130F` | Page background |
| `surface` | `#FFFDF8` | `#1E1C17` | Cards, tables, panels |
| `inset` | `#F7F4ED` | `#27241E` | Wells, table headers, input fill |
| `line` | `#E7E2D6` | `#33302A` | Decorative dividers only |
| `line-strong` | `#7E7769` | `#8E8879` | Control borders, 3:1 on every surface |
| `ink` | `#1B1813` | `#F4F1EA` | Main text |
| `muted` | `#6B655A` | `#A9A396` | Secondary text |
| `glass` | `rgba(255,253,248,.72)` | `rgba(30,28,23,.72)` | Floating items only |

### 2.2 Action and meaning

| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` | `#2F5C50` | `#7FC4AE` | Main actions, active navigation, Net Worth hero |
| `primary-hover` | `#264B41` | `#6BB39C` | Hover and press on primary |
| `on-primary` | `#FFFFFF` | `#14130F` | Text and icons on primary |
| `primary-soft` | `#DDE9E3` | `#23352F` | Selected rows, soft buttons |
| `amber` | `#F0A31A` | `#F0A31A` | Attention fills, with `on-amber` text only |
| `on-amber` | `#1B1813` | `#14130F` | Text on amber |
| `amber-soft` | `#FBEBCC` | `#3A2D13` | Attention badges and banners |
| `attention-text` | `#9A5F00` | `#F0A31A` | Attention text and icons |
| `money-in` | `#167A4E` | `#4CC38A` | Income, gains |
| `money-in-soft` | `#DCEFE5` | `#17352A` | Positive badges |
| `money-out` | `#B3361E` | `#F08A6E` | Losses, errors, destructive actions |
| `money-out-soft` | `#F8E2DC` | `#3D2219` | Error badges and banners |
| `on-danger` | `#FFFFFF` | `#14130F` | Text on destructive buttons |
| `focus` | `#2F5C50` | `#7FC4AE` | Focus ring |

### 2.3 Category colours (`D-049`)

They label categories and sources, and never mean good or bad.

| Token | Light | Dark | Soft light | Soft dark |
|---|---|---|---|---|
| `ocean` | `#1F6F8B` | `#6DBBD6` | `#DCECF2` | `#1B3540` |
| `terracotta` | `#B5562F` | `#E59A78` | `#F7E5DC` | `#3C281E` |
| `purple` | `#6F4AA8` | `#B79BE6` | `#E9E2F4` | `#2D2540` |
| `indigo` | `#3F51B5` | `#9AA8F0` | `#E1E4F5` | `#262B47` |

### 2.4 Chart series (`D-061`)

The approved colours pass as text, but they fail as chart series. Run through a colour-blindness validator, indigo and purple are almost identical side by side, with a score of 2.3 where 8 is the target and 6 is the minimum. In dark mode they all sit at the same lightness and blur together. No ordering fixes it.

So charts get their own five series, which keep the same hues and shift lightness and saturation slightly. The approved colours stay for chips, labels and icons.

| Token | Hue | Light | Ratio on surface | Dark | Ratio on surface |
|---|---|---|---|---|---|
| `chart-1` | Green | `#00866E` | 4.46:1 | `#42AA8E` | 5.98:1 |
| `chart-2` | Purple | `#744AB2` | 6.14:1 | `#986AD8` | 4.37:1 |
| `chart-3` | Ocean | `#007DA0` | 4.65:1 | `#2996B6` | 4.97:1 |
| `chart-4` | Terracotta | `#C0592F` | 4.38:1 | `#CE7144` | 4.92:1 |
| `chart-5` | Indigo | `#4051DE` | 5.99:1 | `#7684D9` | 4.92:1 |

**Validator result:** both sets pass lightness, saturation, normal vision and contrast. The closest colour-blind pair scores 7.4 in light and 6.3 in dark, which is above the minimum but under the target. That band is only allowed with a second signal, so direct labels and legends are required on every multi-series chart (section 13).

**Rules**
- Colours are assigned in that order and stay with their item. A filter that removes a series never repaints the others.
- Charts show five series at most. Everything else folds into "Other", in `muted`.
- Amber, `money-in` and `money-out` aren't series colours, because they carry meaning. Income and spending charts are the exception: there they mean exactly what they always mean.

### 2.5 Contrast results

Computed against WCAG 2.2. All pass AA.

| Pair | Light | Dark |
|---|---|---|
| `ink` on `surface` | 17.41 | 15.09 |
| `ink` on `canvas` | 15.41 | 16.48 |
| `muted` on `surface` | 5.68 | 6.78 |
| `muted` on `canvas` | 5.03 | 7.41 |
| `muted` on `inset` | 5.26 | 6.16 |
| `on-primary` on `primary` | 7.59 | 9.21 |
| `on-primary` on `primary-hover` | 9.70 | 7.57 |
| `primary` on `primary-soft` | 6.08 | 6.42 |
| `money-in` on `surface` | 5.26 | 7.68 |
| `money-in` on `canvas` | 4.66 | 8.39 |
| `money-out` on `surface` | 5.96 | 6.94 |
| `money-out` on `canvas` | 5.28 | 7.58 |
| `attention-text` on `surface` | 5.15 | 8.07 |
| `attention-text` on `canvas` | 4.56 | 8.81 |
| `line-strong` on `surface`, `inset`, `canvas` | 4.37, 4.04, 3.87 | 4.82, 4.38, 5.26 |
| `focus` on `surface` | 7.46 | 8.44 |
| `ink` on soft tints (`primary-soft`, `amber-soft`, `money-out-soft`) | 14.19, 15.05, not computed | 11.90 on `amber-soft`, 12.92 on `money-out-soft` |

**Rule (A):** soft tints hold `ink` text with a coloured icon or dot, never coloured text. `attention-text`, `money-in` and terracotta fall under 4.5:1 on their soft tints in light mode. `primary` on `primary-soft` is the one exception, and it passes.

**Rule (A):** amber alone is about 2:1 on light surfaces. It's only ever a fill with `on-amber` text, never a thin line or a lone icon.

**Rule (A):** on the Net Worth hero the focus ring uses `on-primary`.

## 3. Typography

**Typeface:** Manrope (`D-057`), self-hosted through `@fontsource-variable/manrope`, weights 200 to 800. The choices in Preferences stay, and a saved choice is kept. Fallback: `system-ui, sans-serif`.

**Figures:** every amount uses `font-variant-numeric: tabular-nums`, so columns line up and count-ups don't jitter. Manrope has real tabular figures: all ten digits measured the same width in a browser test.

| Style | Desktop | Phone | Weight | Spacing | Use |
|---|---|---|---|---|---|
| `figure-hero` | 44/48 | 40/44 | 800 | -0.02em | Net Worth, main figure on a page |
| `page-title` | 32/38 | 26/32 | 800 | -0.015em | Page titles |
| `sentence` | 24/34 | 22/30 | 600 | 0 | The written summary |
| `figure-lg` | 28/34 | 24/30 | 800 | -0.01em | Summary card figures |
| `section-title` | 20/26 | 18/24 | 700 | 0 | Section headings |
| `card-title` | 16/22 | 15/22 | 700 | 0 | Card titles |
| `body` | 15/22 | 15/22 | 500 | 0 | Default text |
| `body-strong` | 15/22 | 15/22 | 700 | 0 | Emphasis, row names |
| `figure-row` | 15/22 | 15/22 | 600 | 0 | Amounts in rows and tables |
| `label` | 13/18 | 13/18 | 600 | 0 | Form labels, table headers |
| `caption` | 12/16 | 12/16 | 600 | 0 | Metadata, axis labels, the smallest text |

**Rules**
- Body is weight 500, because Manrope reads thin at 400 on warm backgrounds.
- Sizes are set in `rem`, so browser zoom and text size settings work (A).
- Form inputs are 16 px on phones, otherwise iOS zooms in on focus (B).
- Sentence case everywhere. No all-caps labels.
- Line length stays under about 70 characters in prose.

## 4. Spacing

A 4 px base.

| Token | Value | Typical use |
|---|---|---|
| `space-1` | 2 px | Icon to tight label |
| `space-2` | 4 px | Inside compact chips |
| `space-3` | 8 px | Icon to label, related items |
| `space-4` | 12 px | Control groups, compact rows |
| `space-5` | 16 px | Phone margin, card gap on phones |
| `space-6` | 20 px | Card padding on phones |
| `space-7` | 24 px | Card padding, grid gutter |
| `space-8` | 32 px | Page margin, section gap |
| `space-9` | 40 px | Between major sections |
| `space-10` | 48 px | Page top |
| `space-11` | 64 px | Empty state padding |

**Density (`D-032`, `D-036`):** pages are always spacious. Only large tables have the Comfortable or Compact switch, which is remembered per table.

| | Comfortable | Compact |
|---|---|---|
| Row height | 56 px | 40 px |
| Cell padding | 16 px | 12 px |

## 5. Layout

| Breakpoint | Width | Columns | Margin | Gutter |
|---|---|---|---|---|
| Phone | Under 768 px | 4 | 16 px | 12 px |
| Tablet | 768 to 1023 px | 8 | 24 px | 16 px |
| Desktop | 1024 to 1439 px | 12 | 32 px | 24 px |
| Wide | 1440 px and over | 12 | 32 px | 24 px |

- Content is at most 1360 px wide and centred.
- The tool rail floats in the left margin, 60 px wide, vertically centred (`D-052`). Content clears it with 96 px left padding on desktop and 84 px on tablet.
- Dashboard grid (`D-035`): six columns on desktop, three on tablet, one on phones, with a 96 px row unit.
- The side panel is 480 px wide, and 640 px for transaction detail with a map.
- The bottom bar reserves 96 px plus the safe area at the bottom of phone pages.

## 6. Corners

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 8 px | Chips, checkboxes, tooltips |
| `radius-md` | 12 px | Inputs, menu items, small tiles |
| `radius-lg` | 16 px | Dropdown menus, inner cards |
| `radius-xl` | 22 px | Cards, dialogs, side panels |
| `radius-2xl` | 28 px | Bottom sheets, the phone bar |
| `radius-full` | 999 px | Buttons, pills, badges, avatars |

Nested corners get smaller: inner radius is the outer radius minus the padding.

## 7. Depth

Depth is mostly surface colour. Cards don't have shadows.

| Level | What | Treatment |
|---|---|---|
| 0 | Canvas | Flat |
| 1 | Cards, tables | `surface`, 1 px `line` |
| 2 | Menus, popovers, tooltips | `surface` or glass, `shadow-sm` |
| 3 | Rail, phone bar | Glass, `shadow-md` |
| 4 | Dialogs, panels, sheets | `surface`, `shadow-lg`, scrim |
| 5 | Toasts | `surface`, `shadow-md`, above all |

| Token | Light | Dark |
|---|---|---|
| `shadow-sm` | `0 4px 12px rgba(27,24,19,.10)` | `0 4px 12px rgba(0,0,0,.40)` |
| `shadow-md` | `0 10px 30px rgba(27,24,19,.14)` | `0 10px 30px rgba(0,0,0,.45)` |
| `shadow-lg` | `0 24px 60px rgba(27,24,19,.20)` | `0 24px 60px rgba(0,0,0,.55)` |
| `scrim` | `rgba(27,24,19,.40)` | `rgba(0,0,0,.60)` |

Layer order: page 0, sticky headers 10, rail and bar 20, popovers 30, overlays 40, toasts 50. Today's `Z_INDEX` constant is replaced to match.

**Glass (`D-055`):** `background: var(--glass); backdrop-filter: blur(18px) saturate(1.4)`, with a 1 px `line` border. Use on the rail, phone bar, tooltips and menus only. With `prefers-reduced-transparency`, or no `backdrop-filter` support, it falls back to solid `surface` (A).

## 8. Icons

**Set:** Hugeicons Stroke Rounded (`D-058`), from `@hugeicons/core-free-icons` (MIT, 6,067 icons in the version checked) and `@hugeicons/react`.

| Size | Stroke | Use |
|---|---|---|
| 16 px | 1.5 | Inline with text, table rows |
| 20 px | 1.5 | Buttons, inputs, menus, the default |
| 24 px | 1.5 | Rail, phone bar, top bar |
| 24 px | 2 | Active rail and phone bar item |

**No filled style.** The free set is stroke-only, so an active item is shown by its pill background and a 2 px stroke, plus `aria-current`. This is the one difference from the option you saw.

**Core icons**

| Meaning | Icon | Meaning | Icon |
|---|---|---|---|
| Overview | `Home01` | Search | `Search01` |
| Accounts | `Wallet02` | Create | `Add01` |
| Transactions | `ArrowDataTransferHorizontal` | Today | `Calendar01` |
| Planning | `Calendar03` | Sync banks | `Refresh` |
| Investments | `ChartLineData01` | Lock | `SquareLock02` |
| Reports | `Analytics01` | Theme | `Moon02`, `Sun03` |
| Settings | `Settings01` | More | `MoreHorizontal` |
| Review queue | `TaskDone01` | Notifications | `Notification01` |

**Rules**
- Icons inherit `currentColor` and sit on a 24 px grid.
- Icon-only buttons need an accessible name and a tooltip on pointer devices (A).
- Icons support words. They never carry meaning alone, except universal ones such as Close.

**Migrating (Phase 9).** Crystal stores icon names in saved data, in several forms, because the current `Icon` component already translates old names. So:
- Saved data isn't rewritten. `components/ui/Icon.tsx` keeps its interface and gains a table from every old name to a Hugeicon.
- About 230 literal names in code and the picker's catalogue of about 1,200 icons need mapping. An unknown name falls back to one neutral icon.
- `IconPicker` is rebuilt on the new set, and the full catalogue loads only when the picker opens. Each icon is otherwise imported by name, so the app doesn't load the 6,000.
- Phosphor is removed once nothing imports it. Today that's 14 files.

## 9. Motion (`D-059`)

Expressive, but it never holds you up.

| Token | Value | Use |
|---|---|---|
| `duration-fast` | 120 ms | Hover, press, focus |
| `duration-base` | 200 ms | Tabs, menus, tooltips |
| `duration-medium` | 320 ms | Panels, dialogs, sheets |
| `duration-slow` | 500 ms | Chart reveals, card entrances |
| `duration-count` | 700 ms | Number count-ups |
| `stagger` | 40 ms | Between cards, up to six |
| `ease-standard` | `cubic-bezier(.2,0,0,1)` | Most movement |
| `ease-exit` | `cubic-bezier(.4,0,1,1)` | Things leaving |
| `spring-sheet` | Stiffness 380, damping 36 | Sheets, drag release |

**What moves**

| Moment | Motion |
|---|---|
| Open a page | Cards rise 8 px and fade in, staggered |
| Key figures | Count up from about 90% of the final value |
| Charts | Lines draw from the left, bars grow from the baseline |
| Active pill or tab | The highlight slides between items |
| Progress bars and rings | Fill from zero |
| Panels and sheets | Slide in with a fading scrim |
| Save, Review queue | Item slides out, and the count updates |
| Forecast drag | The low point updates live |

**Rules that keep it from getting in the way**
- Count-ups and staggers play on the first visit to a page in a session. After that a page appears at once (`D-062`).
- Nothing blocks input. You can click during an animation, and it jumps to the end.
- Tables, rows and lists never stagger. Data changes never replay entrances.
- Only `transform` and `opacity` animate, apart from chart drawing.

**Reduced motion (A).** With `prefers-reduced-motion`, count-ups, staggers, chart drawing and sliding all stop. Figures show their final value at once, and only short fades remain.

**Screen readers (A).** Animated figures expose their final value only, never the intermediate numbers.

## 10. Accessibility baseline

WCAG 2.2 AA decides pass or fail (`H-003`).

| Requirement | Rule | Tier |
|---|---|---|
| Contrast | 4.5:1 for text, 3:1 for large text, controls and meaningful graphics | A |
| Colour alone | Gain, loss and status also have a sign, word or icon | A |
| Keyboard | Everything works by keyboard, including drag alternatives (2.5.7) | A |
| Focus | 2 px `focus` ring with 2 px offset, on `:focus-visible`, never hidden by sticky items | A |
| Targets | 24 px minimum (2.5.8) | A |
| Touch targets | 44 px on tablets and phones | B |
| Dialogs | Focus trapped and restored, Escape closes, background inert | A |
| Charts | Text summary and table view | A |
| Forms | Visible labels, errors linked to fields and written in words | A |
| Zoom | Usable at 200% and at 320 px wide | A |
| Live updates | Toasts and sync status use polite live regions | A |
| Privacy mode | Hidden amounts are hidden from screen readers too | A |

## 11. Writing

- Plain words with a little character (`S-005`): "Nothing to review. Nice." rather than "No pending items".
- Say "you" and "your". Button labels are verbs: "Save budget", not "Submit".
- Errors say what happened and what to do next.
- Destructive buttons name the thing: "Delete 3 transactions".
- Currency follows the record: `€1,284.50`, with the sign before the symbol: `− €42.10`. Positive amounts show `+` where direction matters.

## 12. Components

Each one is listed in the [Component Inventory](07-component-inventory.md), and its screen-size behaviour is in the [Responsive Specification](08-responsive-behavior-specification.md). All interactive parts have hover, pressed, focus and disabled states, built on `react-aria-components`.

### Buttons

| Variant | Look | Use |
|---|---|---|
| Primary | `primary` fill | One main action per view |
| Secondary | `surface`, `line-strong` border | Other actions |
| Soft | `primary-soft` fill | Quiet actions inside cards |
| Ghost | No fill | Toolbars, Cancel |
| Destructive | `money-out` fill | Plain confirmation for screen readers, and type-to-confirm |
| Hold | `money-out-soft`, fills to `money-out` | Deleting (`D-065`) |
| Icon | Round, tooltip | Rail, tools |

Sizes: small 32 px (desktop tables only), medium 40 px, large 48 px. All are `radius-full`, and phones use 44 px or more. A busy button keeps its width and shows a spinner.

**Hold to delete (`D-065`).** Press and hold for 1.2 seconds. The button fills as you hold, drains if you let go early, then a toast offers Undo. The label names the thing: "Hold to delete 3 transactions".

| Case | Behaviour |
|---|---|
| Detail panels and bulk actions | The hold button sits there directly |
| Row menus | Delete opens a small dialog with the hold button, because a menu item can't be held |
| Quick click or tap | Nothing is deleted, and the label says "Keep holding" |
| Keyboard | Hold Space or Enter |
| Screen readers (A) | They send a plain click, so it opens a dialog with an ordinary Destructive button |
| Accounts | Keep type-to-confirm, as they do today |

Built in Crystal from KokonutUI's source (MIT), using Crystal tokens and Hugeicons, so `lucide-react` isn't added. Undo depends on each delete being reversible, which Phase 9 confirms per record type.

### Inputs

Height 44 px, `radius-md`, `inset` fill, 1 px `line-strong`. Label above, help or error below, and placeholders never replace labels. Amounts are right-aligned with tabular figures and a currency prefix. The error state uses a `money-out` border, an icon and a message.

Variants: text, amount, date, search, textarea. Autofilled fields (merchant autofill, `AUT` rows) show a small "Filled from Merchant" note with Undo.

### Selects and dropdowns

- **Select:** picks one value, using a popover list.
- **Combobox:** long lists (accounts, merchants, categories) get search.
- **Multi-select:** uses checkboxes, with a count in the trigger.
- **Menu:** actions, not values, with icons and shortcuts. Destructive items sit last.

Menus are `radius-lg`, with 40 px items (44 px on touch), and 12 items before scrolling.

### Switches, checkboxes, radios, segmented controls

Switch for instant settings, checkbox for choices that are saved, radio for two to five exclusive options, and a segmented control for views. All have 44 px touch areas on touch devices.

### Cards

`surface`, 1 px `line`, `radius-xl`, 24 px padding (20 on phones). The header holds the title, then an optional action. Whole-card links get hover and focus states. Hero variant: `primary` fill with `on-primary` text, used once per page at most.

### Tables

Header row in `label` on `inset`, sticky on scroll. Numbers are right-aligned. Rows have hover, selected and focus states, and the row menu is always keyboard reachable. Comfortable or Compact density (section 4). Lists use Show more rather than page numbers (`D-040`). Bulk actions appear in a floating action bar in Select mode (`D-008`).

### Tabs and navigation

- **Top pills (`D-002`):** seven hubs, with a sliding `primary` highlight.
- **Tab row:** underlined tabs below the pills, for the hub's pages.
- **Tool rail (`D-018`, `D-052`):** eight 44 px glass icon buttons with tooltips.
- **Phone bottom bar (`D-054`):** five labelled items in glass, 58 px tall, plus the safe area.
- **More sheet:** Investments, Reports, Settings, Sync, Privacy, Theme and Lock.
- **Phone top bar:** logo, Search, notifications and Create.

### Overlays (`D-024`)

| Type | Use | Size |
|---|---|---|
| Dialog | Short task or confirmation | 480 px, `radius-xl` |
| Side panel | View or edit a record | 480 or 640 px |
| Full panel | Long or multi-step work | Full width, 960 px content |
| Bottom sheet | All of these on phones | Peek, half and full heights |
| Popover | Filters, small pickers | Content width |
| Tooltip | Names and hints, never essential content | 12 px text, glass |

Dialogs, panels and sheets dim the page with `scrim` plus a very slight 2 px blur (`D-067`), which drops with reduced transparency. Only one sheet is open at a time. The exception is a picker on top of a form. Closing with unsaved changes asks first: Keep editing or Discard (`D-068`).

### Notifications

- **Toast:** confirmation, with Undo where possible. It sits at bottom centre, above the selection bar when that's showing, or above the phone bar, for five seconds (`D-066`).
- **Banner:** page-level status, such as a bank connection needing attention.
- **Notification centre:** a side panel on desktop, a sheet on phones.
- **Needs you:** the Dashboard list of what's waiting.

### Badges

`radius-full`, 24 px tall, `ink` text on a soft tint with an icon or dot. Variants: neutral, positive, attention, negative, and the four category colours. Counts sit in small `primary` pills.

## 13. Charts (`D-060`)

Built on `src/components/charts` (visx). Clean and labelled.

| Element | Rule |
|---|---|
| Lines | 2 px, rounded joins, with a soft area fading from 16% to 0% |
| Bars | 4 px rounded data end, 2 px gap, anchored to the baseline |
| Grid | Horizontal only, in `line` |
| Axes | `caption` in `muted`, up to six labels |
| Labels | Direct labels for up to four series. A legend is always shown for two or more |
| Hover | Crosshair and tooltip, with bigger hit areas than the marks |
| Forecast | Solid for actual, dashed for forecast, with the buffer as a dashed `attention-text` line |
| Candlesticks | Green up and red down, also told apart by filled and hollow bodies |
| Sankey and donut | Direct labels, with "Other" for small slices |
| Heatmap | One hue from light to dark, with values on hover and in the table |

**Rules**
- One axis per chart.
- Text uses text colours, never the series colour.
- Every chart has an accessible summary and a table view (A).
- Loading uses the chart's skeleton, and an empty chart explains itself in words.
- Dark mode uses the chart tokens in section 2.4, not an automatic flip.

## 14. Financial summaries

| Pattern | Rule |
|---|---|
| Written summary | `sentence` style, with figures and phrases as links. Only three facts at most |
| Net Worth hero | Figure, change this period in words and a sign, and a three-part split |
| Summary card | Label, `figure-lg`, one line of context |
| Amount | Tabular. Income in `money-in` with `+`, spending in `ink` with `−`. Red is kept for losses and overspending, so a page of normal spending isn't a wall of red (`D-063`) |
| Change | Icon, sign and word: "+ €1,206 this month" |
| Budget progress | Bar with amount spent and left. Attention at 80%, over budget in `money-out` and in words |
| Privacy mode | Replaces figures with `•••` and hides chart values |

## 15. States

| State | Rule |
|---|---|
| Empty | Icon, one line on what belongs here, one action. No illustrations |
| First use | Explains the benefit, with Add or Import |
| No results | Says what was searched and offers Clear filters |
| Loading | Skeletons that match the layout, shown after 200 ms. Spinners only inside buttons |
| Refreshing | Existing data stays visible, with a quiet status |
| Error, section | The widget shows what failed and Try again. The rest of the page keeps working |
| Error, page | Plain message, Try again and a route home |
| Offline or sync issue | Banner, plus when the data was last updated |
| Partial | A failed price or bank shows on its own row |
| Saving | Autosave status is quiet, and a failure is loud |
| Conflict | The 409 case explains that another session changed the data, and offers Reload |

## 16. Apple HIG review

| Item | Finding | Tier | Outcome |
|---|---|---|---|
| Contrast and colour alone | Tokens computed, signs and words required | A | Followed |
| Reduced motion and transparency | Handled, including count-ups and glass | A | Followed |
| Keyboard, focus and dialogs | React Aria base, with drag alternatives | A | Followed |
| Dynamic text size | `rem` sizing and 200% zoom | A | Followed |
| 44 px touch targets | Tablets and phones | B | Followed |
| Feedback in context, Undo over alerts | Toasts with Undo, autofill note | B | Followed |
| One focused sheet at a time | Picker exception only | B | Followed |
| Sheet heights and drag handle | Peek, half and full | C | Adopted as a web pattern |
| Bottom bar | Labelled, five items, with a More | C | Differs on More, owner's choice (`D-054`) |
| In-app theme switch | Apple prefers system setting | C | Not followed, Crystal keeps Theme |
| Glass on floating layers | Matches the floating-only idea | D | Owner's choice (`D-055`) |
| Press and hold to delete | Hidden gesture, with a visible label and a screen reader route | A, B | Owner's choice (`D-065`), label and alternative required |
| Expressive motion | HIG favours restraint and purpose | B | Owner's choice (`D-059`), with the limits in section 9 |

No tier A conflicts remain.

## 17. Open checks

| Item | Status |
|---|---|
| Manrope tabular figures | Done. Digits measured equal in a browser with `tabular-nums` |
| Component samples | Checked at about 800 px and 390 px, in light and dark, with no sideways overflow. They're samples, not the app |
| Widget Grid replaces react-grid-layout | Tested in Phase 9 (`D-035`) |
| Real text over charts through glass | Tested in Phase 9 |
| Hugeicons name mapping | Done in Phase 9, with coverage checked for all 230 names |
