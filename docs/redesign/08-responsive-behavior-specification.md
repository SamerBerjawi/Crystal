# Crystal: Responsive Behavior Specification

Phase 8 deliverable, approved by the owner (`D-073`). It defines how every component and page behaves on desktop, tablet and phone. Sizes are in the [Design System Specification](06-design-system-specification.md), and the components are in the [Component Inventory](07-component-inventory.md).

**Principle (`S-006`):** the phone isn't a smaller desktop. Each page has its own order and interaction, and nothing is removed from it unless a decision says so.

## 1. Breakpoints

| Name | Width | Test size | Input |
|---|---|---|---|
| Phone | Under 768 px | 390 × 844 | Touch |
| Tablet | 768 to 1023 px | 768 × 1024 | Touch, sometimes pointer |
| Desktop | 1024 to 1439 px | 1440 × 900 is also tested | Pointer and keyboard |
| Wide | 1440 px and over | 1440 × 900 | Pointer and keyboard |

**Rules**
- Hover-only features are decided by `@media (hover: hover)`, and touch sizes by `pointer: coarse`, not by width. A touchscreen laptop still gets large targets.
- Container queries are used for cards in the Dashboard grid, because a card's width depends on the grid, not the screen.
- Safe areas use `env(safe-area-inset-*)`.
- Pages must also work at 320 px wide, and at 200% zoom (A).
- Landscape phones use the phone layout.
- `100dvh` is used rather than `100vh`, so browser bars don't clip sheets.

## 2. App frame

| Element | Desktop | Tablet | Phone |
|---|---|---|---|
| Hub navigation | Top pills | Top pills, compressed. Labels stay | Bottom bar and More |
| Tab row | Under pills | Under pills, scrolls sideways | Under title, scrolls sideways, with the next tab partly visible |
| Tools | Rail, vertically centred | Rail, vertically centred (`D-072`) | Search and Create in the top bar, others in More |
| Notifications | Top right | Top right | Top bar |
| Profile | Top right | Top right | More |
| Page margin | 32 px | 24 px | 16 px |
| Content | Up to 1360 px, 12 columns | 8 columns | 4 columns |

If the seven pills don't fit at 768 px, the pills compress to 12 px side padding. They never become a menu.

## 3. Components

### Actions

| Component | Desktop | Tablet | Phone |
|---|---|---|---|
| `Button` | M, small in tables | M, 44 px | L, full width at the bottom of forms |
| Main page action | Page header | Page header | Create in the top bar opens Add transaction, with Create something else (`D-071`) |
| `IconButton` | 40 px, tooltip | 44 px | 44 px, name exposed for screen readers |
| `SegmentedControl` | Inline | Inline | Full width, a sheet with more than three long options |
| `SelectionBar` | Floating at the bottom | Floating at the bottom | Above the phone bar, with More for extra actions |
| `HoldButton` | In panels, or a dialog from row menus | The same, hold by touch | Full width in the detail sheet |

### Forms

| Component | Desktop | Tablet | Phone |
|---|---|---|---|
| Form layout | Two columns where fields are related | Two columns | One column |
| `TextInput` | 44 px, 15 px text | The same | 48 px, 16 px text |
| `AmountInput` | Text keyboard | Decimal keyboard | Decimal keyboard, large figure at the top of the transaction form |
| `DateInput` | Calendar popover | Calendar popover | Native date picker |
| `Select` | Popover | Popover | Bottom sheet |
| `Combobox` | Popover with search | Popover with search | Full-height sheet, search focused |
| `MultiSelect` | Popover | Popover | Sheet with Apply |
| `Checkbox`, `Radio`, `Switch` | Pointer sizing | 44 px target | 44 px target, whole row tappable |
| Form actions | Footer of the panel | Footer of the panel | Sticky footer above the keyboard |

### Menus and overlays

