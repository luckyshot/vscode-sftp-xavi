jest.mock('../src/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn() } }));
jest.mock('../src/host', () => ({ getOpenTextDocuments: () => [], getUserSetting: () => ({}) }));
const { sync } = require('../src/fileHandlers/transfer/transfer');
const { entry, filesystem, config } = require('./helper/transferMocks');

test.each(['source', 'destination'])('aborts sync on %s listing errors without deleting or collecting transfers', async side => {
  const src = filesystem([entry('/local/a')]), dst = filesystem([entry('/remote/valuable')]);
  (side === 'source' ? src : dst).list.mockRejectedValue(new Error('permission denied'));
  const collect = jest.fn();
  await expect(sync(config(src, dst, { delete: true }), collect)).rejects.toThrow('permission denied');
  expect(dst.unlink).not.toHaveBeenCalled();
  expect(dst.rmdir).not.toHaveBeenCalled();
  expect(collect).not.toHaveBeenCalled();
});

test('waits for deletion and propagates failures', async () => {
  const src = filesystem(), dst = filesystem([entry('/remote/a')]);
  let rejectDelete;
  dst.unlink.mockImplementation(() => new Promise((_, reject) => { rejectDelete = reject; }));
  let finished = false;
  const result = sync(config(src, dst, { delete: true }), () => {}).finally(() => { finished = true; });
  const rejected = expect(result).rejects.toThrow('delete failed');
  await new Promise(resolve => setImmediate(resolve));
  expect(finished).toBe(false);
  rejectDelete(new Error('delete failed'));
  await rejected;
});

test('preserves ignored descendants and their parents while removing other children', async () => {
  const { FileType } = require('../src/core/fs/fileSystem');
  const src = filesystem(), dst = filesystem();
  dst.list.mockImplementation(async p => p === '/remote' ? [entry('/remote/assets', 1000, FileType.Directory)] : [entry('/remote/assets/keep.txt'), entry('/remote/assets/remove.txt')]);
  await sync(config(src, dst, { delete: true, ignore: p => p.endsWith('keep.txt') }), () => {});
  expect(dst.unlink.mock.calls).toEqual([['/remote/assets/remove.txt']]);
  expect(dst.rmdir).not.toHaveBeenCalled();
});

test('removes an unprotected directory only after visiting its children', async () => {
  const { FileType } = require('../src/core/fs/fileSystem');
  const src = filesystem(), dst = filesystem();
  dst.list.mockImplementation(async p => p === '/remote' ? [entry('/remote/assets', 1000, FileType.Directory)] : [entry('/remote/assets/a')]);
  await sync(config(src, dst, { delete: true }), () => {});
  expect(dst.unlink).toHaveBeenCalledWith('/remote/assets/a');
  expect(dst.rmdir).toHaveBeenCalledWith('/remote/assets', false);
});
