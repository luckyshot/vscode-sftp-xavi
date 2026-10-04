import * as vscode from 'vscode';
import { COMMAND_CANCEL_ALL_TRANSFER } from '../constants';

// Single-file saves should stay quiet; only larger batches get a notification.
const MIN_TASKS_FOR_NOTIFICATION = 5;
// Walking a big folder to collect the files can take a while before any batch starts.
const SCAN_NOTIFICATION_DELAY_MS = 1000;

class TransferProgress {
  private total = 0;
  private done = 0;
  private operations = 0;
  private activeBatches = 0;
  private current = '';
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  // True from the moment a notification is requested, before VS Code runs its callback.
  private shown = false;
  private finish: (() => void) | null = null;
  private report: ((value: { message?: string; increment?: number }) => void) | null = null;

  // A whole transfer or sync operation: collecting the files, then transferring them.
  begin() {
    this.operations++;
    if (!this.shown && !this.scanTimer) {
      this.scanTimer = setTimeout(() => {
        this.scanTimer = null;
        if (this.operations > 0) {
          this.open();
        }
      }, SCAN_NOTIFICATION_DELAY_MS);
    }
  }

  end() {
    this.operations = Math.max(0, this.operations - 1);
    this.closeIfIdle();
  }

  batchStart(taskCount: number) {
    this.activeBatches++;
    this.total += taskCount;
    if (!this.shown && this.total >= MIN_TASKS_FOR_NOTIFICATION) {
      this.open();
    }
    this.update(0);
  }

  batchEnd() {
    this.activeBatches = Math.max(0, this.activeBatches - 1);
    this.closeIfIdle();
  }

  taskStart(name: string) {
    this.current = name;
    this.update(0);
  }

  taskEnd() {
    this.done++;
    this.update(this.total ? 100 / this.total : 0);
  }

  private update(increment: number) {
    if (!this.report) {
      return;
    }
    const counts = this.total ? `${this.done} / ${this.total}` : 'Scanning files…';
    this.report({
      increment,
      message: this.current && this.total ? `${counts} · ${this.current}` : counts,
    });
  }

  private open() {
    if (this.shown) {
      return;
    }
    this.shown = true;
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'SFTP Xavi: transferring',
        cancellable: true,
      },
      (progress, token) =>
        new Promise<void>(resolve => {
          if (!this.shown) {
            // everything finished before VS Code got to run this
            resolve();
            return;
          }
          this.report = progress.report.bind(progress);
          this.finish = resolve;
          token.onCancellationRequested(() => {
            vscode.commands.executeCommand(COMMAND_CANCEL_ALL_TRANSFER);
          });
          this.update(0);
        })
    );
  }

  private closeIfIdle() {
    if (this.operations > 0 || this.activeBatches > 0) {
      return;
    }
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    const finish = this.finish;
    this.shown = false;
    this.finish = null;
    this.report = null;
    this.total = 0;
    this.done = 0;
    this.current = '';
    if (finish) {
      finish();
    }
  }
}

export default new TransferProgress();
