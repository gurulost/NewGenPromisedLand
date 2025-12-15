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
  // Patch: tldts
  {
    const distDir = path.resolve(__dirname, '..', 'node_modules', 'tldts', 'dist');
    if (fs.existsSync(distDir)) {
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
  }

  // Patch: detect-gpu (some installs can be missing `dist/`, breaking Vite's resolver)
  {
    const pkgDir = path.resolve(__dirname, '..', 'node_modules', 'detect-gpu');
    if (fs.existsSync(pkgDir)) {
      const distDir = path.join(pkgDir, 'dist');
      const esmEntry = path.join(distDir, 'detect-gpu.esm.js');
      const umdEntry = path.join(distDir, 'detect-gpu.umd.js');
      const dtsEntry = path.join(distDir, 'src', 'index.d.ts');

      const wroteEsm = ensureFile(
        esmEntry,
        [
          "export async function getGPUTier() {",
          "  return { tier: 0, type: 'FALLBACK', gpu: 'Unknown', isMobile: false, fps: 0 };",
          "}",
          "export default { getGPUTier };",
          "",
        ].join("\n")
      );

      const wroteUmd = ensureFile(
        umdEntry,
        [
          "(function (global, factory) {",
          "  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :",
          "  typeof define === 'function' && define.amd ? define(['exports'], factory) :",
          "  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.DetectGPU = {}));",
          "})(this, (function (exports) { 'use strict';",
          "  async function getGPUTier() {",
          "    return { tier: 0, type: 'FALLBACK', gpu: 'Unknown', isMobile: false, fps: 0 };",
          "  }",
          "  exports.getGPUTier = getGPUTier;",
          "  Object.defineProperty(exports, '__esModule', { value: true });",
          "}));",
          "",
        ].join("\n")
      );

      const wroteDts = ensureFile(
        dtsEntry,
        [
          "export type GPUTierResult = { tier: number; type: string; gpu: string; isMobile: boolean; fps: number };",
          "export function getGPUTier(): Promise<GPUTierResult>;",
          "export default { getGPUTier: typeof getGPUTier };",
          "",
        ].join("\n")
      );

      if (wroteEsm || wroteUmd || wroteDts) {
        console.log('[postinstall] Patched missing detect-gpu dist entrypoints');
      }
    }
  }
}

main();
