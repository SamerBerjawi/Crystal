# Crystal

**Your comprehensive financial command center.**

Crystal is designed to give you clarity on your past, control over your present, and foresight into your future. Built on a **local-first** philosophy, it prioritizes data sovereignty and privacy while leveraging modern AI to provide actionable insights.

## Core Features

### 📊 Dashboard
A modular, customizable view of your financial health.
- **Net Worth:** Real-time aggregation of assets vs. liabilities.
- **Cash Flow:** Income vs. Expense trends with sparklines.
- **Transaction Map:** Geospatial heatmap of your spending activity.
- **Sankey Diagram:** Visual flow of money from income sources to expense categories.

### 🏦 Advanced Accounts
Track every aspect of your portfolio with specialized logic for different asset types.
- **Loans:** Built-in amortization schedules that automatically split principal vs. interest.
- **Properties:** Track equity, appreciation, and link directly to mortgages for real-time LTV ratios.
- **Vehicles:** Log mileage, track depreciation, and manage lease agreements (mileage allowances, penalties).
- **Credit Cards:** Statement cycle tracking, utilization alerts, and payment due dates.

### 💳 Transactions
The ledger for all your financial activity.
- **Transfer Matching:** Automatically detects transfers between accounts to prevent double-counting.
- **Bulk Actions:** Select multiple transactions to categorize, tag, or delete in batches.
- **Location Tagging:** Add city/country data to transactions to populate the Map Widget.

### 💎 Subscriptions & Loyalty
Manage your recurring life and rewards.
- **Recurring Payments:** Automatically detects subscriptions based on patterns to forecast future spend.
- **Loyalty Wallet:** A digital wallet for rewards programs. Track membership IDs, point balances, and tier status (Silver, Gold) alongside your finances.

### 🔮 Forecasting
The "Crystal Ball" engine projects your daily balance up to 2 years into the future.
- Combines **Recurring Transactions**, **Scheduled Bills**, and **Financial Goals**.
- Answers questions like *"Will I go into overdraft in November if I buy this car today?"*

### 📈 Investments & Warrants
- **Standard Assets:** Stocks, ETFs, and Crypto tracking.
- **Employee Warrants:** Specialized tracking for unvested/vested equity grants. Track grant price vs. current price to see "in-the-money" value.
- **Price Scrapers:** Configure visual DOM scrapers to fetch prices for assets without public APIs (e.g., private equity).

### ✅ Tasks
A Kanban-style board to track financial chores.
- Track tax filings, bill payments, or cancellations.
- Set priorities and due dates.
- Visual consistency heatmap to track productivity.

### 🤖 AI Assistant
Integrated with Google's **Gemini** models.
- **Chat:** Ask questions like *"How much did I spend on dining out last month?"*
- **Budgeting:** Analyze spending habits to generate realistic budget recommendations.
- **Planning:** Create step-by-step contribution plans to reach financial goals.

### 💾 Data Management
- **Import Wizard:** Powerful CSV importer with column mapping and cleaning tools.
- **Export:** Download data as CSVs.
- **Backup & Restore:** Full JSON snapshots of your workspace state.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS.
- **Visualization:** Recharts, Leaflet (Maps).
- **State/Data:** React Query, Context API.
- **Backend (Optional):** Express, PostgreSQL (for auth/persistence).
- **AI:** Google GenAI SDK.

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Configure AI (Optional):**
    To enable the AI Assistant, create a `.env.local` file in the root:
    ```bash
    GEMINI_API_KEY=your_key_here
    ```

3.  **Run the frontend:**
    ```bash
    npm run dev
    ```
    Access the app at `http://localhost:5173`.

### Running the Backend (Optional)
The backend provides user authentication and cloud persistence.

1.  **Set environment variables:**
    ```bash
    DATABASE_HOST=localhost
    DATABASE_PORT=5432
    DATABASE_USER=postgres
    DATABASE_PASSWORD=password
    DATABASE_NAME=crystal
    JWT_SECRET=your_secret
    ```

2.  **Start the server:**
    ```bash
    cd server
    npm install
    npm run build
    npm start
    ```

### Docker
Run the full stack (Frontend + Backend + DB) with Docker Compose.

```bash
docker compose up --build
```
