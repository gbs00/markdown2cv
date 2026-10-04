// Intentionally accepts no destination argument: unverified builds stay in this vault.
import { cp, mkdir, readFile, realpath, writeFile, lstat, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const vault = path.join(root, 'dev-vault');
try { if ((await lstat(vault)).isSymbolicLink()) throw new Error('Refusing symlink vault'); }
catch (e) { if (e.code !== 'ENOENT') throw e; }
await mkdir(vault, { recursive: true });
if (await realpath(vault) !== vault) throw new Error('Unexpected development vault path');
const config = path.join(vault, '.obsidian');
await mkdir(path.join(config, 'plugins', 'markdown-to-cv'), { recursive: true });
async function initial(name, content) {
  try { await writeFile(path.join(vault, name), content, { flag: 'wx' }); }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
}
if (!process.argv.includes('--plugin-only')) {
await initial('.markdown-to-cv-dev-vault', 'Isolated development fixtures only.\n');
await initial('.obsidian/community-plugins.json', '["markdown-to-cv"]\n');
await initial('.obsidian/app.json', '{"livePreview":true,"showInlineTitle":false}\n');
await initial('.obsidian/core-plugins.json', '["file-explorer","switcher","command-palette","outline"]\n');
await initial('START.md', '# Markdown to CV 开发 Vault\n\n这里只放虚构验收样例。启用 Markdown to CV 后，打开 fixtures/01-standard.md，运行“打开简历预览”。\n\n命令：新建简历、打开简历预览、导出 PDF、回到模板（保留原文并新建副本）。\n');
await cp(path.join(root, 'fixtures'), path.join(vault, 'fixtures'), { recursive: true, force: false, errorOnExist: false });
}
for (const name of ['main.js', 'manifest.json', 'styles.css']) {
  await writeFile(path.join(config, 'plugins', 'markdown-to-cv', name), await readFile(path.join(root, 'dist', name)));
}
await rm(path.join(config, 'plugins', 'markdown-to-cv', 'fonts'), { recursive: true, force: true });
console.log(`Deployed only to ${vault}`);
