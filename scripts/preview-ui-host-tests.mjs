import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const evidence = path.join(root, 'evidence', 'preview-ui-20261004');
await mkdir(evidence, { recursive: true }); await mkdir(path.join(root, 'tmp'), { recursive: true });
for (const file of ['main.js', 'styles.css']) {
  if (!(await readFile(path.join(root, 'dist', file))).equals(await readFile(path.join(root, 'dev-vault/.obsidian/plugins/markdown-to-cv', file)))) throw Error('Deploy current ' + file + ' first');
}
await build({ stdin: { contents: 'export { exportHtml } from "./src/render"; export { PdfService } from "./src/pdf";', resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', target: 'es2022', external: ['electron', '@electron/remote'], loader: { '.css': 'text' }, plugins: [{ name: 'unused-obsidian', setup(b) { b.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', external: true, sideEffects: false })); } }], outfile: path.join(root, 'tmp/preview-ui-api.cjs') });
const runId = String(Date.now()), resultPath = path.join(evidence, `host-${runId}.json`);
const code = `new Function("app","require","runId",require("fs").readFileSync(${JSON.stringify(path.join(root, 'scripts/preview-ui-host-suite.js'))},"utf8"))(app,require,${JSON.stringify(runId)})`;
const launch = execFileSync('obsidian', ['vault=dev-vault', 'eval', `code=${code}`], { encoding: 'utf8', timeout: 10000 });
if (launch.includes('Error:')) throw Error(launch);
let finished = false;
for (let i = 0; i < 100; i++) {
  await new Promise(resolve => setTimeout(resolve, 500));
  let result; try { result = JSON.parse(await readFile(resultPath, 'utf8')); } catch { continue; }
  if (result.status === 'running') continue;
  await writeFile(path.join(evidence, 'host-results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === 'complete' && Object.values(result.safety).every(Boolean) ? 0 : 1;
  finished = true; break;
}
if (!finished) throw Error('Preview UI checks timed out; inspect ' + resultPath);
