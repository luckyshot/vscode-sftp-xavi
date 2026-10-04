import { LRUCache } from 'lru-cache';
import StatusBarItem from './ui/statusBarItem';
import { COMMAND_TOGGLE_OUTPUT, COMMAND_CANCEL_ALL_TRANSFER, EXTENSION_DISPLAY_NAME } from './constants';
import AppState from './modules/appState';
import RemoteExplorer from './modules/remoteExplorer';

interface App {
  fsCache: LRUCache<string, string>;
  state: AppState;
  sftpBarItem: StatusBarItem;
  remoteExplorer: RemoteExplorer;
}

const app: App = Object.create(null);

app.state = new AppState();
app.sftpBarItem = new StatusBarItem(
  () => {
    if (app.state.profile) {
      return `SFTP Xavi: ${app.state.profile}`;
    } else {
      return 'SFTP Xavi';
    }
  },
  EXTENSION_DISPLAY_NAME,
  COMMAND_TOGGLE_OUTPUT,
  COMMAND_CANCEL_ALL_TRANSFER
);
app.fsCache = new LRUCache<string, string>({ max: 6 });

export default app;
