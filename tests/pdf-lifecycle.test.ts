import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { PdfService } from '../src/pdf';

function fakeHost() {
  const windows: FakeWindow[] = [];
  let load = () => Promise.resolve();
  let print = () => Promise.resolve(new Uint8Array([37, 80, 68, 70]));
  class FakeWindow {
    destroyed = false;
    constructor() { windows.push(this); }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; }
    loadURL() { return load(); }
    webContents = {
      printToPDF: () => print(),
      executeJavaScript: () => Promise.resolve(true),
      on() {},
      setWindowOpenHandler() {},
    };
  }
  const service = new PdfService(() => ({
    BrowserWindow: FakeWindow,
    getCurrentWindow: () => null,
    dialog: { showSaveDialog: () => Promise.resolve({ canceled: true }) },
  }));
  return { service, windows, setLoad: (operation: typeof load) => { load = operation; }, setPrint: (operation: typeof print) => { print = operation; } };
}

test('disposing a hung export cancels promptly and permits a clean retry', async () => {
  const host = fakeHost();
  const controller = new AbortController();
  host.setLoad(() => new Promise(() => {}));
  const pending = host.service.print('<h1>Resume</h1>', controller.signal);
  host.service.dispose();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(host.windows[0]!.destroyed, true);
  assert.equal(controller.signal.aborted, false, 'service disposal does not mutate the caller signal');
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);

  host.setLoad(() => Promise.resolve());
  assert.deepEqual(await host.service.print('<h1>Retry</h1>', controller.signal), new Uint8Array([37, 80, 68, 70]));
  assert.equal(host.windows.length, 2);
  host.service.dispose();
  assert.equal(host.windows[1]!.destroyed, true);
});

test('caller cancellation closes its print window and rejects overlapping exports', async () => {
  const host = fakeHost();
  const controller = new AbortController();
  host.setLoad(() => new Promise(() => {}));
  const pending = host.service.print('', controller.signal);
  await assert.rejects(host.service.print('', new AbortController().signal), /另一个 PDF/);
  assert.equal(host.windows.length, 1);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(host.windows[0]!.destroyed, true);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('successful exports reuse one window; failed exports release it', async () => {
  const host = fakeHost();
  const signal = new AbortController().signal;
  await host.service.print('', signal);
  await host.service.print('', signal);
  assert.equal(host.windows.length, 1);
  assert.equal(getEventListeners(signal, 'abort').length, 0);
  host.setPrint(() => Promise.reject(new Error('native printing failed')));
  await assert.rejects(host.service.print('', signal), /native printing failed/);
  assert.equal(host.windows[0]!.destroyed, true);
  assert.equal(getEventListeners(signal, 'abort').length, 0);
});
