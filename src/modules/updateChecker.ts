import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import logger from '../logger';
import { EXTENSION_DISPLAY_NAME } from '../constants';

const RELEASE_API_URL = 'https://api.github.com/repos/luckyshot/vscode-sftp-xavi/releases/latest';
const DOWNLOAD_URL_PREFIX = 'https://github.com/luckyshot/vscode-sftp-xavi/releases/download/';
const VSIX_NAME = /^sftp-xavi-[\w.-]+\.vsix$/;
const MAX_VSIX_BYTES = 50 * 1024 * 1024;

export const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const TIMER_INTERVAL_MS = 6 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 30 * 1000;

const KEY_LAST_CHECK = 'sftpXavi.updates.lastCheck';
const KEY_REMIND_AFTER = 'sftpXavi.updates.remindAfter';
const KEY_SKIPPED_VERSION = 'sftpXavi.updates.skippedVersion';

const BUTTON_UPDATE = 'Update';
const BUTTON_SKIP = 'Skip this version';
const BUTTON_REMIND = 'Remind later';

export interface ReleaseInfo {
  version: string;
  url: string;
  digest?: string;
}

export function parseVersion(text: string): number[] | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(text).trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

export function isNewerVersion(candidate: string, current: string) {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

export function isCheckDue(state: { lastCheck?: number; remindAfter?: number }, now: number) {
  // Timestamps further in the future than one interval come from a wrong clock; ignore them.
  const remindAfter = state.remindAfter && state.remindAfter <= now + CHECK_INTERVAL_MS ? state.remindAfter : 0;
  if (now < remindAfter) return false;
  const elapsed = state.lastCheck ? now - state.lastCheck : Infinity;
  return elapsed < 0 || elapsed >= CHECK_INTERVAL_MS;
}

export async function fetchLatestRelease(): Promise<ReleaseInfo> {
  const response = await fetch(RELEASE_API_URL, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'sftp-xavi-update-check' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`GitHub answered ${response.status} ${response.statusText}`);
  }
  const release: any = await response.json();
  const version = String(release.tag_name || '').replace(/^v/, '');
  if (!parseVersion(version)) {
    throw new Error(`Unrecognised release tag "${release.tag_name}"`);
  }
  const asset = (release.assets || []).find(a => VSIX_NAME.test(String(a.name)));
  if (!asset || !String(asset.browser_download_url).startsWith(DOWNLOAD_URL_PREFIX)) {
    throw new Error(`Release ${version} has no downloadable VSIX`);
  }
  return {
    version,
    url: asset.browser_download_url,
    digest: typeof asset.digest === 'string' ? asset.digest : undefined,
  };
}

export async function downloadRelease(release: ReleaseInfo, directory: string) {
  const response = await fetch(release.url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length === 0 || data.length > MAX_VSIX_BYTES) {
    throw new Error(`Downloaded file has an unexpected size (${data.length} bytes)`);
  }
  if (release.digest) {
    const [algorithm, expected] = release.digest.split(':');
    if (algorithm !== 'sha256' || crypto.createHash('sha256').update(data).digest('hex') !== expected) {
      throw new Error('Downloaded file does not match the checksum published by GitHub');
    }
  }
  const file = path.join(directory, `sftp-xavi-${release.version}.vsix`);
  fs.writeFileSync(file, data, { flag: 'wx' });
  return file;
}

export async function installRelease(release: ReleaseInfo) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sftp-xavi-update-'));
  try {
    const file = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Downloading ${EXTENSION_DISPLAY_NAME} ${release.version}` },
      () => downloadRelease(release, directory)
    );
    await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(file));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  const answer = await vscode.window.showInformationMessage(
    `${EXTENSION_DISPLAY_NAME} ${release.version} is installed. Reload the window to start using it.`,
    'Reload Window'
  );
  if (answer === 'Reload Window') {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}

export class UpdateChecker {
  private checking = false;
  private offering = false;

  constructor(private readonly memento: vscode.Memento, private readonly currentVersion: string) {}

  start(context: vscode.ExtensionContext) {
    const tick = () => {
      if (!this.autoCheckEnabled()) return;
      if (!isCheckDue({ lastCheck: this.memento.get(KEY_LAST_CHECK), remindAfter: this.memento.get(KEY_REMIND_AFTER) }, Date.now())) return;
      this.check(false).catch(error => logger.warn(`Automatic update check failed: ${error && error.message || error}`));
    };
    const first = setTimeout(tick, STARTUP_DELAY_MS);
    const timer = setInterval(tick, TIMER_INTERVAL_MS);
    context.subscriptions.push({ dispose() { clearTimeout(first); clearInterval(timer); } });
  }

  private autoCheckEnabled() {
    return vscode.workspace.getConfiguration('sftpXavi').get<boolean>('updates.checkAutomatically', true);
  }

  /** Checks GitHub for a newer release. `manual` checks always report their outcome and ignore a skipped version. */
  async check(manual: boolean) {
    if (this.checking) return;
    this.checking = true;
    let release: ReleaseInfo;
    try {
      try {
        release = await fetchLatestRelease();
      } catch (error: any) {
        if (!manual) throw error;
        vscode.window.showErrorMessage(`${EXTENSION_DISPLAY_NAME} could not check for updates: ${error && error.message || error}`);
        return;
      }
      await this.memento.update(KEY_LAST_CHECK, Date.now());

      if (!isNewerVersion(release.version, this.currentVersion)) {
        if (manual) {
          vscode.window.showInformationMessage(`${EXTENSION_DISPLAY_NAME} is up to date. You have version ${this.currentVersion}, the latest release.`);
        }
        return;
      }
      if (!manual && this.memento.get(KEY_SKIPPED_VERSION) === release.version) return;
    } finally {
      this.checking = false;
    }

    // Outside the guard: an unanswered notification must not make later checks do nothing.
    if (!manual && this.offering) return;
    this.offering = true;
    try {
      await this.offer(release);
    } finally {
      this.offering = false;
    }
  }

  private async offer(release: ReleaseInfo) {
    const answer = await vscode.window.showInformationMessage(
      `${EXTENSION_DISPLAY_NAME} update available: you have ${this.currentVersion}, version ${release.version} is available.`,
      BUTTON_UPDATE, BUTTON_SKIP, BUTTON_REMIND
    );
    if (answer === BUTTON_UPDATE) {
      try {
        await installRelease(release);
      } catch (error: any) {
        vscode.window.showErrorMessage(`${EXTENSION_DISPLAY_NAME} update failed: ${error && error.message || error}`);
      }
    } else if (answer === BUTTON_SKIP) {
      await this.memento.update(KEY_SKIPPED_VERSION, release.version);
    } else if (answer === BUTTON_REMIND) {
      await this.memento.update(KEY_REMIND_AFTER, Date.now() + CHECK_INTERVAL_MS);
    }
  }
}

let instance: UpdateChecker | undefined;

export function initUpdateChecker(context: vscode.ExtensionContext) {
  instance = new UpdateChecker(context.globalState, context.extension.packageJSON.version);
  instance.start(context);
  return instance;
}

export function checkForUpdatesNow() {
  if (!instance) throw new Error('The update checker is not running');
  return instance.check(true);
}
