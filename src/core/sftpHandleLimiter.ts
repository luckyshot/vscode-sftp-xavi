// Limit handles using ssh2's public callback API, including reservations for in-flight opens.
export default function limitSftpHandles(sftp: any, limit: number): () => void {
  let reserved = 0, stopped = false;
  const handles = new Set<string>();
  const waiting: { run: () => void; fail: () => void }[] = [];
  const disconnected = () => new Error('SFTP connection closed while waiting for a file handle');
  const pump = () => {
    while (!stopped && reserved < limit && waiting.length) waiting.shift()!.run();
  };
  for (const method of ['open', 'opendir']) {
    const original = sftp[method];
    sftp[method] = function (...args: any[]) {
      const callback = args.pop();
      const run = () => {
        reserved++;
        let completed = false;
        const done = (error, handle?) => {
          if (completed) return;
          completed = true;
          if (error || stopped) reserved--;
          else handles.add(handle.toString('hex'));
          queueMicrotask(pump);
          callback(error || (stopped ? disconnected() : null), stopped ? undefined : handle);
        };
        try { return original.call(this, ...args, done); }
        catch (error) { if (completed) throw error; done(error); }
      };
      if (stopped) return callback(disconnected());
      if (reserved < limit) return run();
      waiting.push({ run, fail: () => callback(disconnected()) });
    };
  }
  const close = sftp.close;
  sftp.close = function (handle, callback) {
    return close.call(this, handle, error => {
      if (!error && handles.delete(handle.toString('hex'))) reserved--;
      queueMicrotask(pump);
      callback(error);
    });
  };
  return () => {
    stopped = true;
    for (const request of waiting.splice(0)) request.fail();
  };
}
