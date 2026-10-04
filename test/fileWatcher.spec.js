jest.mock('vscode', () => ({ RelativePattern: function () {}, workspace: { createFileSystemWatcher: jest.fn() } }));
jest.mock('../src/helper', () => ({ isValidFile: () => true, fileDepth: p => p.split('/').length }));
jest.mock('../src/logger', () => ({ __esModule: true, default: { info: jest.fn(), error: jest.fn() } }));
jest.mock('../src/fileHandlers', () => ({ upload: jest.fn().mockResolvedValue(), removeRemote: jest.fn().mockResolvedValue() }));
jest.mock('../src/app', () => ({ __esModule: true, default: { sftpBarItem: { updateStatus: jest.fn() } } }));
jest.mock('../src/modules/serviceManager', () => ({ getRunningTransformTasks: () => [] }));
const vscode = require('vscode');
const { upload, removeRemote } = require('../src/fileHandlers');
const watchers = require('../src/modules/fileWatcher').default;
let onChange, onDelete;
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  vscode.workspace.createFileSystemWatcher.mockReturnValue({ onDidCreate: jest.fn(), onDidChange: fn => { onChange = fn; }, onDidDelete: fn => { onDelete = fn; }, dispose: jest.fn() });
  watchers.create('/local', { files: '**/*', autoUpload: true, autoDelete: true });
});
afterEach(() => { watchers.dispose('/local'); jest.useRealTimers(); });
test('deduplicates distinct URI objects for the same file', async () => {
  onChange({ fsPath: '/local/a' }); onChange({ fsPath: '/local/a' }); onChange({ fsPath: '/local/a' });
  await jest.advanceTimersByTimeAsync(550);
  expect(upload).toHaveBeenCalledTimes(1);
});
test('a delete supersedes a pending upload for the same path', async () => {
  onChange({ fsPath: '/local/a' }); onDelete({ fsPath: '/local/a' });
  await jest.advanceTimersByTimeAsync(550);
  expect(upload).not.toHaveBeenCalled();
  expect(removeRemote).toHaveBeenCalledTimes(1);
});
