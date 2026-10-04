const limitHandles = require('../../src/core/sftpHandleLimiter').default;
const tick = () => new Promise(resolve => setImmediate(resolve));
function client() {
  const sftp = { open: jest.fn(), opendir: jest.fn(), close: jest.fn((handle, cb) => cb(null)) };
  return sftp;
}
test('queues directory opens behind in-flight file opens and closes through the public API', async () => {
  let opened;
  const originalOpen = jest.fn((p, flags, cb) => { opened = cb; });
  const originalDir = jest.fn((p, cb) => cb(null, Buffer.from('directory')));
  const sftp = { open: originalOpen, opendir: originalDir, close: jest.fn((handle, cb) => cb(null)) };
  limitHandles(sftp, 1);
  const cb = jest.fn();
  sftp.open('/a', 'r', cb);
  sftp.opendir('/b', cb);
  expect(originalOpen).toHaveBeenCalledTimes(1);
  expect(originalDir).not.toHaveBeenCalled();
  opened(null, Buffer.from('a'));
  await tick();
  expect(originalDir).not.toHaveBeenCalled();
  sftp.close(Buffer.from('a'), () => {});
  await tick();
  expect(originalDir).toHaveBeenCalledWith('/b', expect.any(Function));
  expect(cb).toHaveBeenLastCalledWith(null, Buffer.from('directory'));
});
test('counts pending calls and releases reservations on failed opens', async () => {
  const callbacks = [], opens = [];
  const sftp = { open: jest.fn((p, flags, cb) => { opens.push(p); callbacks.push(cb); }), opendir: jest.fn(), close: jest.fn((h, cb) => cb(null)) };
  const stop = limitHandles(sftp, 1);
  const cb = jest.fn();
  sftp.open('/a', 'r', cb);
  sftp.open('/b', 'r', cb);
  sftp.open('/c', 'r', cb);
  expect(opens).toEqual(['/a']);
  callbacks[0](new Error('missing'));
  await tick();
  expect(opens).toEqual(['/a', '/b']);
  callbacks[1](null, Buffer.from('b'));
  await tick();
  expect(opens).toHaveLength(2);
  sftp.close(Buffer.from('b'), () => {});
  await tick();
  expect(opens).toEqual(['/a', '/b', '/c']);
  sftp.open('/queued', 'r', cb);
  stop();
  expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ message: expect.stringContaining('connection closed') }));
});
test('limits are independent per client', () => {
  const a = client(), b = client();
  const aOpen = a.open, bOpen = b.open;
  limitHandles(a, 1); limitHandles(b, 2);
  for (let i = 0; i < 3; i++) { a.open('/x', 'r', () => {}); b.open('/x', 'r', () => {}); }
  expect(aOpen).toHaveBeenCalledTimes(1);
  expect(bOpen).toHaveBeenCalledTimes(2);
});
