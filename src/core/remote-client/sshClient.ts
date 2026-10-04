import { Client } from 'ssh2';
import upath from '../upath';
import RemoteClient, { ErrorCode, ConnectOption, Config } from './remoteClient';
import localFs from '../localFs';
import { FileSystem, RemoteFileSystem, SFTPFileSystem } from '../fs';
import logger from '../../logger';
import CustomError from '../customError';
import { verifyHostKey } from '../hostKeyVerifier';
import limitSftpHandles from '../sftpHandleLimiter';

export default class SSHClient extends RemoteClient {
  private sftp: any;
  private hoppingClients: SSHClient[];
  private stopHandleLimiter?: () => void;

  _initClient() {
    return new Client();
  }

  _hasProvideAuth(connectOption: ConnectOption) {
    return (
      // interactiveAuth : boolean
      connectOption.interactiveAuth === true ||
      // or interactiveAuth : array of phrases
      (Array.isArray(connectOption.interactiveAuth) && !!connectOption.interactiveAuth.length) ||
      // or key defined
      ['password', 'agent', 'privateKeyPath'].some(
        key => connectOption[key] != undefined
      )
    );
  }

  async _doConnect(
    connectOption: ConnectOption,
    config: Config
  ): Promise<void> {
    const { hop, ...option } = connectOption;

    let lastOption: ConnectOption = option;
    let fs: FileSystem | RemoteFileSystem = localFs;
    let sock;
    if (
      (Array.isArray(hop) && hop.length > 0) ||
      (hop && Object.keys(hop).length > 0)
    ) {
      this.hoppingClients = [];
      const connectOptions = Array.isArray(hop)
        ? [option].concat(hop)
        : [option, hop];
      lastOption = connectOptions.pop()!;

      for (let index = 0; index < connectOptions.length; index++) {
        const curOpt = connectOptions[index];
        if (curOpt.port === undefined) {
          curOpt.port = 22;
        }
        const preClient = this.hoppingClients[index - 1];
        if (preClient) {
          sock = await this._makeHopping(preClient, curOpt.host, curOpt.port);
          fs = new SFTPFileSystem(upath, {
            client: preClient,
          });
        }

        if (curOpt.privateKeyPath) {
          const buffer = await fs.readFile(curOpt.privateKeyPath);
          curOpt.privateKey = buffer.toString();
        }

        const client = new SSHClient(curOpt);
        this.hoppingClients.push(client);
        await client.connect({ ...curOpt, sock }, config);
      }

      const lastClient = this.hoppingClients[this.hoppingClients.length - 1];
      sock = await this._makeHopping(
        lastClient,
        lastOption.host,
        lastOption.port
      );
      fs = new SFTPFileSystem(upath, {
        client: lastClient,
      });
    }

    if (lastOption.privateKeyPath) {
      const buffer = await fs.readFile(lastOption.privateKeyPath);
      lastOption.privateKey = buffer.toString();
    }

    await this._connectSSHClient(this._client, { ...lastOption, sock }, config);
    this.sftp = await this._getSftp(this._client);

    if (lastOption.limitOpenFilesOnRemote) {
      const limit = lastOption.limitOpenFilesOnRemote === true ? 222 : lastOption.limitOpenFilesOnRemote;
      if (!Number.isInteger(limit) || limit < 1) throw new Error('limitOpenFilesOnRemote must be a positive integer or true');
      this.stopHandleLimiter = limitSftpHandles(this.sftp, limit);
    }
  }

