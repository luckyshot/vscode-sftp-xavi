import * as vscode from 'vscode';
import { REMOTE_SCHEME } from '../../constants';
import { SyncState, DecorationSummary, stateBadge } from './syncState';

export type DecorationInfo = DecorationSummary;

const COLORS: Partial<Record<SyncState, string>> = {
  [SyncState.Modified]: 'gitDecoration.modifiedResourceForeground',
  [SyncState.RemoteOnly]: 'gitDecoration.untrackedResourceForeground',
  [SyncState.LocalOnly]: 'gitDecoration.addedResourceForeground',
  [SyncState.TypeMismatch]: 'gitDecoration.conflictingResourceForeground',
  [SyncState.Ignored]: 'gitDecoration.ignoredResourceForeground',
};

/** Badges and colours for remote explorer items, driven by the tree provider's compare results. */
export default class SyncDecorationProvider implements vscode.FileDecorationProvider {
  private _emitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this._emitter.event;

  constructor(private readonly _lookup: (uri: vscode.Uri) => DecorationInfo | undefined) {}

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== REMOTE_SCHEME) return undefined;
    const info = this._lookup(uri);
    if (!info) return undefined;

    const color = COLORS[info.state];
    const badge = info.differing
      ? info.differing > 9 ? '9+' : String(info.differing)
      : stateBadge(info.state);
    if (!badge && !color) return undefined;
    return new vscode.FileDecoration(
      badge,
      info.tooltip,
      color ? new vscode.ThemeColor(color) : undefined
    );
  }

  fire(uris?: vscode.Uri | vscode.Uri[]) {
    this._emitter.fire(uris);
  }

  dispose() {
    this._emitter.dispose();
  }
}
