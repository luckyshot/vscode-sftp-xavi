import { COMMAND_CHECK_FOR_UPDATES } from '../constants';
import { checkForUpdatesNow } from '../modules/updateChecker';
import { checkCommand } from './abstract/createCommand';

export default checkCommand({
  id: COMMAND_CHECK_FOR_UPDATES,

  handleCommand() {
    return checkForUpdatesNow();
  },
});