  private async _connectSSHClient(
    client,
    remoteOption: ConnectOption,
    config: Config
  ): Promise<any> {
    const {
      interactiveAuth,
      connectTimeout,
      ...option
    } = remoteOption;

    // explict compare to true, cause we want to distinct between string and true
    if (option.passphrase === true) {
      option.passphrase = await config.askForPasswd(
        `[${option.host}]: Enter your passphrase`
      );
      if (option.passphrase === undefined) {
        throw new CustomError(ErrorCode.CONNECT_CANCELLED, 'cancelled');
      }
    }

    return new Promise<void>((resolve, reject) => {
      const handshakeTimeout = interactiveAuth
        ? Math.max(60000, connectTimeout || 0)
        : connectTimeout ?? 10000;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;
      const clearDeadline = () => {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        clearDeadline();
        reject(error instanceof CustomError
          ? error
          : new Error(`[${option.host}]: ${error.message}`));
      };
      const deadline = (timeout: number, message: string) => {
        clearDeadline();
        if (timeout > 0) {
          timer = setTimeout(() => {
            fail(new Error(message));
            client.destroy();
          }, timeout);
        }
      };
      const resumeHandshake = () => deadline(handshakeTimeout, 'SSH handshake timed out');

      if (interactiveAuth) {
        client.on('keyboard-interactive', function redo(
          name,
          instructions,
          instructionsLang,
          prompts,
          finish,
          stackedAnswers
        ) {
          // Copy the configured answers: pushing prompted ones onto the config array
          // would change the connection identity and leak into later connections.
          const answers = stackedAnswers ||
            (Array.isArray(interactiveAuth) ? [...interactiveAuth] : []);
          if (answers.length < prompts.length) {
            config.askForPasswd(`[${option.host}]: ${prompts[answers.length].prompt}`)
              .then(answer => {
                if (settled) return;
                if (answer === undefined) {
                  fail(new CustomError(ErrorCode.CONNECT_CANCELLED, 'cancelled'));
                  client.destroy();
                  return;
                }
                answers.push(answer);
                redo(name, instructions, instructionsLang, prompts, finish, answers);
              }).catch(fail);
          } else {
            finish(answers);
          }
        });
      }

      client
        .on('ready', () => {
          if (settled) return;
          settled = true;
          clearDeadline();
          resolve();
        })
        .on('error', fail)
        .on('close', () => {
          fail(new Error('SSH connection closed'));
          this.end();
        })
        .on('end', () => {
          fail(new Error('SSH connection ended'));
          this.end();
        });
      resumeHandshake();
      try {
        client.connect({
          keepaliveInterval: 1000 * 30,
          keepaliveCountMax: 2,
          ...option,
          // Own deadlines allow fingerprint confirmation to pause the handshake timeout.
          readyTimeout: 0,
          hostHash: undefined,
          hostVerifier: (key: Buffer, done: (trusted: boolean) => void) => {
            if (settled) return done(false);
            deadline(120000, 'Timed out while verifying SSH server fingerprint');
            verifyHostKey(option.host, option.port || 22, key, option.hostFingerprint)
              .then(trusted => {
                if (settled) return done(false);
                resumeHandshake();
                done(trusted);
              }, () => {
                if (settled) return done(false);
                resumeHandshake();
                done(false);
              });
          },
          tryKeyboard: !!interactiveAuth,
        });
      } catch (error) {
        fail(error);
      }
    });
  }

  private _getSftp(client): Promise<any> {
    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(sftp);
      });
    });
  }

  private _makeHopping(sshClient: SSHClient, dstHost, dstPort): Promise<any> {
    logger.info(`hopping from ${sshClient._option.host} to ${dstHost}`);
    return new Promise((resolve, reject) => {
      // Create a connect form 127.0.0.1:port to dstHost:dstPort
      sshClient._client.forwardOut(
        '127.0.0.1',
        sshClient._option.port,
        dstHost,
        dstPort,
        (error, stream) => {
          if (error) {
            return reject(error);
          }

          resolve(stream);
        }
      );
    });
  }

  end() {
    this.stopHandleLimiter?.();
    this.stopHandleLimiter = undefined;
    this._client.end();

    if (this.hoppingClients) {
      // last connect first end
      this.hoppingClients.reverse().forEach(client => client.end());
    }
  }

  getFsClient() {
    return this.sftp;
  }
}
