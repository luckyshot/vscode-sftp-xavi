jest.mock('vscode', () => ({
  window: { withProgress: jest.fn() },
  ProgressLocation: { Notification: 15 },
  commands: { executeCommand: jest.fn() },
}), { virtual: true });
let vscode, progress;
beforeEach(() => {
  jest.useFakeTimers();
  jest.resetModules();
  vscode = require('vscode');
  // VS Code may run the task callback later than the call that requested it.
  vscode.window.withProgress.mockImplementation((_options, task) =>
    Promise.resolve().then(() => task({ report: jest.fn() }, { onCancellationRequested: jest.fn() })));
  progress = require('../src/ui/transferProgress').default;
});
afterEach(() => jest.useRealTimers());

test('a notification is requested once even when the scan timer and a batch both ask for it', async () => {
  progress.begin();
  jest.advanceTimersByTime(1000);
  progress.batchStart(10);
  await Promise.resolve();
  expect(vscode.window.withProgress).toHaveBeenCalledTimes(1);
});

test('small quick transfers never show a notification', () => {
  progress.begin();
  progress.batchStart(2);
  progress.batchEnd();
  progress.end();
  jest.advanceTimersByTime(5000);
  expect(vscode.window.withProgress).not.toHaveBeenCalled();
});

test('the notification closes when the work ends before VS Code runs its callback', async () => {
  progress.begin();
  progress.batchStart(10);
  progress.batchEnd();
  progress.end();
  let settled = false;
  const shown = vscode.window.withProgress.mock.results[0].value.then(() => { settled = true; });
  await shown;
  expect(settled).toBe(true);
});

test('a later operation can show a new notification after the first closed', async () => {
  progress.begin(); progress.batchStart(10); progress.batchEnd(); progress.end();
  await vscode.window.withProgress.mock.results[0].value;
  progress.begin(); progress.batchStart(10);
  expect(vscode.window.withProgress).toHaveBeenCalledTimes(2);
});
