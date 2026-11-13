# Crystal 🔮

**Crystal** is the ultimate personal finance operating system. It moves beyond simple retrospective expense tracking to provide a professional-grade predictive wealth forecasting and financial simulation engine wrapped in a beautiful, **privacy-first, self-hosted** application.

Designed for data sovereignty, Crystal ensures your financial data remains yours while offering predictive capabilities typically found only in enterprise wealth management software. Crystal analyzes your historical financial velocity and merges it with expected future transactions to project your true liquidity, net worth, and cashflow trajectory up to 2 years ahead.

![Crystal overview](docs/screenshots/overview.jpg)

> **v3.0** is a full redesign with a new app shell, rebuilt Forecast, Accounts and Investments, a server-enforced PIN lock and multi-arch (amd64 + arm64) images. See the [changelog](CHANGELOG.md).

## 📸 Screenshots

| Forecast: cash horizon | Accounts: net worth |
| --- | --- |
| ![Forecast](docs/screenshots/forecasting.jpg) | ![Accounts](docs/screenshots/accounts.jpg) |

| Investments: portfolio |
| --- |
| ![Investments](docs/screenshots/investments.jpg) |

*Screenshots use the built-in demo dataset.*

## 🌟 Key Features

- 🔮 **Forecast your cash, not just track it.** A deterministic simulation projects daily balances and net worth up to 2 years ahead from your history, scheduled bills, recurring income, loan amortisation and card statement cycles. It flags your lowest point before it happens and suggests a cash buffer.
- 🏦 **Everything in one place.** Cash, savings, cards, loans, mortgages, property, vehicles, investments, crypto, pensions, warrants and other assets or liabilities, in any of 150+ currencies (plus BTC), with live exchange-rate conversion.
- 🔒 **Yours alone.** Self-hosted with your own PostgreSQL. A server-enforced PIN lock, one-click privacy blur, rate-limited sign-in and encrypted bank credentials.
- 🤖 **Less manual work.** Bank sync, rules, merchant detection, duplicate and transfer matching, and subscription detection do the busywork.
- 📱 **Desktop and mobile.** Responsive layouts, keyboard shortcuts (⌘K command center, `N` to add), pull-to-refresh and swipe actions, light and dark themes.

---

## 🧭 What's inside

### 📊 Overview
* **Summary, Spending, Wealth and Coming up** tabs, each with size-responsive widgets you can rearrange and resize.
* Net worth with a cash / investments / property / debts breakdown, **Safe to spend** (a daily allowance until month end), money in/out/saved with period deltas, spending calendar, money-flow Sankey, goal rings and a "Needs you" card for bills and items to review.
* Spending map of where your money goes, drawn with MapLibre and OpenStreetMap (no API key).
* **Net worth bridge** widget (Wealth tab, via Customise → Add widget): what moved your net worth over the period, from start to end, split into income, spending, market gains and debt.
* **Life events** (a new job, a move, a big purchase) marked on the net-worth line and in Wrapped.
* Five **accent colours** (Forest, Ocean, Plum, Copper, Graphite) in Preferences, in light and dark.

### 💰 Accounts
* **Cash, Cards, Loans and Assets** views with per-type layouts and a wallet-style card view you can reorder by drag and drop.
* **Credit cards:** statement cycles, APR and fees, utilisation.
* **Loans and mortgages:** amortisation schedules, early repayments, deferred payments, bulk edits, future interest.
* **Property and vehicles:** valuation history, leases, mileage logs and limits, depreciation.
* Linked accounts, balance adjustments and reconciliation, closing assets, per-account analytics inclusion.

### 📝 Transactions
* Fast ledger with filters, bulk edit and bulk categorise, splitting and combining, transfers between accounts, and a **review queue** for imported items.
* Merchant logos, location tagging, a transaction scatter chart and a places map.
* **Import** from CSV with a guided mapping wizard and **export** to JSON or CSV.
* **Tidy-ups:** Crystal suggests merging merchant spellings and filing merchants under categories. You see the exact edits, nothing changes until you approve, and Undo restores the old values.

