jest.mock('../src/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));
const { hashOption, createRemoteIfNoneExist } = require('../src/core/remoteFs');
const { Client } = require('ssh2');
afterEach(() => jest.restoreAllMocks());

test('connection identities distinguish boundaries, nested settings, and credentials', () => {
  const opts = { host: 'server1', port: 22, password: 'secret', hop: { host: 'jump1' } };
  expect(hashOption(opts)).not.toBe(hashOption({ ...opts, host: 'server', port: 122 }));
  expect(hashOption(opts)).not.toBe(hashOption({ ...opts, hop: { host: 'jump2' } }));
  expect(hashOption(opts)).not.toBe(hashOption({ ...opts, password: 'changed' }));
  expect(hashOption(opts)).toBe(hashOption({ hop: { host: 'jump1' }, password: 'secret', port: 22, host: 'server1' }));
  expect(hashOption(opts)).not.toContain('secret');
});
test('different servers get different connections while reordered options reuse one', async () => {
  const connect = jest.spyOn(Client.prototype, 'connect').mockImplementation(function () { queueMicrotask(() => this.emit('ready')); return this; });
  jest.spyOn(Client.prototype, 'sftp').mockImplementation(cb => cb(null, {}));
  const opts = { host: 'review-server1', port: 22, username: 'u', password: 'p', protocol: 'sftp', remoteTimeOffsetInHours: 0 };
  const first = await createRemoteIfNoneExist(opts);
  const second = await createRemoteIfNoneExist({ ...opts, host: 'review-server', port: 122 });
  expect(second).not.toBe(first);
  expect(await createRemoteIfNoneExist(Object.fromEntries(Object.entries(opts).reverse()))).toBe(first);
  expect(connect).toHaveBeenCalledTimes(2);
});
