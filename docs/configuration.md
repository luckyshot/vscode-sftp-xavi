# SFTP Xavi configuration

Project connection settings live in `.vscode/sftp.json`. Run **SFTP Xavi: Config** to create the file. Existing files from the original extension remain compatible. The file may contain `//` and `/* */` comments and trailing commas.

## Quick start

```json
{
  "name": "My server",
  "protocol": "sftp",
  "host": "example.com",
  "port": 22,
  "username": "my-user",
  "remotePath": "/srv/www/site",
  "uploadOnSave": false,
  "ignore": ["**/.git/**", "**/node_modules/**"]
}
```

Leave `password` out to be prompted when connecting, or configure `privateKeyPath` for SSH key authentication. Keep upload on save disabled until your local folder and remote target are correct. You can use **Download Project** to initialize a local folder from the server.

Do not commit credentials. SFTP Xavi excludes `.vscode/sftp.json` from uploads, including Force Upload.

## VS Code settings

These settings belong in editor or workspace settings, rather than `sftp.json`:

| Setting | Default | Behavior |
| --- | --- | --- |
| `sftpXavi.debug` | `false` | Write debug logs to the SFTP Xavi output channel; reload after changing. |
| `sftpXavi.printDebugLog` | `false` | Alternative debug-log switch; reload after changing. |
| `sftpXavi.downloadWhenOpenInRemoteExplorer` | `false` | Download a remote file instead of opening its read-only remote view. |

When migrating, rename the corresponding `sftp.*` editor settings to `sftpXavi.*`. Connection option names inside `.vscode/sftp.json` do not change.

## Connection options

`host`, `username`, and `remotePath` identify the server account and target. SFTP is the default protocol and normally uses port 22; FTP normally uses port 21. `uploadOnSave`, `downloadOnOpen`, and `useTempFile` default to disabled. The default transfer concurrency is 4.

The following option reference is derived from the project's inherited JSON schemas. A server may not support every protocol-specific feature. Profiles can override connection and transfer options; `context` and `watcher` belong at the top level. Examples of profiles, multiple contexts, and SSH hopping are in the [README](../README.md#example-configurations).


### rootOption options

| Option | Type | Description |
| --- | --- | --- |
| `name` | string | A string to identify your config. |
| `context` | string | Relative path relative to the workspace root folder. |
| `watcher` | object | Watch external modification. |
| `defaultProfile` | string | Profile name you want to set as default. |

### option options

| Option | Type | Description |
| --- | --- | --- |
| `remote` | string | Name of remote which configs with `remoteFs.remote` in User Setting. Configuration will get merged to this remote. |
| `uploadOnSave` | boolean | True to upload on every save operation of VS Code. |
| `useTempFile` | boolean | True to upload temp file on every save operation of VS Code to avoid breaking a webpage when a user acceses it while the file is still being uploaded (is incomplete). |
| `openSsh` | boolean | True to enable atomic file uploads (only supported by openSSH servers). if true, `useTempFile` must also be set to true. |
| `downloadOnOpen` | mixed | True to download when a file opens. |
| `syncOption` | object | Configuration the behavior of `Sync` command. |
| `ignore` | array | Files to ignore. Same behavior as gitignore. |
| `ignoreFile` | string | Absolute path to the ignore file or Relative path relative to the workspace root folder. |
| `remoteExplorer` | object | Remote Explorer Setting. |
| `remoteTimeOffsetInHours` | number | The number of hours difference between the local machine and remote/server. (remote minus local) |
| `limitOpenFilesOnRemote` | mixed | Limit the open file descriptors to the specific number in a remote server. Set to true for using default limit(222). Do not set this unless you have to. |

### host options

| Option | Type | Description |
| --- | --- | --- |
| `host` | string | Hostname or IP address of the server. |
| `port` | number | Port number of the server. |
| `username` | string | Username for authentication. |
| `password` | string | Password for password-based user authentication. |
| `remotePath` | string | The absolute path on remote. |
| `connectTimeout` | number | How long (in milliseconds) to wait for the connect to complete. |

