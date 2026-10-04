// Copy getter-backed properties before graceful-fs patches the fs object.
const fs = { ...require('memfs').fs };
fs.realpath.native = fs.realpath;
fs.realpathSync.native = fs.realpathSync;

// memfs does not disable stream auto-destruction when autoClose is false,
// unlike Node's fs. Keep caller-owned descriptors open for futimes and close.
const createWriteStream = fs.createWriteStream.bind(fs);
fs.createWriteStream = (path, options) => createWriteStream(path, {
  ...options,
  autoDestroy: false,
});

fs.__mock__ = true;
module.exports = fs;
