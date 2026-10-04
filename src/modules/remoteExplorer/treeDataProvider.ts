import * as vscode from 'vscode';
import { showTextDocument } from '../../host';
import {
  upath,
  UResource,
  Resource,
  FileService,
  FileType,
  FileEntry,
  FileStats,
  Ignore,
  ServiceConfig,
} from '../../core';
import {
  COMMAND_REMOTEEXPLORER_VIEW_CONTENT,
  COMMAND_REMOTEEXPLORER_EDITINLOCAL,
  COMMAND_REMOTEEXPLORER_COMPARE,
} from '../../constants';
import { getAllFileService } from '../serviceManager';
import { getExtensionSetting } from '../ext';
import { toLocalPath } from '../../helper';
import mapConcurrent from '../../core/mapConcurrent';
import ListingCache from './listingCache';
import SyncDecorationProvider, { DecorationInfo } from './decorationProvider';
import { SyncState, CompareResult, compareEntries, stateLabel } from './syncState';

type Id = number;

const previewDocumentPathPrefix = '/~ ';

const LISTING_TTL_MS = 30 * 1000;
const LOCAL_STAT_CONCURRENCY = 16;

const DEFAULT_FILES_EXCLUDE = ['.git', '.svn', '.hg', 'CVS', '.DS_Store'];
/**
 * covert the url path for a customed docuemnt title
 *
 *  There is no api to custom title.
 *  So we change url path for custom title.
 *  This is not break anything because we get fspth from uri.query.'
 */
function makePreivewUrl(uri: vscode.Uri) {
  // const query = querystring.parse(uri.query);
  // query.originPath = uri.path;
  // query.originQuery = uri.query;

  return uri.with({
    path: previewDocumentPathPrefix + upath.basename(uri.path),
    // query: querystring.stringify(query),
  });
}

interface ExplorerChild {
  resource: Resource;
  isDirectory: boolean;
}

export interface ExplorerRoot extends ExplorerChild {
  explorerContext: {
    fileService: FileService;
    config: ServiceConfig;
    id: Id;
  };
}

export type ExplorerItem = ExplorerRoot | ExplorerChild;

function dirFirstSort(fileA: ExplorerItem, fileB: ExplorerItem) {
  if (fileA.isDirectory === fileB.isDirectory) {
    return fileA.resource.fsPath.localeCompare(fileB.resource.fsPath);
  }

  return fileA.isDirectory ? -1 : 1;
}

