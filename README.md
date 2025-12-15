# Crystal 🔮

**Crystal** is the ultimate personal finance operating system. It moves beyond simple expense tracking to provide a professional-grade financial simulation engine wrapped in a beautiful, **privacy-first, self-hosted** application.

Designed for data sovereignty, Crystal ensures your financial data remains yours while offering features typically found only in enterprise wealth management software.

## 🌟 Key Features

### 🏦 Open Banking & Integrations
* **Real Bank Sync:** Connect to 2,500+ European banks via **Enable Banking** (beta feature) to automatically import transactions and balances.
* **Live Market Data:** Real-time stock, ETF, and crypto pricing via **Twelve Data**.
* **Merchant Enrichment:** Automatically fetch merchant logos and branding via **Brandfetch**.

### 🤖 AI Copilot (Gemini)
* **Conversational Insights:** Chat naturally with your data (e.g., "How much did I spend on Uber last year vs this year?").
* **Smart Planner:** Generates step-by-step contribution plans to fund your goals based on your projected free cash flow.
* **Auto-Categorization:** Intelligent suggestions for transaction categories.

### 📅 Forecasting & Time Travel
* **2-Year Horizon:** Daily balance projections based on recurring income, bills, and goals.
* **Synthetic Events:** The engine automatically generates future transactions for loans, credit card payments, and annual property taxes to give a realistic "Safe-to-Spend" number.
* **Scenario Modeling:** Toggle goals and large expenses to simulate their impact on your runway.

---

## 🧭 Core Application Views (The Financial Operating System)

Crystal is organized around powerful views that provide both a high-level pulse and granular control over your finances.

### 📊 Dashboard - Command Center
* A pulse view of your cash, investments, and commitments with quick jumps to what matters today.
* **Modular Widgets:** Fully customizable grid (Drag & Drop) including Net Worth, Cash Flow, and Recent Activity.
* **Privacy Mode:** One-click blur for sensitive numbers when viewing in public spaces.
* **Geospatial Analysis:** Visualize spending hotspots on an interactive map.
* **Cash Flow Sankey:** Trace every euro from income sources to expenses and savings buckets.

### 💰 Accounts - Money Map
* Bank, card, and lending balances with tools to rebalance, reorder, and reconcile on the fly.

### 📝 Transactions - Activity Feed
* Every inflow and outflow with powerful filters, transaction splitting, and custom tagging to keep your history audit-ready.

### 💵 Budgeting - Spending Plan
* Set envelopes, guardrails, and spending alerts that adapt intelligently as your cash flow evolves.

### 📈 Investments - Portfolio Lab
* Performance, risk, and allocation snapshots with drill-downs into individual holdings and transactions.
* **Warrants & Grants:** Specialized tracking for employee equity, including strike prices and vesting.

### 📅 Schedule & Bills - Cash Calendar
* Upcoming payments, autopay windows, and reminders to keep your runway safe and manage your liquidity.

### 🔁 Subscriptions & Memberships - Recurring Center
* A dedicated dashboard to monitor renewals, renegotiate dates, and spot overlapping services to prevent wasteful spending.

### 🧾 Quotes & Invoices - Billing Desk
* Draft, send, and track receivables with status, due dates, and follow-up nudges for small business or freelance tracking.

### 🎯 Tasks - Action Board
* Track follow-ups, approvals, and chores directly tied to accounts, invoices, or financial goals.

---

## 💼 Wealth & Asset Management

Crystal handles complex portfolios beyond simple bank accounts.

* **Property & Real Estate:**
    * **Amortization Engine:** Automatic calculation of principal vs. interest splits for mortgages.
    * **Equity Tracking:** Visualize Market Equity vs. Invested Capital.
* **Vehicles:**
    * **Lease Management:** Track mileage limits, lease expiry, and projected overage costs.
    * **Depreciation:** Monitor current value against purchase price.