| Component | Desktop | Tablet | Phone |
|---|---|---|---|
| `Menu` | Popover | Popover | Bottom sheet with 48 px items |
| Context menu | Right-click, and a row menu button | Long press, and a row menu button | Long press and swipe, and detail view |
| `Popover` | Anchored | Anchored | Bottom sheet |
| `Tooltip` | Hover and focus | Focus only | None. Anything important is in the label |
| `Dialog` | Centred, 480 px | Centred, 480 px | Bottom sheet, content height |
| `SidePanel` | Right, 480 or 640 px | Right, 480 px | Full-height sheet |
| `FullPanel` | Full width, 960 px content | Full width | Full screen, steps one at a time |
| `BottomSheet` | Not used | Not used | Peek, half, full, with drag handle and Close |
| `CommandPalette` | Centred | Centred | Full screen |

Sheets can be closed by dragging, by Close, or by tapping the scrim, and the keyboard never covers the focused field.

### Navigation

| Component | Desktop | Tablet | Phone |
|---|---|---|---|
| `TopPills` | Visible | Visible | Hidden |
| `ToolRail` | Visible | Visible | Hidden |
| `PhoneBar` | Hidden | Hidden | Always visible while scrolling, hidden with the keyboard open (`D-070`) |
| `PhoneTopBar` | Hidden | Hidden | Visible, sticky |
| `MoreSheet` | Not used | Not used | Half sheet |
| `PageHeader` | Title and actions in one row | Title and actions in one row | Title only, actions move to Create or a menu |

### Data

| Component | Desktop | Tablet | Phone |
|---|---|---|---|
| `Card` | 24 px padding | 24 px padding | 20 px padding |
| Multi-column cards | 2 to 4 columns | 1 to 2 columns | 1 column, in a set order |
| Summary card row | 4 across | 2 by 2 | Scrolling row, with the next card partly visible |
| `Table` | All columns, density switch | Key columns, others in the detail panel | Becomes `Row` list |
| Table sort | Column headers | Column headers | Sort sheet |
| `Row` | Not used | Not used | 64 px, name and context left, amount right |
| Day groups | Table subheaders | Table subheaders | Sticky headers |
| `FilterBar` | Inline chips | Inline chips, scrolling | One Filter button with a count, and a sheet |
| `ShowMore` | Bottom of list | Bottom of list | Bottom of list |
| `Badge` | Inline | Inline | Up to two on a row |
| `Timeline` | Horizontal | Horizontal, scrolling | Vertical list |

### Financial summaries

| Component | Desktop | Tablet | Phone |
|---|---|---|---|
| `WrittenSummary` | Full width, `sentence` | Full width | Full width, at most three facts |
| `NetWorthHero` | Two-thirds with Needs you beside it | Full width | Full width, smaller figure |
| `WidgetGrid` | Six columns, drag and resize | Three columns, drag and resize | One column, reorder and hide in an edit sheet |
| `AccountFrame` tabs | Tab row | Tab row | Scrolling tab row |
| `ReviewCard` | Queue beside detail | Queue beside detail | One card, swipe or buttons |
| `RuleBuilder` | Two columns, with a live preview | One column, with preview below | Steps, with preview as a step |
| `PinPad` | Keyboard and on-screen pad | On-screen pad | On-screen pad, 64 px keys |

### Charts

| Item | Desktop | Tablet | Phone |
|---|---|---|---|
| Height | 320 px | 280 px | 220 px |
| Axis labels | Up to six | Up to five | Up to three |
| Legend | Right or top | Top | Below, wrapping |
| Details | Hover crosshair | Tap and drag | Tap and drag, value above the chart |
| Series | Up to five | Up to five | Up to three, with others in "Other" |
| Table view | Toggle | Toggle | Toggle, as rows |
| Drag (Forecast) | Drag bubbles | Drag bubbles | List by default, tap a bubble to move it |
| Sankey | Full | Full | Simplified to top flows, with the rest listed |
| Heatmap | Full year | Full year, scrolling | Current months, swipe for more |
| Candlesticks | Available | Available | Available with fewer candles |

Touching a chart mustn't scroll the page by accident, so charts capture sideways drags and let vertical ones scroll.

### Feedback

| Component | Desktop | Tablet | Phone |
|---|---|---|---|
| `Toast` | Bottom centre, above the selection bar | Bottom centre, above the selection bar | Above the phone bar, full width |
| `Banner` | Under header | Under header | Under top bar |
| `NotificationCenter` | Side panel | Side panel | Full-height sheet |
| `EmptyState` | Centred in the area | Centred in the area | Centred, with a full-width action |

