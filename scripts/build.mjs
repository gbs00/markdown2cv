import { build, context } from 'esbuild';
import { mkdir, copyFile, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await mkdir('dist', { recursive: true });
const font = await readFile('assets/fonts/SourceHanSansCN-VF.ttf.woff2');
if (createHash('sha256').update(font).digest('hex') !== 'f971e3bff46f76b49e1d5510556c2297c618ec4b491a295a4e741cdd38257799') throw new Error('Bundled official font checksum mismatch');
const license = await readFile('LICENSE', 'utf8');
const fontLicense = await readFile('assets/fonts/LICENSE.txt', 'utf8');
const fontSource = await readFile('assets/fonts/SOURCE.md', 'utf8');
const options = {
  entryPoints: ['src/main.ts'], bundle: true, platform: 'node', format: 'cjs',
  target: 'es2022', external: ['obsidian', 'electron', '@electron/remote'],
  loader: { '.css': 'text', '.md': 'text', '.woff2': 'base64' }, outfile: 'dist/main.js',
  sourcemap: process.argv.includes('--release') ? false : 'inline', logLevel: 'info',
  banner: { js: `/*! Markdown to CV — source code license\n${license}\nBundled font — SIL OFL 1.1 (not covered by MIT)\n${fontLicense}\nFont source and attribution\n${fontSource}\n*/` },
};
for (const name of ['manifest.json', 'styles.css']) await copyFile(name, `dist/${name}`);
await rm('dist/fonts', { recursive: true, force: true });
if (process.argv.includes('--watch')) await (await context(options)).watch();
else await build(options);
