const modern = require('glob-modern');

// Legacy callers use callbacks and treat Windows separators as separators.
const optionsFor = options => ({ windowsPathsNoEscape: true, ...options });
function glob(pattern, options, callback) {
  if (typeof options === 'function') { callback = options; options = undefined; }
  const result = modern.glob(pattern, optionsFor(options));
  if (callback) {
    result.then(matches => callback(null, matches), error => callback(error));
    return;
  }
  return result;
}

module.exports = Object.assign(glob, modern, {
  glob,
  sync: (pattern, options) => modern.globSync(pattern, optionsFor(options)),
  hasMagic: (pattern, options) => modern.hasMagic(pattern, optionsFor(options)),
});
