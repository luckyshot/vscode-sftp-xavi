jest.mock('../src/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn() } }));
const TransferTask = require('../src/core/transferTask').default;
const { FileType } = require('../src/core/fs/fileSystem');
const { filesystem } = require('./helper/transferMocks');
const task = (srcFs, targetFs, opts = {}) => new TransferTask({ fsPath: '/local/a', fileSystem: srcFs }, { fsPath: '/remote/a', fileSystem: targetFs }, { fileType: FileType.File, transferDirection: 'local ➞ remote', transferOption: { perserveTargetMode: false, ...opts } });

test('source open failure never opens or truncates the destination', async () => {
  const src = filesystem(), dst = filesystem();
  src.get.mockRejectedValue(new Error('read failed'));
  await expect(task(src, dst).run()).rejects.toThrow('read failed');
  expect(dst.open).not.toHaveBeenCalled();
});
test('failed destination open destroys the source', async () => {
  const src = filesystem(), dst = filesystem();
  const stream = await src.get();
  src.get.mockResolvedValue(stream);
  dst.open.mockRejectedValue(new Error('open failed'));
  await expect(task(src, dst).run()).rejects.toThrow('open failed');
  expect(stream.destroyed).toBe(true);
  expect(dst.close).not.toHaveBeenCalled();
});
test('failed writes close even a zero-valued destination descriptor', async () => {
  const src = filesystem(), dst = filesystem();
  dst.open.mockResolvedValue(0);
  dst.put.mockRejectedValue(new Error('write failed'));
  await expect(task(src, dst).run()).rejects.toThrow('write failed');
  expect(dst.close).toHaveBeenCalledWith(0);
});
test('local reads reject missing files before handing a stream to a transfer', async () => {
  const localFs = require('../src/core/localFs').default;
  await expect(localFs.get('/private/tmp/sftp-xavi-review-missing/source')).rejects.toMatchObject({ code: 'ENOENT' });
});

test('uses unique temporary files, closes before replacement, and leaves .new untouched', async () => {
  const src = filesystem(), dst = filesystem();
  await Promise.all([task(src, dst, { useTempFile: true }).run(), task(src, dst, { useTempFile: true }).run()]);
  const paths = dst.open.mock.calls.map(([p]) => p);
  expect(new Set(paths).size).toBe(2);
  expect(paths.every(p => p.startsWith('/remote/a.sftp-xavi-') && p.endsWith('.tmp'))).toBe(true);
  expect(dst.open.mock.calls.every(([, flags]) => flags === 'wx')).toBe(true);
  expect(dst.unlink).not.toHaveBeenCalledWith('/remote/a');
  expect(dst.unlink).not.toHaveBeenCalledWith('/remote/a.new');
  expect(dst.close.mock.invocationCallOrder[0]).toBeLessThan(dst.renameAtomic.mock.invocationCallOrder[0]);
});
test('restores the original when non-atomic replacement fails', async () => {
  const src = filesystem(), dst = filesystem();
  dst.renameAtomic.mockRejectedValue(Object.assign(new Error('unsupported'), { code: 8 }));
  dst.rename.mockImplementation(async from => { if (from.endsWith('.tmp')) throw new Error('rename failed'); });
  await expect(task(src, dst, { useTempFile: true }).run()).rejects.toThrow('rename failed');
  const backup = dst.rename.mock.calls[0][1];
  expect(dst.rename.mock.calls[0][0]).toBe('/remote/a');
  expect(dst.rename).toHaveBeenLastCalledWith(backup, '/remote/a');
  expect(dst.unlink).not.toHaveBeenCalledWith('/remote/a');
  expect(dst.unlink).not.toHaveBeenCalledWith(backup);
});
test('atomic-only failures preserve the original without fallback', async () => {
  const src = filesystem(), dst = filesystem();
  dst.renameAtomic.mockRejectedValue(new Error('rename failed'));
  await expect(task(src, dst, { useTempFile: true, openSsh: true }).run()).rejects.toThrow('rename failed');
  expect(dst.rename).not.toHaveBeenCalled();
  expect(dst.unlink).not.toHaveBeenCalledWith('/remote/a');
});
