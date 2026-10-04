jest.mock('../src/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() } }));
const upath = require('../src/core/upath').default;
const FTPFileSystem = require('../src/core/fs/ftpFileSystem').default;

function connected() {
  const ftp = {};
  for (const name of ['list', 'get', 'put', 'delete', 'mkdir', 'rmdir', 'site', 'rename', 'setLastMod', 'abort']) {
    ftp[name] = jest.fn((...args) => args[args.length - 1](null, name === 'list' ? [] : undefined));
  }
  const fs = new FTPFileSystem(upath, { clientOption: {}, remoteTimeOffsetInHours: 0 });
  Object.defineProperty(fs, 'ftp', { get: () => ftp });
  return { fs, ftp };
}
const evil = '/site/a\r\nDELE /important';

test.each([
  ['list', fs => fs.list(evil)],
  ['get', fs => fs.get(evil)],
  ['put', fs => fs.put(require('stream').Readable.from([]), evil)],
  ['unlink', fs => fs.unlink(evil)],
  ['mkdir', fs => fs.mkdir(evil)],
  ['rmdir', fs => fs.rmdir(evil, false)],
  ['chmod', fs => fs.chmod(evil, 0o644)],
  ['rename source', fs => fs.rename(evil, '/site/b')],
  ['rename target', fs => fs.rename('/site/b', evil)],
  ['futimes', fs => fs.futimes({ path: evil }, 1, 1)],
])('%s refuses a path containing a line break before sending any command', async (_name, run) => {
  const { fs, ftp } = connected();
  await run(fs).catch(() => undefined);
  for (const fn of Object.values(ftp)) expect(fn).not.toHaveBeenCalled();
});

test('ordinary paths, including spaces and unicode, still reach the server', async () => {
  const { fs, ftp } = connected();
  await fs.unlink('/site/my file ñ.txt');
  expect(ftp.delete).toHaveBeenCalledWith('/site/my file ñ.txt', expect.any(Function));
});
