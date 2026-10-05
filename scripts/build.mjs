import { build, context } from 'esbuild';
import { mkdir, copyFile, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
const watch = process.argv.includes('--watch');
const development = process.argv.includes('--dev');
const staticAssets = ['manifest.json', 'styles.css'];
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
  sourcemap: development ? 'inline' : false, logLevel: 'info',
  banner: { js: `/*! Markdown to CV — source code license\n${license}\nBundled font — SIL OFL 1.1 (not covered by MIT)\n${fontLicense}\nFont source and attribution\n${fontSource}\n*/` },
  plugins: [{
    name: 'static-assets',
    setup(builder) {
      // These files are installed beside the bundle, so esbuild cannot discover
      // them through imports. A style-only edit must also trigger watch mode.
      if (watch) builder.onLoad({ filter: /[/\\]src[/\\]main\.ts$/ }, async ({ path }) => ({
        contents: await readFile(path, 'utf8'), loader: 'ts', resolveDir: dirname(path),
        watchFiles: staticAssets.map(name => resolve(name)),
      }));
      builder.onEnd(async ({ errors }) => {
        if (!errors.length) await Promise.all(staticAssets.map(name => copyFile(name, `dist/${name}`)));
      });
    },
  }],
};
await rm('dist/fonts', { recursive: true, force: true });
if (watch) await (await context(options)).watch();
else await build(options);
