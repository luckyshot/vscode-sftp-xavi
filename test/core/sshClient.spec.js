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
  const { createHash } = require('crypto');
  const key = Buffer.from('server-key');
  const hostFingerprint = `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`;
  const override = jest.fn(() => true);
  const connect = jest.spyOn(Client.prototype, 'connect').mockImplementation(function (opts) {
    opts.hostVerifier(key, trusted => queueMicrotask(() => this.emit(trusted ? 'ready' : 'error', new Error('untrusted key'))));
    return this;
  });
  jest.spyOn(Client.prototype, 'sftp').mockImplementation(cb => cb(null, {}));
  await new SSHClient(options).connect({ ...options, hostFingerprint, hostVerifier: override }, { askForPasswd: jest.fn() });
  expect(connect.mock.calls[0][0].hostVerifier).not.toBe(override);
  expect(override).not.toHaveBeenCalled();
  await expect(new SSHClient(options).connect({ ...options, hostFingerprint: 'wrong' }, { askForPasswd: jest.fn() })).rejects.toThrow('untrusted key');
});

test('fingerprint confirmation can outlast the connection timeout and then complete', async () => {
  jest.useFakeTimers();
  try {
    const { configureHostKeyVerification } = require('../../src/core/hostKeyVerifier');
    const saved = new Map();
    let approve;
    configureHostKeyVerification({ get: key => saved.get(key), update: async (key, value) => { saved.set(key, value); } }, () => new Promise(resolve => { approve = resolve; }));
    jest.spyOn(Client.prototype, 'connect').mockImplementation(function (opts) {
      opts.hostVerifier(Buffer.from('new-key'), trusted => { if (trusted) this.emit('ready'); });
      return this;
    });
    jest.spyOn(Client.prototype, 'sftp').mockImplementation(cb => cb(null, {}));
    let completed = false;
    const result = new SSHClient(options).connect({ ...options, connectTimeout: 10000 }, { askForPasswd: jest.fn() }).then(() => { completed = true; });
    await jest.advanceTimersByTimeAsync(30000);
    expect(completed).toBe(false);
    approve(true);
    await result;
    expect(completed).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});
test('fingerprint confirmation has its own bounded deadline', async () => {
  jest.useFakeTimers();
  try {
    const { configureHostKeyVerification } = require('../../src/core/hostKeyVerifier');
    configureHostKeyVerification({ get: () => undefined, update: async () => {} }, () => new Promise(() => {}));
    jest.spyOn(Client.prototype, 'connect').mockImplementation(function (opts) { opts.hostVerifier(Buffer.from('timeout-key'), () => {}); return this; });
    const destroy = jest.spyOn(Client.prototype, 'destroy').mockReturnThis();
    const result = new SSHClient(options).connect({ ...options, connectTimeout: 10000 }, { askForPasswd: jest.fn() });
    const rejected = expect(result).rejects.toThrow('verifying SSH server fingerprint');
    await jest.advanceTimersByTimeAsync(120000);
    await rejected;
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

test('the configured deadline still bounds an unanswered SSH handshake', async () => {
  jest.useFakeTimers();
  try {
    jest.spyOn(Client.prototype, 'connect').mockReturnThis();
    const destroy = jest.spyOn(Client.prototype, 'destroy').mockReturnThis();
    const result = new SSHClient(options).connect({ ...options, connectTimeout: 10000 }, { askForPasswd: jest.fn() });
    const rejected = expect(result).rejects.toThrow('SSH handshake timed out');
    await jest.advanceTimersByTimeAsync(10000);
    await rejected;
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});
