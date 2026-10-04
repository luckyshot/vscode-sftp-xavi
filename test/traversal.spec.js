jest.mock('../src/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn() } }));
jest.mock('../src/host', () => ({ getOpenTextDocuments: () => [], getUserSetting: () => ({}) }));
const fs = require('fs');
const localFs = require('../src/core/localFs').default;
const { transfer } = require('../src/fileHandlers/transfer/transfer');
const { FileType } = require('../src/core/fs/fileSystem');
const { entry, filesystem, config } = require('./helper/transferMocks');
afterEach(() => jest.restoreAllMocks());

test('bounds metadata reads in large local directories', async () => {
  let active = 0, peak = 0;
  jest.spyOn(fs, 'readdir').mockImplementation((dir, cb) => cb(null, Array.from({ length: 100 }, (_, i) => String(i))));
  jest.spyOn(fs, 'lstat').mockImplementation((p, cb) => {
    peak = Math.max(peak, ++active);
    setImmediate(() => { active--; cb(null, { isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false, size: 1, mode: 0o644, mtime: new Date(), atime: new Date() }); });
  });
  expect(await localFs.list('/local')).toHaveLength(100);
  expect(peak).toBeLessThanOrEqual(16);
  expect(peak).toBeGreaterThan(1);
});
test('directory discovery cannot grow its concurrency with tree depth', async () => {
  let active = 0, peak = 0;
  const src = filesystem(), dst = filesystem();
  src.lstat.mockResolvedValue(entry('/local', 1000, FileType.Directory));
  src.list.mockImplementation(async p => {
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    return p.split('/').length < 5 ? ['a', 'b'].map(n => entry(`${p}/${n}`, 1000, FileType.Directory)) : [entry(`${p}/file`)];
  });
  const collect = jest.fn();
  await transfer(config(src, dst), collect);
  expect(collect).toHaveBeenCalledTimes(8);
  expect(peak).toBe(1);
});
