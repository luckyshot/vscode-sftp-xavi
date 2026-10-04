jest.mock('../src/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn() } }));
jest.mock('../src/host', () => ({ getOpenTextDocuments: () => [], getUserSetting: () => ({}) }));
const { transfer } = require('../src/fileHandlers/transfer/transfer');
const { FileType } = require('../src/core/fs/fileSystem');
const { filesystem, entry, config } = require('./helper/transferMocks');
test.each([undefined, 600])('new folder-upload files use their own permissions or configured override %p', async filePerm => {
  const plain = entry('/local/plain'), executable = { ...entry('/local/run'), mode: 0o750 };
  const src = filesystem([plain, executable]), dst = filesystem(), tasks = [];
  src.lstat.mockImplementation(async p => p === '/local' ? entry(p, 1000, FileType.Directory) : p.endsWith('run') ? executable : plain);
  dst.lstat.mockRejectedValue(Object.assign(new Error('missing'), { code: 2 }));
  await transfer({ ...config(src, dst, { perserveTargetMode: true }), filePerm }, t => tasks.push(t));
  await Promise.all(tasks.map(t => t.run()));
  expect(dst.put.mock.calls.map(([, p, options]) => [p, options.mode]).sort()).toEqual([
    ['/remote/plain', filePerm ? 0o600 : 0o644], ['/remote/run', filePerm ? 0o600 : 0o750],
  ]);
});
