# Crystal 🔮

**Crystal** is the ultimate personal finance operating system. It moves beyond simple retrospective expense tracking to provide a professional-grade predictive wealth forecasting and financial simulation engine wrapped in a beautiful, **privacy-first, self-hosted** application.

Designed for data sovereignty, Crystal ensures your financial data remains yours while offering predictive capabilities typically found only in enterprise wealth management software. Crystal analyzes your historical financial velocity and merges it with expected future transactions to project your true liquidity, net worth, and cashflow trajectory up to 2 years ahead.

<img width="3565" height="1879" alt="Crystal Dashboard" src="https://github.com/user-attachments/assets/fdcd513b-f0c2-492c-9124-b34453fbf196" />

## 🌟 Key Features

### 🏦 Open Banking & Integrations
* **Real Bank Sync:** Connect to 2,500+ European banks via **Enable Banking** (beta feature) to automatically import transactions and balances.
* **Live Market Data:** Real-time stock, ETF, and crypto pricing via **Twelve Data**.
* **Merchant Intelligence:** Automatically profile entities and fetch branding via **Brandfetch**.

### 🔮 Predictive Wealth & Cashflow Forecasting
* **Deterministic Cashflow Simulation:** Daily balance and net worth projections up to 2 years into the future.
* **Historic & Forward Synthesis:** Merges historical cash velocity with upcoming expected transactions (salaries, recurring subscriptions, credit card statement cycles, and loan amortizations).
* **Liquidity Horizon Warnings:** Pinpoints future lowest-balance dates to avert cash crunches before they happen.
* **Dynamic Goal Projections:** Realistic goal completion timelines calculated from forward cashflow models rather than static averages.

### 🧠 Financial Intelligence
* **Taxonomy Blueprint:** Define complex hierarchical categories for rigid data structure.
* **Semantic Overlays:** Layer flat tags (#trip, #project) to cluster data across categories without breaking your taxonomy.
* **Auto-Categorization:** Intelligent suggestions based on merchant profile and temporal patterns.

---

## 🧭 Core Application Views (The Financial Operating System)

Crystal is organized around powerful views that provide both a high-level pulse and granular control over your finances.

### 📊 Dashboard - Command Center
* **Modular Widgets:** Fully customizable grid (Drag & Drop) including Net Worth, Cash Flow, and Recent Activity.
* **Interface Modification Mode:** Reorganize, resize, and prioritize data widgets on the fly.
* **Privacy Mode:** One-click blur for sensitive numbers when viewing in public spaces.
* **Geospatial Analysis:** Visualize spending hotspots on an interactive map.

### 💰 Accounts - Money Map
* Bank, card, and lending balances with tools to rebalance, reorder, and reconcile on the fly.

### 📝 Transactions - Activity Feed
* Every inflow and outflow with powerful filters, transaction splitting, and custom tagging to keep your history audit-ready.

### ✅ Action Board - Operational Tasks
* A telemetric Kanban board for tracking follow-ups, recursive obligations, and semantic chores.
* **Temporal Density Map:** Heatmap visualization of task distribution.
* **Manual Sequencing:** Precise drag-and-drop prioritization for operational execution.

### 📈 Investments - Portfolio Lab
* Performance, risk, and allocation snapshots with drill-downs into individual holdings and transactions.
* **Warrants & Grants:** Specialized tracking for employee equity, including strike prices and vesting.

### 🔮 Forecasting - Predictive Wealth & Cashflow Lab
* **Deterministic Cashflow Simulation:** Daily account balance and wealth projection bridging historical spending behavior with scheduled future inflows and outflows.
* **Liquidity Horizon & Dip Detection:** Identifies future lowest-balance thresholds and pinpoint dates to prevent overdrafts and liquidity crunches months in advance.
* **Goal Trajectory Projections:** Projects exact completion dates for financial goals based on real expected forward cash accumulation rather than static linear models.
* **Synthetic Obligation Modeling:** Automatically incorporates loan amortization schedules, credit card payment cycles, and recurring obligations into future balances.
* **Scenario Playground:** Stress-test decisions (e.g. major expenditures, income disruptions, payment deferrals) against your future trajectory.

---

## 💼 Wealth & Asset Management

Crystal handles complex portfolios beyond simple bank accounts.

* **Property & Real Estate:** Mortgages, equity tracking, and market valuation.
* **Vehicles:** Lease management, mileage limits, and depreciation tracking.
* **Spare Change:** Virtual "Round-up" simulations for micro-investing.
* **Pension Funds:** Retirement tracking with target year projections.

## 🕹️ Gamification & Behavioral Finance

* **Financial Health Score:** A dynamic 0-100 score calculated from your Savings Rate, Liquidity, and Debt.
* **Boss Battles:** RPG-style battles against debt (The Nemesis) or for savings (The Guardian).
* **Savings Sprints:** Short-term challenges to curb impulse spending.

## 🛠️ Data Sovereignty & Settings

### Advanced Data Management
* **Granular Export:** Extract specific nodes (Accounts, Transactions, Taxonomy) in JSON or CSV.
* **Merge Restorations:** Import backup nodes without overwriting current data, resolving conflicts via ID matching.
* **Privacy-First:** All data persists in your local browser sandbox or personal self-hosted node.

### System Configuration
* **Operational Control:** Refine themes, regional standards, and integration keys.
* **Taxonomy Blueprinting:** Manage the logical tree of your income and expenses.
* **Merchant Intelligence Registry:** Manually override or refine detected merchant profiles.

---

## Tech Stack
* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS.
* **Visualization:** Recharts, Leaflet (Maps).
* **State Management:** Context API + React Query.

## Installation

### Self-hosted (recommended)

Crystal is meant to run with its PostgreSQL backend via Docker:

```bash
export DATA_ROOT=./data JWT_SECRET="$(openssl rand -hex 32)" POSTGRES_PASSWORD="$(openssl rand -hex 16)"
docker compose up -d
```

Then open `http://localhost:7157`. `JWT_SECRET` (a long random value; it signs session tokens) and `POSTGRES_PASSWORD` are required — the stack and the production server refuse to start without them.

### Local development

```bash
npm install
npm run dev
```

`npm run dev` serves the app on `http://localhost:3000` (loopback only; set `HOST` to change it).
It needs an API backend:

- **Real backend:** run `server/` (see `server/package.json`) and set `VITE_BACKEND_URL=http://localhost:3001`.
- **In-memory mock (UI work only):** `CRYSTAL_MOCK_API=1 npm run dev`. Data is lost on restart, the sample user
  is `demo@crystal.app` / `password`, and it must never be exposed to a network.

### Tests

```bash
npm test               # unit tests
tests/run-all.sh       # unit tests + Playwright e2e against a throwaway Postgres
```

## License
MIT