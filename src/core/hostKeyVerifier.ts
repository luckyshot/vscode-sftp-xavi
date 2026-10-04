import { createHash } from 'crypto';

interface HostKeyStore {
  get<T>(key: string): T | undefined;
  update(key: string, value: string): PromiseLike<void>;
}
type Confirm = (host: string, port: number, fingerprint: string) => PromiseLike<boolean>;
let store: HostKeyStore | undefined;
let confirm: Confirm | undefined;
const pending = new Map<string, Promise<boolean>>();

export function configureHostKeyVerification(storage: HostKeyStore, prompt: Confirm) {
  store = storage;
  confirm = prompt;
  pending.clear();
}

export async function verifyHostKey(host: string, port: number, key: Buffer, pinned?: string): Promise<boolean> {
  const fingerprint = `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`;
  if (pinned) return pinned === fingerprint;
  if (!store || !confirm) return false;
  const id = `sshHostKey:${encodeURIComponent(host)}:${port}`;
  const known = store.get<string>(id);
  if (known) return known === fingerprint;
  const inFlight = pending.get(id);
  if (inFlight) {
    await inFlight;
    return store.get<string>(id) === fingerprint;
  }
  const storage = store, prompt = confirm;
  const approval = (async () => {
    if (!await prompt(host, port, fingerprint)) return false;
    await storage.update(id, fingerprint);
    return true;
  })();
  pending.set(id, approval);
  try { return await approval; }
  finally { pending.delete(id); }
}
