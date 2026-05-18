# Crystal 🔮

**Crystal** is the ultimate personal finance operating system. It moves beyond simple expense tracking to provide a professional-grade financial simulation engine wrapped in a beautiful, **privacy-first, self-hosted** application.

Designed for data sovereignty, Crystal ensures your financial data remains yours while offering features typically found only in enterprise wealth management software.

<img width="3565" height="1879" alt="Crystal Dashboard" src="https://github.com/user-attachments/assets/fdcd513b-f0c2-492c-9124-b34453fbf196" />

## 🌟 Key Features

### 🏦 Open Banking & Integrations
* **Real Bank Sync:** Connect to 2,500+ European banks via **Enable Banking** (beta feature) to automatically import transactions and balances.
* **Live Market Data:** Real-time stock, ETF, and crypto pricing via **Twelve Data**.
* **Merchant Intelligence:** Automatically profile entities and fetch branding via **Brandfetch**.

### 🧠 Financial Intelligence
* **Taxonomy Blueprint:** Define complex hierarchical categories for rigid data structure.
* **Semantic Overlays:** Layer flat tags (#trip, #project) to cluster data across categories without breaking your taxonomy.
* **Auto-Categorization:** Intelligent suggestions based on merchant profile and temporal patterns.
* **Smart Forecast:** 2-Year daily balance projections based on recurring income, bills, and goals.

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

### 📈 Investments - Portfolio Lab
* Performance, risk, and allocation snapshots with drill-downs into individual holdings and transactions.
* **Warrants & Grants:** Specialized tracking for employee equity, including strike prices and vesting.

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

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/crystal.git
    cd crystal
    ```

2.  **Initialize Node:**
    ```bash
    npm install
    npm run dev
    ```

3.  **Access the App:**
    Open `http://localhost:3000` in your browser.

## License
MIT