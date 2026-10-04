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
