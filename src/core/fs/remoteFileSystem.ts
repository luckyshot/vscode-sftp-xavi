import FileSystem, { FileOption } from './fileSystem';
import readStream from '../readStream';
import { RemoteClient, ConnectOption, RemoteClientConfig } from '../remote-client';

interface RFSOptionDefaults {
  remoteTimeOffsetInHours: number;
}

type RFSOption = Partial<RFSOptionDefaults> & {
  client?: RemoteClient;
  clientOption?: ConnectOption;
};

const SECONDS_PER_HOUR = 60 * 60;
const MILLISECONDS_PER_HOUR = SECONDS_PER_HOUR * 1000;

const defaultOption: RFSOptionDefaults = {
  remoteTimeOffsetInHours: 0,
};

export default abstract class RemoteFileSystem extends FileSystem {
  protected client: RemoteClient;
  private _remoteTimeOffsetInMilliseconds: number = 0;
  private _remoteTimeOffsetInSeconds: number = 0;

  constructor(pathResolver, option: RFSOption) {
    super(pathResolver);

    const _option = {
      ...defaultOption,
      ...option,
    };
    const { client, clientOption, remoteTimeOffsetInHours } = _option;
    if (client) {
      this.client = client;
    } else if (clientOption) {
      this.client = this._createClient(clientOption);
    } else {
      throw new Error('No client or clientOption is provided');
    }

    this.setRemoteTimeOffsetInHours(remoteTimeOffsetInHours);
  }

  setRemoteTimeOffsetInHours(offset: number) {
    this._remoteTimeOffsetInSeconds = offset * SECONDS_PER_HOUR;
    this._remoteTimeOffsetInMilliseconds = offset * MILLISECONDS_PER_HOUR;
  }

  getClient() {
    if (!this.client) {
      throw new Error('client not found!');
    }
    return this.client;
  }

  connect(connectOpetion: ConnectOption, config: RemoteClientConfig): Promise<void> {
    return this.client.connect(
      connectOpetion,
      config
    );
  }

  onDisconnected(cb) {
    this.client.onDisconnected(cb);
  }

  end() {
    this.client.end();
  }

  toLocalTime(remoteTimeMilliseconds: number): number {
    return remoteTimeMilliseconds - this._remoteTimeOffsetInMilliseconds;
  }

  toRemoteTimeInSecnonds(localtime: number): number {
    return localtime + this._remoteTimeOffsetInSeconds;
  }

  async readFile(path: string, option?: FileOption): Promise<string | Buffer> {
    return readStream(options => this.get(path, options), option);
  }

  protected abstract _createClient(option: ConnectOption): any;
}
