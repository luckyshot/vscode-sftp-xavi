jest.mock('../src/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn() } }));
jest.mock('../src/host', () => ({ getOpenTextDocuments: () => [], getUserSetting: () => ({}) }));
const { sync, TransferDirection } = require('../src/fileHandlers/transfer/transfer');
const { FileType } = require('../src/core/fs/fileSystem');
const { entry, filesystem, config } = require('./helper/transferMocks');

test('reads newer remote files remotely and writes them locally', async () => {
  const local = filesystem([entry('/local/a', 1000)]), remote = filesystem([entry('/remote/a', 2000)]), tasks = [];
  await sync(config(local, remote, { bothDiretions: true }), t => tasks.push(t));
  expect(tasks[0].transferType).toBe(TransferDirection.REMOTE_TO_LOCAL);
  await tasks[0].run();
  expect(remote.get).toHaveBeenCalledWith('/remote/a');
  expect(local.open).toHaveBeenCalledWith('/local/a', 'w');
  expect(local.get).not.toHaveBeenCalled();
  expect(remote.open).not.toHaveBeenCalled();
});

test('downloads remote-only directories and their files through the remote filesystem', async () => {
  const local = filesystem(), remote = filesystem(), tasks = [];
  remote.list.mockImplementation(async p => p === '/remote' ? [entry('/remote/d', 1000, FileType.Directory)] : [entry('/remote/d/a')]);
  await sync(config(local, remote, { bothDiretions: true }), t => tasks.push(t));
  expect(remote.list.mock.calls).toEqual([['/remote'], ['/remote/d']]);
  expect(local.ensureDir).toHaveBeenCalledWith('/local/d');
  expect(tasks).toHaveLength(1);
  expect(tasks[0].transferType).toBe(TransferDirection.REMOTE_TO_LOCAL);
  await tasks[0].run();
  expect(remote.get).toHaveBeenCalledWith('/remote/d/a');
  expect(local.open).toHaveBeenCalledWith('/local/d/a', 'w');
});
