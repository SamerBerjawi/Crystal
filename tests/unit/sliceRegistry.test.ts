import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERSISTED_SLICE_KEYS,
  ENTITY_ARRAY_KEYS,
  ORDER_ARRAY_KEYS,
  OBJECT_SLICE_KEYS,
  DELTA_ELIGIBLE_KEYS,
  MATERIAL_DATA_ARRAY_KEYS,
  MATERIAL_DATA_OBJECT_KEYS,
  ENVELOPE_METADATA_KEYS,
  isPersistedSliceKey,
} from '../../utils/sliceRegistry';
import serverRegistry from '../../server/src/sliceRegistry';
import { emptyFinancialData } from '../../demoData';

test('sliceRegistry: client and server slice registries are identical', () => {
  assert.deepEqual(
    Array.from(PERSISTED_SLICE_KEYS),
    Array.from(serverRegistry.PERSISTED_SLICE_KEYS),
    'PERSISTED_SLICE_KEYS must match exactly between client and server',
  );
  assert.deepEqual(
    Array.from(ENTITY_ARRAY_KEYS),
    Array.from(serverRegistry.ENTITY_ARRAY_KEYS),
    'ENTITY_ARRAY_KEYS must match',
  );
  assert.deepEqual(
    Array.from(ORDER_ARRAY_KEYS),
    Array.from(serverRegistry.ORDER_ARRAY_KEYS),
    'ORDER_ARRAY_KEYS must match',
  );
  assert.deepEqual(
    Array.from(OBJECT_SLICE_KEYS),
    Array.from(serverRegistry.OBJECT_SLICE_KEYS),
    'OBJECT_SLICE_KEYS must match',
  );
  assert.deepEqual(
    Array.from(DELTA_ELIGIBLE_KEYS),
    Array.from(serverRegistry.DELTA_ELIGIBLE_KEYS),
    'DELTA_ELIGIBLE_KEYS must match',
  );
});

test('sliceRegistry: PERSISTED_SLICE_KEYS is the exact union of entity arrays, order arrays, and object slices', () => {
  const expectedUnion = new Set([
    ...ENTITY_ARRAY_KEYS,
    ...ORDER_ARRAY_KEYS,
    ...OBJECT_SLICE_KEYS,
  ]);
  assert.equal(
    PERSISTED_SLICE_KEYS.length,
    expectedUnion.size,
    'PERSISTED_SLICE_KEYS must not have duplicates',
  );
  for (const key of PERSISTED_SLICE_KEYS) {
    assert.ok(expectedUnion.has(key), `Key ${key} must belong to one of the slice categories`);
  }
});

test('sliceRegistry: every key in PERSISTED_SLICE_KEYS exists in emptyFinancialData', () => {
  const emptyDataKeys = new Set(Object.keys(emptyFinancialData));
  for (const key of PERSISTED_SLICE_KEYS) {
    assert.ok(
      emptyDataKeys.has(key),
      `Slice key "${key}" from PERSISTED_SLICE_KEYS is missing from emptyFinancialData in demoData.ts`,
    );
  }
});

test('sliceRegistry: every domain key in emptyFinancialData is registered in PERSISTED_SLICE_KEYS', () => {
  const registered = new Set<string>(PERSISTED_SLICE_KEYS);
  for (const key of Object.keys(emptyFinancialData)) {
    if (key === 'lastUpdatedAt' || key === 'userProfile') continue;
    assert.ok(
      registered.has(key),
      `Domain key "${key}" in emptyFinancialData is not registered in PERSISTED_SLICE_KEYS`,
    );
  }
});

test('sliceRegistry: financialDataSchema covers all registered slices', async () => {
  const schemasModule: any = await import('../../server/src/schemas');
  const schemas = schemasModule.default || schemasModule;
  const schemaShape = schemas.financialDataSchema.shape;
  for (const key of PERSISTED_SLICE_KEYS) {
    assert.ok(
      key in schemaShape,
      `Slice key "${key}" must have a schema definition in financialDataSchema`,
    );
  }
  for (const key of ENVELOPE_METADATA_KEYS) {
    assert.ok(
      key in schemaShape,
      `Metadata key "${key}" must be recognized by financialDataSchema`,
    );
  }
});

test('sliceRegistry: isPersistedSliceKey correctly identifies persisted slices', () => {
  assert.equal(isPersistedSliceKey('accounts'), true);
  assert.equal(isPersistedSliceKey('transactions'), true);
  assert.equal(isPersistedSliceKey('userStats'), true);
  assert.equal(isPersistedSliceKey('preferences'), true);
  assert.equal(isPersistedSliceKey('goalOrder'), true);
  assert.equal(isPersistedSliceKey('notAValidKey'), false);
  assert.equal(isPersistedSliceKey('lastUpdatedAt'), false);
  assert.equal(isPersistedSliceKey(''), false);
});

test('sliceRegistry: DELTA_ELIGIBLE_KEYS is a subset of ENTITY_ARRAY_KEYS', () => {
  const entitySet = new Set<string>(ENTITY_ARRAY_KEYS);
  for (const key of DELTA_ELIGIBLE_KEYS) {
    assert.ok(entitySet.has(key), `Delta-eligible key "${key}" must be an entity array`);
  }
});

test('sliceRegistry: material data arrays and objects cover all persisted slices except order arrays', () => {
  const materialKeys = new Set<string>([
    ...MATERIAL_DATA_ARRAY_KEYS,
    ...MATERIAL_DATA_OBJECT_KEYS,
  ]);
  for (const key of PERSISTED_SLICE_KEYS) {
    assert.ok(materialKeys.has(key), `Persisted key "${key}" must be registered in material data`);
  }
});
