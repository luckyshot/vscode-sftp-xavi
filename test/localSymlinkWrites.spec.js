const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const localFs = require('../src/core/localFs').default;
const TransferTask = require('../src/core/transferTask').default;
const { FileType } = require('../src/core/fs');
const { TransferDirection } = require('../src/core/transferTask');

let root;
beforeEach(async () => { root = await fsp.mkdtemp(path.join(os.tmpdir(), 'sftp-symlink-test-')); });
afterEach(() => fsp.rm(root, { recursive: true, force: true }));

test('opening a path that is a symlink for writing is refused and the link target is untouched', async () => {
  const victim = path.join(root, 'victim');
  const link = path.join(root, 'link');
  await fsp.writeFile(victim, 'precious');
  await fsp.symlink(victim, link);
  await expect(localFs.open(link, 'w')).rejects.toMatchObject({ code: 'ELOOP', message: expect.stringContaining('symbolic link') });
  expect(await fsp.readFile(victim, 'utf8')).toBe('precious');
});

test('regular files are still created and truncated, and symlinked directories still work', async () => {
  const dir = path.join(root, 'real');
  await fsp.mkdir(dir);
  await fsp.symlink(dir, path.join(root, 'dirlink'));
  const file = path.join(root, 'dirlink', 'f.txt');
  await localFs.close(await localFs.open(file, 'w', 0o600));
  await fsp.writeFile(file, 'old content');
  await localFs.close(await localFs.open(file, 'w'));
  expect(await fsp.readFile(path.join(dir, 'f.txt'), 'utf8')).toBe('');
});

test('a download over a planted symlink fails instead of overwriting what it points to', async () => {
  const victim = path.join(root, 'victim');
  const remote = path.join(root, 'remote-file');
  const link = path.join(root, 'planted');
  await fsp.writeFile(victim, 'precious');
  await fsp.writeFile(remote, 'attacker content');
  await fsp.symlink(victim, link);
  const task = new TransferTask(
    { fsPath: remote, fileSystem: localFs },
    { fsPath: link, fileSystem: localFs },
    { fileType: FileType.File, transferDirection: TransferDirection.REMOTE_TO_LOCAL, transferOption: { perserveTargetMode: false } }
  );
  await expect(task.run()).rejects.toMatchObject({ code: 'ELOOP' });
  expect(await fsp.readFile(victim, 'utf8')).toBe('precious');
});
