jest.mock('../src/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
jest.mock('../src/host', () => ({ promptForPassword: jest.fn().mockResolvedValue('typed-code'), showWarningMessage: jest.fn() }));
const { Client } = require('ssh2');
const { createRemoteIfNoneExist, hashOption, removeRemoteFs } = require('../src/core/remoteFs');
afterEach(() => jest.restoreAllMocks());

test('answers typed at a keyboard-interactive prompt do not alter the configured interactiveAuth array', async () => {
  jest.spyOn(Client.prototype, 'sftp').mockImplementation(cb => cb(null, {}));
  jest.spyOn(Client.prototype, 'end').mockReturnThis();
  let finished;
  jest.spyOn(Client.prototype, 'connect').mockImplementation(function (options) {
    // The server asks two questions; the first is answered from the configuration.
    options.hostVerifier(Buffer.from('key'), () => undefined);
    this.emit('keyboard-interactive', 'name', 'instructions', '', [{ prompt: 'Password:' }, { prompt: 'Code:' }],
      answers => { finished = answers; this.emit('ready'); });
    return this;
  });
  const configured = ['configured-password'];
  const option = { host: 'interactive-test', port: 22, username: 'u', protocol: 'sftp', remoteTimeOffsetInHours: 0,
    interactiveAuth: configured, hostFingerprint: 'SHA256:' + 'A'.repeat(43) };
  const before = hashOption(option);
  await createRemoteIfNoneExist(option);
  expect(finished).toEqual(['configured-password', 'typed-code']);
  expect(configured).toEqual(['configured-password']);
  expect(hashOption(option)).toBe(before);
  removeRemoteFs(option);
});
