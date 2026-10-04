import { build, context } from 'esbuild';
import { mkdir, copyFile, cp, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await mkdir('dist', { recursive: true });
const options = {
  entryPoints: ['src/main.ts'], bundle: true, platform: 'node', format: 'cjs',
  target: 'es2022', external: ['obsidian', 'electron', '@electron/remote'],
  loader: { '.css': 'text', '.md': 'text' }, outfile: 'dist/main.js',
  sourcemap: process.argv.includes('--release') ? false : 'inline', logLevel: 'info',
};
for (const name of ['manifest.json', 'styles.css']) await copyFile(name, `dist/${name}`);
const font = await readFile('assets/fonts/SourceHanSansCN-VF.ttf.woff2');
if (createHash('sha256').update(font).digest('hex') !== 'f971e3bff46f76b49e1d5510556c2297c618ec4b491a295a4e741cdd38257799') throw new Error('Bundled official font checksum mismatch');
await rm('dist/fonts', { recursive: true, force: true });
await cp('assets/fonts', 'dist/fonts', { recursive: true });
if (process.argv.includes('--watch')) await (await context(options)).watch();
else await build(options);