### 🔮 Planning
* **Forecast:** cash-horizon chart and monthly ledger list, lowest-point marker, buffer suggestions, goal markers, and the items that move the line.
* **Budgets:** category budgets with exclusions, sub-goals and pace tracking.
* **Goals:** realistic completion dates from forward cashflow, monthly targets by account and month, and what-if scenarios.
* **Calendar and bills:** recurring transactions with overrides, bills and payments, automatic matching of bank transactions to scheduled items.
* **Debt payoff:** compare minimums only, snowball and avalanche with an extra monthly payment, and see the debt-free date and the interest saved.
* **Subscriptions:** smart detection from your transactions, renewal timeline, monthly and annual commitment, plus a loyalty-card wallet.
* **Tasks:** a board and heatmap for follow-ups and chores.

### 📈 Investments
* **Portfolio, Holdings and Activity** with allocation by class, performance over time, realised and unrealised gain, cost basis and top positions.
* Stocks, ETFs and crypto with live prices via **Twelve Data**; **warrants and equity grants** with strike prices and vesting; **spare change** round-ups; **pension** tracking.
* **Performance:** money-weighted yearly return (XIRR) per holding and overall, money put in against growth, and concentration.
* **Against an index:** your buys and sales replayed into up to three index funds (or any ticker) on the same days, with ahead/behind figures. Needs a Twelve Data key.
* Positions without a current price are valued at their last trade and left out of the gain, rather than guessed.

### 📑 Reports
* Spending velocity, category allocation, needs vs wants, merchant loyalty, budget vs actual, month-end forecast, anomaly and recurring-pattern detection, saved views and rule-based insights.
* **Weekly recap:** spent, earned and kept against last week, top categories and merchants, budgets running high and bills due. Optional Monday alert.
* **Trips:** trips found from the country on your transactions, with days, spend and a map.
* **FIRE:** the odds your money lasts, with saved settings and planned costs.
* **Wrapped:** your year in review.
* **Tax pack:** income, investment income, deductible-category spending and investment sales for a tax year; a per-country checklist of documents (the country comes from your city in Settings, or choose another); encrypted document storage; and a zip download with CSV summaries and your documents. A guide to the paperwork, not tax advice.

### 🧾 Quotes & invoices
* Create quotes and invoices with line items, tax and discounts, convert a quote to an invoice, and track the billing pipeline.

### 🕹️ Challenges
* A 0-100 **financial health score** from savings rate, liquidity and debt, day streaks, badges, savings sprints, spending predictions and personal records.

---

## 🔌 Integrations & automation

* **Enable Banking (beta):** connect 2,500+ European banks to import transactions and balances, with consent-expiry handling, re-authorisation, webhooks and a credential self-test. Bank sync never overwrites your manual edits.
* **MCP server and API tokens:** create a read-only token in Settings → Connections, limited to the scopes you pick (summary, transactions, investments, planning) and optionally expiring, then point an MCP client at `https://<your-crystal>/api/mcp` with `Authorization: Bearer cry_…` (read-only REST under `/api/v1` uses the same tokens). Tools: `get_summary`, `list_transactions`, `spending_by_category`, `search_merchants`, `get_investments`, `get_planning`, plus a `crystal://summary` resource and a `monthly_review` prompt. A token only sees the tools its scopes allow, and nothing can write.
* **Ask Crystal:** ask about your money in plain words (Ctrl or ⌘ + `/`). Figures are looked up with the same calculations as the rest of the app, and the model only words the answer. Use the built-in engine or any OpenAI-compatible model server. It can also suggest tidy-ups, which wait for your approval. See [docs/ask_crystal.md](docs/ask_crystal.md).
* **Alerts to your phone:** ntfy, Gotify or a webhook for low balances, budgets, duplicate charges, price rises, expiring bank access and an optional Monday recap.
* **Rules:** one rule model to categorise, tag and rename transactions automatically, with suggestions drawn from your history.
* **Merchant intelligence:** detect and profile merchants, fetch logos via **Brandfetch**, and manage branches and keyword rules.
* **Taxonomy:** hierarchical categories plus flat tags (`#trip`, `#project`) that cut across them.

## 🛠️ Data & security

* **Backup and restore:** export selected parts (accounts, transactions, taxonomy) as JSON or CSV, then restore by merging, with conflicts resolved by ID, or by replacing.
* **Sync safely across devices:** autosave with conflict detection and a three-way merge when two devices edit at once.
* **Security:** server-enforced PIN lock, session cookies, rate limiting, request validation, SSRF-guarded fetching and encrypted bank keys. See the [changelog](CHANGELOG.md) for what changed in 3.0.
* **Administration:** no email service is needed; admins reset passwords with a CLI, and registration can be switched off with `ALLOW_REGISTRATION=false`.
* **Preferences:** main currency, display currency, language, time zone, date format, financial-year start, default period, and a Settings search.

