/**
 * Client-facing export of Crystal's declarative SLICE_KEYS registry.
 * Single source of truth for persisted slices shared across App.tsx, server/src/schemas.ts,
 * hooks/useFinancialPersistence.ts, and synchronization logic.
 */

import sliceRegistry from '../server/src/sliceRegistry';
import type { FinancialData } from '../types';

export const {
  ENTITY_ARRAY_KEYS,
  ORDER_ARRAY_KEYS,
  OBJECT_SLICE_KEYS,
  DELTA_ELIGIBLE_KEYS,
  PERSISTED_SLICE_KEYS,
  MATERIAL_DATA_ARRAY_KEYS,
  MATERIAL_DATA_OBJECT_KEYS,
  ENVELOPE_METADATA_KEYS,
  isPersistedSliceKey,
} = sliceRegistry;

export type EntityArrayKey = (typeof ENTITY_ARRAY_KEYS)[number];
export type OrderArrayKey = (typeof ORDER_ARRAY_KEYS)[number];
export type ObjectSliceKey = (typeof OBJECT_SLICE_KEYS)[number];
export type DeltaEligibleKey = (typeof DELTA_ELIGIBLE_KEYS)[number];
export type PersistedSliceKey = (typeof PERSISTED_SLICE_KEYS)[number];
export type MaterialDataArrayKey = (typeof MATERIAL_DATA_ARRAY_KEYS)[number];
export type MaterialDataObjectKey = (typeof MATERIAL_DATA_OBJECT_KEYS)[number];
export type EnvelopeMetadataKey = (typeof ENVELOPE_METADATA_KEYS)[number];

// Compile-time assertion: Every PersistedSliceKey MUST be an exact key of FinancialData
type AssertAllPersistedKeysExistInFinancialData<T extends keyof FinancialData> = T;
export type ValidatedPersistedSliceKeys = AssertAllPersistedKeysExistInFinancialData<PersistedSliceKey>;

// Compile-time assertion: Ensure no domain key in FinancialData is accidentally omitted
// Excludes metadata/envelope properties ('lastUpdatedAt', 'userProfile')
type DomainFinancialDataKeys = Exclude<keyof FinancialData, 'lastUpdatedAt' | 'userProfile'>;
type MissingKeysCheck = Exclude<DomainFinancialDataKeys, PersistedSliceKey>;
// If any key is missing from PERSISTED_SLICE_KEYS, this type will evaluate to `never` instead of `true`
export type AllDomainKeysPersisted = [MissingKeysCheck] extends [never] ? true : false;

/**
 * Casted constant guaranteed to satisfy readonly (keyof FinancialData)[].
 */
export const TYPED_PERSISTED_SLICE_KEYS = PERSISTED_SLICE_KEYS as readonly (keyof FinancialData)[];
