jest.mock('../../src/app', () => ({
  __esModule: true,
  default: { fsCache: { has: () => false }, state: {} },
}));
jest.mock('../../src/logger', () => ({ __esModule: true, default: { warn: jest.fn() } }));

function serviceIgnore(baseDir, remotePath, patterns, windows = false) {
  let ignore;
  if (windows) jest.doMock('path', () => jest.requireActual('path').win32);
  else jest.dontMock('path');
  jest.isolateModules(() => {
    const FileService = require('../../src/core/fileService').default;
    ignore = FileService.prototype._createIgnoreFn.call({ baseDir }, { remotePath, ignore: patterns });
  });
  jest.dontMock('path');
  return ignore;
}

describe('transfer ignore rules', () => {
  test('Windows drive casing does not bypass root or directory ignore patterns', () => {
    const ignore = serviceIgnore('c:\\site', '/www', ['**/package.json', '**/package-lock.json', 'docs/**'], true);
    expect(ignore('C:\\site\\package.json')).toBe(true);
    expect(ignore('C:\\site\\package-lock.json')).toBe(true);
    expect(ignore('C:\\site\\docs\\guide.md')).toBe(true);
    expect(ignore('C:\\site\\index.php')).toBe(false);
  });

  test('UNC server and directory casing do not bypass ignore patterns', () => {
    const ignore = serviceIgnore('\\\\pc_test\\share\\site', '/www', ['**/package.json'], true);
    expect(ignore('\\\\Pc_test\\share\\Site\\package.json')).toBe(true);
  });

  test('a remote root sharing the local prefix is still classified as remote', () => {
    const ignore = serviceIgnore('/project', '/project-remote', ['package.json']);
    expect(ignore('/project-remote/package.json')).toBe(true);
  });

  test('root selection stays transferable and Git ignore negation works', () => {
    const ignore = serviceIgnore('/site', '/www', ['*.log', '!keep.log']);
    expect(ignore('/site')).toBe(false);
    expect(ignore('/www')).toBe(false);
    expect(ignore('/site/debug.log')).toBe(true);
    expect(ignore('/site/keep.log')).toBe(false);
    expect(ignore('/www/debug.log')).toBe(true);
    expect(ignore('/site/app.js')).toBe(false);
  });
});


test.each([{ patterns: [] }, { patterns: ['!**/.vscode/sftp.json'] }])('SFTP configuration stays excluded with ignore rules %p', ({ patterns }) => {
  const ignore = serviceIgnore('/site', '/www', patterns);
  expect(typeof ignore).toBe('function');
  expect(ignore('/site/.vscode/sftp.json')).toBe(true);
  expect(ignore('/site/nested/.vscode/sftp.json')).toBe(true);
  expect(ignore('/www/.vscode/sftp.json')).toBe(true);
  expect(ignore('/site/.vscode/settings.json')).toBe(false);
  expect(ignore('/site/sftp.json')).toBe(false);
});
