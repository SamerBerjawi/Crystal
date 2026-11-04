# Crystal Icon System & UI Registry

> **Standard**: Exclusively `@hugeicons/core-free-icons` (`^4.3.5`) in the **Stroke Rounded** style (1.5px stroke width, 24px default).  
> **Rule**: Free stroke rounded icons only — never import or render Pro icon variants (`solid`, `twotone`, `bulk`, `sharp`).

---

## 1. Architectural Guidelines & Icon Wrapping

Every icon in Crystal is rendered via the unified icon wrapper [`components/ui/Icon.tsx`](file:///Users/samerberjawi/Documents/Crystal/components/ui/Icon.tsx).

```tsx
import Icon from '@/components/ui/Icon';

// Renders using normalized kebab-case, PascalCase, or aliased name
<Icon name="arrow-data-transfer-horizontal" size={16} />
<Icon name="wallet-02" size={20} className="text-emerald-500" />
```

### Normalization Pipeline
1. **Identifier Cleanup**: Replaces spaces, slashes, and dashes into kebab-case.
2. **Alias Resolution**: Queries `ICON_NAME_MAP` for backwards compatibility with legacy database tags and Material Symbol aliases (e.g. `swap_horiz` ➔ `ArrowDataTransferHorizontal`, `card` ➔ `CreditCard`).
3. **PascalCase Resolution**: Converts kebab-case to PascalCase and checks `ICONS` in `Icon.tsx`.
4. **Fallback Safety**: Any unrecognized identifier gracefully falls back to `ICONS.SquaresFour` (`dashboard-square-01`), preventing blank rendering or React runtime errors.

---

## 2. Hubs vs. Subpages (Tabs) Rule

> **Core Principle**: A parent navigation hub **must never share the same icon as any of its child subpages (tabs)**.
> **ToolRail Alignment**: Icons defined in the floating bottom `ToolRail` serve as the default visual anchors for their respective pages/tabs.

### Hub vs. Tab Matrix

| Hub (Page Level) | Hub Hugeicon | Hub String | Subpages (Top Pills / Tabs) | Subpage Hugeicon | Tab String | Financial UX Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Overview** | `DashboardSquare01Icon` | `dashboard-square-01` | *(Cockpit View)* | — | — | Universal high-level cockpit dashboard. |
| **Accounts** | `Layers01Icon` | `layers-01` | • Cards<br>• Accounts<br>• Loans<br>• Assets | `CreditCardIcon`<br>`Wallet02Icon`<br>`Agreement01Icon`<br>`Home01Icon` | `credit-card`<br>`wallet-02`<br>`agreement-01`<br>`home-01` | Hub uses stacked balance-sheet layers (`layers-01`), separating it from cash operating accounts (`wallet-02`) and property (`home-01`). |
| **Transactions** | `ArrowDataTransferHorizontalIcon` | `arrow-data-transfer-horizontal` | • **Ledger**<br>• Review queue<br>• Rules<br>• Merchants | `LogsIcon`<br>`Tick02Icon`<br>`FlashIcon`<br>`Store01Icon` | `logs`<br>`tick-02`<br>`flash`<br>`store-01` | **Ledger tab uses `logs` (matching the ToolRail)**; Hub uses horizontal data flow (`arrow-data-transfer-horizontal`). |
| **Planning** | `Compass01Icon` | `compass-01` | • **Forecast**<br>• Budget<br>• Goals<br>• Calendar<br>• Subscriptions<br>• Tasks | `ChartEvaluationIcon`<br>`PieChart01Icon`<br>`Target01Icon`<br>`Calendar03Icon`<br>`RepeatOne01Icon`<br>`Task01Icon` | `chart-evaluation`<br>`pie-chart-01`<br>`target-01`<br>`calendar-03`<br>`repeat-one-01`<br>`task-01` | **Forecast tab uses `chart-evaluation` (matching the ToolRail)**; Hub uses directional orientation (`compass-01`). |
| **Investments** | `ChartIncreaseIcon` | `chart-increase` | • Portfolio<br>• Holdings<br>• Activity | `ChartLineData01Icon`<br>`Coins01Icon`<br>`Clock01Icon` | `chart-line-data-01`<br>`coins-01`<br>`clock-01` | Hub uses upward growth trajectory (`chart-increase`), separating it from the portfolio breakdown (`chart-line-data-01`). |
| **Reports** | `Analytics01Icon` | `analytics-01` | • Reports<br>• Invoices<br>• Challenges | `ChartColumnIcon`<br>`Invoice02Icon`<br>`Award01Icon` | `chart-column`<br>`invoice-02`<br>`award-01` | Hub uses aggregate analytics (`analytics-01`), while the periodic breakdown tab uses reporting bars (`chart-column`). |
| **Settings** | `Settings05Icon` | `settings-05` | • Profile<br>• Preferences<br>• Connections<br>• Categories<br>• Tags<br>• Data<br>• Help | `UserIcon`<br>`SlidersHorizontalIcon`<br>`BankIcon`<br>`Folder01Icon`<br>`Tag01Icon`<br>`Download04Icon`<br>`BookOpen01Icon` | `user`<br>`sliders-horizontal`<br>`bank`<br>`folder-01`<br>`tag-01`<br>`download-04`<br>`book-open-01` | **Settings Hub uses `settings-05` (matching the ToolRail)**, with zero overlap across its 7 configuration subpages. |

---

## 3. ToolRail & Global Controls

Floating toolbar at the bottom center of the application ([`components/ui/Shell.tsx`](file:///Users/samerberjawi/Documents/Crystal/components/ui/Shell.tsx)):

| Tool | Hugeicons Component | Identifier | Purpose |
| :--- | :--- | :--- | :--- |
| **Global Search** | `SearchingIcon` | `search-01` | Omnibar trigger (⌘K) |
| **Create Entry** | `AddInvoiceIcon` | `add-01` | Primary transaction modal trigger (N) |
| **Sync Banking** | `AiAutoRotateIcon` | `refresh` | Open Banking / PSD2 balance sync |
| **Ledger Shortcut** | `LogsIcon` | `logs` | Quick navigation to Transactions Ledger |
| **Forecast Shortcut** | `ChartEvaluationIcon` | `chart-evaluation` | Quick navigation to Cash Flow Forecast |
| **Settings Shortcut** | `Settings05Icon` | `settings-05` | Quick navigation to Settings & Preferences |
| **Theme Toggle** | `Sun01Icon` / `Moon02Icon` | `sun-01` / `moon-02` | Light / Dark mode switcher |
| **Privacy Mode** | `EyeIcon` / `EyeClosedIcon` | `view` / `view-off` | Sensitive balance masking toggle |

---

## 4. Transaction Flow & Cash Movement

Standard visual language for money movement across modals, drawers, and ledger rows:

| Concept / Flow | Hugeicons Component | Identifier | Financial UX Context |
| :--- | :--- | :--- | :--- |
| **Inter-Account Transfers** | `ArrowDataTransferHorizontalIcon` | `arrow-data-transfer-horizontal` | **Strict Transfer Standard**: Used for transaction type switcher, currency conversion, account swaps, and ledger transfer indicators. |
| **Income (Money In)** | `ArrowDownLeft01Icon` | `arrow-down-left-01` | Inward diagonal vector indicating cash inflows and salary deposits. |
| **Expense (Money Out)** | `ArrowUpRight01Icon` | `arrow-up-right-01` | Outward diagonal vector indicating expenditure and debits. |
| **Loan Principal Portion** | `BankIcon` | `bank` | Split transaction breakdown pill for loan principal repayment. |
| **Loan Interest / Fee** | `Coins01Icon` | `coins-01` | Split transaction breakdown pill for loan financing charges and interest. |
| **Uncategorized Item** | `ReceiptIcon` | `receipt` | Notice pill prompting category assignment. |
| **Split Charge** | `SplitIcon` | `split` | Transaction splitting across multiple spending envelopes. |
| **Merge Duplicates** | `GitMergeIcon` | `git-merge` | Duplicate transaction reconciliation. |
| **Point of Sale City** | `Location01Icon` | `location-01` | Store branch location pill. |

---

## 5. Account Archetypes & Balance Sheet

Standard visual anchors representing account types and balance-sheet items:

| Archetype | Hugeicons Component | Identifier | Representation |
| :--- | :--- | :--- | :--- |
| **Checking & Cash** | `Wallet02Icon` | `wallet-02` | Daily operating liquidity and cash accounts |
| **High-Yield Savings** | `PiggyBankIcon` | `piggy-bank` | Interest-bearing emergency funds and savings accounts |
| **Credit Card** | `CreditCardIcon` | `credit-card` | Revolving credit lines, cards, and utilization |
| **Loan / Mortgage** | `Agreement01Icon` | `agreement-01` | Fixed-term debt, mortgages, and amortization |
| **Investments & Equity** | `ChartLineData01Icon` | `chart-line-data-01` | Public stocks, ETFs, crypto, and warrants |
| **Real Estate & Property** | `Home01Icon` | `home-01` | Fixed property assets and home valuations |
| **Automotive & Vehicles** | `Car01Icon` | `car-01` | Vehicle assets, leases, and mileage logs |
| **Pension Fund** | `SafeIcon` | `safe` | Long-term retirement accounts and pension pots |
| **Spare Change Sweep** | `Coins01Icon` | `coins-01` | Round-up spare change accounts |
| **Balance Trajectory** | `BalanceScaleIcon` | `balance-scale` | Assets vs liabilities solvency scale |

---

## 6. Category Taxonomy Catalog

Default category anchors configured in [`constants.tsx`](file:///Users/samerberjawi/Documents/Crystal/constants.tsx) (de-duplicated so categories have distinct visual anchors):

| Category / Subcategory | Hugeicons Component | Identifier | Category Classification |
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
| **Electricity, Gas & Water** | `FlashIcon` | `flash` | Expense |
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
| **Fitness / Gym** | `Pulse01Icon` | `pulse-01` | Expense |
| **Medical & Dental** | `Hospital01Icon` | `hospital-01` | Expense |
| **Pharmacy & Medicine** | `Medicine01Icon` | `medicine-01` | Expense |
| **Travel & Flights** | `Airplane01Icon` / `AirplaneTakeOff01Icon` | `airplane-01` | Expense |
| **Accommodation & Hotels** | `BedIcon` | `bed` | Expense |
| **Bank Fees & Charges** | `ReceiptIcon` | `receipt` | Expense |
| **Taxes & Filings** | `Invoice02Icon` | `invoice-02` | Expense |
| **Cash Withdrawals & ATM** | `Coins01Icon` | `coins-01` | Expense |
| **FX & Currency Conversion** | `CoinsSwapIcon` | `exchange-01` | Expense |

---

## 7. Universal Action Controls

Standardized interaction affordances across the entire application:

| Action | Hugeicons Component | Identifier | UX Role |
| :--- | :--- | :--- | :--- |
| **Add / Create** | `Add01Icon` | `add-01` | Primary entity creation (buttons, FABs, header actions) |
| **Edit** | `PencilEdit02Icon` | `pencil-edit-02` | In-place entity editing and modification |
| **Delete** | `Delete02Icon` | `delete-02` | Destructive archival or entity deletion |
| **Duplicate** | `Copy01Icon` | `copy-01` | Quick cloning of ledger entries or goals |
| **Confirm / Done** | `Tick02Icon` / `CheckmarkCircle02Icon` | `tick-02` / `checkmark-circle-02` | Positive confirmation, reconciled state, completed goal |
| **Cancel / Dismiss** | `Cancel01Icon` / `CancelCircleIcon` | `cancel-01` / `cancel-circle` | Modal dismissal, close drawer, cancel subscription |
| **Filter / Reconcile** | `SlidersHorizontalIcon` | `sliders-horizontal` | Table column filtering and balance reconciliation |
| **Refresh / Sync** | `RefreshIcon` | `refresh` | Re-fetching bank feeds or market quotes |
| **Paging Prev / Next** | `ArrowLeft01Icon` / `ArrowRight01Icon` | `arrow-left-01` / `arrow-right-01` | Stepper cycle and monthly date navigation |
| **Drag Reorder** | `ArrowUp02Icon` / `ArrowDown02Icon` | `arrow-up-02` / `arrow-down-02` | Priority reordering for goals and rules |
| **Kebab Overflow** | `MoreHorizontalIcon` | `more-horizontal` | Row action overflow menu |

---

## 8. How to Add a New Icon

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
5. **Verify Types**:
   ```bash
   npm run lint
   ```
