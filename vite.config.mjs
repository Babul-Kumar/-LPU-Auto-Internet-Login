import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Helper: copy entire directory recursively ────────────────────────────────
function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath  = `${src}/${entry}`;
    const destPath = `${dest}/${entry}`;
    if (statSync(srcPath).isDirectory()) copyDir(srcPath, destPath);
    else copyFileSync(srcPath, destPath);
  }
}

// Content scripts that must NOT use ES module syntax (injected as classic scripts)
const IIFE_ENTRIES = [
  'src/content/autologin',
  'src/content/portal-registry',
  'popup/popup',
];

export default defineConfig({
  build: {
    outDir:      'dist',
    emptyOutDir: true,
    minify:      'terser',
    terserOptions: {
      compress: { drop_console: false, drop_debugger: true, passes: 2 },
      mangle:   { toplevel: true },
      format:   { comments: false },
    },
    rollupOptions: {
      input: {
        'src/background/service-worker': resolve(__dirname, 'src/background/service-worker.js'),
        'src/content/autologin':         resolve(__dirname, 'src/content/autologin.js'),
        'src/content/portal-registry':   resolve(__dirname, 'src/content/portal-registry.js'),
        'popup/popup':                   resolve(__dirname, 'popup/popup.js'),
      },
      output: {
        // ES modules work for the service worker (MV3 supports ESM SWs).
        // Content scripts are already written as IIFEs / no-export scripts,
        // so outputting them as ES modules is still safe — they have no
        // top-level import/export statements that would break injection.
        format:         'es',
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        manualChunks:   undefined,
      },
    },
  },

  plugins: [
    {
      name: 'copy-extension-assets',
      closeBundle() {
        mkdirSync(resolve(__dirname, 'dist'), { recursive: true });
        mkdirSync(resolve(__dirname, 'dist/popup'), { recursive: true });

        // manifest.json
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(__dirname, 'dist/manifest.json'),
        );
        // icons/
        copyDir(
          resolve(__dirname, 'icons'),
          resolve(__dirname, 'dist/icons'),
        );
        // popup.html + popup.css
        copyFileSync(
          resolve(__dirname, 'popup/popup.html'),
          resolve(__dirname, 'dist/popup/popup.html'),
        );
        copyFileSync(
          resolve(__dirname, 'popup/popup.css'),
          resolve(__dirname, 'dist/popup/popup.css'),
        );

        // Wrap content scripts and popup as IIFE so they work as classic scripts.
        // ES module output may contain top-level `export {}` which breaks injection.
        for (const entry of IIFE_ENTRIES) {
          const filePath = resolve(__dirname, `dist/${entry}.js`);
          try {
            let code = readFileSync(filePath, 'utf8');
            // Strip any trailing `export {}` or `export default ...` added by Rollup
            code = code.replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '').trim();
            // If not already an IIFE (starts with !function or (function), wrap it
            if (!/^[!;]?\s*\(?function/.test(code) && !/^var /.test(code)) {
              code = `;(function(){\n${code}\n})();`;
            }
            writeFileSync(filePath, code, 'utf8');
          } catch (e) {
            console.warn(`Could not wrap ${entry}: ${e.message}`);
          }
        }

        console.log('\n✅  Static assets copied to dist/');
        console.log('✅  Content scripts wrapped as IIFE for classic-script injection.');
      },
    },
  ],
});

