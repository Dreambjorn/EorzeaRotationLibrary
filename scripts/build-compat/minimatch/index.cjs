const modern = require('minimatch-modern');

// Older archive and directory tools expect require('minimatch') to be callable.
const optionsFor = options => ({ windowsPathsNoEscape: process.platform === 'win32', ...options });
function minimatch(filename, pattern, options) {
  return modern.minimatch(filename, pattern, optionsFor(options));
}

module.exports = Object.assign(minimatch, modern, {
  minimatch,
  match: (filenames, pattern, options) => modern.match(filenames, pattern, optionsFor(options)),
});
