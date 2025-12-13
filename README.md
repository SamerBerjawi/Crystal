# Crystal

**Crystal** is the ultimate personal finance operating system. It provides clarity and foresight for your financial future by combining professional-grade accounting tools with behavioral gamification and AI-powered forecasting.

Designed as a **privacy-first, local-centric** application, Crystal ensures your financial data remains yours while offering features typically found only in enterprise software.

## 🌟 Key Features

### 📊 Interactive Dashboard
*   **Modular Widgets:** Fully customizable grid (Drag & Drop) including Net Worth, Cash Flow, and Recent Activity.
*   **Privacy Mode:** One-click blur for sensitive numbers when viewing in public spaces.
*   **Advanced Visuals:**
    *   **Cash Flow Sankey:** Visualize the flow of money from income sources to expenses and savings.
    *   **Transaction Map:** Geospatial heatmaps of your spending based on merchant locations.
    *   **Heatmaps:** Activity density views for tasks and recurring schedules.

### 🎮 Gamification & Health
Turn financial discipline into a game:
*   **Financial Health Score:** A dynamic 0-100 score calculated from your Savings Rate, Liquidity Ratio, Debt Management, and Asset Diversity.
*   **Boss Battles:** Visual RPG-style battles against your largest debts (The Nemesis) or for your savings goals (The Guardian).
*   **Savings Sprints:** Short-term challenges (e.g., "The Zero Day", "Coffee Break", "Grocery Gauntlet") to curb impulse spending.
*   **Predictions:** "Bet" on your future net worth or spending caps to track your discipline against your own expectations.
*   **Badges & Mastery:** Earn achievements for streaks, debt reduction, and budget adherence.

### 💼 Wealth & Asset Management
Crystal handles complex portfolios beyond simple bank accounts:
*   **Liquid Assets:** Checking, Savings, and physical Cash wallets.
*   **Investments:**
    *   **Manual Price Logging:** Track private equity or assets not on public exchanges with historical price charts.
    *   **Warrants & Grants:** Specialized tracking for employee equity, including strike prices and vesting.
    *   **Spare Change:** Virtual "Round-up" accounts that simulate micro-investing from your daily transactions.
    *   **Pension Funds:** Retirement tracking with target year projections.
*   **Property & Vehicles:**
    *   **Real Estate:** Track equity, LTV, mortgages, and recurring costs (HOA, Tax).
    *   **Vehicles:** Manage VINs, lease terms, and mileage logs with overage forecasting.
*   **Liabilities:** Detailed loan amortization schedules and credit card statement cycle management.

### 📅 Forecasting & Planning
*   **2-Year Horizon:** Daily balance projections based on recurring income, bills, and goals.
*   **Synthetic Events:** The engine automatically generates future transactions for loans, credit card payments, and annual property taxes to give a realistic "Safe-to-Spend" number.
*   **AI Smart Planner:** Uses Google Gemini to generate step-by-step contribution plans to fund your goals based on your projected free cash flow.
*   **Scenario Modeling:** Toggle goals and large expenses to simulate their impact on your runway.

### 🧾 Business & Invoicing
*   **Invoicing System:** Create, track, and manage professional Quotes and Invoices.
*   **Status Workflow:** Track documents from Draft → Sent → Paid/Accepted.
*   **Entity Management:** Manage client details and payment terms.

### 🤖 AI Copilot
*   **Conversational Insights:** Chat naturally with your data (e.g., "How much did I spend on Uber last year vs this year?").
*   **Budget Advisor:** AI analysis of historical spending to suggest realistic monthly budgets.
*   **Categorization:** Intelligent suggestions for transaction categories.

### 🛠️ Data Sovereignty
*   **Import Wizard:** A powerful CSV importer with:
    *   Fuzzy column mapping.
    *   Data cleaning and row exclusion.
    *   Duplicate detection.
*   **Granular Backup & Restore:** Export specific slices of data (e.g., just "Settings" or "Transactions") and merge them back in without overwriting your whole database.
*   **Local-First:** Data is stored in your local instance/database. No third-party bank connections sharing your data.

## Tech Stack
*   **Frontend:** React 19, TypeScript, Vite, Tailwind CSS.
*   **Visualization:** Recharts, Leaflet (Maps).
*   **State Management:** Context API + React Query.
*   **AI:** Google Gemini API (@google/genai).
*   **Backend:** Node.js/Express + PostgreSQL.
*   **Infrastructure:** Docker & Docker Compose.

## Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Configure AI (Optional):**
    Create `.env.local` and add your Google Gemini API key:
    ```
    GEMINI_API_KEY=your_key_here
    ```
3.  **Run Development Server:**
    ```bash
    npm run dev
    ```
4.  **Run with Backend (Docker):**
    ```bash
    docker compose up --build
    ```

## License
MIT
