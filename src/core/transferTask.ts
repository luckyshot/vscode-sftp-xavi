import { Readable } from 'stream';
import * as fileOperations from './fileBaseOperations';
import { FileSystem, FileType } from './fs';
import { Task } from './scheduler';
import logger from '../logger';

let hasWarnedModifedTimePermission = false;

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
  private _cancelled: boolean;
  // private _fileStatus: FileStatus;

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
    const src = this._srcFsPath;
    const target = this._targetFsPath;
    const srcFs = this._srcFs;
    const targetFs = this._targetFs;
    switch (this.fileType) {
      case FileType.File:
        await this._transferFile();
        break;
      case FileType.SymbolicLink:
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
    if (this._handle && !this._cancelled) {
      this._cancelled = true;
      FileSystem.abortReadableStream(this._handle);
    }
  }

  isCancelled(): boolean {
    return this._cancelled;
  }

  private async _transferFile() {
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
    const uploadTarget = target + (useTempFile ? ".new" : "");

    let sourceError: Error | undefined;
    const onSourceError = (error: Error) => { sourceError = error; };
    try {
      this._handle = await srcFs.get(src);
      this._handle.on('error', onSourceError);
      if (mode === undefined && perserveTargetMode) {
        mode = await targetFs.lstat(target).then(stat => stat.mode).catch(() => fallbackMode);
      }
      if (sourceError) throw sourceError;
      uploadFd = await targetFs.open(uploadTarget, 'w');
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

      if (useTempFile) {
        logger.info("moving from: " + target + ".new" + " to: " + target);
        if(openSsh) {
          await targetFs.renameAtomic(uploadTarget, target);
        } else {
          try {
            await targetFs.unlink(target);
          } catch(error) {
            // Just ignore
          }
          await targetFs.rename(uploadTarget, target);
        }
      }

    } finally {
      this._handle?.destroy();
      if (uploadFd !== undefined) await targetFs.close(uploadFd);
    }
  }
}
