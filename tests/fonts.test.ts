import test from 'node:test';
import assert from 'node:assert/strict';
import { ResumeFonts, fontStylesheet } from '../src/fonts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function fontDocument(load: () => Promise<void> = () => Promise.resolve()) {
  const registered = new Set<FakeFace>();
  let created = 0;
  class FakeFace {
    status = 'unloaded';
    constructor() { created++; }
    async load() { await load(); this.status = 'loaded'; return this; }
  }
  const win = Object.assign(new EventTarget(), { FontFace: FakeFace });
  const doc = {
    defaultView: win,
    fonts: {
      add: (face: FakeFace) => registered.add(face),
      delete: (face: FakeFace) => registered.delete(face),
      load: () => Promise.resolve([...registered]),
    },
  } as unknown as Document;
  return { doc, win, registered, created: () => created };
}

test('font bytes and faces are reused across edits and released with their window', async () => {
  let reads = 0;
  const fonts = new ResumeFonts(() => { reads++; return Promise.resolve(new ArrayBuffer(4)); });
  const first = fontDocument(), popout = fontDocument();
  const signal = new AbortController().signal;
  await Promise.all([fonts.prepare(first.doc, signal), fonts.prepare(first.doc, signal), fonts.prepare(popout.doc, signal)]);
  assert.equal(reads, 1);
  assert.equal(first.created(), 1);
  assert.equal(popout.created(), 1);
  popout.win.dispatchEvent(new Event('unload'));
  assert.equal(popout.registered.size, 0);
  assert.equal(first.registered.size, 1);
  fonts.dispose();
  assert.equal(first.registered.size, 0);
  await assert.rejects(fonts.prepare(first.doc, signal), /已释放/);
  await assert.rejects(fonts.css(signal), /已释放/);
});

test('closing a window during font loading cannot re-register the late font', async () => {
  const loading = deferred<void>();
  const popout = fontDocument(() => loading.promise);
  const fonts = new ResumeFonts(() => Promise.resolve(new ArrayBuffer(4)));
  const ready = fonts.prepare(popout.doc, new AbortController().signal);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(popout.created(), 1);
  popout.win.dispatchEvent(new Event('unload'));
  loading.resolve();
  await assert.rejects(ready, /已释放/);
  assert.equal(popout.registered.size, 0);
  fonts.dispose();
});

test('cancelled edits do not cancel the shared font load for the next edit', async () => {
  const loading = deferred<void>();
  const view = fontDocument(() => loading.promise);
  const fonts = new ResumeFonts(() => Promise.resolve(new ArrayBuffer(4)));
  const cancelled = new AbortController();
  const first = fonts.prepare(view.doc, cancelled.signal);
  const second = fonts.prepare(view.doc, new AbortController().signal);
  cancelled.abort();
  await assert.rejects(first, { name: 'AbortError' });
  loading.resolve();
  await second;
  assert.equal(view.created(), 1);
  assert.equal(view.registered.size, 1);
  fonts.dispose();
});

test('export reuses encoded font CSS without decoding or re-encoding font bytes', async () => {
  let reads = 0, stylesheets = 0;
  const fonts = new ResumeFonts(
    () => { reads++; return Promise.resolve(new ArrayBuffer(4)); },
    () => { stylesheets++; return Promise.resolve(fontStylesheet('AQIDBA==')); },
  );
  const signal = new AbortController().signal;
  const first = await fonts.css(signal);
  assert.equal(await fonts.css(signal), first);
  assert.match(first, /data:font\/woff2;base64,AQIDBA==/);
  assert.equal(reads, 0);
  assert.equal(stylesheets, 1);
  fonts.dispose();
});

test('failed font reads can be retried without keeping a failed document cache', async () => {
  let reads = 0;
  const view = fontDocument();
  const fonts = new ResumeFonts(() => ++reads === 1 ? Promise.reject(Error('Unavailable')) : Promise.resolve(new ArrayBuffer(4)));
  const signal = new AbortController().signal;
  await assert.rejects(fonts.prepare(view.doc, signal), /加载失败/);
  await fonts.prepare(view.doc, signal);
  assert.equal(reads, 2);
  assert.equal(view.registered.size, 1);
  fonts.dispose();
});
