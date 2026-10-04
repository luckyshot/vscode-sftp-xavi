jest.mock('../../src/app', () => ({
  __esModule: true,
  default: { fsCache: new (require('lru-cache').LRUCache)({ max: 6 }), state: {} },
}));
jest.mock('../../src/logger', () => ({ __esModule: true, default: { warn: jest.fn() } }));

const fs = require('fs');
const app = require('../../src/app').default;
const FileService = require('../../src/core/fileService').default;

function settings(overrides = {}) {
  return new FileService('/workspace', '/workspace', {
    protocol: 'sftp', host: 'site', username: 'user', remotePath: '/',
    sshConfigPath: '/workspace/ssh.conf', ignore: [], ...overrides,
  }).getConfig();
}

afterEach(() => { app.fsCache.clear(); jest.restoreAllMocks(); });

test('reads SSH host directives and preserves explicit connection options', () => {
  jest.spyOn(fs, 'readFileSync').mockReturnValue(
    'Host site\n  # Server settings\n  HostName example.com\n  Port 2222\n  User ssh-user\n  IdentityFile "/workspace/key with spaces"\n'
  );
  const config = settings();
  expect(config.host).toBe('example.com');
  expect(config.port).toBe(2222);
  expect(config.username).toBe('user');
  expect(config.privateKeyPath).toBe('/workspace/key with spaces');
  expect(settings({ port: 22 }).port).toBe(22);
  expect(fs.readFileSync).toHaveBeenCalledTimes(1);
});

test('a missing SSH host section retains the configured host and default port', () => {
  jest.spyOn(fs, 'readFileSync').mockReturnValue('Host other\n  HostName other.example.com\n');
  const config = settings();
  expect(config.host).toBe('site');
  expect(config.port).toBe(22);
});
