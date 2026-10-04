import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const bundled=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
const python=process.env.MCV_PYTHON ?? (existsSync(bundled)?bundled:'python3');
const result=spawnSync(python,[process.argv.includes('--font')?'scripts/check-font-pdf.py':'scripts/check-pdf.py'],{stdio:'inherit'});
process.exitCode=result.status??1;
