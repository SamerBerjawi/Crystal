# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Crystal is a self-hosted personal finance app (React 19 + Vite + Tailwind v4 frontend, Express + PostgreSQL backend).

## Commands

Frontend (repo root):
- `npm run dev`: runs `server.ts` via tsx on http://localhost:3000. This is an Express server with Vite middleware. It also hosts `/api/ai/proxy`. All other `/api` traffic goes to `VITE_BACKEND_URL` when that's set; otherwise an **in-memory mock backend** inside `server.ts` handles it.
- `npm run lint`: `tsc --noEmit`. This is the only type and lint check.
- `npm run build`: **bumps the version first** (`scripts/bump-version.cjs` rewrites `version.ts` and `package.json` to `2.YYMMDD.N`), then runs `vite build`. Expect those two files to change on every build.
- `npm run analyze`: production build that also writes `dist/stats/bundle-report.json`.

Backend (`server/`, a separate package with its own `node_modules`; CommonJS, strict TS):
- `cd server && npm run build` (tsc → `dist/`), `npm run dev` (tsc-watch), `npm start`.
- Needs Postgres and the env vars listed in `.env.example`. `database.ts` creates the tables on startup.

Tests: there's no test runner. Each `*.test.ts` is a standalone script that logs `✓`/`✕` per case, so check the output for `✕` rather than relying on the exit code. Run one directly:
- `npx tsx utils.test.ts`
- `npx tsx server/src/schemas.test.ts` (or build the server and run `node server/dist/<name>.test.js`)

## Architecture

**Persistence model: one JSON document per user.** The backend stores each user's data as a single JSONB `data` column in `financial_data` (see `server/src/data.ts`). `GET /api/data` returns the whole blob. `POST /api/data` either replaces it or merges it (`{ partial: true, data }`). Optimistic concurrency uses `lastUpdatedAt`/`previousUpdatedAt`, and the server returns 409 when the client's copy is stale. Payloads are validated with zod in `server/src/schemas.ts`. The shape of the blob is the `FinancialData` interface in `types.ts`. Adding a new persisted entity means updating `FinancialData`, the zod schema, `demoData.ts` (`initialFinancialData`/`emptyFinancialData`), and the load/save wiring in `App.tsx`.

**`App.tsx` is the state hub (~3k lines).** It owns all domain state (`useState` per entity), loads it from `/api/data`, and autosaves through a debounced dirty signal (`saveData`/`savePartialData`, plus a keepalive save on unload and logout). It also implements routing by hand: `parseRoute(window.location.pathname)` and a `Page` union type, with no router library. Pages in `pages/` are lazy-loaded. Enable Banking sync orchestration lives here too.

**Context layer.** `App.tsx` passes its state and handlers down through providers:
- `contexts/DomainProviders.tsx`: Accounts, Transactions, Preferences, Warrants, Invoices. Includes selector hooks such as `useTransactionSelector` and `useAccountSelector`.
- `contexts/FinancialDataContext.tsx`: Categories, Tags, Budgets, Goals, Schedule (recurring transactions, overrides, bills, memberships, loan payment overrides).
- Components consume these through `use*Context()` hooks, not prop drilling.

**Demo/dev mode.** Demo mode runs entirely on the client from `demoData.ts` and doesn't save to the backend. In dev it can restore a cached dataset (`saveDevCache`/`loadDevCache`).

**Domain logic.** Financial math lives in `utils.ts`: `safeAdd`/`safeMultiply`/`round2`/`toCents` (backed by big.js), currency conversion, credit card statement cycles, synthetic card/loan payments for forecasting, and account totals. More logic is split across `utils/` (`investments.ts`, `rules.ts`, `backup.ts`, `collection.ts`'s `upsertEntity`/`removeEntityById`, and others). Use the safe-math helpers for money; don't use raw float arithmetic.

**UI layout.**
- `components/`: flat directory of feature components and modals. Mobile variants live alongside as `Mobile*View.tsx`.
- `src/components/charts/`: visx-based chart primitives.
- `src/components/ui/`: shadcn (`components.json`).
- `src/services/twelveDataService.ts`: market data.
- Path alias `@/` points to the repo root.

**Design system.** `DESIGN.md` defines the visual language: an Apple HIG / glassmorphism style, primary color `#fa9a1d`, and the typography scale, radii and spacing tokens. Follow it for any UI work.

## Deployment

`.github/workflows/build-and-publish.yml` builds two images to GHCR (`ghcr.io/samerberjawi/crystal`). The frontend image (root `Dockerfile` → nginx serving `dist/`, config in `nginx.conf`) and the backend image (`server/Dockerfile`) are tagged `*-pr-N` for PRs, `*-latest` for main, and `*-stable` for `v*` tags. `docker-compose.yml` and `crystal/` (Umbrel app packaging) consume those images.

## Git workflow (from `.agents/rules/git-workflow.md`)

- Make edits in the working tree; verify with `npm run dev` and `npm run lint`.
- When the user asks to commit, sync, or push, **create a new descriptive branch** (`feat/…`, `fix/…`, `refactor/…`). Never commit to `main` or reuse an old branch.
- Before committing, run `npm run build`, which also bumps the version. Then commit everything with a Conventional Commit message and push with `-u`.
- Afterwards, give the PR link: `https://github.com/SamerBerjawi/Crystal/pull/new/<branch>`.
