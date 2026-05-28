// scripts/zip-dist.mjs
// Creates dist/extension.zip from the dist/ folder after a production build.
// Run with: node scripts/zip-dist.mjs

import archiver from 'archiver';
import { createWriteStream, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const DIST_DIR  = resolve(ROOT, 'dist');
const OUT_ZIP   = resolve(ROOT, 'dist', 'extension.zip');

if (!existsSync(DIST_DIR)) {
  console.error('❌  dist/ not found. Run "npm run build" first.');
  process.exit(1);
}

console.log('📦  Zipping dist/ → dist/extension.zip …');

const output  = createWriteStream(OUT_ZIP);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.on('warning', (err) => {
  if (err.code === 'ENOENT') console.warn('⚠️  ', err.message);
  else throw err;
});

archive.on('error', (err) => { throw err; });

output.on('close', () => {
  const kb = (archive.pointer() / 1024).toFixed(1);
  console.log(`✅  extension.zip created — ${kb} KB`);
  console.log('📤  Upload dist/extension.zip to GitHub Releases.');
});

archive.pipe(output);

// Add everything in dist/ EXCEPT the zip itself
archive.glob('**/*', {
  cwd:    DIST_DIR,
  ignore: ['extension.zip'],
});

archive.finalize();
