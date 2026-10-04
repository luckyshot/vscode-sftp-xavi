jest.mock('../src/app', () => ({ __esModule: true, default: {} }));
const { validateConfig } = require('../src/modules/config');

const base = { host: 'host', username: 'user', remotePath: '/' };

test('accepts minimal settings and unknown extension options without coercion', () => {
  expect(validateConfig({ ...base, customOption: true })).toBeUndefined();
  expect(validateConfig({ ...base, port: '22' })).toBeDefined();
});

test.each(['sftp', 'ftp', 'local'])('accepts the %s protocol', protocol => {
  expect(validateConfig({ ...base, protocol })).toBeUndefined();
});

test.each(['host', 'username', 'remotePath'])('requires %s', key => {
  const config = { ...base };
  delete config[key];
  expect(validateConfig(config)).toBeDefined();
});

test.each([false, true, ['Password:', 'Code:']])('accepts interactive authentication %j', interactiveAuth => {
  expect(validateConfig({ ...base, interactiveAuth })).toBeUndefined();
});

test.each([false, null, '**/*.js'])('accepts watcher files %j', files => {
  expect(validateConfig({ ...base, watcher: { files, autoUpload: false, autoDelete: false } })).toBeUndefined();
});

test('accepts nullable credentials, empty ignores and partial watcher settings', () => {
  expect(validateConfig({ ...base, password: null, agent: null, privateKeyPath: null,
    passphrase: true, ignore: [], watcher: {} })).toBeUndefined();
});

test.each([
  { protocol: 'unknown' }, { watcher: { files: true } }, { ignore: [1] },
  { ignore: '**/*.txt' }, { passphrase: false }, { interactiveAuth: [1] },
])('rejects invalid settings %j', overrides => {
  expect(validateConfig({ ...base, ...overrides })).toBeDefined();
});

const { parseConfigText } = require('../src/modules/config');

test('parses sftp.json with comments and trailing commas', () => {
  const text = '{\n // note\n "host": "h", /* inline */\n "ignore": ["a",],\n}';
  expect(parseConfigText(text)).toEqual({ host: 'h', ignore: ['a'] });
});

test('reports a syntax error with its line', () => {
  expect(() => parseConfigText('{\n"host": }')).toThrow(/line 2/);
});
