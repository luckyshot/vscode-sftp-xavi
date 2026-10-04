const { SyncState, compareEntries, stateBadge } = require('../src/modules/remoteExplorer/syncState');
const ListingCache = require('../src/modules/remoteExplorer/listingCache').default;

const file = (size, mtime) => ({ isDirectory: false, size, mtime });
const dir = () => ({ isDirectory: true, size: 0, mtime: 0 });
const opts = { compareMtime: true };

describe('compareEntries', () => {
  test('missing sides', () => {
    expect(compareEntries(null, file(1, 0), opts).state).toBe(SyncState.RemoteOnly);
    expect(compareEntries(file(1, 0), null, opts).state).toBe(SyncState.LocalOnly);
    expect(compareEntries(null, null, opts).state).toBe(SyncState.Unknown);
  });

  test('same size and second-level mtime is identical', () => {
    expect(compareEntries(file(5, 1000), file(5, 1999), opts).state).toBe(SyncState.Same);
  });

  test('mtime difference reports which side is newer', () => {
    expect(compareEntries(file(5, 9000), file(5, 1000), opts)).toEqual({ state: SyncState.Modified, newer: 'local' });
    expect(compareEntries(file(5, 1000), file(5, 9000), opts)).toEqual({ state: SyncState.Modified, newer: 'remote' });
  });

  test('size difference is modified without a newer side when mtimes match', () => {
    expect(compareEntries(file(5, 1000), file(6, 1000), opts)).toEqual({ state: SyncState.Modified });
  });

  test('size-only mode ignores mtime', () => {
    expect(compareEntries(file(5, 1000), file(5, 9000), { compareMtime: false }).state).toBe(SyncState.Same);
    expect(compareEntries(file(5, 1000), file(6, 9000), { compareMtime: false })).toEqual({ state: SyncState.Modified });
  });

  test('type mismatch and folders', () => {
    expect(compareEntries(dir(), file(1, 0), opts).state).toBe(SyncState.TypeMismatch);
    expect(compareEntries(dir(), dir(), opts).state).toBe(SyncState.Same);
  });

  test('badges', () => {
    expect(stateBadge(SyncState.Modified)).toBe('M');
    expect(stateBadge(SyncState.Same)).toBeUndefined();
  });
});

describe('ListingCache', () => {
  test('expires entries after the ttl', () => {
    let now = 0;
    const cache = new ListingCache(100, () => now);
    cache.set('/a', 1);
    now = 100;
    expect(cache.get('/a')).toBe(1);
    now = 101;
    expect(cache.get('/a')).toBeUndefined();
  });

  test('invalidate drops a subtree but not siblings with a shared prefix', () => {
    const cache = new ListingCache(1000);
    cache.set('/a', 1);
    cache.set('/a/b', 2);
    cache.set('/ab', 3);
    cache.invalidate('/a');
    expect(cache.get('/a')).toBeUndefined();
    expect(cache.get('/a/b')).toBeUndefined();
    expect(cache.get('/ab')).toBe(3);
  });
});
