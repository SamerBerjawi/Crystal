# Crystal AI Agent Development Rules (`AI_RULES.md`)

Read this guide alongside [`CLAUDE.md`](../CLAUDE.md), [`DESIGN.md`](../DESIGN.md), [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md), and [`docs/DOMAIN_RULES.md`](./DOMAIN_RULES.md) before modifying Crystal.

---

## 1. Non-Negotiable Financial & Data Integrity Rules

1. **Never Use Floating-Point Arithmetic for Money**:
   - Use `safeAdd`, `safeSub`, `safeMul`, `safeDiv`, and `safeRound` from [`utils.ts`](../utils.ts).
2. **Never Double-Convert Currencies**:
   - `calculateAccountTotals` ([`utils.ts`](../utils.ts)) already returns amounts in `getMainCurrency()`.
   - Functions in [`utils/challengesModel.ts`](../utils/challengesModel.ts) return amounts in `'EUR'` and are converted to `getMainCurrency()` once at the presentation boundary (`Challenges.tsx` / `wrappedModel.ts`).
3. **Always Use `resolveAccountBalance(account)` for Account Balances**:
   - Loan and Mortgage accounts compute their remaining balance dynamically from amortization schedules and overrides (`resolveAccountBalance(acc)`), not raw `acc.balance`.
4. **Preserve Sync & Merge Keys**:
   - Any new entity slice added to `FinancialData` ([`types.ts`](../types.ts)) must be registered in:
     1. `PERSISTED_SLICE_KEYS` in [`hooks/useFinancialPersistence.ts`](../hooks/useFinancialPersistence.ts)
     2. `financialDataSchema` in [`server/src/schemas.ts`](../server/src/schemas.ts)
     3. `threeWayMerge` in [`utils/threeWayMerge.ts`](../utils/threeWayMerge.ts) (specify composite key in `getItemKey` if items do not have a unique `.id`).

---

## 2. Design System & UI Rules (`DESIGN.md`)

1. **Tokens Only — No Raw Palette or Hex Colors in UI**:
   - Use semantic CSS variables/Tailwind classes (`bg-canvas`, `surface-card`, `bg-inset`, `text-ink`, `text-muted`, `border-line`, `text-money-in`, `text-money-out`, `bg-primary`).
2. **Always Render Money with `<Amount>`**:
   - Use `<Amount>` from [`components/ui/Money.tsx`](../components/ui/Money.tsx) so tabular numerals, currency signs, and privacy-mode blurring work automatically.
3. **Icons**:
   - Use `<Icon name="..." />` from [`components/ui/Icon.tsx`](../components/ui/Icon.tsx) (backed by `@hugeicons/react`). Do not add `lucide-react` or inline SVGs for standard icons.

---

## 3. Architecture & State Management Rules

1. **Keep `App.tsx` Lean**:
   - Routing belongs in [`hooks/useAppRouter.ts`](../hooks/useAppRouter.ts).
   - Server persistence and 3-way conflict resolution belong in [`hooks/useFinancialPersistence.ts`](../hooks/useFinancialPersistence.ts).
   - Entity CRUD handlers belong in [`hooks/useDomainCrudHandlers.ts`](../hooks/useDomainCrudHandlers.ts) and **must** be wrapped in `useCallback`.
   - Enable Banking sync logic belongs in [`hooks/useEnableBankingSync.ts`](../hooks/useEnableBankingSync.ts).
2. **Pure Domain Models in `utils/`**:
   - Put business rules, schedule expansion, forecasting, and portfolio calculations in pure functions under `utils/*Model.ts` with unit tests in `tests/unit/*.test.ts`.
3. **Verification Gate**:
   - Every change must pass both typechecks and the full test suite before completion:
     ```bash
     npm run lint && npm test
     ```
