jest.mock('../src/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn() } }));
jest.mock('../src/host', () => ({ getOpenTextDocuments: () => [], getUserSetting: () => ({}) }));
const { transfer, sync, TransferDirection } = require('../src/fileHandlers/transfer/transfer');
const { FileType } = require('../src/core/fs/fileSystem');
const { entryPath } = require('../src/core/entryPath');
const { filesystem, entry, config } = require('./helper/transferMocks');
const path = require('path');
test.each(['../../outside', '..\\outside', '.', '..', '/outside', 'C:outside', 'bad\0name'])('rejects unsafe remote name %p before collecting downloads', async name => {
  const src = filesystem([{ ...entry('/outside'), name }]), dst = filesystem(), collect = jest.fn();
  src.lstat.mockResolvedValue({ type: FileType.Directory, mode: 0o755 });
  await expect(transfer({ ...config(src, dst), transferDirection: TransferDirection.REMOTE_TO_LOCAL }, collect)).rejects.toThrow('Unsafe directory entry');
  expect(collect).not.toHaveBeenCalled();
});
test('validates destination listings before sync deletion', async () => {
  const src = filesystem(), dst = filesystem([{ ...entry('/outside'), name: 'innocent' }]);
  await expect(sync(config(src, dst, { delete: true }), () => {})).rejects.toThrow('does not match');
  expect(dst.unlink).not.toHaveBeenCalled();
});
test('joins safe names on POSIX and Windows', () => {
  expect(entryPath(path.posix, '/site', 'a.txt')).toBe('/site/a.txt');
  expect(entryPath(path.win32, 'C:\\site', 'a.txt')).toBe('C:\\site\\a.txt');
});
