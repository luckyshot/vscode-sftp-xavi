# SFTP Xavi editor settings

Open Visual Studio Code settings and search for **SFTP Xavi**, or edit your settings JSON. The settings belong in editor/workspace settings rather than `.vscode/sftp.json`.

| Setting | Default | Description |
| --- | --- | --- |
| `sftpXavi.debug` | `false` | Enable logs in **View → Output → SFTP Xavi**. Reload after changing. |
| `sftpXavi.printDebugLog` | `false` | Alternative debug-log switch. Reload after changing. |
| `sftpXavi.downloadWhenOpenInRemoteExplorer` | `false` | Download a remote file instead of opening its remote view. |
| `sftpXavi.maxRemotePreviewBytes` | `10485760` | Largest remote file, in bytes, that Remote Explorer previews or content-compares. Download larger files instead. |
| `sftpXavi.mtimeToleranceSeconds` | `5` | Remote Explorer treats same-size files whose modified times differ by no more than this many seconds as identical. FTP profiles compare by size only. |

Rename the corresponding `sftp.*` settings when moving from the original extension. Connection configuration remains in `.vscode/sftp.json`; see the [configuration guide](configuration.md).
