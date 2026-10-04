jest.mock('vscode', () => ({ window: { showQuickPick: jest.fn() } }));
jest.mock('../src/modules/serviceManager', () => ({ getFileService: jest.fn() }));
jest.mock('../src/fileHandlers', () => ({ uploadFile: jest.fn(), renameRemote: jest.fn(), removeRemote: jest.fn() }));
jest.mock('../src/modules/git', () => ({
  getGitService: jest.fn(),
  Status: { INDEX_MODIFIED: 0, INDEX_ADDED: 1, INDEX_DELETED: 2, INDEX_RENAMED: 3, MODIFIED: 5, DELETED: 6, UNTRACKED: 7 },
}));
jest.mock('../src/commands/abstract/createCommand', () => ({ checkCommand: option => option }));
jest.mock('../src/logger', () => ({ __esModule: true, default: { log: jest.fn(), error: jest.fn() } }));
jest.mock('../src/helper', () => ({ simplifyPath: path => path }));

const { getFileService } = require('../src/modules/serviceManager');
const { getGitService } = require('../src/modules/git');
const { uploadFile, renameRemote, removeRemote } = require('../src/fileHandlers');
const logger = require('../src/logger').default;
const command = require('../src/commands/commandUploadChangedFiles').default;

function change(fsPath, status = 0) {
  const uri = { fsPath };
  return { uri, originalUri: uri, renameUri: { fsPath: `${fsPath}.renamed` }, status };
}
function repository(changes) {
  getGitService.mockReturnValue({ repositories: [{ state: { indexChanges: changes, workingTreeChanges: [] } }] });
}
beforeEach(() => {
  jest.clearAllMocks();
  getFileService.mockReturnValue({ getConfig: () => ({ ignore: path => path.endsWith('package.json') || path.includes('/docs/') }) });
  uploadFile.mockResolvedValue(); renameRemote.mockResolvedValue(); removeRemote.mockResolvedValue();
});

test('ignored root and directory changes are excluded from every operation and the summary', async () => {
  const kept = change('/site/index.php');
  repository([kept, ...[0, 1, 2, 3].map(status => change('/site/package.json', status)), change('/site/docs/guide.md')]);
  await command.handleCommand();
  expect(uploadFile).toHaveBeenCalledTimes(1);
  expect(uploadFile).toHaveBeenCalledWith(kept.uri);
  expect(renameRemote).not.toHaveBeenCalled();
  expect(removeRemote).not.toHaveBeenCalled();
  expect(logger.log.mock.calls.flat().join('\n')).not.toMatch(/package\.json|guide\.md/);
});

test('the command and summary wait for an outstanding upload', async () => {
  let finish;
  uploadFile.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  repository([change('/site/index.php')]);
  let done = false;
  const pending = command.handleCommand().then(() => { done = true; });
  await new Promise(setImmediate);
  expect(done).toBe(false);
  expect(logger.log).not.toHaveBeenCalled();
  finish();
  await pending;
  expect(logger.log).toHaveBeenCalledWith('------ Upload Changed Files Result ------');
});

test.each([
  [0, uploadFile, 'Upload failed.'],
  [3, renameRemote, 'Rename failed.'],
  [2, removeRemote, 'Deletion failed.'],
])('asynchronous operation failures are caught for status %s', async (status, handler, message) => {
  const error = new Error('connection failed');
  handler.mockRejectedValue(error);
  repository([change('/site/index.php', status)]);
  await command.handleCommand();
  expect(logger.error).toHaveBeenCalledWith(message, error);
});
