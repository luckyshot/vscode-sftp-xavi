import * as fs from 'fs';
import * as path from 'path';
import { diffFiles, onDidCloseTextDocument } from '../host';
import { EXTENSION_NAME } from '../constants';
import { fileOperations } from '../core';
import { makeTmpFile } from '../helper';
import logger from '../logger';
import createFileHandler from './createFileHandler';

// Copies of remote files live in the temp folder only while their diff is open.
const tmpFiles = new Set<string>();

function removeTmpFile(tmpPath: string) {
  tmpFiles.delete(tmpPath);
  fs.unlink(tmpPath, error => {
    if (error && error.code !== 'ENOENT') {
      logger.warn(`Unable to remove temporary file ${tmpPath}: ${error.message}`);
    }
  });
}

export function removeAllDiffTmpFiles() {
  for (const tmpPath of Array.from(tmpFiles)) {
    tmpFiles.delete(tmpPath);
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // already gone
    }
  }
}

export const diff = createFileHandler({
  name: 'diff',
  async handle() {
    const remoteFs = await this.fileService.getRemoteFileSystem(this.config);
    const localFs = this.fileService.getLocalFileSystem();
    const { localFsPath, remoteFsPath } = this.target;
    const tmpPath = await makeTmpFile({
      prefix: `${EXTENSION_NAME}-`,
      postfix: path.extname(localFsPath),
    });
    tmpFiles.add(tmpPath);

    try {
      await fileOperations.transferFile(remoteFsPath, tmpPath, remoteFs, localFs);
      const closeWatcher = onDidCloseTextDocument(doc => {
        if (doc.uri.fsPath === tmpPath) {
          closeWatcher.dispose();
          removeTmpFile(tmpPath);
        }
      });
      await diffFiles(
        tmpPath,
        localFsPath,
        `${path.basename(localFsPath)} (${this.fileService.name || 'remote'} ↔ local)`
      );
    } catch (error) {
      removeTmpFile(tmpPath);
      throw error;
    }
  },
});
