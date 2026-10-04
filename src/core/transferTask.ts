import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import SerialQueue from './serialQueue';
import * as fileOperations from './fileBaseOperations';
import { FileSystem, FileType } from './fs';
import { Task } from './scheduler';
import logger from '../logger';
import { isProtectedConfigPath } from './ignore';
import { ERROR_MSG_STREAM_INTERRUPT } from './fs/fileSystem';

let hasWarnedModifedTimePermission = false;
const fileQueues = new WeakMap<FileSystem, Map<string, { queue: SerialQueue; users: number }>>();

async function replaceUploadedFile(fs: FileSystem, temporary: string, target: string, atomicOnly: boolean) {
  try {
    await fs.renameAtomic(temporary, target);
    return;
  } catch (error) {
    if (atomicOnly) throw error;
  }
  const backup = `${target}.sftp-xavi-${randomUUID()}.bak`;
  let backedUp = false;
  try {
    await fs.lstat(target);
    await fs.rename(target, backup);
    backedUp = true;
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 2) throw error;
  }
  try {
    await fs.rename(temporary, target);
  } catch (error) {
    if (backedUp) {
      try { await fs.rename(backup, target); }
      catch (rollbackError) { logger.warn(`Original file preserved at ${backup}: ${rollbackError.message}`); }
    }
    throw error;
  }
  if (backedUp) {
    await fs.unlink(backup).catch(error => logger.warn(`Unable to remove backup ${backup}: ${error.message}`));
  }
}

export enum TransferDirection {
  LOCAL_TO_REMOTE = 'local ➞ remote',
  REMOTE_TO_LOCAL = 'remote ➞ local',
}

interface FileHandle {
  fsPath: string;
  fileSystem: FileSystem;
}

export interface TransferOption {
  atime: number;
  mtime: number;
  mode?: number;
  filePerm?: number;
  dirPerm?: number;
  fallbackMode?: number;
  perserveTargetMode: boolean;
  useTempFile?: boolean;
  openSsh?: boolean;
}

export default class TransferTask implements Task {
  readonly fileType: FileType;
  private readonly _srcFsPath: string;
  private readonly _targetFsPath: string;
  private readonly _srcFs: FileSystem;
  private readonly _targetFs: FileSystem;
  private readonly _transferDirection: TransferDirection;
  private readonly _TransferOption: TransferOption;
  private _handle: Readable;
  private _cancelled = false;

  constructor(
    src: FileHandle,
    target: FileHandle,
    option: {
      fileType: FileType;
      transferDirection: TransferDirection;
      transferOption: TransferOption;
    }
  ) {
    this._srcFsPath = src.fsPath;
    this._targetFsPath = target.fsPath;
    this._srcFs = src.fileSystem;
    this._targetFs = target.fileSystem;
    this._TransferOption = option.transferOption;
    this._transferDirection = option.transferDirection;
    this.fileType = option.fileType;
  }

  get localFsPath() {
    if (this._transferDirection === TransferDirection.REMOTE_TO_LOCAL) {
      return this._targetFsPath;
    } else {
      return this._srcFsPath;
    }
  }

  get srcFsPath() {
    return this._srcFsPath;
  }

  get targetFsPath() {
    return this._targetFsPath;
  }

  get transferType() {
    return this._transferDirection;
  }

