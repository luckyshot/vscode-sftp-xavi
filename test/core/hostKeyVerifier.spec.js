const { createHash } = require('crypto');
const { configureHostKeyVerification, verifyHostKey } = require('../../src/core/hostKeyVerifier');
const key = Buffer.from('server-key');
const fingerprint = `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`;
let storage, prompt;
beforeEach(() => {
  const saved = new Map();
  storage = { get: k => saved.get(k), update: jest.fn(async (k, v) => { saved.set(k, v); }) };
  prompt = jest.fn().mockResolvedValue(true);
  configureHostKeyVerification(storage, prompt);
});
test('accepts a matching pin and rejects a different key without prompting', async () => {
  expect(await verifyHostKey('server', 22, key, fingerprint)).toBe(true);
  expect(await verifyHostKey('server', 22, Buffer.from('attacker'), fingerprint)).toBe(false);
  expect(prompt).not.toHaveBeenCalled();
});
test('remembers accepted keys and rejects changed keys without allowing replacement', async () => {
  expect(await verifyHostKey('server', 22, key)).toBe(true);
  expect(await verifyHostKey('server', 22, key)).toBe(true);
  expect(await verifyHostKey('server', 22, Buffer.from('attacker'))).toBe(false);
  expect(prompt).toHaveBeenCalledTimes(1);
  expect(prompt).toHaveBeenCalledWith('server', 22, fingerprint);
});
test('cancelled approval never stores a key', async () => {
  prompt.mockResolvedValue(false);
  expect(await verifyHostKey('server', 22, key)).toBe(false);
  expect(storage.update).not.toHaveBeenCalled();
});
test('coalesces concurrent prompts and separates host/port identities', async () => {
  expect(await Promise.all([verifyHostKey('server', 22, key), verifyHostKey('server', 22, key)])).toEqual([true, true]);
  expect(prompt).toHaveBeenCalledTimes(1);
  await verifyHostKey('server', 2222, key);
  expect(prompt).toHaveBeenCalledTimes(2);
});
