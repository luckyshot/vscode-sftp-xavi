jest.mock('../../src/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn() },
}));

const { Client } = require('ssh2');
const SSHClient = require('../../src/core/remote-client/sshClient').default;

const options = { host: 'example.com', port: 22, username: 'user', password: 'password' };

afterEach(() => jest.restoreAllMocks());

test.each(['close', 'end'])('connects without ending early and cleans up on %s', async event => {
  const end = jest.spyOn(Client.prototype, 'end').mockReturnThis();
  const connect = jest.spyOn(Client.prototype, 'connect').mockImplementation(function () {
    queueMicrotask(() => this.emit('ready'));
    return this;
  });
  const sftp = {};
  jest.spyOn(Client.prototype, 'sftp').mockImplementation(callback => callback(null, sftp));

  const client = new SSHClient(options);
  await client.connect(options, { askForPasswd: jest.fn() });

  expect(connect).toHaveBeenCalledWith(expect.objectContaining(options));
  expect(end).not.toHaveBeenCalled();
  expect(client.getFsClient()).toBe(sftp);

  // Use the real ssh2 EventEmitter to verify listener registration and binding.
  client._client.emit(event);
  expect(end).toHaveBeenCalledTimes(1);
  expect(end.mock.instances[0]).toBe(client._client);
});

test('always installs host-key verification even if configuration tries to override it', async () => {
  const connect = jest.spyOn(Client.prototype, 'connect').mockImplementation(function () { queueMicrotask(() => this.emit('ready')); return this; });
  jest.spyOn(Client.prototype, 'sftp').mockImplementation(cb => cb(null, {}));
  const { createHash } = require('crypto');
  const key = Buffer.from('server-key');
  const hostFingerprint = `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`;
  const override = jest.fn(() => true);
  await new SSHClient(options).connect({ ...options, hostFingerprint, hostVerifier: override }, { askForPasswd: jest.fn() });
  const verifier = connect.mock.calls[0][0].hostVerifier;
  expect(verifier).not.toBe(override);
  const check = buffer => new Promise(resolve => verifier(buffer, resolve));
  expect(await check(key)).toBe(true);
  expect(await check(Buffer.from('attacker'))).toBe(false);
});