### sftp options

| Option | Type | Description |
| --- | --- | --- |
| `agent` | string | Path to ssh-agent's UNIX socket for ssh-agent-based user authentication.  Windows users: set to 'pageant' for authenticating with Pageant or (actual) path to a cygwin "UNIX socket". |
| `privateKeyPath` | string | Absolute path to user private key. |
| `passphrase` | mixed | For an encrypted private key, this is the passphrase string used to decrypt it. Set to true for enable passphrase dialog. This will prevent from using cleartext passphrase in this config. |
| `interactiveAuth` | mixed | Keyboard interaction authentication mechanism. For example using Google Authentication. |
| `algorithms` | object | Explicit overrides for the default transport layer algorithms used for the connection. |
| `sshConfigPath` | string | Absolute path to your SSH configuration file (eg. ~/.ssh/config) |
| `concurrency` | number | Concurrency number. |
| `sshCustomParams` | string | Extra parameters append to SSH command using by "Open SSH in Terminal" |

### ftp options

| Option | Type | Description |
| --- | --- | --- |
| `secure` | string, boolean | Set to true for both control and data connection encryption, 'control' for control connection encryption only, or 'implicit' for implicitly encrypted control connection (this mode is deprecated in modern times, but usually uses port 990). |
| `secureOptions` | object | Options to be passed to tls.connect(). Default: (none) |

## Profiles and multiple projects

