jest.mock('../src/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn() } }));
jest.mock('../src/host', () => ({ getOpenTextDocuments: () => [], getUserSetting: () => ({}) }));
const { sync } = require('../src/fileHandlers/transfer/transfer');
const { FileType } = require('../src/core/fs/fileSystem');
const { filesystem, entry, config } = require('./helper/transferMocks');
test('sync preserves symlink type and transfers the link rather than reading its contents', async () => {
  const src = filesystem([entry('/local/link', 1000, FileType.SymbolicLink)]), dst = filesystem(), tasks = [];
  src.readlink.mockResolvedValue('ordinary-target');
  await sync(config(src, dst), t => tasks.push(t));
  expect(tasks[0].fileType).toBe(FileType.SymbolicLink);
  await tasks[0].run();
  expect(dst.symlink).toHaveBeenCalledWith('ordinary-target', '/remote/link');
  expect(src.get).not.toHaveBeenCalled();
});
test('sync never uploads configuration through an innocent-looking symlink', async () => {
  const fs = require('fs/promises'), os = require('os'), path = require('path');
  const localFs = require('../src/core/localFs').default;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sftp-symlink-test-'));
  try {
    await fs.mkdir(path.join(root, '.vscode'));
    await fs.writeFile(path.join(root, '.vscode/sftp.json'), 'CONFIG_PASSWORD_SECRET');
    await fs.symlink('.vscode/sftp.json', path.join(root, 'innocent-link'));
    const dst = filesystem(), tasks = [];
    await sync({ ...config(localFs, dst, { ignore: p => p.endsWith('/.vscode/sftp.json') }), srcFsPath: root }, t => tasks.push(t));
    await Promise.all(tasks.map(t => t.run()));
    expect(dst.put).not.toHaveBeenCalled();
    expect(dst.symlink).not.toHaveBeenCalled();
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
