export default async function mapConcurrent<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0, failed = false, failure: unknown;
  const worker = async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try { results[index] = await work(items[index]); }
      catch (error) { failed = true; failure = error; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failed) throw failure;
  return results;
}
