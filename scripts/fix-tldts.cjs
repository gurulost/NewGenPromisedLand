/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

/**
 * Some npm installations of `tldts@6` can be missing the entrypoints referenced by its package.json:
 *   - main: dist/cjs/index.js
 *   - module: dist/es6/index.js
 *
 * This breaks `jsdom` (via `tough-cookie`) in Vitest.
 * Create lightweight shims if they don't exist.
 */
function ensureFile(filePath, contents) {
  if (fs.existsSync(filePath)) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
  return true;
}

function main() {
  const distDir = path.resolve(__dirname, '..', 'node_modules', 'tldts', 'dist');
  if (!fs.existsSync(distDir)) return;

  const cjsIndex = path.join(distDir, 'cjs', 'index.js');
  const es6Index = path.join(distDir, 'es6', 'index.js');

  const wroteCjs = ensureFile(
    cjsIndex,
    "module.exports = require('../index.cjs.min.js');\n"
  );

  const wroteEs6 = ensureFile(
    es6Index,
    "export * from '../index.esm.min.js';\nexport { default } from '../index.esm.min.js';\n"
  );

  if (wroteCjs || wroteEs6) {
    console.log('[postinstall] Patched missing tldts entrypoints');
  }
}

main();

