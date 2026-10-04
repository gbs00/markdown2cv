import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writePdfAtomically } from '../src/pdf';

test('CV-18: canceled write preserves existing destination and leaves no temporary file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cv-write-'));
  try {
    const target = join(dir, 'resume.pdf'); await writeFile(target, 'previous-pdf');
    const controller = new AbortController(); controller.abort();
    await assert.rejects(writePdfAtomically(new Uint8Array([1,2,3]), target, controller.signal), { name: 'AbortError' });
    assert.equal(await readFile(target, 'utf8'), 'previous-pdf'); assert.deepEqual(await readdir(dir), ['resume.pdf']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('CV-18: failed directory write rejects; subsequent valid retry writes exact bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cv-write-'));
  try {
    const bytes = new Uint8Array([37,80,68,70,45,49]); const signal = new AbortController().signal;
    await assert.rejects(writePdfAtomically(bytes, join(dir, 'missing', 'resume.pdf'), signal));
    const target = join(dir, 'resume.pdf'); await writePdfAtomically(bytes, target, signal);
    assert.deepEqual(new Uint8Array(await readFile(target)), bytes); assert.deepEqual(await readdir(dir), ['resume.pdf']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
