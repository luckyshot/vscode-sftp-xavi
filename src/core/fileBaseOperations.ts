import { FileSystem } from './fs';
import { window } from 'vscode';
import { Readable } from 'stream';
import logger from '../logger';

interface FileOption {
  mode?: number;
}

export async function transferFile(
  src: string,
  des: string,
  srcFs: FileSystem,
  desFs: FileSystem,
  option?: FileOption
): Promise<void> {
  const inputStream = await srcFs.get(src, option);
  await desFs.put(inputStream, des, option);
}

export function transferSymlink(
  src: string,
  des: string,
  srcFs: FileSystem,
  desFs: FileSystem,
  option: FileOption
): Promise<void> {
  return srcFs.readlink(src).then(targetPath => {
    return desFs.symlink(targetPath, des).catch(err => {
      // ignore file already exist
      if (err.code === 4 || err.code === 'EEXIST') {
        return;
      }
      throw err;
    });
  });
}

export function removeFile(path: string, fs: FileSystem, option): Promise<void> {
  return fs.unlink(path);
}

export function removeDir(path: string, fs: FileSystem, option): Promise<void> {
  return fs.rmdir(path, true);
}

export function rename(srcPath: string, destPath: string, fs: FileSystem): Promise<void> {
  return fs.rename(srcPath, destPath);
}

export function createDir(path: string, fs: FileSystem, option): Promise<void> {
  return fs.mkdir(path);
}

export async function createFile(path: string, fs: FileSystem, option): Promise<void> {
  if (fs.supportsExclusiveCreation === false) throw new Error('This protocol does not support safe exclusive file creation');
  try {
    await fs.lstat(path);
    logger.warn('Cannot create file because it already exists');
    window.showErrorMessage('Cannot create file because it already exists');
    return;
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 2) throw error;
  }

  const targetFd = await fs.open(path, 'wx');
  const input = Readable.from([]);
  try {
    await fs.put(input, path, { fd: targetFd, autoClose: false });
  } finally {
    input.destroy();
    await fs.close(targetFd);
  }
}
