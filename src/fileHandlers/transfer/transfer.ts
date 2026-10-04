import {
  FileSystem,
  FileEntry,
  FileType,
  TransferTask,
  TransferOption as TransferTaskTransferOption,
  TransferDirection,
  fileOperations,
} from '../../core';
import { FileHandleOption } from '../option';
import logger from '../../logger';
import { getOpenTextDocuments } from '../../host';
import { isProtectedConfigPath } from '../../core/ignore';
import { entryPath, validateEntries } from '../../core/entryPath';

interface InternalTransferOption extends FileHandleOption, TransferTaskTransferOption {}

type ExternalTransferOption<T extends InternalTransferOption> = Pick<
  T,
  Exclude<keyof T, 'mtime' | 'atime' | 'mode' | 'fallbackMode'>
>;

type TransferOption = ExternalTransferOption<InternalTransferOption>;
interface SyncOption extends TransferOption {
  // delete extraneous files from dest dirs
  delete?: boolean;

  // skip creating new files on dest
  skipCreate?: boolean;

  // skip updating files that exist on dest
  ignoreExisting?: boolean;

  // update the dest only if a newer version is on the src filesystem
  update?: boolean;

  // make newest file to be present in both locations.
  bothDiretions?: boolean;
}

interface BaseTransferHandleConfig {
  srcFsPath: string;
  targetFsPath: string;
  dirPerm?: number,
  filePerm?: number,
  srcFs: FileSystem;
  targetFs: FileSystem;
  transferDirection: TransferDirection;
  // Polled while walking the tree so a cancelled transfer stops collecting tasks.
  isCancelled?: () => boolean;
}

interface TransferHandleConfig<T> extends BaseTransferHandleConfig {
  transferOption: T;
}

function getAltDirection(direction: TransferDirection) {
  return direction === TransferDirection.LOCAL_TO_REMOTE
    ? TransferDirection.REMOTE_TO_LOCAL
    : TransferDirection.LOCAL_TO_REMOTE;
}

function isFileModified(a: FileEntry, b: FileEntry): boolean {
  // compare time at seconds
  return Math.floor(a.mtime / 1000) !== Math.floor(b.mtime / 1000) || a.size !== b.size;
}

function toHash<T, R = T>(items: T[], key: string, transform?: (a: T) => R): { [key: string]: R } {
  return items.reduce((hash, item) => {
    const transformedItem = transform ? transform(item) : item;
    hash[transformedItem[key]] = transformedItem;
    return hash;
  }, Object.create(null));
}

async function transferFolder(
  config: TransferHandleConfig<TransferOption>,
  collect: (t: TransferTask) => void
) {
  const { srcFsPath, targetFsPath, srcFs, targetFs, transferOption } = config;

  if (config.isCancelled?.() || (transferOption.ignore && transferOption.ignore(srcFsPath))) {
    return;
  }

  // Need this to make sure file can correct transfer
  await targetFs.ensureDir(targetFsPath);

  // If dirPerm is configured, we chmod the remote directory after creation.
  if(config.transferOption.dirPerm) {
    logger.info("chmod remote directory as configured by dirPerm, dirPerm is: ", config.transferOption.dirPerm)
    await targetFs.chmod(targetFsPath, parseInt(String(config.transferOption.dirPerm), 8))
  }

  const fileEntries = await srcFs.list(srcFsPath);
  validateEntries(fileEntries, srcFs.pathResolver, srcFsPath);
  // Walk directories sequentially so recursion cannot multiply pending requests.
  for (const file of fileEntries) {
    if (config.isCancelled?.()) return;
    await transferWithType({
      ...config,
      transferOption: { ...config.transferOption, fallbackMode: file.mode, mtime: file.mtime, atime: file.atime },
      srcFsPath: file.fspath,
      targetFsPath: entryPath(targetFs.pathResolver, targetFsPath, file.name),
      ensureDirExist: false,
    }, file.type, collect);
  }

  logger.info('folder transfered.');
}

async function transferFile(
  config: TransferHandleConfig<InternalTransferOption>,
  fileType: FileType,
  collect: (t: TransferTask) => void
) {
  // Force transfers bypass user patterns, but never touch the configuration file:
  // uploading it leaks credentials, and downloading it lets a server rewrite the
  // connection settings (including sshCustomParams) of the local workspace.
  if (isProtectedConfigPath(config.srcFsPath) || isProtectedConfigPath(config.targetFsPath)) {
    return;
  }

  if (config.transferOption.ignore && config.transferOption.ignore(config.srcFsPath)) {
    return;
  }

  collect(
    new TransferTask(
      {
        fsPath: config.srcFsPath,
        fileSystem: config.srcFs,
      },
      {
        fsPath: config.targetFsPath,
        fileSystem: config.targetFs,
      },
      {
        fileType,
        transferDirection: config.transferDirection,
        transferOption: config.transferOption,
      }
    )
  );
}

