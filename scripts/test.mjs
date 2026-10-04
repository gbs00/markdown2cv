import { build } from 'esbuild';
import { readdir, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
await mkdir('.test-build', { recursive: true });
const entries = (await readdir('tests')).filter(x => x.endsWith('.test.ts')).map(x => `tests/${x}`);
await build({ entryPoints: entries, bundle: true, platform: 'node', format: 'esm', external: ['@electron/remote'], outdir: '.test-build' });
const result = spawnSync(process.execPath, ['--test', ...entries.map(x => `.test-build/${x.split('/').pop().replace('.ts', '.js')}`)], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
