---
version: 3.0
name: Crystal
description: Warm light canvas, forest green and amber, with a matching dark mode
colors:
  primary: "#2F5C50"
  primary-dark: "#6CC59A"
  amber: "#F2C94C"
  money-in: "#27694A"
  money-out: "#A93316"
  canvas: "#EBE8E1"
  solid: "#FFFDF8"
  ink: "#1B1813"
  muted: "#5E584E"
typography:
  sans:
    fontFamily: "Manrope Variable, Manrope, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
---

# Crystal design

This is the short guide for anyone changing the interface. The full reasoning, every measurement and every decision is in [docs/redesign](docs/redesign/README.md): the specification is [06-design-system-specification.md](docs/redesign/06-design-system-specification.md), and the decisions are in [DECISION_REGISTER.md](docs/redesign/DECISION_REGISTER.md) (`D-` numbers below).

## The look

A warm light canvas with a soft fixed tint behind it, forest green for actions and amber for highlights. Dark mode is its own set of values, not an inversion. Cards and controls are translucent over the tint, and popovers, panels, sheets, tooltips and toasts are solid (`D-086`). Borders are soft and the background glow is light (`D-126`). The sidebar and page tabs use the pill style (`D-122`), and phones get a floating dock at the bottom (`D-123`).

## Rules that hold everywhere

1. **Tokens, never raw colours.** No Tailwind palette classes (`text-gray-500`, `bg-emerald-600`) and no hex values in components. User-chosen colours (a category's colour) are data, so they are the exception.
2. **Money goes through `Amount`.** It is tabular, signed, and hidden in privacy mode. Use `tone="flow"` to show direction and `tone="loss"` to show negatives in red. Do arithmetic with the safe-math helpers in `utils.ts`.
3. **Colour never carries meaning alone.** Every status has a word or an icon, and every chart with more than one series has a legend.
4. **Text is ink or muted.** Coloured text is for `money-in`, `money-out` and `attention-text` only. Soft tints (`primary-soft`, `amber-soft`, `blue-soft` and so on) hold ink text with a coloured icon or dot.
5. **Icons come from `components/ui/Icon`**, which maps saved names onto Hugeicons.
6. **Touch targets are 44 px** on coarse pointers, and form text is 16 px on phones.
7. **Respect the preferences.** Reduced motion, reduced transparency, more contrast and forced colours all have a fallback in `index.css`.

## Tokens

Defined once in `index.css` (light on `:root`, dark on `.dark`) and exposed to Tailwind as colours.

| Group | Names |
|---|---|
| Surfaces | `canvas`, `solid`, `surface`, `glass`, `inset` |
| Lines | `line`, `line-strong` |
| Text | `ink`, `muted`, `attention-text` |
| Action | `primary`, `primary-hover`, `on-primary`, `primary-soft`, `pill`, `pill-hover`, `on-pill` |
| Meaning | `money-in`, `money-out`, `on-danger`, `amber`, `amber-soft`, `-soft` versions of each |
| Accents | `blue`, `tomato`, `rose`, `teal` (each with a `-soft` tint) |
| Charts | `chart-1` to `chart-5`, in that order, never cycled |
| Depth | `shadow-sm`, `shadow-md`, `shadow-lg`, `scrim` |
| Layers | `--z-sticky` 110, `--z-bar` 200, `--z-popover` 500, `--z-overlay` 400, `--z-toast` 1000. Popovers sit above dialogs because they open from them |

Corners: `radius-sm` 8, `radius-md` 12, `radius-lg` 16, `radius-xl` 22, `radius-2xl` 28, and full for buttons, pills and badges.

## Type

Manrope, sizes in `rem`, sentence case. Use the utilities, not raw sizes:

`type-figure-hero`, `type-page-title`, `type-sentence`, `type-figure-lg`, `type-section-title`, `type-card-title`, `type-body`, `type-body-strong`, `type-figure-row`, `type-label`, `type-caption`.

## Layout

Phone under 768 px, tablet 768 to 1023, desktop 1024 and up. Content is at most 1360 px wide. Check every change at 1440, 768 and 390 wide, in light and dark.

## Building blocks

Everything is in `components/ui`. Reach for these before writing markup.

| Need | Use |
|---|---|
| A dialog, panel or sheet | `Dialog` (short task), `SidePanel` (a record), `FullPanel` (long work). Phones get a bottom sheet automatically |
| Ask before something risky | `ConfirmDialog` |
| A small anchored picker or filter | `Popover`. Its trigger is a button, and phones get a sheet |
| A list of actions | `Menu`, and `PointerMenu` for right-click |
| Fields | `TextInput`, `AmountInput`, `Textarea`, `DateInput`, `Select`, `Combobox`, `MultiSelect`, `Checkbox`, `Switch` |
| Buttons | `Button` (primary, secondary, soft, ghost, destructive), `IconButton` |
| Rows, tags and tables | `Row`, `Badge`, `DataTable`, `DayGroup` |
| Empty and loading | `EmptyState`, `Skeleton`. A spinner is for buttons and the first load only |
| Logos and icons for things | `EntityIcon` (`LogoTile`, `EntityGlyph`, `MerchantLogo`). Logos come only from Merchants (`D-127`) |
| Charts | `src/components/charts` with the chart tokens, plus a legend and a table view |

## Forecasting

One calculation drives the Overview, Forecast and account pages: `utils/forecastModel.ts`. Add new money movements there, not in a screen.

## Checking a change

```bash
node node_modules/typescript/bin/tsc --noEmit
npm test
npm run build
```

Then open it in the browser at the three widths. `/?ui-kit` shows every component in development.