async function transferWithType(
  config: TransferHandleConfig<InternalTransferOption> & {
    ensureDirExist: boolean;
  },
  fileType: FileType,
  collect: (t: TransferTask) => void
) {
  switch (fileType) {
    case FileType.Directory:
      await transferFolder(config, collect);
      break;
    case FileType.File:
    case FileType.SymbolicLink:
      if (config.ensureDirExist) {
        const { targetFs, targetFsPath } = config;
        await targetFs.ensureDir(targetFs.pathResolver.dirname(targetFsPath));
        // If dirPerm is configured, we chmod the remote directory after creation.
        if(config.transferOption.dirPerm) {
          logger.info("Running chmod on remote directory with perm: ", config.transferOption.dirPerm)
          await targetFs.chmod(targetFs.pathResolver.dirname(targetFsPath), parseInt(String(config.transferOption.dirPerm), 8));
        }
      }
      // <<< save before upload: start
      if (config.transferDirection === TransferDirection.LOCAL_TO_REMOTE) {
        const textDocuments = getOpenTextDocuments();
        const document = textDocuments.find(doc => doc.fileName === config.srcFsPath);
        if (document && !document.isClosed && document.isDirty) {
          await document.save();
          // Update mtime after file was saved
          const stat = await config.srcFs.lstat(config.srcFsPath);
          config.transferOption.mtime = stat.mtime;
          logger.info('save before upload.');
        }
      }
      // save before upload: end >>>
      await transferFile(config, fileType, collect);
      break;
    default:
      logger.warn(`Unsupported file type (type = ${fileType}). File ${config.srcFsPath}`);
  }
}

async function removeFile(file: string, fs: FileSystem, fileType: FileType, option): Promise<boolean> {
  if (option.ignore && option.ignore(file)) {
    return false;
  }

  switch (fileType) {
    case FileType.Directory:
      const children = await fs.list(file);
      validateEntries(children, fs.pathResolver, file);
      let canRemove = true;
      for (const child of children) {
        if (!await removeFile(child.fspath, fs, child.type, option)) {
          canRemove = false;
        }
      }
      if (!canRemove) return false;
      await fs.rmdir(file, false);
      logger.info('folder removed.');
      return true;
    case FileType.File:
    case FileType.SymbolicLink:
      await fileOperations.removeFile(file, fs, option);
      logger.info('file removed.');
      return true;
    default:
      return false;
  }
}

