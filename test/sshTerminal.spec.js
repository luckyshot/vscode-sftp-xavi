jest.mock('../src/modules/serviceManager', () => ({ getAllFileService: jest.fn() }));
jest.mock('../src/commands/abstract/createCommand', () => ({ checkCommand: x => x }));
jest.mock('vscode', () => ({ window: { createTerminal: jest.fn(() => ({ show: jest.fn() })) } }));
const vscode = require('vscode');
const command = require('../src/commands/commandOpenSshConnection').default;
const { splitSshArguments } = require('../src/helper/sshArguments');

test('passes injected usernames and key paths as literal process arguments', async () => {
  const config = { host: 'example.com', username: 'user; printf INJECTED #', port: 22, protocol: 'sftp', privateKeyPath: '/tmp/$(touch injected)', name: 'test' };
  await command.handleCommand({ explorerContext: { config } });
  expect(vscode.window.createTerminal).toHaveBeenCalledWith({ name: 'test', shellPath: 'ssh', shellArgs: ['-t', '-l', config.username, '-p', '22', '-i', config.privateKeyPath, 'example.com'] });
});
test('tokenizes quoted SSH parameters without evaluating substitutions', () => {
  expect(splitSshArguments('-o "ConnectTimeout=10" "echo $(printf injected)"')).toEqual(['-o', 'ConnectTimeout=10', 'echo $(printf injected)']);
  expect(() => splitSshArguments('"unfinished')).toThrow('Unclosed quote');
});