function trimTrailingSlash(p: string) {
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

function formatAge(mtime: number, now = Date.now()) {
  const secs = Math.max(0, Math.round((now - mtime) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(mtime).toISOString().slice(0, 10);
}

interface ItemMeta {
  entry: FileEntry;
  local: FileStats | null;
  result: CompareResult;
}

export default class RemoteTreeData
  implements vscode.TreeDataProvider<ExplorerItem>, vscode.TextDocumentContentProvider {
  private _roots: ExplorerRoot[] | null;
  private _rootsMap: Map<Id, ExplorerRoot> | null;
  private _map: Map<vscode.Uri['query'], ExplorerItem>;
  private _listings = new ListingCache<FileEntry[]>(LISTING_TTL_MS);
  /** Compare results keyed by `uri.toString()`. */
  private _meta = new Map<string, ItemMeta>();
  private _folderDiffs = new Map<string, number>();
  readonly decorations = new SyncDecorationProvider(uri => this._decorationFor(uri));

  private _onDidChangeFolder: vscode.EventEmitter<ExplorerItem | undefined> = new vscode.EventEmitter<
    ExplorerItem | undefined
  >();
  private _onDidChangeFile: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChangeTreeData: vscode.Event<ExplorerItem | undefined> = this._onDidChangeFolder.event;
  readonly onDidChange: vscode.Event<vscode.Uri> = this._onDidChangeFile.event;

  async refresh(item?: ExplorerItem): Promise<any> {
    // refresh root
    if (!item) {
      // clear cache
      this._roots = null;
      this._rootsMap = null;
      this._listings.clear();
      this._meta.clear();
      this._folderDiffs.clear();

      this._onDidChangeFolder.fire(undefined);
      return;
    }

    this._listings.invalidate(this._listingKey(item));
    if (item.isDirectory) {
      this._onDidChangeFolder.fire(item);

      // refresh top level files as well
      const children = await this.getChildren(item);
      children
        .filter(i => !i.isDirectory)
        .forEach(i => this._onDidChangeFile.fire(makePreivewUrl(i.resource.uri)));
    } else {
      const parent = await this.getParent(item);
      if (parent) {
        this._listings.invalidate(this._listingKey(parent));
        this._onDidChangeFolder.fire(parent);
      }
      this._onDidChangeFile.fire(makePreivewUrl(item.resource.uri));
    }
  }

  getTreeItem(item: ExplorerItem): vscode.TreeItem {
    const isRoot = (item as ExplorerRoot).explorerContext !== undefined;
    let customLabel;
    if (isRoot) {
      customLabel = (item as ExplorerRoot).explorerContext.fileService.name;
    }
    if (!customLabel) {
      customLabel = upath.basename(item.resource.fsPath);
    }
    const meta = this._meta.get(item.resource.uri.toString());
    const state = meta?.result.state;
    const treeItem: vscode.TreeItem = {
      // Stable ids keep expansion state across refreshes.
      id: item.resource.uri.query,
      label: customLabel,
      resourceUri: item.resource.uri,
      collapsibleState: item.isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : undefined,
      contextValue: isRoot ? 'root' : item.isDirectory ? 'folder' : `file.${state ?? SyncState.Unknown}`,
    };
    if (!item.isDirectory) {
      treeItem.description = meta ? `${formatSize(meta.entry.size)} · ${formatAge(meta.entry.mtime)}` : undefined;
      treeItem.tooltip = meta ? this._fileTooltip(item, meta) : undefined;
      treeItem.command =
        state === SyncState.Modified
          ? { command: COMMAND_REMOTEEXPLORER_COMPARE, arguments: [item], title: 'Compare with Local' }
          : {
              command: getExtensionSetting().downloadWhenOpenInRemoteExplorer
                ? COMMAND_REMOTEEXPLORER_EDITINLOCAL
                : COMMAND_REMOTEEXPLORER_VIEW_CONTENT,
              arguments: [item],
              title: 'View Remote Resource',
            };
    }
    return treeItem;
  }

  async getChildren(item?: ExplorerItem): Promise<ExplorerItem[]> {
    if (!item) {
      return this._getRoots();
    }

    const root = this.findRoot(item.resource.uri);
    if (!root) {
      throw new Error(`Can't find config for remote resource ${item.resource.uri}.`);
    }
    const config = root.explorerContext.config;
    const remotefs = await root.explorerContext.fileService.getRemoteFileSystem(config);
    const listingKey = this._listingKey(item);
    let fileEntries = this._listings.get(listingKey);
    if (!fileEntries) {
      fileEntries = await remotefs.list(item.resource.fsPath);
      this._listings.set(listingKey, fileEntries);
    }

    const filesExcludeList: string[] =
      config.remoteExplorer && config.remoteExplorer.filesExclude
        ? config.remoteExplorer.filesExclude.concat(DEFAULT_FILES_EXCLUDE)
        : DEFAULT_FILES_EXCLUDE;

    const ignore = new Ignore(filesExcludeList);
    function filterFile(file: FileEntry) {
      const relativePath = upath.relative(config.remotePath, file.fspath);
      return !ignore.ignores(relativePath);
    }

    const visible = fileEntries.filter(filterFile);
    const localFs = root.explorerContext.fileService.getLocalFileSystem();
    const compareMtime = config.protocol !== 'ftp';
    const metas = await mapConcurrent(visible, LOCAL_STAT_CONCURRENCY, async entry => {
      const localPath = toLocalPath(entry.fspath, config.remotePath, root.explorerContext.fileService.baseDir);
      const local = await localFs.lstat(localPath).catch(() => null);
      const isDir = entry.type === FileType.Directory;
      let result: CompareResult = compareEntries(
        local && { isDirectory: local.type === FileType.Directory, size: local.size, mtime: local.mtime },
        { isDirectory: isDir, size: entry.size, mtime: entry.mtime },
        { compareMtime }
      );
      if (result.state === SyncState.RemoteOnly && config.ignore && config.ignore(localPath)) {
        result = { state: SyncState.Ignored };
      }
      return { entry, local, result } as ItemMeta;
    });

    const folderKey = item.resource.uri.toString();
    let differing = 0;
    const changed: vscode.Uri[] = [];
    for (const meta of metas) {
      const uri = UResource.updateResource(item.resource, { remotePath: meta.entry.fspath }).uri;
      const key = uri.toString();
      const prev = this._meta.get(key);
      if (!prev || prev.result.state !== meta.result.state) changed.push(uri);
      // keep a content-checked verdict while neither side has changed
      const verdictStillValid =
        prev &&
        prev.result.state === SyncState.Same &&
        meta.result.state === SyncState.Modified &&
        prev.entry.size === meta.entry.size &&
        prev.entry.mtime === meta.entry.mtime &&
        prev.local?.mtime === meta.local?.mtime;
      this._meta.set(key, verdictStillValid ? prev : meta);
      const { state } = this._meta.get(key)!.result;
      if (state !== SyncState.Same && state !== SyncState.Ignored) differing++;
    }
    if (this._folderDiffs.get(folderKey) !== differing) {
      this._folderDiffs.set(folderKey, differing);
      changed.push(item.resource.uri);
    }
    if (changed.length) this.decorations.fire(changed);

    return visible
      .map(file => {
        const isDirectory = file.type === FileType.Directory;
        const newResource = UResource.updateResource(item.resource, {
          remotePath: file.fspath,
        });
        const mapItem = this._map.get(newResource.uri.query);
        if (mapItem) {
          return mapItem;
        } else {
          const newItem = {
            resource: UResource.updateResource(item.resource, {
              remotePath: file.fspath,
            }),
            isDirectory,
          };
          this._map.set(newItem.resource.uri.query, newItem);
          return newItem;
        }
      })
      .sort(dirFirstSort);
  }

  async getParent(item: ExplorerChild): Promise<ExplorerItem> {
    const resourceUri = item.resource.uri;
    const root = this.findRoot(resourceUri);
    if (!root) {
      throw new Error(`Can't find config for remote resource ${resourceUri}.`);
    }

    if (trimTrailingSlash(item.resource.fsPath) === trimTrailingSlash(root.resource.fsPath)) {
      return root;
    }

    const fspath = upath.dirname(item.resource.fsPath);
    // remotePath is often configured with a trailing slash ("/var/www/"), but dirname() drops it
    if (trimTrailingSlash(fspath) === trimTrailingSlash(root.resource.fsPath)) {
      return root;
    }
    const newResource = UResource.updateResource(item.resource, {
      remotePath: fspath,
    });
    const mapItem = this._map.get(newResource.uri.query);
    if (mapItem) {
      return mapItem;
    } else {
      const newMapItem = {
        resource: newResource,
        isDirectory: true,
      };
      this._map.set(newResource.uri.query, newMapItem);
      await this.getChildren(newMapItem);
      return newMapItem;
    }
  }

  findRoot(uri: vscode.Uri): ExplorerRoot | null | undefined {
    if (!this._rootsMap) {
      return null;
    }

    const rootId = UResource.makeResource(uri).remoteId;
    return this._rootsMap.get(rootId);
  }

  async provideTextDocumentContent(
    uri: vscode.Uri,
    token: vscode.CancellationToken
  ): Promise<string> {
    const root = this.findRoot(uri);
    if (!root) {
      throw new Error(`Can't find remote for resource ${uri}.`);
    }

    const controller = new AbortController();
    const cancellation = token.onCancellationRequested(() => controller.abort());
    if (token.isCancellationRequested) controller.abort();
    try {
      const config = root.explorerContext.config;
      const remotefs = await root.explorerContext.fileService.getRemoteFileSystem(config);
      if (controller.signal.aborted) throw new Error('Remote preview cancelled');
      const maxBytes = getExtensionSetting().get<number>('maxRemotePreviewBytes', 10 * 1024 * 1024);
      const filepath = UResource.makeResource(uri).fsPath;
      const stat = await remotefs.lstat(filepath);
      if (stat.size > maxBytes) throw new Error(`Remote file is too large to preview (${stat.size} bytes). Download it instead.`);
      const buffer = await remotefs.readFile(filepath, { maxBytes, signal: controller.signal });
      return buffer.toString();
    } finally {
      cancellation.dispose();
    }
  }

  private _listingKey(item: ExplorerItem) {
    return `${UResource.makeResource(item.resource.uri).remoteId}:${item.resource.fsPath}`;
  }

  private _fileTooltip(item: ExplorerItem, meta: ItemMeta) {
    const lines = [stateLabel(meta.result), `Remote: ${formatSize(meta.entry.size)}, ${new Date(meta.entry.mtime).toLocaleString()}`];
    if (meta.local) lines.push(`Local: ${formatSize(meta.local.size)}, ${new Date(meta.local.mtime).toLocaleString()}`);
    return lines.join('\n');
  }

  private _decorationFor(uri: vscode.Uri): DecorationInfo | undefined {
    const key = uri.toString();
    const meta = this._meta.get(key);
    if (meta) {
      return { state: meta.result.state, tooltip: stateLabel(meta.result) };
    }
    const differing = this._folderDiffs.get(key);
    if (differing) {
      return {
        state: SyncState.Modified,
        tooltip: `${differing} item${differing === 1 ? '' : 's'} differ from local`,
        differing,
      };
    }
    return undefined;
  }

  /** Metadata for the compare commands; undefined until the parent folder has been listed. */
  getMeta(item: ExplorerItem): ItemMeta | undefined {
    return this._meta.get(item.resource.uri.toString());
  }

  /** Local file system path matching a remote item. */
  getLocalPath(item: ExplorerItem): string | undefined {
    const root = this.findRoot(item.resource.uri);
    if (!root) return undefined;
    const { config, fileService } = root.explorerContext;
    return toLocalPath(item.resource.fsPath, config.remotePath, fileService.baseDir);
  }

  /** Open a diff of the remote file (left) against its local counterpart (right). */
  async compareWithLocal(item: ExplorerItem): Promise<void> {
    if (item.isDirectory) return;
    const localPath = this.getLocalPath(item);
    const meta = this.getMeta(item);
    if (!localPath || meta?.result.state === SyncState.RemoteOnly) {
      vscode.window.showInformationMessage('This file does not exist locally.');
      return;
    }
    const name = upath.basename(item.resource.fsPath);
    await vscode.commands.executeCommand(
      'vscode.diff',
      makePreivewUrl(item.resource.uri),
      vscode.Uri.file(localPath),
      `${name} (remote ↔ local)`
    );
  }

  /** Download both versions (bounded by maxRemotePreviewBytes) and compare their bytes. */
  async checkContent(item: ExplorerItem): Promise<void> {
    if (item.isDirectory) return;
    const root = this.findRoot(item.resource.uri);
    const localPath = this.getLocalPath(item);
    const meta = this.getMeta(item);
    if (!root || !localPath || !meta?.local) {
      vscode.window.showInformationMessage('This file does not exist locally.');
      return;
    }
    const maxBytes = getExtensionSetting().get<number>('maxRemotePreviewBytes', 10 * 1024 * 1024);
    if (meta.entry.size > maxBytes) {
      vscode.window.showWarningMessage(`File is larger than sftpXavi.maxRemotePreviewBytes (${maxBytes} bytes); use Compare or download it.`);
      return;
    }
    const { config, fileService } = root.explorerContext;
    const remotefs = await fileService.getRemoteFileSystem(config);
    const [remote, local] = await Promise.all([
      remotefs.readFile(item.resource.fsPath, { maxBytes }),
      fileService.getLocalFileSystem().readFile(localPath, { maxBytes }),
    ]);
    const same = Buffer.compare(Buffer.from(remote), Buffer.from(local)) === 0;
    const key = item.resource.uri.toString();
    this._meta.set(key, { ...meta, result: same ? { state: SyncState.Same } : meta.result.state === SyncState.Same ? { state: SyncState.Modified } : meta.result });
    this.decorations.fire(item.resource.uri);
    const parent = await this.getParent(item);
    this._onDidChangeFolder.fire(parent);
    vscode.window.showInformationMessage(same ? 'Contents are identical.' : 'Contents differ.');
  }

  showItem(item: ExplorerItem): void {
    if (item.isDirectory) {
      return;
    }

    showTextDocument(makePreivewUrl(item.resource.uri));
  }

  private _getRoots(): ExplorerRoot[] {
    if (this._roots) {
      return this._roots;
    }

    this._roots = [];
    this._rootsMap = new Map();
    this._map = new Map();
    getAllFileService().forEach(fileService => {
      const config = fileService.getConfig();
      const id = fileService.id;
      const item = {
        resource: UResource.makeResource({
          remote: {
            host: config.host,
            port: config.port,
          },
          fsPath: config.remotePath,
          remoteId: id,
        }),
        isDirectory: true,
        explorerContext: {
          fileService,
          config,
          id,
        },
      };
      this._roots!.push(item);
      this._rootsMap!.set(id, item);
      this._map.set(item.resource.uri.query, item);
    });
    this._roots.sort((a,b) => a.explorerContext.config.remoteExplorer.order - b.explorerContext.config.remoteExplorer.order || a.explorerContext.fileService.name.localeCompare(b.explorerContext.fileService.name));
    return this._roots;
  }
}
