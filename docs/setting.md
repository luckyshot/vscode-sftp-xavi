# SFTP Xavi editor settings

Open Visual Studio Code settings and search for **SFTP Xavi**, or edit your settings JSON. The settings belong in editor/workspace settings rather than `.vscode/sftp.json`.

| Setting | Default | Description |
| --- | --- | --- |
| `sftpXavi.debug` | `false` | Enable logs in **View → Output → SFTP Xavi**. Reload after changing. |
| `sftpXavi.printDebugLog` | `false` | Alternative debug-log switch. Reload after changing. |
| `sftpXavi.downloadWhenOpenInRemoteExplorer` | `false` | Download a remote file instead of opening its remote view. |

Rename the corresponding `sftp.*` settings when moving from the original extension. Connection configuration remains in `.vscode/sftp.json`; see the [configuration guide](configuration.md).