---

## ⚙️ Setup guide

Most things are configured in the app under **Settings → Connections**. Anything that needs the server is set as an environment variable on the **backend** (in `docker-compose.yml`, or a `.env` file next to it). Replace `https://crystal.example.com` below with the address you open Crystal at.

### 1. Required, once

| Variable | What it is |
| --- | --- |
| `JWT_SECRET` | A long random value that signs sessions. `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | The database password. `openssl rand -hex 16` |
| `DATA_ROOT` | A folder on the host for the database, backend files and models. |
| `ENCRYPTION_SECRET` | Encrypts bank keys, alert tokens and tax documents. Empty falls back to `JWT_SECRET`. **Set it once and never change it**, or stored keys and documents can no longer be read. |
| `ALLOW_REGISTRATION` | `false` once everyone who needs an account has one. |

### 2. Prices, exchange rates and logos (optional)

1. **Twelve Data:** create a free key at [twelvedata.com](https://twelvedata.com), then paste it in **Connections → Prices and logos**. It adds live prices, more exchange rates and the index comparison. The free plan has a daily limit.
2. **Brandfetch:** create an account at [brandfetch.com/developers](https://brandfetch.com/developers) and paste the **Client ID** (not a secret key) in the same place.

### 3. Bank sync with Enable Banking (optional)

1. Create an application at [enablebanking.com](https://enablebanking.com) and download its **private key (.pem)**. Note the **application ID**.
2. In the application settings, register the callback address: `https://crystal.example.com/enable-banking/callback`. Enable Banking accepts `https` only, except for `localhost`.
3. On the server set `ENABLE_BANKING_REDIRECT_URL=https://crystal.example.com/enable-banking/callback` (the same address). Without it Crystal builds the address from how you opened it, which is rarely the registered one.
4. In **Connections → Enable Banking**, enter the application ID and key (the key is stored encrypted and never shown again). Then add a bank under **Banks**, sign in with it, and link each of its accounts.

Access lasts up to 180 days and Crystal warns before it ends. Details: [docs/enable_banking_integration.md](docs/enable_banking_integration.md).

### 4. Alerts to your phone (optional)

In **Connections → Alerts** choose a channel:

| Channel | Address | Other |
| --- | --- | --- |
| ntfy | `https://ntfy.sh` or your own server | A topic: a hard-to-guess name you subscribe to in the ntfy app |
| Gotify | `https://gotify.example.com` | An application token |
| Webhook | Any address that accepts a JSON `POST` | Optional bearer token |

An address on your own network (for example a self-hosted ntfy at `http://192.168.1.20:8080`) needs `ALERTS_ALLOW_PRIVATE_URLS=true` on the server. `ALERTS_ENABLED` and `ALERTS_INTERVAL_MINUTES` (default 30, minimum 5) control the scheduler.

### 5. API tokens and AI tools (optional)

1. In **Connections → API tokens** create a token and tick the scopes it may read (summary, transactions, investments, planning). It is read-only, can expire, and is shown **once**.
2. REST: `curl -H "Authorization: Bearer cry_…" https://crystal.example.com/api/v1/…`
3. MCP client (Claude Desktop, Claude Code, others): add an HTTP server at `https://crystal.example.com/api/mcp` with the header `Authorization: Bearer cry_…`. For Claude Code: `claude mcp add --transport http crystal https://crystal.example.com/api/mcp --header "Authorization: Bearer cry_…"`.

### 6. Ask Crystal (optional)

Open it with Ctrl or ⌘ + `/`, then choose a model in **Connections → Ask Crystal**:

- **Built-in engine:** `docker compose --profile ai up -d` starts an Ollama container. Pick a model and press **Download** (`qwen3:4b`, about 2.5 GB, is a good start on a NAS CPU). `OLLAMA_URL` defaults to `http://ollama:11434`.
- **A model server you already run:** choose *A model server I already have* and enter its address:

