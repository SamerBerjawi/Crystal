/**
 * Declarative slice registry for Crystal's single-row JSONB financial persistence model.
 * Single source of truth for persisted slices shared across App.tsx, server/src/schemas.ts,
 * hooks/useFinancialPersistence.ts, and synchronization logic.
 */

/**
 * Array slices where elements are entity objects with unique IDs or composite keys.
 */
export const ENTITY_ARRAY_KEYS = [
  'accounts',
  'transactions',
  'investmentTransactions',
  'recurringTransactions',
  'recurringTransactionOverrides',
  'financialGoals',
  'budgets',
  'tasks',
  'warrants',
  'memberships',
  'importExportHistory',
  'incomeCategories',
  'expenseCategories',
  'billsAndPayments',
  'invoices',
  'tags',
  'predictions',
  'lifeEvents',
  'cleanupProposals',
  'enableBankingConnections',
] as const;

export type EntityArrayKey = typeof ENTITY_ARRAY_KEYS[number];

/**
 * Slices representing ordered string IDs for user drag-and-drop prioritization.
 */
export const ORDER_ARRAY_KEYS = [
  'accountOrder',
  'taskOrder',
  'goalOrder',
] as const;

export type OrderArrayKey = typeof ORDER_ARRAY_KEYS[number];

/**
 * Object / Dictionary slices stored as key-value records.
 */
export const OBJECT_SLICE_KEYS = [
  'loanPaymentOverrides',
  'manualWarrantPrices',
  'priceHistory',
  'userStats',
  'preferences',
] as const;

export type ObjectSliceKey = typeof OBJECT_SLICE_KEYS[number];

/**
 * Slices eligible for bandwidth-efficient delta transfers (upserts + deletedIds).
 */
export const DELTA_ELIGIBLE_KEYS = [
  'transactions',
  'investmentTransactions',
] as const;

export type DeltaEligibleKey = typeof DELTA_ELIGIBLE_KEYS[number];

/**
 * All 26 persistent domain slices stored in `users.financial_data`.
 * A slice is dirty when its reference does not match the baseline loaded from the server.
 */
export const PERSISTED_SLICE_KEYS = [
  ...ENTITY_ARRAY_KEYS,
  ...ORDER_ARRAY_KEYS,
  ...OBJECT_SLICE_KEYS,
] as const;

export type PersistedSliceKey = typeof PERSISTED_SLICE_KEYS[number];

/**
 * Non-empty arrays that indicate the presence of real financial data (prevents saving empty default state).
 */
export const MATERIAL_DATA_ARRAY_KEYS = [
  ...ENTITY_ARRAY_KEYS,
  ...ORDER_ARRAY_KEYS,
] as const;

export type MaterialDataArrayKey = typeof MATERIAL_DATA_ARRAY_KEYS[number];

/**
 * Objects that indicate the presence of real financial data.
 */
export const MATERIAL_DATA_OBJECT_KEYS = [
  ...OBJECT_SLICE_KEYS,
] as const;

export type MaterialDataObjectKey = typeof MATERIAL_DATA_OBJECT_KEYS[number];

/**
 * Top-level metadata / envelope fields that accompany the payload but are not domain data slices.
 */
export const ENVELOPE_METADATA_KEYS = [
  'lastUpdatedAt',
  'userProfile',
  'deltas',
] as const;

export type EnvelopeMetadataKey = typeof ENVELOPE_METADATA_KEYS[number];

/**
 * Check if a string key is a registered persisted slice.
 */
export function isPersistedSliceKey(key: string): key is PersistedSliceKey {
  return (PERSISTED_SLICE_KEYS as readonly string[]).includes(key);
}

const sliceRegistry = {
  ENTITY_ARRAY_KEYS,
  ORDER_ARRAY_KEYS,
  OBJECT_SLICE_KEYS,
  DELTA_ELIGIBLE_KEYS,
  PERSISTED_SLICE_KEYS,
  MATERIAL_DATA_ARRAY_KEYS,
  MATERIAL_DATA_OBJECT_KEYS,
  ENVELOPE_METADATA_KEYS,
  isPersistedSliceKey,
};

export default sliceRegistry;