Set `profiles` to an object of named overrides, then select one with **SFTP Xavi: Set Profile**. `defaultProfile` chooses the initial profile. To configure multiple contexts, use an array of configurations with distinct `context` values. See the [examples](../README.md#profiles).

## SSH configuration and temporary uploads

`sshConfigPath` reads an SSH configuration file; the default is `~/.ssh/config`. Matching host sections can supply connection details. Explicit connection options retain precedence, while `HostName` resolves the configured host alias.

With `useTempFile: true`, uploads use a temporary remote file before replacing the target. Set `openSsh: true` only when the server supports the OpenSSH atomic-rename extension, and also enable `useTempFile`.

## Ignore rules

`ignore` contains Git-style patterns; `ignoreFile` loads additional patterns from a file. Protected SFTP configuration files remain excluded even if patterns explicitly negate them or Force Upload is used.

The schema files in [schema](../schema) provide editor completion. Historical upstream documentation is available separately as [reference material](upstream-references.md).

## Detailed connection reference

The detailed option descriptions below are adapted from the upstream documentation; upstream authors are credited in [NOTICE.md](../NOTICE.md).

## Table of Contents

### Configuration
- [name](#name)
- [context](#context)
- [protocol](#protocol)
- [host](#host)
- [port](#port)
- [username](#username)
- [password](#password)
- [remotePath](#remotepath)
- [filePerm](#fileperm)
- [dirPerm](#dirperm)
- [uploadOnSave](#uploadonsave)
- [useTempFile](#usetempfile)
- [openSsh](#openssh)
- [downloadOnOpen](#downloadonopen)
- [syncOption](#syncoption)
- [ignore](#ignore)
- [ignoreFile](#ignorefile)
- [watcher](#watcher)
- [remoteTimeOffsetInHours](#remotetimeoffsetinhours)
- [remoteExplorer](#remoteexplorer)
- [concurrency](#concurrency)
- [connectTimeout](#connecttimeout)
- [limitOpenFilesOnRemote](#limitopenfilesonremote)

### SFTP only configuration
- [agent](#agent)
- [privateKeyPath](#privatekeypath)
- [passphrase](#passphrase)
- [interactiveAuth](#interactiveauth)
- [algorithms](#algorithms)
- [sshConfigPath](#sshconfigpath)
- [sshCustomParams](#sshcustomparams)

### FTP(s) only configuration
- [secure](#secure)
- [secureOptions](#secureoptions)



## Configuration

### name
A string to identify your configuration.

| Key | Value |
| --- | --- |
| *name* | *string* |

```json
{
  "name": "My Server"
}
```

### context
A path relative to the workspace root folder. <br>
Use this when you want to map a subfolder to the `remotePath`.

| Key | Value | Default |
| --- | --- | --- |
| *context* | *string* | *The workspace root.* |

```json
{
  "context": "/_subfolder_"
}
```

### protocol
Protocol to be used.

| Key | Value | Default |
| --- | --- | --- |
| *protocol* | `sftp` *or* `ftp` | `sftp` |

```json
{
  "protocol": "sftp"
}
```

### host
Hostname or IP address of the server.

| Key | Value |
| --- | --- |
| *host* | *string* |

```json
{
  "host": "server.example.com"
}
```

### port
Port number of the server.

| Key | Value |
| --- | --- |
| *port* | *integer* |

```json
{
  "port": 22
}
```

### username
Username for authentication.

| Key | Value |
| --- | --- |
| *username* | *string* |

```json
{
  "username": "user1"
}
```

### password
[!WARNING]
**Passwords are stored as plain-text!**

The password for password-based user authentication.

| Key | Value |
| --- | --- |
| *password* | *string* |

```json
{
  "password": "Password123"
}
```

### remotePath
The absolute path on the remote host.

| Key | Value | Default |
| --- | --- | --- |
| *remotePath* | *string* | `/` |

```json
{
  "remotePath": "/_subfolder_"
}
```

### filePerm
Set octal file permissions for new files.

| Key | Value | Default |
| --- | --- | --- |
| *filePerm* | *number* | `false` |

```json
{
  "filePerm": 644
}
```

### dirPerm
Set octal directory permissions for new directories.

| Key | Value | Default |
| --- | --- | --- |
| *dirPerm* | *number* | `false` |

```json
{
  "dirPerm": 750
}
```

### uploadOnSave
Upload on every save operation of Visual Studio Code.

| Key | Value | Default |
| --- | --- | --- |
| *uploadOnSave* | *boolean* | `false` |

```json
{
  "uploadOnSave": true
}
```

### useTempFile
Upload temp file on every save operation of Visual Studio Code to avoid breaking a webpage when a user accesses it while the file is still being uploaded (is incomplete).

| Key | Value | Default |
| --- | --- | --- |
| *useTempFile* | *boolean* | `false` |

```json
{
  "useTempFile": true
}
```

### openSsh
Enable atomic file uploads (*only supported by openSSH servers*).

| 💡 Important |
| :--- |
| *If set to* `true`*, the* `useTempFile` *option must also be set to* `true`.|

| Key | Value | Default |
| --- | --- | --- |
| *openSsh* | *boolean* | `false` |

```json
{
  "openSsh": true,
  "useTempFile": true
}
```

### downloadOnOpen
Download the file from the remote server whenever it is opened.

| Key | Value | Default |
| --- | --- | --- |
| *downloadOnOpen* | *boolean* | `false` |

```json
{
  "downloadOnOpen": true
}
```

### syncOption
Configure the behavior of the `Sync` command.

| Key | Value | Default |
| --- | --- | --- |
| *syncOption* | *object* | `{}` |

#### syncOption.delete
Delete extraneous files from destination directories.

| Key | Value |
| --- | --- |
| *syncOption.delete* | *boolean* |

#### syncOption.skipCreate
Skip creating new files on the destination.

| Key | Value |
| --- | --- |
| *syncOption.skipCreate* | *boolean* |

#### syncOption.ignoreExisting
Skip updating files that exist on the destination.

| Key | Value |
| --- | --- |
| *syncOption.ignoreExisting* | *boolean* |

#### syncOption.update
Update the destination only if a newer version is on the source filesystem.

| Key | Value |
| --- | --- |
| *syncOption.update* | *boolean* |

```json
{
  "syncOption": {
    "delete": true,
    "skipCreate": false,
    "ignoreExisting": false,
    "update": true
  },
}
```

### useTempFile
Upload temp file on every save operation of Visual Studio Code to avoid breaking a webpage when a user accesses it while the file is still being uploaded (is incomplete).

| Key | Value | Default |
| --- | --- | --- |
| *useTempFile* | *boolean* | `false` |

```json
{
  "useTempFile": true
}
```

### ignore
Ignore can be used to ignore files and folders from sync, and even supports wildcards using `*`. <br>
This is the same behavior as gitignore, all paths relative to context of the current configuration.

`.vscode/sftp.json` is always excluded because it may contain connection credentials, including configurations in nested folders. An empty ignore list, a negated pattern, or Force Upload cannot enable uploading these files. Other `.vscode` files follow your configured ignore patterns.

| Key | Value | Default |
| --- | --- | --- |
| *ignore* | *string[]* | `[]` |

```json
{
  "ignore": [
    "/.vscode",
    "/.git",
    "/.cache",
    "/_subfolder_",
    ".DS_Store",
    "*.gz",
    "*.log"
  ],
}
```

### ignoreFile
Absolute path to the ignore file or Relative path relative to the workspace root folder.

| Key | Value |
| --- | --- |
| *ignoreFile* | *string* |

```json
{
  "ignoreFile": "/.vscode/sftp.json"
}
```

### watcher
Configure the behavior of the `watcher` command.

| Key | Value | Default |
| --- | --- | --- |
| *watcher* | *object* | `{}` |

#### watcher.files
Glob patterns that are watched and when edited outside of the Visual Studio Code editor are processed.

| 💡 Important |
| :--- |
| *Set* `uploadOnSave` *to* `false` *when you watch everything.*|

| Key | Value |
| --- | --- |
| *watcher.files* | *string* |

#### watcher.autoUpload
Upload when the file changed.

| Key | Value |
| --- | --- |
| *watcher.autoUpload* | *boolean* |

#### watcher.autoDelete
Delete when the file is removed.

| Key | Value |
| --- | --- |
| *watcher.autoDelete* | *boolean* |
```json
{
  "watcher": {
    "files": "**/*",
    "autoUpload": true,
    "autoDelete": true
  },
}
```

### remoteTimeOffsetInHours
The number of hours difference between the local machine and the remote server (remote minus local).

| Key | Value | Default |
| --- | --- | --- |
| *remoteTimeOffsetInHours* | *number* | `0` |

```json
{
  "remoteTimeOffsetInHours": 3
}
```

### remoteExplorer
Configure the behavior of the `remoteExplorer` command.

| Key | Value | Default |
| --- | --- | --- |
| *remoteExplorer* | *object* | `{}` |

#### remoteExplorer.filesExclude
Configure that patterns for excluding files and folders. <br>
The Remote Explorer decides which files and folders to show or hide based on this setting..

| Key | Value |
| --- | --- |
| *remoteExplorer.filesExclude* | *string[]* |

#### remoteExplorer.order

| Key | Value |
| --- | --- |
| *remoteExplorer.order* | *number* |
```json
{
  "remoteExplorer": {
    "filesExclude": [],
    "order": 0
  }
}
```

### concurrency
Lowering the concurrency could get more stability because some clients/servers have some sort of configured/hard coded limit.

| Key | Value | Default |
| --- | --- | --- |
| *concurrency* | *number* | `4` |

```json
{
  "concurrency": 3
}
```

### connectTimeout
The maximum connection time.

| Key | Value | Default |
| --- | --- | --- |
| *connectTimeout* | *number* | `10000` |

```json
{
  "connectTimeout": 15000
}
```

### limitOpenFilesOnRemote
Limit open file descriptors to the specific number in a remote server. <br>
Set to true for using default `limit(222)`.

| 💡 Important |
| :--- |
| *Do not set this unless you have to!* |

| Key | Value | Default |
| --- | --- | --- |
| *limitOpenFilesOnRemote* | *mixed* | `false` |

```json
{
  "limitOpenFilesOnRemote": 15000
}
```


## SFTP only configuration

### agent
Path to ssh-agent's UNIX socket for ssh-agent-based user authentication. <br>
Windows users must set to 'pageant' for authenticating with Pagenat or (actual) path to a Cygwin "UNIX socket". <br>
It'd get more stability because some client/server have some sort of configured/hard coded limit.

| Key | Value |
| --- | --- |
| *agent* | *string* |

```json
{
  "agent": "/_subfolder_/agent"
}
```

### privateKeyPath
Absolute path to user private key.

| Key | Value |
| --- | --- |
| *privateKeyPath* | *string* |

```json
{
  "privateKeyPath": "/.ssh/key.pem"
}
```

### passphrase
For an encrypted private key, this is the passphrase string used to decrypt it. <br>
Set to 'true' for enable passphrase dialog. This will prevent from using cleartext passphrase in this config.

| Key | Value |
| --- | --- |
| *passphrase* | *mixed* |

```json
{
  "passphrase": true
}
```

### interactiveAuth
Enable keyboard interaction authentication mechanism. Set to 'true' to enable `verifyCode` dialog. <br>
For example using Google Authentication (multi-factor). Or pass array of predefined phrases to automatically enter them without user prompting.

| 💡 Note |
| :--- |
| *Requires the server to have keyboard-interactive authentication enabled.* |

| Key | Value | Default |
| --- | --- | --- |
| *interactiveAuth* | *boolean*\|*string[]* | 'false' |

```json
{
  "interactiveAuth": true
}
```

### algorithms
Explicit overrides for the default transport layer algorithms used for the connection.

**Default**:
```json
{
  "algorithms": {
    "kex": [
      "ecdh-sha2-nistp256",
      "ecdh-sha2-nistp384",
      "ecdh-sha2-nistp521",
      "diffie-hellman-group-exchange-sha256"
    ],
    "cipher": [
      "aes128-gcm",
		"aes128-gcm@openssh.com",
		"aes256-gcm",
		"aes256-gcm@openssh.com",
		"aes128-cbc",
		"aes192-cbc",
		"aes256-cbc",
		"aes128-ctr",
		"aes192-ctr",
		"aes256-ctr"
    ],
    "serverHostKey": [
      "ssh-rsa",
      "ssh-dss",
      "ssh-ed25519",
      "ecdsa-sha2-nistp256",
      "ecdsa-sha2-nistp384",
      "ecdsa-sha2-nistp521",
      "rsa-sha2-512",
      "rsa-sha2-256"
    ],
    "hmac": [
      "hmac-sha2-256",
      "hmac-sha2-512"
    ]
  },
}
```

### sshConfigPath
Absolute path to your SSH configuration file.

| Key | Value | Default |
| --- | --- | --- |
| *sshConfigPath* | *string* | `~/.ssh/config` |

```json
{
  "sshConfigPath": "~/.ssh/config"
}
```

### sshCustomParams
Extra parameters appended to the SSH command used by "Open SSH in Terminal".

| Key | Value |
| --- | --- |
| *sshCustomParams* | *string* |

```json
{
  "sshCustomParams": "-g"
}
```


## FTP(s) only configuration

### secure
Set to true for both control and data connection encryption. <br>
Set to `control` for control encryption only, or `implicit` for implicitly encrypted control connection (this mode is deprecated in modern times, but usually uses port 990).

| Key | Value | Default |
| --- | --- | --- |
| *secure* | *mixed* | `false` |

```json
{
  "secure": control
}
```

### secureOptions
Additional options to be passed to `tls.connect()`.

| 💡 Note |
| :--- |
| *See [TLS connect options callback](https://nodejs.org/api/tls.html#tls_tls_connect_options_callback).* |

| Key | Value |
| --- | --- |
| *secureOptions* | *object* |

```json
{
  "secureOptions": {
    "enableTrace": true
  }
}
```
