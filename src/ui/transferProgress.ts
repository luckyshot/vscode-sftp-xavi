import * as vscode from 'vscode';
import { COMMAND_CANCEL_ALL_TRANSFER } from '../constants';

// Single-file saves should stay quiet; only larger batches get a notification.
const MIN_TASKS_FOR_NOTIFICATION = 5;

class TransferProgress {
  private total = 0;
  private done = 0;
  private activeBatches = 0;
  private current = '';
  private finish: (() => void) | null = null;
  private report: ((value: { message?: string; increment?: number }) => void) | null = null;

  batchStart(taskCount: number) {
    this.activeBatches++;
    this.total += taskCount;
    if (!this.finish && this.total >= MIN_TASKS_FOR_NOTIFICATION) {
      this.open();
    }
    this.update(0);
  }

  batchEnd() {
    this.activeBatches = Math.max(0, this.activeBatches - 1);
    if (this.activeBatches === 0) {
      this.close();
    }
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
    this.report({
      increment,
      message: `${this.done} / ${this.total}${this.current ? ' · ' + this.current : ''}`,
    });
  }

  private open() {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'SFTP Xavi: transferring',
        cancellable: true,
      },
      (progress, token) =>
        new Promise<void>(resolve => {
          this.report = progress.report.bind(progress);
          this.finish = resolve;
          token.onCancellationRequested(() => {
            vscode.commands.executeCommand(COMMAND_CANCEL_ALL_TRANSFER);
          });
        })
    );
  }

  private close() {
    const finish = this.finish;
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
