# SFTP Xavi commands

Open the Command Palette and search for **SFTP Xavi**. Some actions appear only in editor, file, folder, or remote-explorer menus. Custom keybindings use the command IDs below.

| Command | ID |
| --- | --- |
| SFTP Xavi: Config | `sftpXavi.config` |
| SFTP Xavi: Set Profile | `sftpXavi.setProfile` |
| SFTP Xavi: Open SSH in Terminal | `sftpXavi.openConnectInTerminal` |
| SFTP Xavi: Cancel All Transfers | `sftpXavi.cancelAllTransfer` |
| SFTP Xavi: Upload File | `sftpXavi.upload.file` |
| SFTP Xavi: Upload Changed Files | `sftpXavi.upload.changedFiles` |
| SFTP Xavi: Upload Active File | `sftpXavi.upload.activeFile` |
| SFTP Xavi: Upload Folder | `sftpXavi.upload.folder` |
| SFTP Xavi: Upload Active Folder | `sftpXavi.upload.activeFolder` |
| SFTP Xavi: Upload Project | `sftpXavi.upload.project` |
| SFTP Xavi: Force Upload | `sftpXavi.forceUpload` |
| SFTP Xavi: Upload File To All Profiles | `sftpXavi.upload.file.to.allProfiles` |
| SFTP Xavi: Upload Active File To All Profiles | `sftpXavi.upload.activeFile.to.allProfiles` |
| SFTP Xavi: Upload Folder To All Profiles | `sftpXavi.upload.folder.to.allProfiles` |
| SFTP Xavi: Upload Active Folder To All Profiles | `sftpXavi.upload.activeFolder.to.allProfiles` |
| SFTP Xavi: Upload Project To All Profiles | `sftpXavi.upload.project.to.allProfiles` |
| SFTP Xavi: Force Upload To All Profiles | `sftpXavi.forceUpload.to.allProfiles` |
| SFTP Xavi: Download File | `sftpXavi.download.file` |
| SFTP Xavi: Download Active File | `sftpXavi.download.activeFile` |
| SFTP Xavi: Download Folder | `sftpXavi.download.folder` |
| SFTP Xavi: Download Active Folder | `sftpXavi.download.activeFolder` |
| SFTP Xavi: Download Project | `sftpXavi.download.project` |
| SFTP Xavi: Force Download | `sftpXavi.forceDownload` |
| SFTP Xavi: Sync Local -> Remote | `sftpXavi.sync.localToRemote` |
| SFTP Xavi: Sync Remote -> Local | `sftpXavi.sync.remoteToLocal` |
| SFTP Xavi: Sync Both Directions | `sftpXavi.sync.bothDirections` |
| SFTP Xavi: Diff with Remote | `sftpXavi.diff` |
| SFTP Xavi: Diff Active File with Remote | `sftpXavi.diff.activeFile` |
| SFTP Xavi: List | `sftpXavi.list` |
| SFTP Xavi: List Active Folder | `sftpXavi.listActiveFolder` |
| SFTP Xavi: List All | `sftpXavi.listAll` |
| SFTP Xavi: Delete | `sftpXavi.delete.remote` |
| SFTP Xavi: Create Folder | `sftpXavi.create.folder` |
| SFTP Xavi: Create File | `sftpXavi.create.file` |
| SFTP Xavi: Reveal in Explorer | `sftpXavi.revealInExplorer` |
| SFTP Xavi: Reveal in Remote Explorer | `sftpXavi.revealInRemoteExplorer` |
| SFTP Xavi: Edit in Local | `sftpXavi.remoteExplorer.editInLocal` |
| SFTP Xavi: View Content | `sftpXavi.viewContent` |
| SFTP Xavi: Refresh | `sftpXavi.remoteExplorer.refresh` |
| SFTP Xavi: Refresh Active Remote File | `sftpXavi.remoteExplorer.refreshActiveFile` |

**Upload Changed Files** uploads selected Git changes and excludes ignored files. **Force Upload** bypasses user ignore patterns but never uploads `.vscode/sftp.json` credential files.

Remote browsing is available in the **SFTP Xavi Explorer** view. Use **Set Profile** to choose a configured server profile and **Cancel All Transfers** to stop pending work.

## Detailed command behavior

## Common commands

### SFTP Xavi: Config
Create a new configuration file for a project.

### SFTP Xavi: Set Profile
Set the current profile.

#### KeyBindings Args
func(profileName: string)

### SFTP Xavi: Upload Active File
Upload the current file.

### SFTP Xavi: Upload Changed Files
Upload all files changed or created since the last commit to your Git.
Can be called by default keyboard shortcut `Ctrl+Alt+U`.

### SFTP Xavi: Upload Active Folder
Upload the entire folder the current file is located in.

### SFTP Xavi: Download Active File
Download the remote version of the current file and overwrite the local copy.

### SFTP Xavi: Download Active Folder
Download the entire folder the current file is located in.

### SFTP Xavi: Sync Local -> Remote
1. Any files that exist on both local and remote that have a different timestamp between local and remote are copied over.
2. Any files that only exist on the local are copied over.

You can change the default behavior by [syncOption](configuration.md#syncoption).

### SFTP Xavi: Sync Remote -> Local
Same as `Sync Local -> Remote`, but in the opposite direction.

### SFTP Xavi: Sync Both Directions
Compare file modification times, and will always perform the action that causes the newest file to be present in both locations.

*Only [skipCreate](configuration.md#syncoptionskipcreate) and [ignoreExisting](configuration.md#syncoptionignoreexisting) are valid for this command.*

### SFTP Xavi: List Active Folder
List the folder the current file is located in.

### sftpXavi.upload
Upload file or folders.

#### KeyBindings Args
func(fspaths: string[])

### sftpXavi.download
Download file or folders.

#### KeyBindings Args
func(fspaths: string[])

### SFTP Xavi: Cancel All Transfers
Stop the current transfers (upload and download). Batches of 5 or more files show a progress notification with a Cancel button, and clicking the spinning SFTP Xavi item in the status bar runs this command too.

### SFTP Xavi: Open SSH in Terminal
Open a terminal in Visual Studio Code and auto login to a specific server.


## Alt commands
An alternative command can be found when pressing `Alt` while opening a menu.

### Force Download
Download file but disregard ignore rules.

### Force Upload
Upload files while bypassing user ignore rules. Protected `.vscode/sftp.json` credential files are always excluded.
