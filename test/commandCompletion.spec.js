jest.mock('../src/logger', () => ({ __esModule: true, default: { trace: jest.fn() } }));
jest.mock('../src/helper', () => ({ reportError: jest.fn() }));
const { createCommand } = require('../src/commands/abstract/createCommand');
const { reportError } = require('../src/helper');
test('command completion waits for asynchronous work', async () => {
  let release;
  const work = new Promise(resolve => { release = resolve; });
  const Command = createCommand({ id: 'test', name: 'test', handleCommand: () => work });
  const command = new Command(), onDone = jest.fn();
  command.onCommandDone(onDone);
  const done = command.run();
  await Promise.resolve();
  expect(onDone).not.toHaveBeenCalled();
  release(); await done;
  expect(onDone).toHaveBeenCalledTimes(1);
});
test('asynchronous errors reach the command error handler before completion', async () => {
  const error = new Error('async failure');
  const Command = createCommand({ id: 'test', name: 'test', handleCommand: async () => { throw error; } });
  const command = new Command(), onDone = jest.fn();
  command.onCommandDone(onDone);
  await command.run();
  expect(reportError).toHaveBeenCalledWith(error);
  expect(onDone).toHaveBeenCalledTimes(1);
});
