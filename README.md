# Crystal

Crystal provides clarity and foresight for your financial future. It is a comprehensive, privacy-first personal finance dashboard that centralizes accounts, transactions, budgets, investments, and forecasts. Beyond standard tracking, Crystal layers in intelligent forecasting, asset-specific management tools, and AI-assisted insights to help you plan with confidence.

## Core Features

### 📊 Dynamic Dashboard
*   **Modular Widget System:** Customizable grid layout with drag-and-drop widgets (Net Worth, Recent Activity, Cash Flow, Spending breakdown, etc.).
*   **Privacy / "Coffee Shop" Mode:** One-click toggle in the header to blur all monetary values for secure viewing in public spaces.
*   **Multi-Tab Views:** Switch between `Overview` (snapshot), `Analysis` (ratios & health metrics), and `Activity` (maps & flows) layouts.
*   **Transaction Map:** Visual heat map of spending locations based on transaction geolocation data.
*   **Cash Flow Sankey Diagram:** Visualize money flow from income sources to expenses and savings.

### 💼 Comprehensive Account Management
Crystal supports a wide array of account types with specialized views and logic for each:
*   **Liquid Assets:** Checking, Savings, and Cash wallets with burn-rate calculation and "Safe-to-Spend" metrics.
*   **Credit Cards:** Smart statement tracking that visualizes billing cycles, due dates, and credit utilization limits.
*   **Properties:** Dedicated property ledger tracking estimated market value, equity (calculated against linked mortgages), amortization, and property specifics (lot size, year built, amenities).
*   **Vehicles:** Detailed vehicle profiles supporting both **Owned** and **Leased** models. Tracks VIN, fuel type, purchase details, and includes a **Mileage Log** with usage charts to forecast lease overages.
*   **Loans & Lending:** Amortization schedule generation, principal/interest split tracking, and payment planning.
*   **Investments:** Support for Stocks, ETFs, Crypto, and Pension funds.
*   **Warrants & Equity:** Specialized tracking for employee stock warrants/options with grant dates and strike prices. Includes a **Custom Web Scraper** tool to fetch prices for obscure or private assets.

### 💳 Intelligent Transaction Handling
*   **Smart Categorization:** Bulk editing and categorization tools.
*   **Transfer Detection:** Heuristic-based matching engine that identifies potential transfers between accounts (e.g., a debit in Checking matching a credit in Savings) to keep cash flow reporting accurate.
*   **Spare Change Tracking:** Virtual "Round-up" calculator that estimates savings if purchases were rounded to the nearest dollar.
*   **Rich Metadata:** Support for merchant names, notes, tags, and geolocation.
*   **Global Search:** Fuzzy search across amounts, descriptions, categories, and accounts.

### 📅 Forecasting & Planning
*   **Projected Cash Flow:** Generates a daily balance forecast up to 2 years into the future based on recurring patterns and scheduled bills.
*   **Synthetic Events:** The forecasting engine automatically generates future "Synthetic" transactions for loan payments, credit card payoffs, and property taxes without cluttering your actual transaction ledger.
*   **Financial Goals:** Create One-time or Recurring savings goals.
*   **AI Smart Planner:** Generates step-by-step contribution plans to achieve your goals based on your projected free cash flow (requires Gemini API).
*   **Scenario Modeling:** Toggle goals and large expenses on/off to see their impact on your future liquidity.

### 🔄 Schedule & Recurring Engine
*   **Subscription Manager:** Detects potential recurring subscriptions from transaction history.
*   **Calendar Heatmap:** Visual density map of upcoming financial obligations.
*   **Flexible Recurrence:** Support for complex schedules (e.g., "Last Friday of the month", "Every 2 weeks").
*   **Bill Tracking:** Mark bills as paid/unpaid and track due dates.

### 🤖 AI Integration (Gemini)
*   **Conversational Assistant:** Chat with your financial data using natural language (e.g., "How much did I spend on coffee last month?", "Can I afford a vacation in July?").
*   **Budget Advisor:** AI analysis of historical spending to suggest realistic monthly budgets for each category.

### 🛠️ Data Sovereignty & Management
*   **Local-First / Private:** Data is stored locally or on your self-hosted backend. No external bank connections required.
*   **Import Wizard:** Robust CSV importer with column mapping, data cleaning (date formats, currency normalization), and preview capabilities.
*   **Export:** Full JSON backup and CSV export options for portability.
*   **Currencies:** Multi-currency support with automatic conversion to your base currency for reporting.

## Tech Stack
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Recharts, Leaflet (Maps).
- **State Management:** Context API + React Query.
- **Backend (Optional):** Node.js/Express + PostgreSQL (for persistence and multi-device sync).
- **Containerization:** Docker & Docker Compose.

## Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Configure AI (Optional):**
    Create `.env.local` and add `GEMINI_API_KEY=your_key_here`.
3.  **Run Development Server:**
    ```bash
    npm run dev
    ```
4.  **Run with Backend (Docker):**
    ```bash
    docker compose up --build
    ```
