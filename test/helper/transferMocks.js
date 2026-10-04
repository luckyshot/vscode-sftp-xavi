const path = require('path');
const { Readable } = require('stream');
const { FileType } = require('../../src/core/fs/fileSystem');
const entry = (fspath, mtime = 1000, type = FileType.File) => ({ fspath, name: path.basename(fspath), mtime, atime: mtime, size: 1, mode: 0o644, type });
const filesystem = (entries = []) => ({
  pathResolver: path.posix, list: jest.fn().mockResolvedValue(entries),
  ensureDir: jest.fn().mockResolvedValue(), unlink: jest.fn().mockResolvedValue(),
  rmdir: jest.fn().mockResolvedValue(), open: jest.fn().mockResolvedValue(1),
  get: jest.fn().mockImplementation(() => Promise.resolve(Readable.from('x'))),
  put: jest.fn().mockResolvedValue(), close: jest.fn().mockResolvedValue(),
  futimes: jest.fn().mockResolvedValue(), fstat: jest.fn().mockResolvedValue({ mode: 0o644 }),
  lstat: jest.fn().mockResolvedValue({ mode: 0o644, type: FileType.File }),
  readlink: jest.fn().mockResolvedValue('target'), symlink: jest.fn().mockResolvedValue(),
  chmod: jest.fn().mockResolvedValue(), rename: jest.fn().mockResolvedValue(),
  renameAtomic: jest.fn().mockResolvedValue(),
});
const config = (srcFs, targetFs, transferOption = {}) => ({ srcFs, targetFs, srcFsPath: '/local', targetFsPath: '/remote', transferDirection: 'local ➞ remote', transferOption });
module.exports = { entry, filesystem, config };
