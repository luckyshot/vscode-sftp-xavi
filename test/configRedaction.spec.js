jest.mock('../src/logger', () => ({ __esModule: true, default: { info: jest.fn() } }));
const { maskConfig, createFileService } = require('../src/modules/serviceManager');
const logger = require('../src/logger').default;

test('redacts nested profiles and jump-host credentials without changing configuration', () => {
  const config = { host: 'example.com', username: 'u', profiles: { prod: { password: 'PROFILE_SECRET', passphrase: 'KEY_SECRET' } }, hop: [{ host: 'jump', password: 'HOP_SECRET', interactiveAuth: ['ANSWER_SECRET'], privateKey: 'PRIVATE_KEY' }] };
  const original = JSON.stringify(config);
  const redacted = JSON.stringify(maskConfig(config));
  for (const secret of ['PROFILE_SECRET', 'KEY_SECRET', 'HOP_SECRET', 'ANSWER_SECRET', 'PRIVATE_KEY']) expect(redacted).not.toContain(secret);
  expect(redacted).toContain('example.com');
  expect(JSON.stringify(config)).toBe(original);
  createFileService(config, '/review-only-workspace');
  expect(JSON.stringify(logger.info.mock.calls)).not.toContain('PROFILE_SECRET');
  expect(JSON.stringify(logger.info.mock.calls)).not.toContain('HOP_SECRET');
});
