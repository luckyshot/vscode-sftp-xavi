import * as vscode from 'vscode';
import * as path from 'path';
import SerialQueue from '../core/serialQueue';
import debounce from 'lodash.debounce';
import logger from '../logger';
import { isValidFile, fileDepth } from '../helper';
import { upload, removeRemote } from '../fileHandlers';
import { WatcherService, TransferDirection } from '../core';
import app from '../app';
import StatusBarItem from '../ui/statusBarItem';
import { getRunningTransformTasks } from './serviceManager';

const watchers: {
  [x: string]: vscode.FileSystemWatcher;
} = {};

const uploadQueue = new Map<string, vscode.Uri>();
const deleteQueue = new Map<string, vscode.Uri>();
const pathQueues = new Map<string, { queue: SerialQueue; users: number }>();
const pathKey = (uri: vscode.Uri) => process.platform === 'win32' ? uri.fsPath.toLowerCase() : uri.fsPath;
async function forPath(uri: vscode.Uri, action: () => Promise<void>) {
  const key = pathKey(uri);
  let entry = pathQueues.get(key);
  if (!entry) pathQueues.set(key, entry = { queue: new SerialQueue(), users: 0 });
  entry.users++;
  try { await entry.queue.add(action); }
  finally { if (--entry.users === 0) pathQueues.delete(key); }
}

// less than 550 will not work
const ACTION_INTEVAL = 550;

function doUpload() {
  const files = Array.from(uploadQueue.values()).sort((a, b) => fileDepth(b.fsPath) - fileDepth(a.fsPath));
  uploadQueue.clear();

  const currentDownloadTasks = getRunningTransformTasks().filter(
    task => task.transferType === TransferDirection.REMOTE_TO_LOCAL
  );

  files.forEach(async uri => {
    // current target is still in downloading, so don't upload it.
    if (currentDownloadTasks.find(task => task.localFsPath === uri.fsPath)) {
      return;
    }

    const fspath = uri.fsPath;
    logger.info(`[watcher/updated] ${fspath}`);
    try {
      await forPath(uri, () => upload(uri));
    } catch (error) {
      logger.error(error, `upload ${fspath}`);
      app.sftpBarItem.updateStatus(StatusBarItem.Status.error);
    }
  });
}

function doDelete() {
  const files = Array.from(deleteQueue.values()).sort((a, b) => fileDepth(b.fsPath) - fileDepth(a.fsPath));
  deleteQueue.clear();
  files.forEach(async uri => {
    const fspath = uri.fsPath;
    logger.info(`[watcher/removed] ${fspath}`);
    try {
      await forPath(uri, () => removeRemote(uri));
    } catch (error) {
      logger.error(error, `remove ${fspath}`);
      app.sftpBarItem.updateStatus(StatusBarItem.Status.error);
    }
  });
}

const debouncedUpload = debounce(doUpload, ACTION_INTEVAL, { leading: false, trailing: true, maxWait: 2000 });
const debouncedDelete = debounce(doDelete, ACTION_INTEVAL, { leading: false, trailing: true, maxWait: 2000 });

function uploadHandler(uri: vscode.Uri) {
  if (!isValidFile(uri)) {
    return;
  }

  deleteQueue.delete(pathKey(uri));
  uploadQueue.set(pathKey(uri), uri);
  debouncedUpload();
}

function addWatcher(id, watcher) {
  watchers[id] = watcher;
}

function getWatcher(id) {
  return watchers[id];
}

function createWatcher(
  watcherBase: string,
  watcherConfig: { files: false | string; autoUpload: boolean; autoDelete: boolean }
) {
  let watcher = getWatcher(watcherBase);
  if (watcher) {
    // clear old watcher
    watcher.dispose();
  }

  if (!watcherConfig) {
    return;
  }

  const shouldAddListenser = watcherConfig.autoUpload || watcherConfig.autoDelete;
  if (watcherConfig.files == false || !shouldAddListenser) {
    return;
  }

  watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(watcherBase, watcherConfig.files),
    false,
    false,
    false
  );
  addWatcher(watcherBase, watcher);

  if (watcherConfig.autoUpload) {
    watcher.onDidCreate(uploadHandler);
    watcher.onDidChange(uploadHandler);
  }

  if (watcherConfig.autoDelete) {
    watcher.onDidDelete(uri => {
      if (!isValidFile(uri)) {
        return;
      }

      uploadQueue.delete(pathKey(uri));
      deleteQueue.set(pathKey(uri), uri);
      debouncedDelete();
    });
  }
}

function removeWatcher(watcherBase: string) {
  for (const queue of [uploadQueue, deleteQueue]) {
    for (const [key, uri] of queue) {
      const relative = path.relative(watcherBase, uri.fsPath);
      if (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) queue.delete(key);
    }
  }
  const watcher = getWatcher(watcherBase);
  if (watcher) {
    watcher.dispose();
    delete watchers[watcherBase];
  }
  if (!Object.keys(watchers).length) { debouncedUpload.cancel(); debouncedDelete.cancel(); }
}

const watcherService: WatcherService = {
  create: createWatcher,
  dispose: removeWatcher,
};

export default watcherService;