async function _sync(
  config: TransferHandleConfig<SyncOption>,
  collect: (t: TransferTask) => void,
  deleted: FileEntry[]
) {

  const { srcFsPath, targetFsPath, srcFs, targetFs, transferOption, transferDirection } = config;
  if (config.isCancelled?.() || (transferOption.ignore && transferOption.ignore(srcFsPath))) {
    return;
  }

  const altDirection = getAltDirection(transferDirection);
  const syncFiles = async (srcFileEntries: FileEntry[], desFileEntries: FileEntry[]) => {
    const srcFileTable = toHash(srcFileEntries, 'id', fileEntry => ({
      ...fileEntry,
      id: fileEntry.name,
    }));

    const desFileTable = toHash(desFileEntries, 'id', fileEntry => ({
      ...fileEntry,
      id: fileEntry.name,
    }));

    const file2trans: [string, string, TransferDirection, InternalTransferOption, FileType][] = [];
    const dir2trans: [string, string, TransferDirection][] = [];
    const dir2sync: [string, string][] = [];

    Object.keys(srcFileTable).forEach(id => {
      const srcFile = srcFileTable[id];
      const desFile = desFileTable[id];
      delete desFileTable[id];

      // files exist on both side
      if (desFile) {
        if (transferOption.ignoreExisting) {
          return;
        }

        let from: FileEntry = srcFile;
        let to: FileEntry = desFile;
        let direction: TransferDirection = transferDirection;
        switch (from.type) {
          case FileType.Directory:
            dir2sync.push([from.fspath, to.fspath]);
            break;
          case FileType.File:
          case FileType.SymbolicLink:
            if (transferOption.bothDiretions) {
              // from new to old
              if (desFile.mtime > srcFile.mtime) {
                from = desFile;
                to = srcFile;
                direction = altDirection;
              }
            }

            if (transferOption.update) {
              if (from.mtime <= to.mtime) {
                return;
              }
            }

            // only transfer changed files
            if (isFileModified(from, to)) {
              file2trans.push([
                from.fspath,
                to.fspath,
                direction,
                {
                  ...transferOption,
                  mode: to.mode, // prefer target mode
                  mtime: from.mtime,
                  atime: from.atime,
                },
                from.type,
              ]);
            }
            break;
          default:
          // do not process
        }
        return;
      }

      // files exist only on src
      if (transferOption.skipCreate) {
        return;
      }

      const fspath = entryPath(targetFs.pathResolver, targetFsPath, srcFile.name);
      switch (srcFile.type) {
        case FileType.Directory:
          dir2trans.push([srcFile.fspath, fspath, transferDirection]);
          break;
        case FileType.File:
        case FileType.SymbolicLink:
          file2trans.push([
            srcFile.fspath,
            fspath,
            transferDirection,
            {
              ...transferOption,
              fallbackMode: srcFile.mode,
              mtime: srcFile.mtime,
              atime: srcFile.atime,
            },
            srcFile.type,
          ]);
          break;
        default:
        // do not process
      }
    });

    // files exist only on target
    if (transferOption.bothDiretions) {
      if (transferOption.skipCreate !== true) {
        Object.keys(desFileTable).forEach(id => {
          const file = desFileTable[id];
          const fspath = entryPath(srcFs.pathResolver, srcFsPath, file.name);
          switch (file.type) {
            case FileType.Directory:
              dir2trans.push([file.fspath, fspath, altDirection]);
              break;
            case FileType.File:
            case FileType.SymbolicLink:
              file2trans.push([
                file.fspath,
                fspath,
                altDirection,
                {
                  ...transferOption,
                  fallbackMode: file.mode,
                  mtime: file.mtime,
                  atime: file.atime,
                },
                file.type,
              ]);
              break;
            default:
            // do not process
          }
        });
      }
    } else if (transferOption.delete) {
      // Only recorded here: sync() removes them once the whole tree has been walked.
      Object.keys(desFileTable).forEach(id => deleted.push(desFileTable[id]));
    }

    const directedConfig = (direction: TransferDirection) => ({
      ...config,
      transferDirection: direction,
      srcFs: direction === transferDirection ? srcFs : targetFs,
      targetFs: direction === transferDirection ? targetFs : srcFs,
    });

    for (const [src, target, direction, option, type] of file2trans) {
      if (config.isCancelled?.()) return;
      await transferFile({
        ...directedConfig(direction), transferOption: option,
        srcFsPath: src, targetFsPath: target,
      }, type, collect);
    }
    for (const [src, target, direction] of dir2trans) {
      if (config.isCancelled?.()) return;
      await transferFolder({
        ...directedConfig(direction), srcFsPath: src, targetFsPath: target,
      }, collect);
    }
    for (const [src, target] of dir2sync) {
      if (config.isCancelled?.()) return;
      await _sync({ ...config, srcFsPath: src, targetFsPath: target }, collect, deleted);
    }
  };

  // create dir here so we don't have to ensure it for children files.
  await targetFs.ensureDir(targetFsPath);

  const files = await Promise.all([
    srcFs.list(srcFsPath),
    targetFs.list(targetFsPath),
  ]);
  validateEntries(files[0], srcFs.pathResolver, srcFsPath);
  validateEntries(files[1], targetFs.pathResolver, targetFsPath);
  await syncFiles(...files);
}

export { TransferOption, SyncOption, TransferDirection };

export async function transfer(
  config: TransferHandleConfig<TransferOption>,
  collect: (t: TransferTask) => void
) {
  const stat = await config.srcFs.lstat(config.srcFsPath);
  const transferOption = {
    ...config.transferOption,
    fallbackMode: stat.mode,
    mtime: stat.mtime,
    atime: stat.atime,
    filePerm: config?.filePerm,
    dirPerm: config?.dirPerm
  };
  await transferWithType({ ...config, transferOption, ensureDirExist: true }, stat.type, collect);
}

// Removing files is immediate and cannot be cancelled, so it only starts after the
// tree has been walked, and only if confirmDelete (when given) agrees to the list.
export async function sync(
  config: TransferHandleConfig<SyncOption>,
  collect: (t: TransferTask) => void,
  confirmDelete?: (items: FileEntry[]) => Promise<boolean>
): Promise<FileEntry[]> {
  const deleted: FileEntry[] = [];
  await _sync(config, collect, deleted);

  const { targetFs, transferOption } = config;
  const doomed = deleted.filter(
    entry =>
      (entry.type === FileType.File ||
        entry.type === FileType.SymbolicLink ||
        entry.type === FileType.Directory) &&
      !(transferOption.ignore && transferOption.ignore(entry.fspath))
  );
  if (!doomed.length || config.isCancelled?.()) {
    return deleted;
  }
  if (confirmDelete && !(await confirmDelete(doomed))) {
    return [];
  }
  for (const entry of doomed) {
    if (entry.type !== FileType.Directory) {
      await removeFile(entry.fspath, targetFs, FileType.File, transferOption);
    }
  }
  for (const entry of doomed) {
    if (entry.type === FileType.Directory) {
      await removeFile(entry.fspath, targetFs, FileType.Directory, transferOption);
    }
  }
  return deleted;
}
