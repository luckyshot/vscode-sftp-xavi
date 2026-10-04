jest.mock('../src/logger', () => ({ __esModule: true, default: { warn: jest.fn() } }));
jest.mock('../src/core/remoteFs', () => ({ hashOption: x => x.host, retainRemoteFs: jest.fn(), releaseRemoteFs: jest.fn(), createRemoteIfNoneExist: jest.fn().mockResolvedValue({}) }));
const FileService = require('../src/core/fileService').default;
const remote = require('../src/core/remoteFs');
beforeEach(() => jest.clearAllMocks());
test('disposal never validates configuration and releases all acquired profiles exactly once', async () => {
  const service = new FileService('/local', '/local', {});
  await service.getRemoteFileSystem({ host: 'profile-a' });
  await service.getRemoteFileSystem({ host: 'profile-a' });
  await service.getRemoteFileSystem({ host: 'profile-b' });
  jest.spyOn(service, 'getConfig').mockImplementation(() => { throw new Error('invalid config'); });
  service.dispose(); service.dispose();
  expect(service.getConfig).not.toHaveBeenCalled();
  expect(remote.retainRemoteFs).toHaveBeenCalledTimes(2);
  expect(remote.releaseRemoteFs.mock.calls.map(([x]) => x.host)).toEqual(['profile-a', 'profile-b']);
  await expect(service.getRemoteFileSystem({ host: 'profile-c' })).rejects.toThrow('disposed');
});