  async run() {
    this._checkCancelled();
    const src = this._srcFsPath;
    const target = this._targetFsPath;
    const srcFs = this._srcFs;
    const targetFs = this._targetFs;
    switch (this.fileType) {
      case FileType.File:
        let queues = fileQueues.get(targetFs);
        if (!queues) fileQueues.set(targetFs, queues = new Map());
        let entry = queues.get(target);
        if (!entry) queues.set(target, entry = { queue: new SerialQueue(), users: 0 });
        entry.users++;
        try { await entry.queue.add(() => this._transferFile()); }
        finally { if (--entry.users === 0) queues.delete(target); }
        break;
      case FileType.SymbolicLink:
        if (this._transferDirection === TransferDirection.LOCAL_TO_REMOTE) {
          const linkTarget = await srcFs.readlink(src);
          const resolved = srcFs.pathResolver.resolve(srcFs.pathResolver.dirname(src), linkTarget);
          if (isProtectedConfigPath(resolved)) {
            logger.warn(`Skipping symlink to protected configuration: ${src}`);
            return;
          }
        }
        this._checkCancelled();
        await fileOperations.transferSymlink(
          src,
          target,
          srcFs,
          targetFs,
          this._TransferOption
        );
        break;
      default:
        logger.warn(`Unsupported file type (type = ${this.fileType}). File ${src}`);
    }
  }

  cancel() {
    if (this._cancelled) return;
    this._cancelled = true;
    if (this._handle && !this._handle.destroyed) FileSystem.abortReadableStream(this._handle);
  }

  private _checkCancelled() {
    if (this._cancelled) throw Object.assign(new Error('Transfer Aborted'), { code: ERROR_MSG_STREAM_INTERRUPT });
  }

  isCancelled(): boolean {
    return this._cancelled;
  }

  private async _transferFile() {
    this._checkCancelled();
    const src = this._srcFsPath;
    const target = this._targetFsPath;
    const srcFs = this._srcFs;
    const targetFs = this._targetFs;
    const {
      perserveTargetMode,
      useTempFile,
      openSsh,
      fallbackMode,
      atime,
      mtime,
      filePerm
    } = this._TransferOption;
    // Set the mode if it's specified in the config, otherwise get mode from server.
    let mode = filePerm ? parseInt(String(filePerm), 8) : this._TransferOption.mode;
    let uploadFd; // Temp file or destination file when no temp file is used
    const uploadTarget = useTempFile ? `${target}.sftp-xavi-${randomUUID()}.tmp` : target;

    let sourceError: Error | undefined;
    const onSourceError = (error: Error) => { sourceError = error; };
    try {
      const sourceStat = await srcFs.lstat(src);
      if (sourceStat.type !== FileType.File) throw new Error(`Source changed type before transfer: ${src}`);
      this._handle = await srcFs.get(src);
      this._handle.on('error', onSourceError);
      this._checkCancelled();
      if (mode === undefined && perserveTargetMode) {
        mode = await targetFs.lstat(target).then(stat => stat.mode).catch(() => fallbackMode);
      }
      this._checkCancelled();
      if (sourceError) throw sourceError;
      uploadFd = await targetFs.open(uploadTarget, useTempFile ? 'wx' : 'w');
      this._checkCancelled();
      if (sourceError) throw sourceError;
      if (useTempFile) {
        logger.info("uploading temp file: " + uploadTarget);
      }
      await targetFs.put(this._handle, uploadTarget, {
        mode,
        fd: uploadFd,
        autoClose: false,
      });
      if (atime && mtime) {
        try {
          await targetFs.futimes(
            uploadFd,
            Math.floor(atime / 1000),
            Math.floor(mtime / 1000)
          );
        } catch (error) {
          if (!hasWarnedModifedTimePermission) {
            hasWarnedModifedTimePermission = true;
            logger.warn(
              `Can't set modified time to the file because ${error.message}`
            );
          }
        }
      }

      await targetFs.close(uploadFd);
      uploadFd = undefined;
      this._checkCancelled();
      if (useTempFile) {
        await replaceUploadedFile(targetFs, uploadTarget, target, !!openSsh);
      }

    } finally {
      this._handle?.destroy();
      if (uploadFd !== undefined) await targetFs.close(uploadFd).catch(error => logger.warn(`Unable to close transfer handle: ${error.message}`));
      if (useTempFile) {
        await targetFs.unlink(uploadTarget).catch(() => undefined);
      }
    }
  }
}
