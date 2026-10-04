jest.mock('../src/logger', () => ({ __esModule: true, default: { warn: jest.fn() } }));
const FileService = require('../src/core/fileService').default;

test('independent batches share the configured transfer limit', async () => {
  const service = new FileService('/local', '/local', {});
  let active = 0, peak = 0;
  const batches = Array.from({ length: 10 }, () => {
    const batch = service.createTransferScheduler(2);
    batch.add({ run: async () => { peak = Math.max(peak, ++active); await new Promise(resolve => setImmediate(resolve)); active--; } });
    return batch;
  });
  await Promise.all(batches.map(b => b.run()));
  expect(peak).toBe(2);
  expect(service.getPendingTransferTasks()).toHaveLength(0);
  expect(service.isTransferring()).toBe(false);
});
test('cancellation skips tasks waiting in the shared queue and resolves batches', async () => {
  const service = new FileService('/local', '/local', {});
  let release;
  const first = { run: jest.fn(() => new Promise(resolve => { release = resolve; })), cancel: jest.fn() };
  const queued = { run: jest.fn(), cancel: jest.fn() };
  const a = service.createTransferScheduler(1), b = service.createTransferScheduler(1);
  a.add(first); b.add(queued);
  const done = Promise.all([a.run(), b.run()]);
  service.cancelTransferTasks();
  release();
  await done;
  expect(first.cancel).toHaveBeenCalled();
  expect(queued.run).not.toHaveBeenCalled();
});