* **Spare Change:** Virtual "Round-up" accounts that simulate micro-investing from your daily transactions.
* **Pension Funds:** Retirement tracking with target year projections.

## 🎮 Gamification & Behavioral Finance

Turn financial discipline into a game:

* **Financial Health Score:** A dynamic 0-100 score calculated from your Savings Rate, Liquidity Ratio, Debt Management, and Asset Diversity.
* **Boss Battles:** Visual RPG-style battles against your largest debts (The Nemesis) or for your savings goals (The Guardian). Payments deal "damage" to the boss.
* **Savings Sprints:** Short-term challenges (e.g., "The Zero Day", "Coffee Break", "Grocery Gauntlet") to curb impulse spending.
* **Prediction Markets:** "Bet" on your future net worth or spending caps to track your discipline against your own expectations.
* **Badges & Mastery:** Earn achievements for streaks, debt reduction, and budget adherence.

## 🛠️ Data Sovereignty & Settings

### Data Management
* **Import Wizard:** A powerful CSV importer with fuzzy column mapping and duplicate detection.
* **Granular Backup & Restore:** Export specific slices of data (e.g., just "Settings" or "Transactions") and merge them back in without overwriting your whole database.
* **Local-First:** Data is stored in your local PostgreSQL database. **No third-party servers mining your data.**

### Settings Management
* **Preferences:** Theme, currency, language, and regional formats.
* **Integrations:** Manage API keys and external service connections.
* **Merchant Logos:** Review detected merchants and customize their logos.
* **AI Assistant:** Configure API keys and AI behaviors.
* **Categories & Tags:** Manage income/expense categories and custom tags for filtering.
* **Documentation:** Learn about features and usage.

---

## Tech Stack
* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS.
* **Visualization:** Recharts, Leaflet (Maps).
* **State Management:** Context API + React Query.
* **AI:** Google Gemini API (`@google/genai`).
* **Backend:** Node.js/Express + PostgreSQL.
* **Infrastructure:** Docker & Docker Compose.

## Getting Started

### Prerequisites
* Docker & Docker Compose
* (Optional) Google Gemini API Key
* (Optional) Twelve Data API Key (for live stock prices)
* (Optional) **Brandfetch API Key (for merchant logos)**
* (Optional) Enable Banking Credentials (for bank sync)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/yourusername/crystal.git](https://github.com/yourusername/crystal.git)
    cd crystal
    ```

2.  **Configure Environment:**
    Create a `.env` file in the root directory (or update `docker-compose.yml` environment variables):
    ```env
    # Database
    POSTGRES_USER=crystal_user
    POSTGRES_PASSWORD=strong_password
    POSTGRES_DB=crystal

    # Security
    JWT_SECRET=your_jwt_secret_key

    # Integrations
    # Brandfetch key for merchant logo fetching (Backend use)
    BRANDFETCH_API_KEY=your_brandfetch_server_key

    # Optional Integrations (Client-side)
    # These can also be set in the UI under Settings > Integrations
    VITE_GEMINI_API_KEY=your_gemini_client_key
    VITE_BRANDFETCH_CLIENT_ID=your_brandfetch_client_id
    ```

3.  **Run with Docker:**
    ```bash
    docker compose up --build
    ```

4.  **Access the App:**
    Open `http://localhost:7157` in your browser.

## Configuration Guide

### AI Assistant
To enable the Chatbot and Smart Planner, go to **Settings > AI Assistant** and follow the link to get a free Google Gemini API key. Add it to your configuration.

### Enable Banking Integration (Beta)
To sync real bank accounts:
1.  Go to **Settings > Integrations**.
2.  Enter your Enable Banking Application ID and Private Key (PEM format).
3.  Click "Load Banks" to select your institution and authorize access.

### Market Data
To get live price updates for your stocks and crypto:
1.  Go to **Settings > Integrations**.
2.  Enter your Twelve Data API Key.
3.  Prices will update automatically when viewing the Investments page.

## License
MIT
