import { fileOperations } from '../core';
import { toRemotePath } from '../helper';
import createFileHandler from './createFileHandler';

// The handler context is the file's old location; newLocalPath is where it moved to.
export const renameRemote = createFileHandler<{ newLocalPath: string }>({
  name: 'rename',
  async handle({ newLocalPath }) {
    const remoteFs = await this.fileService.getRemoteFileSystem(this.config);
    const { remoteFsPath } = this.target;
    const newRemotePath = toRemotePath(newLocalPath, this.fileService.baseDir, this.config.remotePath);
    await fileOperations.rename(remoteFsPath, newRemotePath, remoteFs);
  },
});
