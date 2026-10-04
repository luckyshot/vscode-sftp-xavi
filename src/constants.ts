import * as path from 'path';

const VENDOR_FOLDER = '.vscode';

export const EXTENSION_NAME = 'sftpXavi';
export const EXTENSION_DISPLAY_NAME = 'SFTP Xavi';
export const REMOTE_EXPLORER_VIEW_ID = 'sftpXavi.remoteExplorer';
export const SETTING_KEY_REMOTE = 'remotefs.remote';

export const REMOTE_SCHEME = 'sftp-xavi';

export const CONGIF_FILENAME = 'sftp.json';
export const CONFIG_PATH = path.join(VENDOR_FOLDER, CONGIF_FILENAME);

// command not in package.json
export const COMMAND_TOGGLE_OUTPUT = 'sftpXavi.toggleOutput';

// commands in package.json
export const COMMAND_CONFIG = 'sftpXavi.config';
export const COMMAND_SET_PROFILE = 'sftpXavi.setProfile';
export const COMMAND_CANCEL_ALL_TRANSFER = 'sftpXavi.cancelAllTransfer';
export const COMMAND_OPEN_CONNECTION_IN_TERMINAL = 'sftpXavi.openConnectInTerminal';

export const COMMAND_FORCE_UPLOAD = 'sftpXavi.forceUpload';
export const COMMAND_UPLOAD = 'sftpXavi.upload';
export const COMMAND_UPLOAD_FILE = 'sftpXavi.upload.file';
export const COMMAND_UPLOAD_CHANGEDFILES = 'sftpXavi.upload.changedFiles';
export const COMMAND_UPLOAD_ACTIVEFILE = 'sftpXavi.upload.activeFile';
export const COMMAND_UPLOAD_FOLDER = 'sftpXavi.upload.folder';
export const COMMAND_UPLOAD_ACTIVEFOLDER = 'sftpXavi.upload.activeFolder';
export const COMMAND_UPLOAD_PROJECT = 'sftpXavi.upload.project';

export const COMMAND_FORCE_UPLOAD_TO_ALL_PROFILES = 'sftpXavi.forceUpload.to.allProfiles';
export const COMMAND_UPLOAD_TO_ALL_PROFILES = 'sftpXavi.upload.to.allProfiles';
export const COMMAND_UPLOAD_FILE_TO_ALL_PROFILES = 'sftpXavi.upload.file.to.allProfiles';
export const COMMAND_UPLOAD_ACTIVEFILE_TO_ALL_PROFILES = 'sftpXavi.upload.activeFile.to.allProfiles';
export const COMMAND_UPLOAD_FOLDER_TO_ALL_PROFILES = 'sftpXavi.upload.folder.to.allProfiles';
export const COMMAND_UPLOAD_ACTIVEFOLDER_TO_ALL_PROFILES = 'sftpXavi.upload.activeFolder.to.allProfiles';
export const COMMAND_UPLOAD_PROJECT_TO_ALL_PROFILES = 'sftpXavi.upload.project.to.allProfiles';

export const COMMAND_FORCE_DOWNLOAD = 'sftpXavi.forceDownload';
export const COMMAND_DOWNLOAD = 'sftpXavi.download';
export const COMMAND_DOWNLOAD_FILE = 'sftpXavi.download.file';
export const COMMAND_DOWNLOAD_ACTIVEFILE = 'sftpXavi.download.activeFile';
export const COMMAND_DOWNLOAD_FOLDER = 'sftpXavi.download.folder';
export const COMMAND_DOWNLOAD_ACTIVEFOLDER = 'sftpXavi.download.activeFolder';
export const COMMAND_DOWNLOAD_PROJECT = 'sftpXavi.download.project';

export const COMMAND_SYNC_LOCAL_TO_REMOTE = 'sftpXavi.sync.localToRemote';
export const COMMAND_SYNC_REMOTE_TO_LOCAL = 'sftpXavi.sync.remoteToLocal';
export const COMMAND_SYNC_BOTH_DIRECTIONS = 'sftpXavi.sync.bothDirections';

export const COMMAND_DIFF = 'sftpXavi.diff';
export const COMMAND_DIFF_ACTIVEFILE = 'sftpXavi.diff.activeFile';
export const COMMAND_LIST = 'sftpXavi.list';
export const COMMAND_LIST_ACTIVEFOLDER = 'sftpXavi.listActiveFolder';
export const COMMAND_LIST_ALL = 'sftpXavi.listAll';
export const COMMAND_DELETE_REMOTE = 'sftpXavi.delete.remote';
export const COMMAND_REVEAL_IN_EXPLORER = 'sftpXavi.revealInExplorer';
export const COMMAND_REVEAL_IN_REMOTE_EXPLORER = 'sftpXavi.revealInRemoteExplorer';

export const COMMAND_REMOTEEXPLORER_REFRESH = 'sftpXavi.remoteExplorer.refresh';
export const COMMAND_REMOTEEXPLORER_REFRESH_ACTIVE_FILE = "sftpXavi.remoteExplorer.refreshActiveFile"
export const COMMAND_REMOTEEXPLORER_EDITINLOCAL = 'sftpXavi.remoteExplorer.editInLocal';
export const COMMAND_REMOTEEXPLORER_VIEW_CONTENT = 'sftpXavi.viewContent';

export const COMMAND_CREATE_FOLDER = 'sftpXavi.create.folder';
export const COMMAND_CREATE_FILE = 'sftpXavi.create.file';
