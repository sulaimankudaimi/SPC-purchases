/**
 * scripts/register-font-hook.cjs
 * خطاف Node.js لتحميل خطوط woff2 بصيغة ?inline كـ Data URI في سياق اختبارات tsx
 */
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  try {
    const Module = require('module');
    const origResolve = Module._resolveFilename;
    Module._resolveFilename = function (request, parent, isMain, options) {
      if (typeof request === 'string' && request.includes('?inline')) {
        request = request.replace(/\?inline$/, '');
      }
      return origResolve.call(this, request, parent, isMain, options);
    };

    const fs = require('fs');
    Module._extensions['.woff2'] = (m, filename) => {
      const buf = fs.readFileSync(filename);
      m.exports = 'data:font/woff2;base64,' + buf.toString('base64');
    };
    Module._extensions['.woff'] = (m, filename) => {
      const buf = fs.readFileSync(filename);
      m.exports = 'data:font/woff;base64,' + buf.toString('base64');
    };
  } catch {
    // Ignore in non-Node environments
  }
}
