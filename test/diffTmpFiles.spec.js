jest.mock('../src/fileHandlers/createFileHandler', () => ({ __esModule: true, default: option => option }));
jest.mock('../src/logger', () => ({ __esModule: true, default: { warn: jest.fn() } }));
jest.mock('../src/core', () => ({ fileOperations: { transferFile: jest.fn() } }));
jest.mock('../src/host', () => ({ diffFiles: jest.fn(), onDidCloseTextDocument: jest.fn() }));
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fileOperations } = require('../src/core');
const host = require('../src/host');
const { diff, removeAllDiffTmpFiles } = require('../src/fileHandlers/diff');

const context = () => ({
  fileService: { name: 'srv', getRemoteFileSystem: async () => ({}), getLocalFileSystem: () => ({}) },
  config: {},
  target: { localFsPath: '/work/a.txt', remoteFsPath: '/var/www/a.txt' },
});
let closeListener, disposed, tmpPath;
beforeEach(() => {
  closeListener = undefined; disposed = false;
  fileOperations.transferFile.mockReset().mockImplementation(async (_src, tmp) => { tmpPath = tmp; fs.writeFileSync(tmp, 'remote secrets'); });
  host.diffFiles.mockReset().mockResolvedValue();
  host.onDidCloseTextDocument.mockReset().mockImplementation(listener => { closeListener = listener; return { dispose: () => { disposed = true; } }; });
});
afterEach(() => removeAllDiffTmpFiles());

test('the downloaded copy is deleted when its diff document is closed', async () => {
  await diff.handle.call(context());
  expect(fs.existsSync(tmpPath)).toBe(true);
  closeListener({ uri: { fsPath: path.join(os.tmpdir(), 'other-file') } });
  expect(fs.existsSync(tmpPath)).toBe(true);
  closeListener({ uri: { fsPath: tmpPath } });
  expect(disposed).toBe(true);
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(fs.existsSync(tmpPath)).toBe(false);
});

test('the copy is deleted straight away when the download or the diff fails', async () => {
  host.diffFiles.mockRejectedValue(new Error('cannot open diff'));
  await expect(diff.handle.call(context())).rejects.toThrow('cannot open diff');
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(fs.existsSync(tmpPath)).toBe(false);
});

test('copies still open when the extension deactivates are removed', async () => {
  await diff.handle.call(context());
  removeAllDiffTmpFiles();
  expect(fs.existsSync(tmpPath)).toBe(false);
});