## 4. Pages

### Desktop and tablet

| Page | Desktop | Tablet |
|---|---|---|
| Overview | Summary, then hero with Needs you, then the widget grid | The same, in three columns |
| Accounts | Tabs, summary cards, table or pots | Two-column cards |
| Account detail | Frame with summary and tabs | The same, in one column |
| Ledger | Scatter, tabs, table, filter-aware side summary | Scatter, table, summary below |
| Review queue | List with detail | The same |
| Rules | List with builder | One column |
| Merchants | List with profile | List with panel |
| Budget | Rivet list, with summary | One column |
| Forecast | Chart with bubbles, side list | Chart, list below |
| Goals | Cards, table toggle | Two-column cards |
| Calendar | Month with Today panel | Month, Today below |
| Subscriptions | Timeline, cards, tabs | The same, in two columns |
| Tasks | Board or list | Board scrolls sideways |
| Portfolio and Holdings | Chart with table | Chart, key columns |
| Reports | Report cards, then a report | Two columns |
| Invoices | Table | Key columns |
| Settings | Tabs and Find a setting | Scrolling tabs |

### Phone

| Page | Order and behaviour |
|---|---|
| Overview | Sentence, Net Worth, Needs you, Safe to spend, Forecast, Accounts, Recent |
| Accounts | Total, scrolling tabs, list by group |
| Account detail | Figure, quick actions, tabs |
| Ledger | Search, Filter, month figures, day rows. Select mode from a long press or menu |
| Review queue | One card, with count and quick actions |
| Rules | List, then builder in steps |
| Merchants | List, then profile as a separate step |
| Budget | Month summary, then rows |
| Forecast | List by default, chart above |
| Goals | Cards |
| Calendar | Week strip and day agenda |
| Subscriptions | Renewal list, Wallet tab |
| Tasks | List with filters |
| Investments | Portfolio figure, chart, then name, value and gain |
| Reports | One report at a time |
| Invoices | Rows, editing in a full-height sheet |
| Settings | List of groups, then a page for each |
| Data import | Simplified steps. Full mapping is desktop only (`D-030`) |
| Lock | Full screen pad |

## 5. Gestures

| Gesture | Where | Keyboard or button alternative |
|---|---|---|
| Tap | Open details | Enter |
| Swipe a transaction left | Categorise (`D-069`) | Row menu |
| Swipe a transaction right | Select (`D-069`) | Select button |
| Press and hold Delete | Delete (`D-065`) | Keyboard hold, dialog for screen readers |
| Long press | Select mode | Select button |
| Drag a sheet | Resize or close | Close button |
| Drag a widget | Reorder | Edit sheet, keyboard reorder |
| Drag a forecast bubble | Move a bill | Date field in the sheet |
| Pull down | Refresh | Sync in More |

Every gesture has a visible alternative (A, WCAG 2.5.1 and 2.5.7). Delete isn't a swipe action, so a stray swipe can't remove anything.

## 6. Overflow rules

- The page never scrolls sideways. Only tab rows, summary rows, tables and timelines scroll inside themselves, and they show a cut-off item as a cue.
- Long names truncate with an ellipsis, and the full text is available in details.
- Amounts never truncate. If a figure doesn't fit, the name gets shorter, and then the figure drops one type size.
- Large amounts in any currency must fit: test with `€1,234,567.89` and `RON 12,345,678.90`.
- Grid and flex children use `min-width: 0`.
- Sticky items never cover the focused element (A, WCAG 2.4.11).

## 7. Phase 9 acceptance check

Every module is checked at 1440 × 900, 768 × 1024 and 390 × 844, in light and dark.

- No sideways page scroll, clipped text or covered controls.
- All touch targets meet the size rule.
- Keyboard route works on desktop.
- Overlays open as the right type.
- Long names, large amounts and empty data all hold up.
- Reduced motion and reduced transparency work.

What couldn't be tested is recorded in the Progress Tracker, never assumed.
