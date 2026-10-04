import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(await readFile(path.join(root, 'tmp/release-qa.json'), 'utf8'));
if (path.dirname(config.vault) !== path.join(root, 'tmp') || !config.name.startsWith('mcv-release-qa-')) throw Error('Unexpected test vault');
if (await readFile(path.join(config.vault, '.mcv-release-qa'), 'utf8') !== config.version) throw Error('Release test marker mismatch');
// This generated Vault contains only fixtures. Reload before each run so the
// first-preview assertion is repeatable and cannot reuse a previous font cache.
execFileSync('obsidian', [`vault=${config.name}`, 'plugin:reload', 'id=markdown-to-cv'], { encoding: 'utf8', timeout: 10000 });
config.hostVersion = execFileSync('obsidian', [`vault=${config.name}`, 'version'], { encoding: 'utf8', timeout: 10000 }).trim();
const resultPath = path.join(config.evidence, 'host-results.json');
await writeFile(resultPath, JSON.stringify({ status: 'starting' }));
const code = `new Function("app","require","config",require("fs").readFileSync(${JSON.stringify(path.join(root, 'scripts/release-host-suite.js'))},"utf8"))(app,require,${JSON.stringify(config)})`;
const launch = execFileSync('obsidian', [`vault=${config.name}`, 'eval', `code=${code}`], { encoding: 'utf8', timeout: 10000 });
if (launch.includes('Error:')) throw Error(launch);
let done = false;
for (let i = 0; i < 240; i++) {
  await new Promise(resolve => setTimeout(resolve, 500));
  const result = JSON.parse(await readFile(resultPath, 'utf8'));
  if (['starting', 'running'].includes(result.status)) continue;
  console.log(JSON.stringify({ status: result.status, checks: result.checks, metrics: result.metrics, fixtures: result.fixtures.map(item => ({ name: item.name, pages: item.previewPages, bytes: item.pdfBytes })), error: result.error, evidence: resultPath }, null, 2));
  process.exitCode = result.status === 'complete' ? 0 : 1; done = true; break;
}
if (!done) throw Error(`Release host checks timed out: ${resultPath}`);
