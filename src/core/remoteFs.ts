import upath from './upath';
import { createHash } from 'crypto';
import { promptForPassword } from '../host';
import logger from '../logger';
import app from '../app';
import { ConnectOption } from './remote-client/remoteClient';
import {
  FileSystem,
  RemoteFileSystem,
  SFTPFileSystem,
  FTPFileSystem,
} from './fs';
import localFs from './localFs';

function canonicalOption(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalOption);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined)
      .map(key => [key, canonicalOption(value[key])]));
  }
  return value;
}

export function hashOption(option): string {
  return createHash('sha256').update(JSON.stringify(canonicalOption(option))).digest('hex');
}

class KeepAliveRemoteFs {
  private isValid: boolean = false;

  private pendingPromise: Promise<RemoteFileSystem> | null;

  private fs: RemoteFileSystem | undefined;

  async getFs(
    option: ConnectOption & {
      protocol: string;
      remoteTimeOffsetInHours: number;
    }
  ): Promise<RemoteFileSystem> {
    if (this.isValid) {
      this.pendingPromise = null;
      return Promise.resolve(this.fs!);
    }

    if (this.pendingPromise) {
      return this.pendingPromise;
    }

    const connectOption = Object.assign({}, option);
    let FsConstructor: typeof SFTPFileSystem | typeof FTPFileSystem;
    if (option.protocol === 'sftp') {
      connectOption.debug = function debug(str) {
        const log = str.match(/^DEBUG(?:\[SFTP\])?: (.*?): (.*?)$/);

        if (log) {
          if (log[1] === 'Parser') return;
          logger.debug(`${log[1]}: ${log[2]}`);
        } else {
          logger.debug(str);
        }
      };
      FsConstructor = SFTPFileSystem;
    } else if (option.protocol === 'ftp') {
      connectOption.debug = function debug(str) {
        const log = str.match(/^\[connection\] (>|<) (.*?)(\\r\\n)?$/);

        if (!log) return;

        if (log[2].match(/200 NOOP/)) return;

        if (log[2].match(/^PASS /)) log[2] = 'PASS ******';

        logger.debug(`${log[1]} ${log[2]}`);
      };
      FsConstructor = FTPFileSystem;
    } else {
      throw new Error(`unsupported protocol ${option.protocol}`);
    }

    const fs = new FsConstructor(upath, {
      clientOption: connectOption,
      remoteTimeOffsetInHours: option.remoteTimeOffsetInHours,
    });
    this.fs = fs;
    fs.onDisconnected(() => this.invalid(fs));

    app.sftpBarItem.showMsg('connecting...', connectOption.connectTimeout);
    const pending = fs
      .connect(connectOption, {
        askForPasswd: promptForPassword,
      })
      .then(
        () => {
          if (this.fs !== fs) throw new Error('Connection closed before initialization completed');
          app.sftpBarItem.reset();
          this.isValid = true;
          return fs;
        },
        err => {
          this.invalid(fs);
          throw err;
        }
      ).finally(() => {
        if (this.pendingPromise === pending) this.pendingPromise = null;
      });
    this.pendingPromise = pending;
    return pending;
  }

  invalid(fs: RemoteFileSystem) {
    if (this.fs !== fs) return;
    this.fs = undefined;
    this.pendingPromise = null;
    this.isValid = false;
    fs.end();
  }

  end() {
    if (this.fs) this.invalid(this.fs);
  }
}

function getLocalFs() {
  return Promise.resolve(localFs);
}

const fsTable: {
  [x: string]: KeepAliveRemoteFs;
} = {};

export function createRemoteIfNoneExist(option): Promise<FileSystem> {
  if (option.protocol === 'local') {
    return getLocalFs();
  }

  const identity = hashOption(option);
  const fs = fsTable[identity];
  if (fs !== undefined) {
    return fs.getFs(option);
  }

  const fsInstance = new KeepAliveRemoteFs();
  fsTable[identity] = fsInstance;
  return fsInstance.getFs(option);
}

export function removeRemoteFs(option) {
  const identity = hashOption(option);
  const fs = fsTable[identity];
  if (fs !== undefined) {
    fs.end();
    delete fsTable[identity];
  }
}

const owners = new Map<string, number>();
export function retainRemoteFs(option) {
  const id = hashOption(option);
  owners.set(id, (owners.get(id) || 0) + 1);
}
export function releaseRemoteFs(option) {
  const id = hashOption(option), count = owners.get(id) || 0;
  if (count > 1) owners.set(id, count - 1);
  else { owners.delete(id); removeRemoteFs(option); }
}
