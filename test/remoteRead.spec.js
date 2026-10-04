jest.mock('../src/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn() } }));
const { PassThrough } = require('stream');
const RemoteFileSystem = require('../src/core/fs/remoteFileSystem').default;
const read = (stream, options) => RemoteFileSystem.prototype.readFile.call({ get: () => Promise.resolve(stream) }, '/remote/a', options);
const tick = () => new Promise(resolve => setImmediate(resolve));
test('stops reads that exceed the byte limit', async () => {
  const stream = new PassThrough();
  const result = read(stream, { maxBytes: 4 });
  const rejected = expect(result).rejects.toThrow('exceeds 4 bytes');
  await tick();
  stream.write('123'); stream.write('45');
  await rejected;
  expect(stream.destroyed).toBe(true);
});
test('cancellation destroys active reads', async () => {
  const stream = new PassThrough(), controller = new AbortController();
  const result = read(stream, { signal: controller.signal });
  const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  await tick(); controller.abort();
  await rejected;
  expect(stream.destroyed).toBe(true);
});
test('cancellation while awaiting a stream destroys it when it arrives', async () => {
  const controller = new AbortController(), stream = new PassThrough();
  let release;
  const result = RemoteFileSystem.prototype.readFile.call({ get: () => new Promise(resolve => { release = resolve; }) }, '/a', { signal: controller.signal });
  const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort(); await rejected; release(stream); await tick();
  expect(stream.destroyed).toBe(true);
});
test('reads and decodes files within the limit', async () => {
  const stream = new PassThrough();
  const result = read(stream, { maxBytes: 4, encoding: 'utf8' });
  await tick(); stream.end('test');
  expect(await result).toBe('test');
});
