jest.mock('../src/core', () => ({ upath: jest.requireActual('upath') }));
jest.mock('../src/host', () => ({ pathRelativeToWorkspace: jest.fn(), getWorkspaceFolders: jest.fn() }));

const fs = require('fs');
const { toRemotePath, toLocalPath } = require('../src/helper/paths');

test('maps local string paths into the remote root without filesystem access', () => {
  const realpath = jest.spyOn(fs.realpathSync, 'native');
  expect(toRemotePath('/workspace/site/assets/test.css', '/workspace/site', '/www')).toBe('/www/assets/test.css');
  expect(toRemotePath('/workspace/site/new.txt', '/workspace/site', '/')).toBe('/new.txt');
  expect(toRemotePath('/workspace/site', '/workspace/site', '/www')).toBe('/www');
  expect(realpath).not.toHaveBeenCalled();
  realpath.mockRestore();
});

test('maps remote files back to the workspace', () => {
  expect(toLocalPath('/www/assets/test.css', '/www', '/workspace/site')).toBe('/workspace/site/assets/test.css');
});

test('maps Windows drive and UNC paths with forward slashes remotely', () => {
  jest.doMock('path', () => jest.requireActual('path').win32);
  jest.isolateModules(() => {
    const paths = require('../src/helper/paths');
    expect(paths.toRemotePath('C:\\site\\assets\\test.css', 'C:\\site', '/www')).toBe('/www/assets/test.css');
    expect(paths.toRemotePath('\\\\server\\share\\site\\test.php', '\\\\server\\share\\site', '/www')).toBe('/www/test.php');
  });
  jest.dontMock('path');
});
