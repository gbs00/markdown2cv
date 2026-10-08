import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(await readFile(path.resolve(root, process.argv[2] ?? 'tmp/release-0.1.2-qa.json'), 'utf8'));
if (path.dirname(config.vault) !== path.join(root, 'tmp') || !config.name.startsWith('mcv-release-qa-')) throw Error('Unexpected test vault');
if (await readFile(path.join(config.vault, '.mcv-release-qa'), 'utf8') !== config.version) throw Error('Missing test marker');
config.result = path.join(root, 'evidence/resume-location-20261008/host-results.json');
await mkdir(path.dirname(config.result), { recursive: true });
await writeFile(config.result, JSON.stringify({ status: 'starting' }));
const code = `new Function('app','require','config',require('fs').readFileSync(${JSON.stringify(path.join(root, 'scripts/resume-location-host-suite.js'))},'utf8'))(app,require,${JSON.stringify(config)})`;
const launched = execFileSync('obsidian', [`vault=${config.name}`, 'eval', `code=${code}`], { encoding: 'utf8', timeout: 10000 });
if (launched.includes('Error:')) throw Error(launched);
for (let i = 0; i < 120; i++) {
  await new Promise(resolve => setTimeout(resolve, 500));
  const result = JSON.parse(await readFile(config.result, 'utf8'));
  if (result.status === 'starting' || result.status === 'running') continue;
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === 'complete' ? 0 : 1;
  break;
}
const final = JSON.parse(await readFile(config.result, 'utf8'));
if (['starting', 'running'].includes(final.status)) throw Error('Host tests timed out');
