/**
 * Maps `items` through an async `fn`, running at most `limit` calls at a time, and returns results in input order.
 * Banks rate limit hard (often ~4 unattended fetches a day), so one connection's account requests are throttled
 * instead of fired all at once. Rejects with the first error, like Promise.all.
 */
export async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed) {
      const index = next++;
      if (index >= items.length) return;
      try {
        results[index] = await fn(items[index], index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  const workers = Array.from({ length: Math.max(1, Math.min(Math.floor(limit) || 1, items.length)) }, worker);
  await Promise.all(workers);
  return results;
}
