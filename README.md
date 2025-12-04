# Crystal

Crystal provides clarity and foresight for your financial future. It centralizes accounts, transactions, budgets, investments, and forecasts while layering in AI-assisted insights to help you plan with confidence.

## Features
- **Unified finance workspace:** Dashboard, accounts, transactions, and tags keep balances, cash flow, and categorization in one place.
- **Planning tools:** Budgeting, forecasting, and goal tracking pages help you model scenarios and monitor progress.
- **Investments & warrants:** Track holdings, warrants, and investment transactions with price updates and performance metrics.
- **Cash flow automation:** Schedule recurring payments, bills, and tasks so upcoming obligations stay visible.
- **Data import/export:** Import historical data and export current state for backups or analysis.
- **AI assistance:** Gemini-powered chat and planning helpers surface insights through natural-language prompts (requires API key).
- **Customizable experience:** Preferences for currency, language, themes, and layout, plus category/tag management.

## Tech stack
- **Frontend:** React + TypeScript, Vite bundler, Recharts for data viz, Leaflet for maps.
- **Backend (optional):** Express + PostgreSQL for authentication, persistence, and API routes (`/server`).
- **Containerization:** Dockerfiles for the frontend and backend with a `docker-compose.yml` that wires a PostgreSQL database.

## Getting started (frontend)
1. **Prerequisites:** Node.js 18+ and npm.
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure AI access:** Create `.env.local` in the repo root with your Gemini key:
   ```bash
   GEMINI_API_KEY=your_key_here
   ```
4. **Run the app:**
   ```bash
   npm run dev
   ```
   The Vite dev server prints a local URL (default: `http://localhost:5173`).

## Running the backend (optional)
The Express API powers authentication and persistent storage. Set the required environment before starting:

```
DATABASE_HOST=<postgres_host>
DATABASE_PORT=5432
DATABASE_USER=<postgres_user>
DATABASE_PASSWORD=<postgres_password>
DATABASE_NAME=<postgres_db>
JWT_SECRET=<secure_random_string>
API_BODY_LIMIT=50mb              # optional override
```

Then install and start:
```bash
cd server
npm install
npm run build
npm start
```
Use `npm run dev` for rebuild-on-change development. The API listens on `http://localhost:3001` by default.

## Docker Compose
A full stack (PostgreSQL + backend + frontend) is defined in `docker-compose.yml`.

```bash
docker compose up --build
```

Key overrides:
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`: database credentials.
- `JWT_SECRET`: backend token signing secret.
- `FRONTEND_PORT`: host port exposing the frontend (defaults to `7157`).
- `DATA_ROOT`: host path for persistent Postgres storage.

## Project layout
- `App.tsx`, `pages/`, `components/`: React views and UI building blocks.
- `contexts/`, `hooks/`: shared state providers and reusable logic.
- `utils/`, `utils.ts`, `constants.tsx`, `types.ts`: utilities, shared types, and app-wide constants.
- `server/`: Express API, Postgres migrations/initialization, and backend Dockerfile.
- `docker-compose.yml`, `Dockerfile`, `frontend.Dockerfile`: containerization assets for local or deployment use.

## Useful scripts
- `npm run dev` – start the Vite dev server.
- `npm run build` – create a production build of the frontend.
- `npm run preview` – preview the production build locally.
- `npm run build && npm start` (in `server/`) – compile and serve the backend API.
- `npm run dev` (in `server/`) – watch mode for backend development.

## Notes
- AI features remain disabled until `GEMINI_API_KEY` is present at runtime.
- When the backend is offline, mock/demo data can still be explored in the frontend, but authentication and persistence require the server and PostgreSQL.
