import { Readable } from 'stream';
import type { FileOption } from './fs/fileSystem';

export default function readStream(getStream: (options: FileOption) => Promise<Readable>, option?: FileOption): Promise<string | Buffer> {
    return new Promise<string | Buffer>((resolve, reject) => {
      const { maxBytes = Infinity, signal, ...streamOptions } = option || {};
      const chunks: Buffer[] = [];
      let stream: any, size = 0, settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', abort);
        if (error) {
          chunks.length = 0;
          stream?.destroy();
          reject(error);
        } else {
          const buffer = Buffer.concat(chunks, size);
          resolve(option?.encoding ? buffer.toString(option.encoding) : buffer);
        }
      };
      const abort = () => finish(Object.assign(new Error('Remote read cancelled'), { name: 'AbortError' }));
      if (signal?.aborted) { abort(); return; }
      signal?.addEventListener('abort', abort, { once: true });
      getStream(streamOptions).then(input => {
        stream = input;
        if (settled) { input.destroy(); return; }
        input.on('error', finish);
        input.on('end', () => finish());
        input.on('data', chunk => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, option?.encoding || 'utf8');
          size += buffer.length;
          if (size > maxBytes) { finish(new Error(`Remote preview exceeds ${maxBytes} bytes`)); return; }
          chunks.push(buffer);
        });
      }, finish);
    });
}
