jest.mock('../src/logger', () => ({ __esModule: true, default: { warn: jest.fn() } }));
const { createFile } = require('../src/core/fileBaseOperations');
const { filesystem } = require('./helper/transferMocks');
test.each(['EACCES', 'ETIMEDOUT', 3, 4])('rejects stat error %p without opening or writing', async code => {
  const fs = filesystem();
  fs.lstat.mockRejectedValue(Object.assign(new Error('stat failed'), { code }));
  await expect(createFile('/file', fs, {})).rejects.toThrow('stat failed');
  expect(fs.open).not.toHaveBeenCalled();
});
test('exclusively creates a missing file and closes its handle', async () => {
  const fs = filesystem();
  fs.lstat.mockRejectedValue(Object.assign(new Error('missing'), { code: 2 }));
  await createFile('/file', fs, {});
  expect(fs.open).toHaveBeenCalledWith('/file', 'wx');
  expect(fs.close).toHaveBeenCalledWith(1);
});
test('a file created between stat and open is preserved', async () => {
  const fsp = require('fs/promises'), path = require('path'), os = require('os');
  const localFs = require('../src/core/localFs').default;
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'sftp-create-test-'));
  const file = path.join(root, 'existing');
  try {
    const wrapper = Object.create(localFs);
    wrapper.lstat = async () => { await fsp.writeFile(file, 'original'); throw Object.assign(new Error('missing'), { code: 'ENOENT' }); };
    await expect(createFile(file, wrapper, {})).rejects.toMatchObject({ code: 'EEXIST' });
    expect(await fsp.readFile(file, 'utf8')).toBe('original');
  } finally { await fsp.rm(root, { recursive: true, force: true }); }
});
test('protocols without exclusive creation reject the operation before writing', async () => {
  const fs = filesystem();
  fs.supportsExclusiveCreation = false;
  await expect(createFile('/file', fs, {})).rejects.toThrow('safe exclusive file creation');
  expect(fs.open).not.toHaveBeenCalled();
});
