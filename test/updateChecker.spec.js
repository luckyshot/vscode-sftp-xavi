const crypto = require('crypto');
jest.mock('../src/logger', () => ({ __esModule: true, default: { warn: jest.fn(), trace: jest.fn() } }));
jest.mock('vscode', () => ({
  window: { showInformationMessage: jest.fn(), showErrorMessage: jest.fn(), withProgress: jest.fn(async (_o, task) => task()) },
  workspace: { getConfiguration: () => ({ get: (_k, d) => d }) },
  commands: { executeCommand: jest.fn() },
  ProgressLocation: { Notification: 15 },
  Uri: { file: f => ({ fsPath: f }) },
}), { virtual: true });
const vscode = require('vscode');
const { isNewerVersion, isCheckDue, CHECK_INTERVAL_MS, UpdateChecker, downloadRelease } = require('../src/modules/updateChecker');

const URL = 'https://github.com/luckyshot/vscode-sftp-xavi/releases/download/v2.3.0/sftp-xavi-2.3.0.vsix';
const release = (overrides = {}) => ({
  ok: true,
  json: async () => ({
    tag_name: 'v2.3.0', html_url: 'https://github.com/x',
    assets: [{ name: 'sftp-xavi-2.3.0.vsix', browser_download_url: URL, ...overrides }],
  }),
});
const memento = () => {
  const data = {};
  return { data, get: k => data[k], update: jest.fn(async (k, v) => { data[k] = v; }) };
};

beforeEach(() => { jest.clearAllMocks(); global.fetch = jest.fn(async () => release()); });

test('compares versions numerically', () => {
  expect(isNewerVersion('2.10.0', '2.9.9')).toBe(true);
  expect(isNewerVersion('2.2.1', '2.2.1')).toBe(false);
  expect(isNewerVersion('2.2.0', '2.2.1')).toBe(false);
  expect(isNewerVersion('v3.0.0', '2.9.9')).toBe(true);
  expect(isNewerVersion('garbage', '2.2.1')).toBe(false);
});

test('checks at most once a week and honours remind later', () => {
  const now = 10 * CHECK_INTERVAL_MS;
  expect(isCheckDue({}, now)).toBe(true);
  expect(isCheckDue({ lastCheck: now - CHECK_INTERVAL_MS + 1000 }, now)).toBe(false);
  expect(isCheckDue({ lastCheck: now - CHECK_INTERVAL_MS }, now)).toBe(true);
  expect(isCheckDue({ lastCheck: 0, remindAfter: now + 1 }, now)).toBe(false);
});

test('manual check says so explicitly, with the current version, when up to date', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ tag_name: 'v2.2.1', assets: [{ name: 'sftp-xavi-2.2.1.vsix', browser_download_url: URL }] }) }));
  await new UpdateChecker(memento(), '2.2.1').check(true);
  expect(vscode.window.showInformationMessage.mock.calls[0][0]).toMatch(/up to date.*2\.2\.1/);
});

test('an available update shows both versions and the three buttons', async () => {
  await new UpdateChecker(memento(), '2.2.1').check(true);
  const [message, ...buttons] = vscode.window.showInformationMessage.mock.calls[0];
  expect(message).toContain('2.2.1');
  expect(message).toContain('2.3.0');
  expect(buttons).toEqual(['Update', 'Skip this version', 'Remind later']);
});

test('Remind later postpones for 7 days and Skip suppresses only automatic notifications', async () => {
  const state = memento();
  vscode.window.showInformationMessage.mockResolvedValueOnce('Remind later');
  const before = Date.now();
  await new UpdateChecker(state, '2.2.1').check(false);
  expect(state.data['sftpXavi.updates.remindAfter']).toBeGreaterThanOrEqual(before + CHECK_INTERVAL_MS);

  vscode.window.showInformationMessage.mockResolvedValueOnce('Skip this version');
  await new UpdateChecker(state, '2.2.1').check(false);
  expect(state.data['sftpXavi.updates.skippedVersion']).toBe('2.3.0');

  vscode.window.showInformationMessage.mockClear();
  await new UpdateChecker(state, '2.2.1').check(false);
  expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  await new UpdateChecker(state, '2.2.1').check(true);
  expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(1);
});

test('automatic check fails quietly while a manual check reports the error', async () => {
  global.fetch = jest.fn(async () => { throw new Error('offline'); });
  await expect(new UpdateChecker(memento(), '2.2.1').check(false)).rejects.toThrow('offline');
  await new UpdateChecker(memento(), '2.2.1').check(true);
  expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('offline'));
});

test('refuses releases whose VSIX is not hosted in this repository', async () => {
  global.fetch = jest.fn(async () => release({ browser_download_url: 'https://evil.example/sftp-xavi-2.3.0.vsix' }));
  await new UpdateChecker(memento(), '2.2.1').check(true);
  expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('no downloadable VSIX'));
});

test('download verifies the published checksum', async () => {
  const body = Buffer.from('vsix-bytes');
  global.fetch = jest.fn(async () => ({ ok: true, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length) }));
  const dir = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'upd-test-'));
  const digest = 'sha256:' + crypto.createHash('sha256').update(body).digest('hex');
  const file = await downloadRelease({ version: '2.3.0', url: URL, digest }, dir);
  expect(require('fs').readFileSync(file)).toEqual(body);
  await expect(downloadRelease({ version: '2.3.1', url: URL, digest: 'sha256:00' }, dir)).rejects.toThrow('checksum');
  require('fs').rmSync(dir, { recursive: true });
});

test('an unanswered notification does not block a later manual check', async () => {
  const checker = new UpdateChecker(memento(), '2.2.1');
  vscode.window.showInformationMessage.mockReturnValueOnce(new Promise(() => {}));
  checker.check(true);
  await new Promise(resolve => setImmediate(resolve));
  await checker.check(true);
  expect(vscode.window.showInformationMessage).toHaveBeenCalledTimes(2);
});

test('ignores timestamps from a clock set in the future', () => {
  const now = 10 * CHECK_INTERVAL_MS;
  expect(isCheckDue({ lastCheck: now + 5 * CHECK_INTERVAL_MS }, now)).toBe(true);
  expect(isCheckDue({ lastCheck: 0, remindAfter: now + 5 * CHECK_INTERVAL_MS }, now)).toBe(true);
});
