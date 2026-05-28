import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';

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

export default defineConfig({
  // Vite is used purely as a bundler/minifier — not as a dev server
  build: {
    outDir:   'dist',
    emptyOutDir: true,
    minify:   'terser',   // stronger minification than esbuild default
    terserOptions: {
      compress: {
        drop_console:   false,  // keep console.log (used for SW logging)
        drop_debugger:  true,
        passes:         2,
      },
      mangle: {
        toplevel: true,  // rename top-level vars/functions → hard to read
      },
      format: {
        comments: false, // strip all comments from output
      },
    },
    rollupOptions: {
      // ── Entry points ───────────────────────────────────────────────────────
      // Each file becomes a separate minified bundle (Chrome needs separate files)
      input: {
        'popup/popup':               resolve(__dirname, 'popup/popup.js'),
        'src/background/service-worker': resolve(__dirname, 'src/background/service-worker.js'),
        'src/content/autologin':     resolve(__dirname, 'src/content/autologin.js'),
        'src/content/portal-registry': resolve(__dirname, 'src/content/portal-registry.js'),
      },
      output: {
        // Preserve the original file names so manifest.json paths still work
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        // No code-splitting for extensions — each entry is self-contained
        manualChunks: undefined,
        format: 'es',   // ES modules — Chrome MV3 supports these natively
      },
    },
  },

  // ── Post-build: copy static assets that Vite doesn't bundle ──────────────
  plugins: [
    {
      name: 'copy-extension-assets',
      closeBundle() {
        // Ensure output subdirs exist before copying
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
        console.log('\n✅  Static assets copied to dist/');
      },
    },
  ],
});
