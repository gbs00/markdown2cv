import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(await readFile(path.join(root, 'tmp/release-qa.json'), 'utf8'));
if (path.dirname(config.vault) !== path.join(root, 'tmp') || !config.name.startsWith('mcv-release-qa-')) throw Error('Unexpected test vault');
if (await readFile(path.join(config.vault, '.mcv-release-qa'), 'utf8') !== config.version) throw Error('Missing test marker');
config.phase = process.argv.includes('--before') ? 'before' : 'after';
const evidence = path.join(root, 'evidence/architecture-20261005');
await mkdir(evidence, { recursive: true }); config.result = path.join(evidence, config.phase + '.json');
await writeFile(config.result, JSON.stringify({ status: 'starting' }));
const code = `new Function('app','require','config',require('fs').readFileSync(${JSON.stringify(path.join(root, 'scripts/architecture-host-suite.js'))},'utf8'))(app,require,${JSON.stringify(config)})`;
const launched = execFileSync('obsidian', [`vault=${config.name}`, 'eval', `code=${code}`], { encoding: 'utf8', timeout: 10000 });
if (launched.includes('Error:')) throw Error(launched);
for (let i = 0; i < 180; i++) {
  await new Promise(resolve => setTimeout(resolve, 500));
  const result = JSON.parse(await readFile(config.result, 'utf8'));
  if (['starting', 'running'].includes(result.status)) continue;
  console.log(JSON.stringify({ ...result, standard: result.standard && { pages: result.standard.pages }, multipage: result.multipage && { pages: result.multipage.pages }, longParagraph: result.longParagraph && { pages: result.longParagraph.pages, milliseconds: result.longParagraph.milliseconds } }, null, 2));
  if (result.status !== 'complete' || !Object.values(result.safety).every(Boolean)) process.exitCode = 1;
  break;
}
const final = JSON.parse(await readFile(config.result, 'utf8'));
if (['starting', 'running'].includes(final.status)) throw Error('Host test timed out: ' + config.result);
