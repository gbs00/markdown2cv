import { mkdir, readFile, writeFile, copyFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const name = `mcv-release-qa-${Date.now()}`;
const vault = path.join(root, 'tmp', name);
const plugin = path.join(vault, '.obsidian', 'plugins', manifest.id);
await mkdir(plugin, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) {
  await copyFile(path.join(root, 'release', manifest.version, file), path.join(plugin, file));
}
await writeFile(path.join(vault, '.mcv-release-qa'), manifest.version);
await writeFile(path.join(vault, '.obsidian/community-plugins.json'), JSON.stringify([manifest.id]));
await writeFile(path.join(vault, '.obsidian/core-plugins.json'), '["file-explorer","switcher","command-palette"]');
await writeFile(path.join(vault, '.obsidian/app.json'), '{"livePreview":true,"showInlineTitle":false}');
await cp(path.join(root, 'fixtures'), path.join(vault, 'fixtures'), { recursive: true });
const probe = '\n\n中文复制核对：工作方向页面长；原样部首：⼯⽅⻚⾯⻓；姓名用字：仝龚邬隋昝；English / 2026.\n\n*Italic emphasis preserved*.\n';
for (const [fixture, target, photo] of [['01-standard', 'standard', false], ['04-pagination', 'two-page', false], ['01-standard', 'photo', true]]) {
  let text = await readFile(path.join(root, 'fixtures', `${fixture}.md`), 'utf8');
  if (photo) text = text.replace(/^(# .+)$/m, '$1\n\n**照片：** ![[assets/photo-portrait.png]]');
  await writeFile(path.join(vault, 'fixtures', `release-${target}.md`), text + probe);
}
await writeFile(path.join(vault, 'START.md'), '# Markdown to CV 发布验收\n\n此 Vault 仅含虚构样例和三个发布文件，不含 fonts 目录。\n');
const evidence = path.join(root, 'evidence', `release-${manifest.version}`);
const output = path.join(root, 'output', 'pdf', `release-${manifest.version}`);
await mkdir(evidence, { recursive: true }); await mkdir(output, { recursive: true });
await writeFile(path.join(root, 'tmp/release-qa.json'), JSON.stringify({ root, name, vault, evidence, output, version: manifest.version }, null, 2));
console.log(`Open this folder as an Obsidian Vault: ${vault}`);
console.log('Then enable Markdown to CV in this isolated Vault and run npm run test:release-host.');
