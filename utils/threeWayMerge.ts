/**
 * Three-way merge of one persisted slice, used when a save loses a race with another device.
 *
 *   base   - the value both devices started from (what this device last loaded/saved)
 *   mine   - this device's current value
 *   theirs - the value now on the server
 *
 * Lists of `{ id }` objects merge per item (adds, deletes and edits from both sides survive); plain objects
 * merge per field; anything else (numbers, strings, plain lists) falls back to this device's value.
 */
const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const hasId = (v: unknown): v is { id: string } => isPlainObject(v) && typeof v.id === 'string';
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(item => typeof item === 'string');
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function threeWayMerge(base: unknown, mine: unknown, theirs: unknown): unknown {
  if (same(mine, base)) return theirs;      // nothing changed here
  if (same(theirs, base)) return mine;      // nothing changed there
  if (same(mine, theirs)) return mine;

  const baseList = base == null ? [] : base;
  if (Array.isArray(mine) && Array.isArray(theirs) && Array.isArray(baseList)
      && mine.length + theirs.length > 0
      && mine.every(hasId) && theirs.every(hasId) && baseList.every(hasId)) {
    return mergeById(baseList as { id: string }[], mine as { id: string }[], theirs as { id: string }[]);
  }

  if (isStringArray(mine) && isStringArray(theirs) && isStringArray(baseList)) {
    return mergeStringOrder(baseList, mine, theirs);
  }

  if (isPlainObject(mine) && isPlainObject(theirs) && (base == null || isPlainObject(base))) {
    const b = (base ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
      const merged = threeWayMerge(b[key], mine[key], theirs[key]);
      if (merged !== undefined) out[key] = merged;
    }
    return out;
  }

  return mine;
}

/**
 * Merges ordered string-ID lists (accountOrder, taskOrder, goalOrder):
 * keeps `mine` ordering, drops IDs removed by `theirs` (present in `base` but not `theirs`),
 * and appends any new IDs added in `theirs` that aren't already in `mine`.
 */
function mergeStringOrder(base: string[], mine: string[], theirs: string[]): string[] {
  const baseSet = new Set(base);
  const theirsSet = new Set(theirs);
  const deletedInTheirs = new Set(base.filter(id => !theirsSet.has(id)));
  const deletedInMine = new Set(base.filter(id => !mine.includes(id)));

  const keptFromMine = mine.filter(id => !deletedInTheirs.has(id));
  const keptSet = new Set(keptFromMine);

  for (const id of theirs) {
    if (!keptSet.has(id) && !deletedInMine.has(id) && !baseSet.has(id)) {
      keptFromMine.push(id);
      keptSet.add(id);
    }
  }
  return keptFromMine;
}

function mergeById(base: { id: string }[], mine: { id: string }[], theirs: { id: string }[]) {
  const baseById = new Map(base.map(item => [item.id, item]));
  const mineById = new Map(mine.map(item => [item.id, item]));
  const theirsIds = new Set(theirs.map(item => item.id));
  const result: { id: string }[] = [];

  for (const theirItem of theirs) {
    const baseItem = baseById.get(theirItem.id);
    const myItem = mineById.get(theirItem.id);
    if (baseItem && !myItem) continue;                                  // I deleted it
    if (myItem && !same(myItem, baseItem)) {                            // I added or edited it
      result.push(baseItem ? threeWayMerge(baseItem, myItem, theirItem) as { id: string } : myItem);
    } else {
      result.push(theirItem);                                           // untouched here
    }
  }

  for (const myItem of mine) {                                          // my additions that they don't have
    if (theirsIds.has(myItem.id)) continue;
    const baseItem = baseById.get(myItem.id);
    if (!baseItem || !same(myItem, baseItem)) result.push(myItem);      // new here, or edited here though deleted there
  }
  return result;
}
