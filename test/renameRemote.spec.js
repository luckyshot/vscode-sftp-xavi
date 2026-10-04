jest.mock('../src/fileHandlers/createFileHandler', () => ({ __esModule: true, default: option => option }));
jest.mock('../src/core', () => ({
  fileOperations: { rename: jest.fn().mockResolvedValue() },
  upath: jest.requireActual('../src/core/upath').default,
}));
jest.mock('../src/helper', () => ({ toRemotePath: jest.requireActual('../src/helper/paths').toRemotePath }));
jest.mock('../src/host', () => ({ getWorkspaceFolders: () => [], pathRelativeToWorkspace: p => p }));
const path = require('path');
const { fileOperations } = require('../src/core');
const { renameRemote } = require('../src/fileHandlers/rename');

test('renames the remote counterpart of the old file to the remote counterpart of the new one', async () => {
  const remoteFs = {};
  const context = {
    fileService: { baseDir: path.resolve('/work/site'), getRemoteFileSystem: jest.fn().mockResolvedValue(remoteFs) },
    config: { remotePath: '/var/www' },
    target: { localFsPath: path.resolve('/work/site/old.php'), remoteFsPath: '/var/www/old.php' },
  };
  await renameRemote.handle.call(context, { newLocalPath: path.resolve('/work/site/sub/new.php') });
  expect(fileOperations.rename).toHaveBeenCalledWith('/var/www/old.php', '/var/www/sub/new.php', remoteFs);
});
