import { refreshRemoteExplorer } from './shared';
import { fileOperations } from '../core';
import createFileHandler from './createFileHandler';
import { FileHandleOption } from './option';

export const createRemoteFile = createFileHandler<FileHandleOption & { skipDir?: boolean }>({
  name: 'createRemoteFile',
  async handle(option) {
    const remoteFs = await this.fileService.getRemoteFileSystem(this.config);
    const { remoteFsPath } = this.target;

    await fileOperations.createFile(remoteFsPath, remoteFs, {});
  },
  transformOption() {
    const config = this.config;
    return {
      ignore: config.ignore,
    };
  },
  afterHandle() {
    refreshRemoteExplorer(this.target, false);
  },
});

export const createRemoteFolder = createFileHandler<FileHandleOption & { skipDir?: boolean }>({
  name: 'createRemoteFolder',
  async handle(option) {
    const remoteFs = await this.fileService.getRemoteFileSystem(this.config);
    const { remoteFsPath } = this.target;

    await fileOperations.createDir(remoteFsPath, remoteFs, {});
  },
  transformOption() {
    const config = this.config;
    return {
      ignore: config.ignore,
    };
  },
  afterHandle() {
    refreshRemoteExplorer(this.target, false);
  },
});
