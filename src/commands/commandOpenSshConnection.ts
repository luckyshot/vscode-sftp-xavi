import * as vscode from 'vscode';
import { COMMAND_OPEN_CONNECTION_IN_TERMINAL } from '../constants';
import { getAllFileService } from '../modules/serviceManager';
import { ExplorerRoot } from '../modules/remoteExplorer';
import { interpolate } from '../utils';
import { splitSshArguments } from '../helper/sshArguments';
import { checkCommand } from './abstract/createCommand';

const isWindows = process.platform === 'win32';

function shouldUseAgent(config) {
  return typeof config.agent === 'string' && config.agent.length > 0;
}

function shouldUseKey(config) {
  return typeof config.privateKeyPath === 'string' && config.privateKeyPath.length > 0;
}

function adaptPath(filepath) {
  if (isWindows) {
    return filepath.replace(/\\\\/g, '\\');
  }

  // convert to unix style
  return filepath.replace(/\\\\/g, '/').replace(/\\/g, '/');
}


export default checkCommand({
  id: COMMAND_OPEN_CONNECTION_IN_TERMINAL,

  async handleCommand(exploreItem?: ExplorerRoot) {
    let remoteConfig;
    if (exploreItem && exploreItem.explorerContext) {
      remoteConfig = exploreItem.explorerContext.config;
      if (remoteConfig.protocol !== 'sftp') {
        return;
      }
    } else {
      const remoteItems = getAllFileService().reduce<
        { label: string; description: string; config: any }[]
      >((result, fileService) => {
        const config = fileService.getConfig();
        if (config.protocol === 'sftp') {
          result.push({
            label: config.name || config.remotePath,
            description: config.host,
            config,
          });
        }
        return result;
      }, []);
      if (remoteItems.length <= 0) {
        return;
      }

      const item = await vscode.window.showQuickPick(remoteItems, {
        placeHolder: 'Select a folder...',
      });
      if (item === undefined) {
        return;
      }

      remoteConfig = item.config;
    }

    const shellArgs = ['-t', '-l', remoteConfig.username, '-p', String(remoteConfig.port)];
    if (!shouldUseAgent(remoteConfig) && shouldUseKey(remoteConfig)) {
      shellArgs.push('-i', adaptPath(remoteConfig.privateKeyPath));
    }
    // The host is an argument, never executable local shell text.
    if (typeof remoteConfig.host !== 'string' || remoteConfig.host.startsWith('-') || /[\r\n\0]/.test(remoteConfig.host)) {
      throw new Error('Invalid SSH host');
    }
    shellArgs.push(remoteConfig.host);
    if (remoteConfig.sshCustomParams) {
      shellArgs.push(...splitSshArguments(interpolate(remoteConfig.sshCustomParams, { remotePath: remoteConfig.remotePath })));
    }
    const terminal = vscode.window.createTerminal({
      name: remoteConfig.name || 'SSH',
      shellPath: 'ssh',
      shellArgs,
    });
    terminal.show();
  },
});
