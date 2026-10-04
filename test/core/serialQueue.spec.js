const SerialQueue = require('../../src/core/serialQueue').default;

test('FTP operations wait for earlier operations and retain their results', async () => {
  const queue = new SerialQueue();
  const calls = [];
  let finish;
  const first = queue.add(() => {
    calls.push('first');
    return new Promise(resolve => { finish = resolve; });
  });
  const second = queue.add(() => { calls.push('second'); return 2; });
  await Promise.resolve();
  expect(calls).toEqual(['first']);
  finish(1);
  expect(await Promise.all([first, second])).toEqual([1, 2]);
  expect(calls).toEqual(['first', 'second']);
});

test.each([false, true])('continues after a failed command (synchronous: %s)', synchronous => {
  const queue = new SerialQueue();
  const error = new Error('connection failed');
  const failed = queue.add(() => {
    if (synchronous) throw error;
    return Promise.reject(error);
  });
  const next = queue.add(() => 'recovered');
  return Promise.all([
    expect(failed).rejects.toBe(error),
    expect(next).resolves.toBe('recovered'),
  ]);
});
