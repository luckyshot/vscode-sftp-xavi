# SFTP Xavi

![SFTP Xavi icon](resources/icon.png)

An independently maintained file synchronization extension for Visual Studio Code.

Sync local projects with remote servers over SFTP and FTP, browse remote files, compare changes, and upload on save. Maintained by [Xavi Esteve](https://github.com/luckyshot), this fork builds on the work of Natizyskunk, liximomo, and their contributors with bug fixes, modern tooling, and ongoing development.

**Independent fork:** SFTP Xavi is not affiliated with or endorsed by Natizyskunk, liximomo, Microsoft, or the Visual Studio Code team. Upstream authors retain credit for their work.

The latest release is **[2.1.0](https://github.com/luckyshot/vscode-sftp-xavi/releases/latest)**, currently marked as a preview while broader live-server testing is pending. See the [fork release history](CHANGELOG.md).

- [Source code](https://github.com/luckyshot/vscode-sftp-xavi)
- [Issues and feature requests](https://github.com/luckyshot/vscode-sftp-xavi/issues)
- [Releases](https://github.com/luckyshot/vscode-sftp-xavi/releases)
- [Development guide](CONTRIBUTING.md)

- Features
  - [Browser remote with Remote Explorer](#remote-explorer)
  - Diff local and remote
  - Sync directory
  - Upload/Download
  - Upload on save
  - File Watcher
  - Multiple configurations
  - Switchable profiles
  - Temp File support
- [Commands](docs/commands.md)
- [Debug](#debug)
- [FAQ](#FAQ)

## Installation

SFTP Xavi is not published on the Visual Studio Marketplace. Install it from a VSIX file attached to a GitHub release.

Requires VS Code 1.100 or newer.

1. Disable or uninstall the original SFTP extension and any other SFTP fork that uploads on save. Running both on the same workspace can perform duplicate transfers.
2. Download `sftp-xavi-<version>.vsix` from the [latest release](https://github.com/luckyshot/vscode-sftp-xavi/releases/latest).
3. Install it, either from a terminal:

   ```bash
   code --install-extension sftp-xavi-2.1.0.vsix
   ```

   or in VS Code: open the Command Palette, run **Extensions: Install from VSIX...**, and choose the file.
4. Reload VS Code. Look for **SFTP Xavi** in Extensions. Its extension ID is `luckyshot.sftp-xavi`.

To update, run **SFTP Xavi: Check for Updates** from the Command Palette. It tells you which version you have and, if a newer release exists, offers to download and install it (**Update**), ignore that version (**Skip this version**), or ask again in 7 days (**Remind later**). SFTP Xavi also runs this check once a week and never installs anything without asking; set `sftpXavi.updates.checkAutomatically` to `false` to turn the weekly check off. You can also install the newer VSIX manually the same way as above; it replaces the old version. You can also build a VSIX yourself with `npm ci && npm run package`.

### Moving from the original extension

Existing `.vscode/sftp.json` configuration files and profiles continue to work. VS Code settings now use `sftpXavi.*`: rename `sftp.debug`, `sftp.printDebugLog`, and `sftp.downloadWhenOpenInRemoteExplorer` in your settings if you use them. Custom command keybindings now use `sftpXavi.*` command IDs instead of `sftp.*`.

Commands appear under **SFTP Xavi**, remote files open with the `sftp-xavi` URI scheme, and logs appear in the **SFTP Xavi** output channel. Reopen any remote editor tabs left over from the original extension.

## Documentation

- [Commands and command IDs](docs/commands.md)
- [Configuration and settings](docs/configuration.md)
- [Configuration examples](#example-configurations)
- [Migration from the original extension](#moving-from-the-original-extension)
- [Troubleshooting](FAQ.md)
- [Support and bug reports](SUPPORT.md)
- [Upstream reference documentation](docs/upstream-references.md)

## Usage
If the latest files are already on a remote server, you can start with an empty local folder,
then download your project, and from that point sync.

1. In `VS Code`, open a local directory you wish to sync to the remote server (or create an empty directory
that you wish to first download the contents of a remote server folder in order to edit locally).
2. `Ctrl+Shift+P` on Windows/Linux or `Cmd+Shift+P` on Mac open command palette, run `SFTP Xavi: config` command.
3. A basic configuration file will appear named `sftp.json` under the `.vscode` directory, open and edit the configuration parameters with your remote server information.

For instance:
```json
{
    "name": "Profile Name",
    "host": "name_of_remote_host",
    "protocol": "ftp",
    "port": 21,
    "secure": true,
    "username": "username",
    "remotePath": "/public_html/project", // <--- This is the path which will be downloaded if you "Download Project"
    "password": "password",
    "uploadOnSave": false
}
```
The password parameter in `sftp.json` is optional, if left out you will be prompted for a password on sync.
_Note：_ backslashes and other special characters must be escaped with a backslash.

4. Save and close the `sftp.json` file.
5. `Ctrl+Shift+P` on Windows/Linux or `Cmd+Shift+P` on Mac open command palette.
6. Type `sftp` and you'll now see a number of other commands. You can also access many of the commands from the project's file explorer context menus.
7. A good one to start with if you want to sync with a remote folder is `SFTP Xavi: Download Project`.  This will download the directory shown in the `remotePath` setting in `sftp.json` to your local open directory.
8. Done - you can now edit locally and after each save it will upload to sync your remote file with the local copy.
9. Enjoy!

See the [local configuration guide](docs/configuration.md) for settings and the [command reference](docs/commands.md) for available actions.

## Example configurations
See the [configuration guide](docs/configuration.md) for available options.

- [Simple](#simple)
- [Profiles](#profiles)
- [Multiple contexts](#multiple-context)
- [Connection hopping](#connection-hopping)
- [Configuration in user settings](#configuration-in-user-setting)

### Simple
```json
{
  "host": "host",
  "username": "username",
  "remotePath": "/remote/workspace"
}
```

### Profiles
```json
{
  "username": "username",
  "password": "password",
  "remotePath": "/remote/workspace/a",
  "watcher": {
    "files": "dist/*.{js,css}",
    "autoUpload": false,
    "autoDelete": false
  },
  "profiles": {
    "dev": {
      "host": "dev-host",
      "remotePath": "/dev",
      "uploadOnSave": true
    },
    "prod": {
      "host": "prod-host",
      "remotePath": "/prod"
    }
  },
  "defaultProfile": "dev"
}
```

_Note：_ `context` and `watcher` are only available at root level.

Use `SFTP Xavi: Set Profile` to switch profile.

### Multiple Context
The context must **not be same**.
```json
[
  {
    "name": "server1",
    "context": "project/build",
    "host": "host",
    "username": "username",
    "password": "password",
    "remotePath": "/remote/project/build"
  },
  {
    "name": "server2",
    "context": "project/src",
    "host": "host",
    "username": "username",
    "password": "password",
    "remotePath": "/remote/project/src"
  }
]
```

_Note：_ `name` is required in this mode.

### Connection Hopping
You can connect to a target server through a proxy with ssh protocol.

_Note：_ Variable substitution is not working in a hop configuration.

#### Single Hop
local -> hop -> target
```json
{
  "name": "target",
  "remotePath": "/path/in/target",

  // hop
  "host": "hopHost",
  "username": "hopUsername",
  "privateKeyPath": "/Users/localUser/.ssh/id_rsa", // <-- The key file is assumed on the local.

  "hop": {
    // target
    "host": "targetHost",
    "username": "targetUsername",
    "privateKeyPath": "/Users/hopUser/.ssh/id_rsa", // <-- The key file is assumed on the hop.
  }
}
```

#### Multiple Hop
local -> hopa -> hopb -> target
```json
{
  "name": "target",
  "remotePath": "/path/in/target",

  // hopa
  "host": "hopAHost",
  "username": "hopAUsername",
  "privateKeyPath": "/Users/hopAUsername/.ssh/id_rsa" // <-- The key file is assumed on the local.

  "hop": [
    // hopb
    {
      "host": "hopBHost",
      "username": "hopBUsername",
      "privateKeyPath": "/Users/hopaUser/.ssh/id_rsa" // <-- The key file is assumed on the hopa.
    },

    // target
    {
      "host": "targetHost",
      "username": "targetUsername",
      "privateKeyPath": "/Users/hopbUser/.ssh/id_rsa", // <-- The key file is assumed on the hopb.
    }
  ]
}
```

### Configuration in User Setting
You can use `remote` to tell sftp to get the configuration from [remote-fs](https://github.com/liximomo/vscode-remote-fs).

In User Setting:
```json
"remotefs.remote": {
  "dev": {
    "scheme": "sftp",
    "host": "host",
    "username": "username",
    "rootPath": "/path/to/somewhere"
  },
  "projectX": {
    "scheme": "sftp",
    "host": "host",
    "username": "username",
    "privateKeyPath": "/Users/xx/.ssh/id_rsa",
    "rootPath": "/home/foo/some/projectx"
  }
}
```

In sftp.json:
```json
{
  "remote": "dev",
  "remotePath": "/home/xx/",
  "uploadOnSave": false,
  "ignore": [".vscode", ".git", ".DS_Store"]
}
```

## Remote Explorer
Remote Explorer lets you explore files in remote. You can open Remote Explorer by:

1. Run Command `View: Show SFTP Xavi`.
2. Click SFTP Xavi view in Activity Bar.

You can only view a files content with Remote Explorer. Run command `SFTP Xavi: Edit in Local` to edit it in local.

### Local sync status and compare
Each remote entry is compared with the local file it maps to:

| Badge | Meaning |
|---|---|
| `M` | The file exists on both sides but differs |
| `R` | The file exists only on the remote |
| `!` | A file on one side and a folder on the other |
| greyed out | Matched by your `ignore` rules, so sync commands skip it |

Folders show how many of their loaded entries differ. Files show their size and age, and the tooltip lists both sides' sizes and modified times and which one is newer.

- Click a file that differs, or choose **Compare with Local**, to open a remote ↔ local diff.
- Choose **Check Whether Content Differs** to compare the actual bytes when size and time are ambiguous. Files larger than `sftpXavi.maxRemotePreviewBytes` are not compared.
- Uploads rarely keep modified times, so files of the same size whose times differ by at most `sftpXavi.mtimeToleranceSeconds` (default `5`) count as identical. FTP profiles compare by size only.

Status is calculated when a folder is listed and local-only files are not shown. Use the Refresh button after changing files locally.

### Multiple Select
You are able to select multiple files/folders at once on the remote server to download and upload. You can do it simply by holding down Ctrl or Shift while selecting all desired files, just like on the regular explorer view.

_Note：_ You need to manually refresh the parent folder after you **delete** a file if the explorer isn't correctly updated.

### Order
You can order the remote Explorer by adding the `remoteExplorer.order` parameter inside your `sftp.json` config file.

In sftp.json:
```json
{
  "remoteExplorer": {
    "order": 1 // <-- Default value is 0.
  }
}
```

## Debug
1. Open User Settings.
  - On Windows/Linux - `File > Preferences > Settings`
  - On macOS - `Code > Preferences > Settings`
2. Set `sftpXavi.debug` to `true` and reload vscode.
3. View the logs in `View > Output > SFTP Xavi`.

## FAQ
You can see all the Frequently Asked Questions [here](./FAQ.md).

## License and attribution

This project retains the original authors' copyright and license notices. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md) for attribution to Natizyskunk, liximomo, and the upstream contributors.

If you would like to support the original maintainer's work, you can [buy Natizyskunk a coffee](https://www.buymeacoffee.com/Natizyskunk).

### SSH server verification

SFTP verifies the server host key before authentication, including each jump host. The first connection asks you to verify and trust the displayed SHA256 fingerprint; accepted keys are stored in VS Code's extension global state. Changed keys are rejected. You can set `hostFingerprint` to an independently verified fingerprint such as `SHA256:...` in the server, profile, or hop configuration. When a server intentionally rotates its key, update this pin after verifying it with your administrator. Terminal connections use OpenSSH's own host-key verification.

Remote previews are limited to 10 MiB by default. Adjust `sftpXavi.maxRemotePreviewBytes` to change the limit, or download larger files. Cancelling a preview stops its read stream.

The Create File command requires exclusive creation, supported by SFTP and local filesystems. FTP cannot guarantee that an existing file will be preserved, so this command reports an unsupported operation for FTP.

SSH fingerprint verification has a separate two-minute deadline. The configured connection timeout resumes after verification.
