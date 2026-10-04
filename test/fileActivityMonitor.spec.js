jest.mock('vscode', () => ({
  Uri: { file: jest.fn(fsPath => ({ scheme: 'file', fsPath })) },
  workspace: { getWorkspaceFolder: jest.fn() },
}));
jest.mock('../src/app', () => ({
  __esModule: true,
  default: {
    fsCache: { has: jest.fn(), del: jest.fn() },
    sftpBarItem: { updateStatus: jest.fn() },
    remoteExplorer: { refresh: jest.fn() },
  },
}));
jest.mock('../src/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn() },
}));
jest.mock('../src/ui/statusBarItem', () => ({
  __esModule: true, default: { Status: { error: 'error' } },
}));
jest.mock('../src/host', () => ({
  onDidSaveTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
  onDidOpenTextDocument: jest.fn(),
  showConfirmMessage: jest.fn(),
}));
jest.mock('../src/modules/config', () => ({ readConfigsFromFile: jest.fn() }));
jest.mock('../src/modules/serviceManager', () => ({
  getFileService: jest.fn(), findAllFileService: jest.fn(),
  createFileService: jest.fn(), disposeFileService: jest.fn(),
}));
jest.mock('../src/helper', () => ({
  isValidFile: jest.fn(() => true), isInWorkspace: jest.fn(() => true),
  isConfigFile: jest.fn(() => false), reportError: jest.fn(),
}));
jest.mock('../src/fileHandlers', () => ({ uploadFile: jest.fn(), downloadFile: jest.fn() }));

const fs = require('fs');
const app = require('../src/app').default;
const logger = require('../src/logger').default;
const host = require('../src/host');
const { getFileService } = require('../src/modules/serviceManager');
const { uploadFile } = require('../src/fileHandlers');
const monitor = require('../src/modules/fileActivityMonitor').default;

let onSave;
let realpath;
beforeEach(() => {
  jest.clearAllMocks();
  realpath = jest.spyOn(fs.realpathSync, 'native');
  monitor.init();
  onSave = host.onDidSaveTextDocument.mock.calls.slice(-1)[0][0];
});
afterEach(() => { monitor.destory(); realpath.mockRestore(); });

async function save(uri, config = { uploadOnSave: true }) {
  getFileService.mockImplementation(candidate => candidate === uri ? { getConfig: () => config } : undefined);
  uploadFile.mockImplementation(async candidate => {
    if (!getFileService(candidate)) throw new Error('Config Not Found');
  });
  onSave({ uri });
  await new Promise(setImmediate);
}

test.each([
  ['Windows drive casing', 'c:\\Projects\\site\\test.php', 'C:\\Projects\\Site\\test.php'],
  ['UNC server casing', '\\\\pc_test\\share\\site\\test.php', '\\\\Pc_test\\share\\site\\test.php'],
  ['symlinked workspace', '/workspace/site/test.php', '/physical/site/test.php'],
])('upload-on-save preserves the configured URI for %s', async (_name, fsPath, physicalPath) => {
  const uri = { scheme: 'file', fsPath };
  realpath.mockReturnValue(physicalPath);
  await save(uri);
  expect(uploadFile).toHaveBeenCalledWith(uri);
  expect(realpath).not.toHaveBeenCalled();
  expect(logger.error).not.toHaveBeenCalled();
});

test('saving does not upload when uploadOnSave is disabled', async () => {
  await save({ scheme: 'file', fsPath: '/workspace/test.php' }, { uploadOnSave: false });
  expect(uploadFile).not.toHaveBeenCalled();
});

test('upload failures update the error status and identify the operation correctly', async () => {
  const uri = { scheme: 'file', fsPath: '/workspace/test.php' };
  const error = new Error('connection failed');
  realpath.mockReturnValue(uri.fsPath);
  getFileService.mockReturnValue({ getConfig: () => ({ uploadOnSave: true }) });
  uploadFile.mockRejectedValue(error);
  onSave({ uri });
  await new Promise(setImmediate);
  expect(logger.error).toHaveBeenCalledWith(error, `upload ${uri.fsPath}`);
  expect(app.sftpBarItem.updateStatus).toHaveBeenCalledWith('error');
});
