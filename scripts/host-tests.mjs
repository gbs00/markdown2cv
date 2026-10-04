import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'evidence', 'host-results.json');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ status: 'starting' }));
const version = execFileSync('obsidian', ['vault=dev-vault', 'version'], { encoding: 'utf8' }).trim();
const code = `new Function("app","hostVersion","require",require("fs").readFileSync(${JSON.stringify(path.join(root, 'scripts', 'host-suite.js'))},"utf8"))(app,${JSON.stringify(version)},require)`;
const launch = execFileSync('obsidian', ['vault=dev-vault', 'eval', `code=${code}`], { cwd: root, encoding: 'utf8', timeout: 10000 });
if (launch.includes('Error:')) throw new Error(launch);
let last = 0;
for (let i = 0; i < 180; i++) {
  await new Promise(r => setTimeout(r, 500));
  const result = JSON.parse(await readFile(output, 'utf8'));
  for (const test of (result.tests ?? []).slice(last)) console.log(`${test.status}: ${test.name}${test.error ? ` — ${test.error}` : ''}`);
  last = result.tests?.length ?? 0;
  if (result.status === 'complete' || result.status === 'failed') {
    console.log(`Evidence: ${output}`);
    process.exitCode = result.status === 'failed' || result.tests.some(t => t.status === 'fail') ? 1 : 0;
    break;
  }
  if (i === 179) throw new Error(`Timed out; inspect ${output}`);
}
