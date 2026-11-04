# Crystal Icon System & UI Registry

> **Standard**: Exclusively `@hugeicons/core-free-icons` (`^4.3.5`) in the **Stroke Rounded** style (1.5px stroke width, 24px default).  
> **Rule**: Free stroke rounded icons only — never import or render Pro icon variants (`solid`, `twotone`, `bulk`, `sharp`).

---

## Crystal Icon Philosophy

Crystal icons communicate **intent** rather than decorate the interface.

Every icon should answer one of four questions:
- **Where am I?** (Navigation & wayfinding)
- **What can I do?** (Actions & interaction affordances)
- **What type of object is this?** (Domain entities, accounts & categories)
- **What state is this in?** (Status, sync health & verification)

Icons are **supplementary**. Labels remain the primary communication mechanism.

When several icons could represent a concept, prefer the **simplest metaphor that remains recognizable at 16px**.

---

## 1. Architectural Guidelines & Icon Wrapping

Every icon in Crystal is rendered via the unified icon wrapper [`components/ui/Icon.tsx`](file:///Users/samerberjawi/Documents/Crystal/components/ui/Icon.tsx).

```tsx
import Icon from '@/components/ui/Icon';

// Renders using normalized kebab-case, PascalCase, or aliased name
<Icon name="arrow-data-transfer-horizontal" size={16} />
<Icon name="wallet-02" size={20} className="text-emerald-500" />
<Icon name="sync" size={18} className="animate-spin" />
```

### Normalization Pipeline
1. **Identifier Cleanup**: Replaces spaces, slashes, and dashes into kebab-case.
2. **Alias Resolution**: Queries `ICON_NAME_MAP` for backwards compatibility with legacy database tags and Material Symbol aliases (e.g. `swap_horiz` ➔ `ArrowDataTransferHorizontal`, `sync` ➔ `Sync`, `drag_indicator` ➔ `DragDropVertical`).
3. **PascalCase Resolution**: Converts kebab-case to PascalCase and checks `ICONS` in `Icon.tsx`.
4. **Fallback Safety**: Any unrecognized identifier gracefully falls back to `ICONS.SquaresFour` (`dashboard-square-01`), preventing blank rendering or React runtime errors.

---

## 2. The Four Global Semantic Classes

Crystal organizes its design system into four global semantic classes to prevent semantic drift across features.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CRYSTAL ICON TAXONOMY                           │
├─────────────────────┬────────────────────┬─────────────────────────────┤
│ Class               │ Question Answered  │ Primary Domains             │
├─────────────────────┼────────────────────┼─────────────────────────────┤
│ 1. Navigation       │ Where am I?        │ Hubs, Tabs, Breadcrumbs     │
│ 2. Objects          │ What type is this? │ Accounts, Categories, Pots  │
│ 3. Actions          │ What can I do?     │ Verbs, Reorder, Sync, Form  │
│ 4. Status           │ What state is it?  │ Reconciled, Synced, Locked  │
└─────────────────────┴────────────────────┴─────────────────────────────┘
```

---

### Class 1: Navigation ("Where am I?")

#### Hubs vs. Subpages (Tabs) Non-Overlap Rule
- **Rule**: A parent navigation hub **must never share the same icon as any of its child subpages (tabs)**.
- **ToolRail Alignment**: Icons defined in the floating bottom `ToolRail` serve as the default visual anchors for their respective pages and tabs.

| Navigation Hub | Hub Hugeicon | Hub Identifier | Subpages / Tabs (Top Pills) | Subpage Hugeicon | Tab Identifier | Financial UX Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Overview** | `DashboardSquare01Icon` | `dashboard-square-01` | *(Cockpit View)* | — | — | Universal high-level cockpit dashboard. |
| **Accounts** | `Layers01Icon` | `layers-01` | • Cards<br>• Accounts<br>• Loans<br>• Assets | `CreditCardIcon`<br>`Wallet02Icon`<br>`Agreement01Icon`<br>`Home01Icon` | `credit-card`<br>`wallet-02`<br>`agreement-01`<br>`home-01` | Hub uses stacked balance-sheet layers (`layers-01`), separating it from cash operating accounts (`wallet-02`) and property (`home-01`). |
| **Transactions** | `ArrowDataTransferHorizontalIcon` | `arrow-data-transfer-horizontal` | • **Ledger**<br>• Review queue<br>• Rules<br>• Merchants | `LogsIcon`<br>`Tick02Icon`<br>`FlashIcon`<br>`Store01Icon` | `logs`<br>`tick-02`<br>`flash`<br>`store-01` | **Ledger tab uses `logs` (matching the ToolRail)**; Hub uses horizontal data flow (`arrow-data-transfer-horizontal`). |
| **Planning** | `Compass01Icon` | `compass-01` | • **Forecast**<br>• Budget<br>• Goals<br>• Calendar<br>• Subscriptions<br>• Tasks | `ChartEvaluationIcon`<br>`PieChart01Icon`<br>`Target01Icon`<br>`Calendar03Icon`<br>`RepeatOne01Icon`<br>`Task01Icon` | `chart-evaluation`<br>`pie-chart-01`<br>`target-01`<br>`calendar-03`<br>`repeat-one-01`<br>`task-01` | **Forecast tab uses `chart-evaluation` (matching the ToolRail)**; Hub uses directional orientation (`compass-01`). |
| **Investments** | `ChartIncreaseIcon` | `chart-increase` | • Portfolio<br>• Holdings<br>• Activity | `ChartLineData01Icon`<br>`Coins01Icon`<br>`Clock01Icon` | `chart-line-data-01`<br>`coins-01`<br>`clock-01` | Hub uses upward growth trajectory (`chart-increase`), separating it from the portfolio breakdown (`chart-line-data-01`). |
| **Reports** | `Analytics01Icon` | `analytics-01` | • Reports<br>• Invoices<br>• Challenges | `ChartColumnIcon`<br>`Invoice02Icon`<br>`Award01Icon` | `chart-column`<br>`invoice-02`<br>`award-01` | Hub uses aggregate analytics (`analytics-01`), while the periodic breakdown tab uses reporting bars (`chart-column`). |
| **Settings** | `Settings05Icon` | `settings-05` | • Profile<br>• Preferences<br>• Connections<br>• Categories<br>• Tags<br>• Data<br>• Help | `UserIcon`<br>`SlidersHorizontalIcon`<br>`BankIcon`<br>`Folder01Icon`<br>`Tag01Icon`<br>`Download04Icon`<br>`BookOpen01Icon` | `user`<br>`sliders-horizontal`<br>`bank`<br>`folder-01`<br>`tag-01`<br>`download-04`<br>`book-open-01` | **Settings Hub uses `settings-05` (matching the ToolRail)**, with zero overlap across its 7 configuration subpages. |

#### Wayfinding & Steppers
| Control | Hugeicons Component | Identifier | Usage |
| :--- | :--- | :--- | :--- |
| **Back / Forward** | `ArrowLeft02Icon` / `ArrowRight02Icon` | `arrow-left-02` / `arrow-right-02` | History traversal and modal flow navigation |
| **Paging Prev / Next** | `ArrowLeft01Icon` / `ArrowRight01Icon` | `arrow-left-01` / `arrow-right-01` | Date carousel and month step pagination |
| **Breadcrumb Step** | `ArrowRight01Icon` | `arrow-right-01` | Hierarchy divider |

---

### Class 2: Objects ("What type of object is this?")

#### Balance Sheet & Account Archetypes
| Entity Archetype | Hugeicons Component | Identifier | Representation |
| :--- | :--- | :--- | :--- |
| **Checking & Cash** | `Wallet02Icon` | `wallet-02` | Daily operating liquidity and cash accounts |
| **High-Yield Savings** | `PiggyBankIcon` | `piggy-bank` | Interest-bearing emergency funds and savings accounts |
| **Credit Card** | `CreditCardIcon` | `credit-card` | Revolving credit lines, cards, and card accounts |
| **Loan / Mortgage** | `Agreement01Icon` | `agreement-01` | Fixed-term debt, mortgages, and amortization schedules |
| **Real Estate & Property** | `Home01Icon` | `home-01` | Physical property assets and valuations |
| **Automotive & Vehicles** | `Car01Icon` | `car-01` | Vehicle assets, leases, and odometer logs |
| **Investments & Equity** | `ChartLineData01Icon` | `chart-line-data-01` | Public stocks, ETFs, warrants, and funds |
| **Pension Pot** | `SafeIcon` | `safe` | Long-term retirement accounts and locked pensions |
| **Spare Change Sweep** | `Coins01Icon` | `coins-01` | Micro-savings round-up accounts |
| **Balance Trajectory** | `BalanceScaleIcon` | `balance-scale` | Solvency comparison between assets and liabilities |

#### Financial Records & Currency Instruments
| Record / Instrument | Hugeicons Component | Identifier | Context |
| :--- | :--- | :--- | :--- |
| **Transfer Movement** | `ArrowDataTransferHorizontalIcon` | `arrow-data-transfer-horizontal` | **Strict Transfer Standard**: All inter-account movements, switches, and linked pairs |
| **Split Charge** | `SplitIcon` | `split` | Multi-category itemization envelope |
| **Receipt Document** | `ReceiptIcon` | `receipt` | Proof of purchase or paper receipt |
| **Invoice / Tax Bill** | `Invoice02Icon` | `invoice-02` | Formal billing document and tax statement |
| **Merchant / Store** | `Store01Icon` | `store-01` | Physical or digital commercial entity |
| **Branch Location** | `Location01Icon` | `location-01` | Point-of-sale geographic city or terminal |
| **Euro Currency** | `EuroIcon` | `euro` | EUR currency symbol |
| **Dollar Currency** | `Dollar01Icon` | `dollar-01` | USD currency symbol |
| **Pound Currency** | `PoundIcon` | `pound` | GBP currency symbol |
| **Bitcoin Asset** | `BitcoinIcon` | `bitcoin` | BTC crypto asset |
| **Ethereum Asset** | `EthereumIcon` | `ethereum` | ETH crypto asset |

---

### Class 3: Actions ("What can I do?")

#### Universal Verbs & Primary Controls
| Action | Hugeicons Component | Identifier | UX Role |
| :--- | :--- | :--- | :--- |
| **Create / Add** | `Add01Icon` | `add-01` | Primary entity creation (buttons, FABs, header triggers) |
| **Edit** | `PencilEdit02Icon` | `pencil-edit-02` | In-place entity editing and record modification |
| **Delete** | `Delete02Icon` | `delete-02` | Destructive removal or entity deletion |
| **Duplicate** | `Copy01Icon` | `copy-01` | Quick cloning of ledger entries, rules, or goals |
| **Filter / Reconcile** | `SlidersHorizontalIcon` | `sliders-horizontal` | Table column filtering and balance reconciliation |
| **Search** | `Search01Icon` | `search-01` | Global Omnibar (⌘K) and inline list filtering |
| **Confirm / Done** | `Tick02Icon` | `tick-02` | Positive submission, confirmation, or completion |
| **Cancel / Dismiss** | `Cancel01Icon` | `cancel-01` | Modal dismissal or sheet close |
| **Kebab Overflow** | `MoreHorizontalIcon` | `more-horizontal` | Row action overflow menu |

#### Refresh vs. Sync Distinction
> [!IMPORTANT]
> **Refresh** and **Sync** are distinct actions and must never share visual metaphors or identifiers:
> - **Refresh (`RefreshIcon` / `refresh`)**: Reloads current local data (re-queries a database view, recalculates forecast balances, or re-renders prices).
> - **Sync (`AiAutoRotateIcon` / `sync`)**: Connects to an external service to pull third-party data (Open Banking / PSD2 feeds, bank account synchronization).

| Action | Hugeicons Component | Identifier | Semantic Intent |
| :--- | :--- | :--- | :--- |
| **Refresh Local Data** | `RefreshIcon` | `refresh` | Reload current page or local dataset |
| **Sync External Feeds** | `AiAutoRotateIcon` | `sync` / `bank-sync` | Synchronize external bank feeds or third-party APIs |
| **Import File** | `Download04Icon` | `download-04` | Import CSV, QIF, or OFX financial files |
| **Export File** | `Upload04Icon` | `upload-04` | Export ledger, reports, or backup archives |

#### Drag Reorder vs. Move Up/Down
> [!IMPORTANT]
> **Drag Handles** and **Move Buttons** serve different interaction models:
> - **Drag Handle (`DragDropVerticalIcon` / `drag-handle` / `drag_indicator`)**: 6-dot grip handle indicating an element can be grabbed and dragged via pointer or touch.
> - **Move Up / Move Down (`ArrowUp02Icon` / `ArrowDown02Icon`)**: Discrete push buttons for keyboard and accessible menu-driven reordering.

| Interaction | Hugeicons Component | Identifier | Context |
| :--- | :--- | :--- | :--- |
| **Drag Reorder Handle** | `DragDropVerticalIcon` | `drag-handle` / `drag_indicator` | Cursor grab handle on table rows, rules, and category trees |
| **Move Up (Step)** | `ArrowUp02Icon` | `arrow-up-02` / `move-up` | Accessible discrete action to shift priority up |
| **Move Down (Step)** | `ArrowDown02Icon` | `arrow-down-02` / `move-down` | Accessible discrete action to shift priority down |

---

### Class 4: Status ("What state is this in?")

| Status State | Hugeicons Component | Identifier | Visual & Semantic Role |
| :--- | :--- | :--- | :--- |
| **Reconciled / Verified** | `CheckmarkCircle02Icon` | `checkmark-circle-02` | Confirmed transaction matching bank statement |
| **Success / Done** | `Tick02Icon` | `tick-02` | Goal reached, rule applied successfully |
| **Scheduled / Pending** | `Clock01Icon` | `clock-01` | Future-dated transaction or pending authorization |
| **In-Flight Timer** | `Timer01Icon` | `timer-01` | Countdown or active sync timer |
| **Review Needed / Attention**| `Alert02Icon` | `alert-02` | Suspicious transaction or unfiled merchant in review queue |
| **Warning Notice** | `AlertCircleIcon` | `alert-circle` | Budget limit approaching or low buffer warning |
| **Critical / Failed** | `CancelCircleIcon` | `cancel-circle` | Bank feed disconnection, overdue bill, failed import |
| **External Synced** | `CloudSavingDone01Icon` | `cloud-saving-done-01` | Successfully backed up or synced with cloud |
| **External Syncing** | `AiAutoRotateIcon` | `sync` | Active bank synchronization in progress |
| **Locked (Read-Only)** | `SquareLock02Icon` | `square-lock-02` | Seed-protected demo category or locked period |
| **Unlocked (Editable)** | `SquareUnlock02Icon` | `square-unlock-02` | Unlocked configuration envelope |
| **Privacy Masked** | `ViewOffIcon` | `view-off` | Sensitive account balances hidden |
| **Privacy Revealed** | `ViewIcon` | `view` | Account balances visible |

---

## 3. ToolRail & Global Controls

Floating dock toolbar at the bottom center of the application ([`components/ui/Shell.tsx`](file:///Users/samerberjawi/Documents/Crystal/components/ui/Shell.tsx)):

| Tool | Hugeicons Component | Identifier | Purpose |
| :--- | :--- | :--- | :--- |
| **Global Search** | `SearchingIcon` | `search-01` | Omnibar trigger (⌘K) |
| **Create Entry** | `AddInvoiceIcon` | `add-01` | Primary transaction modal trigger (N) |
| **Sync Banking** | `AiAutoRotateIcon` | `sync` | Open Banking / PSD2 balance sync |
| **Ledger Shortcut** | `LogsIcon` | `logs` | Quick navigation to Transactions Ledger |
| **Forecast Shortcut** | `ChartEvaluationIcon` | `chart-evaluation` | Quick navigation to Cash Flow Forecast |
| **Settings Shortcut** | `Settings05Icon` | `settings-05` | Quick navigation to Settings & Preferences |
| **Theme Toggle** | `Sun01Icon` / `Moon02Icon` | `sun-01` / `moon-02` | Light / Dark mode switcher |
| **Privacy Mode** | `ViewIcon` / `ViewOffIcon` | `view` / `view-off` | Sensitive balance masking toggle |

---

## 4. Category Taxonomy & Hierarchy Rules

### Category Philosophy & Inheritance Rules
1. **Parent-Child Sharing Principle**:
   - Parent categories **may intentionally share icons with one child** when they represent the same conceptual object.
     ```
     Housing (Parent)      ➔ Home (Home01Icon)
     └── Home & Garden     ➔ Home (Home01Icon)  [Valid: same conceptual core]
     ```
2. **Distinct Child Concept Principle**:
   - Distinct child concepts **must use dedicated metaphors**:
     ```
     Housing (Parent)      ➔ Home (Home01Icon)
     ├── Mortgage          ➔ Agreement (Agreement01Icon)
     ├── Rent              ➔ Building (Building03Icon)
     └── Home Maintenance  ➔ Wrench (Wrench01Icon)
     ```
3. **Travel vs. Flights Clarification**:
   - **General Travel (`exp-8`)**: Uses `Luggage01Icon` (`luggage-01`). Represents multi-modal travel, road trips, trains, and general transit.
   - **Flights (`exp-8a`)**: Uses `AirplaneTakeOff01Icon` (`airplane-take-off-01`). Specifically represents flight bookings and air travel.
   - **Accommodation (`exp-8b`)**: Uses `BedIcon` (`bed`). Specifically represents lodging, hotels, and rentals.

### Complete Category Catalog

| Category / Subcategory | Hugeicons Component | Identifier | Classification |
| :--- | :--- | :--- | :--- |
| **Fixed Salary** | `Briefcase01Icon` | `briefcase-01` | Income |
| **Bonus Salary** | `Coins01Icon` | `coins-01` | Income |
| **Freelance / Side Hustle** | `LaptopIcon` | `laptop` | Income |
| **Rental Income** | `Building03Icon` | `building-03` | Income |
| **Investments & Dividends** | `ChartIncreaseIcon` | `chart-increase` | Income |
| **Government & Benefits** | `Agreement01Icon` | `agreement-01` | Income |
| **Refunds & Paybacks** | `ArrowTurnBackwardIcon` | `arrow-turn-backward` | Income |
| **Gifts Received** | `GiftIcon` | `gift` | Income |
| **Housing (Parent)** | `Home01Icon` | `home-01` | Expense |
| **Mortgage** | `Agreement01Icon` | `agreement-01` | Expense |
| **Rent** | `Building03Icon` | `building-03` | Expense |
| **Home Maintenance** | `Wrench01Icon` | `wrench-01` | Expense |
| **Home Insurance** | `Shield01Icon` | `shield-01` | Expense |
| **HOA / Body Corporate** | `Key01Icon` | `key-01` | Expense |
| **Food & Groceries (Parent)** | `ShoppingCart01Icon` | `shopping-cart-01` | Expense |
| **Supermarket** | `ShoppingCart01Icon` | `shopping-cart-01` | Expense |
| **Dining Out** | `Restaurant01Icon` | `restaurant-01` | Expense |
| **Cafes & Coffee** | `Coffee01Icon` | `coffee-01` | Expense |
| **Delivery & Takeaway** | `PackageIcon` | `package` | Expense |
| **Transportation (Parent)** | `Car01Icon` | `car-01` | Expense |
| **Public Transit** | `Bus01Icon` | `bus-01` | Expense |
| **Fuel / Charging** | `FuelStationIcon` | `fuel-station` | Expense |
| **Vehicle Insurance** | `Shield01Icon` | `shield-01` | Expense |
| **Ride-Hailing** | `Car01Icon` | `car-01` | Expense |
| **Parking & Tolls** | `Ticket01Icon` | `ticket-01` | Expense |
| **Traffic / Parking Fines** | `BalanceScaleIcon` | `balance-scale` | Expense |
| **Clothing & Apparel** | `ShoppingBag01Icon` | `shopping-bag-01` | Expense |
| **Electronics & Gadgets** | `CpuIcon` | `cpu` | Expense |
| **Home & Garden** | `Home01Icon` | `home-01` | Expense |
| **Personal Care & Grooming** | `SparklesIcon` | `sparkles` | Expense |
| **Bills & Utilities (Parent)** | `Invoice02Icon` | `invoice-02` | Expense |
| **Electricity, Gas & Water** | `WaterEnergyIcon` | `water-energy` | Expense |
| **Internet & TV** | `Wifi01Icon` | `wifi-01` | Expense |
| **Mobile Telecom** | `SmartPhone01Icon` | `smart-phone-01` | Expense |
| **Subscriptions (Parent)** | `RepeatOne01Icon` | `repeat-one-01` | Expense |
| **Streaming Services** | `Video01Icon` | `video-01` | Expense |
| **Apps & Software** | `LaptopIcon` | `laptop` | Expense |
| **Cloud Storage** | `CloudIcon` | `cloud` | Expense |
| **Entertainment & Cinema** | `Video01Icon` | `video-01` | Expense |
| **Concerts & Events** | `Ticket01Icon` | `ticket-01` | Expense |
| **Sports & Recreation** | `Basketball01Icon` | `basketball-01` | Expense |
| **Family & Childcare** | `UserGroupIcon` | `user-group` | Expense |
| **School Fees & Supplies** | `Mortarboard01Icon` | `mortarboard-01` | Expense |
| **Toys & Games** | `GameController01Icon` | `game-controller-01` | Expense |
| **Tuition & Higher Education** | `GraduationCapIcon` | `graduation-cap` | Expense |
| **Books & Materials** | `BookOpen01Icon` | `book-open-01` | Expense |
| **Health & Wellness** | `Pulse01Icon` | `pulse-01` | Expense |
| **Fitness / Gym** | `Dumbbell01Icon` | `dumbbell-01` | Expense |
| **Medical & Dental** | `Hospital01Icon` | `hospital-01` | Expense |
| **Pharmacy & Medicine** | `Medicine01Icon` | `medicine-01` | Expense |
| **Travel (General)** | `Luggage01Icon` | `luggage-01` | Expense |
| **Flights** | `AirplaneTakeOff01Icon` | `airplane-take-off-01` | Expense |
| **Accommodation** | `BedIcon` | `bed` | Expense |
| **Activities & Tours** | `Ticket01Icon` | `ticket-01` | Expense |
| **Visa & Passport** | `Doc01Icon` | `doc-01` | Expense |
| **Bank Fees & Charges** | `ReceiptIcon` | `receipt` | Expense |
| **Taxes & Filings** | `Invoice02Icon` | `invoice-02` | Expense |
| **Cash Withdrawals & ATM** | `Coins01Icon` | `coins-01` | Expense |
| **FX & Currency Conversion** | `Exchange01Icon` | `exchange-01` | Expense |

---

## 5. How to Add a New Icon

1. **Verify Availability in Free Core Icons**:
   Check that the icon exists in `@hugeicons/core-free-icons`:
   ```bash
   node -e 'console.log(require("@hugeicons/core-free-icons").YourIconNameIcon);'
   ```
2. **Import in `components/ui/Icon.tsx`**:
   Add the named import to the top `@hugeicons/core-free-icons` block:
   ```ts
   import {
     // ...
     YourIconNameIcon,
   } from '@hugeicons/core-free-icons';
   ```
3. **Register in `ICONS`**:
   ```ts
   const ICONS: Record<string, IconSvgElement> = {
     // ...
     YourIconName: YourIconNameIcon,
   };
   ```
4. **Add Aliases in `ICON_NAME_MAP` (Optional)**:
   ```ts
   export const ICON_NAME_MAP: Record<string, string> = {
     // ...
     'your-icon-name': 'YourIconName',
   };
   ```
5. **Verify Design System & Semantic Class**:
   - Ensure the new icon belongs to one of the 4 global semantic classes (Navigation, Objects, Actions, Status).
   - If for navigation, ensure it does not create a collision between a hub and its subpages.
   - Run typecheck and tests:
   ```bash
   npm run lint && npm test
   ```
