export enum SyncState {
  /** Not computed yet, or the local side cannot be determined. */
  Unknown = 'unknown',
  Same = 'same',
  Modified = 'modified',
  RemoteOnly = 'remoteOnly',
  LocalOnly = 'localOnly',
  TypeMismatch = 'typeMismatch',
  /** Matched by the profile's ignore rules, so sync commands skip it. */
  Ignored = 'ignored',
}

export interface Comparable {
  isDirectory: boolean;
  size: number;
  /** milliseconds */
  mtime: number;
}

export interface CompareOptions {
  /** FTP servers often report unreliable mtimes, so allow comparing size only. */
  compareMtime: boolean;
}

export interface CompareResult {
  state: SyncState;
  /** Only set for Modified when mtimes disagree. */
  newer?: 'local' | 'remote';
}

export function compareEntries(
  local: Comparable | null,
  remote: Comparable | null,
  { compareMtime }: CompareOptions
): CompareResult {
  if (!local && !remote) return { state: SyncState.Unknown };
  if (!local) return { state: SyncState.RemoteOnly };
  if (!remote) return { state: SyncState.LocalOnly };
  if (local.isDirectory !== remote.isDirectory) return { state: SyncState.TypeMismatch };
  // Folders have no content of their own; their status comes from their children.
  if (local.isDirectory) return { state: SyncState.Same };

  const localSecs = Math.floor(local.mtime / 1000);
  const remoteSecs = Math.floor(remote.mtime / 1000);
  const mtimeDiffers = compareMtime && localSecs !== remoteSecs;
  if (local.size === remote.size && !mtimeDiffers) return { state: SyncState.Same };

  if (!compareMtime || !mtimeDiffers) return { state: SyncState.Modified };
  return { state: SyncState.Modified, newer: localSecs > remoteSecs ? 'local' : 'remote' };
}

/** Single letter shown as the file decoration badge. */
export function stateBadge(state: SyncState): string | undefined {
  switch (state) {
    case SyncState.Modified:
      return 'M';
    case SyncState.RemoteOnly:
      return 'R';
    case SyncState.LocalOnly:
      return 'L';
    case SyncState.TypeMismatch:
      return '!';
    default:
      return undefined;
  }
}

export function stateLabel(result: CompareResult): string {
  switch (result.state) {
    case SyncState.Same:
      return 'Identical to local';
    case SyncState.Modified:
      return result.newer ? `Differs from local (${result.newer} is newer)` : 'Differs from local';
    case SyncState.RemoteOnly:
      return 'Only on remote';
    case SyncState.LocalOnly:
      return 'Only on local';
    case SyncState.TypeMismatch:
      return 'File on one side, folder on the other';
    case SyncState.Ignored:
      return 'Ignored by profile rules';
    default:
      return 'Local status unknown';
  }
}
