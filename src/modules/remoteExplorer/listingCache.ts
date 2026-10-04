interface Entry<T> {
  at: number;
  value: T;
}

/** Small TTL cache keyed by path. Invalidation can target a whole subtree. */
export default class ListingCache<T> {
  private _entries = new Map<string, Entry<T>>();

  constructor(private readonly _ttlMs: number, private readonly _now: () => number = Date.now) {}

  get(key: string): T | undefined {
    const entry = this._entries.get(key);
    if (!entry) return undefined;
    if (this._now() - entry.at > this._ttlMs) {
      this._entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T) {
    this._entries.set(key, { at: this._now(), value });
  }

  /** Drop `key` and every key below it (keys are '/'-separated paths). */
  invalidate(key: string) {
    const prefix = key.endsWith('/') ? key : key + '/';
    for (const k of this._entries.keys()) {
      if (k === key || k.startsWith(prefix)) this._entries.delete(k);
    }
  }

  clear() {
    this._entries.clear();
  }
}