| Server | Address | API key |
| --- | --- | --- |
| Ollama | `http://192.168.1.10:11434` | none |
| LM Studio | `http://192.168.1.10:1234/v1` | none |
| llama.cpp / vLLM | `http://192.168.1.10:8080/v1` | optional |
| OpenAI | `https://api.openai.com/v1` | yours |
| OpenRouter | `https://openrouter.ai/api/v1` | yours |

Pick a model that supports **tool calling**. An address on your own network works when you are the only user; with several users set `ASSISTANT_ALLOW_PRIVATE_URLS=true`. On Umbrel the built-in engine is not available, so use a server you already run. More in [docs/ask_crystal.md](docs/ask_crystal.md).

### 7. Tax pack documents (optional)

Uploaded documents are encrypted and written to `TAX_DOCS_DIR` (default `config/tax-docs`, which is inside the backend's `/app/config` volume, so the bundled `docker-compose.yml` already keeps them). `TAX_DOC_MAX_MB` (default 10) limits one file and `TAX_DOC_USER_MAX_MB` (default 500) limits one person. **Back up that folder together with the database**; it is not in the JSON backup. Set your **city** in Settings → Profile so the Tax pack picks your country, or choose one on the page. More in [docs/tax_pack.md](docs/tax_pack.md).

### Every server setting

| Variable | Default | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | required | Signs sessions |
| `ENCRYPTION_SECRET` | `JWT_SECRET` | Encrypts stored keys and documents |
| `POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB` | required, `crystal_user`, `crystal` | Database |
| `ALLOW_REGISTRATION` | `true` | Allow new sign-ups |
| `FRONTEND_PORT` | `7157` | Port the app is served on |
| `ENABLE_BANKING_REDIRECT_URL` | built from the request | Registered bank callback address |
| `ALERTS_ENABLED` | `true` | Alert scheduler on or off |
| `ALERTS_INTERVAL_MINUTES` | `30` | How often it checks (min 5) |
| `ALERTS_ALLOW_PRIVATE_URLS` | `false` | Alert destinations on your network |
| `OLLAMA_URL` | `http://ollama:11434` | Built-in Ask Crystal engine |
| `ASSISTANT_ALLOW_PRIVATE_URLS` | `false` | Model servers on your network, when shared |
| `TAX_DOCS_DIR` | `config/tax-docs` | Where tax documents are kept |
| `TAX_DOC_MAX_MB` / `TAX_DOC_USER_MAX_MB` | `10` / `500` | Upload limits |
| `CORS_ORIGIN` | empty | Only if the app and API are on different addresses |
| `AUTH_COOKIE_SECURE` | `true` in production | Set `false` only for plain-HTTP access (Umbrel does) |

## Tech Stack
* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Aria Components, Motion.
* **Charts and maps:** visx (including Sankey), Recharts, MapLibre GL.
* **State and data:** Context API + TanStack Query; money maths with big.js.
* **Backend:** Express 4, PostgreSQL (one JSON document per user), zod validation.
* **Delivery:** Docker images for linux/amd64 and linux/arm64, Umbrel packaging.

## Installation

### Umbrel

Crystal is packaged for the Umbrel App Store (see [`crystal/`](crystal/)). It installs with its own PostgreSQL database and generated secrets; no configuration needed.

### Self-hosted (recommended)

Crystal is meant to run with its PostgreSQL backend via Docker:

```bash
export DATA_ROOT=./data JWT_SECRET="$(openssl rand -hex 32)" POSTGRES_PASSWORD="$(openssl rand -hex 16)"
docker compose up -d
```

Then open `http://localhost:7157`. Next, follow the [setup guide](#️-setup-guide) for bank sync, prices, alerts and the assistant. Images are published for `linux/amd64` and `linux/arm64`; pin `backend-v3.0.0` / `frontend-v3.0.0` in `docker-compose.yml` for a fixed version. `JWT_SECRET` (a long random value; it signs session tokens) and `POSTGRES_PASSWORD` are required — the stack and the production server refuse to start without them.

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

### Resetting a password

Crystal has no email service, so an administrator resets passwords from the server:

```bash
docker compose exec backend node dist/cli/reset-password.js user@example.com
```

A random password is printed (pass a second argument to choose one). All of that user's sessions are signed out.

### Tests

```bash
npm test               # unit tests
tests/run-all.sh       # unit tests + Playwright e2e against a throwaway Postgres
```

## License
MIT