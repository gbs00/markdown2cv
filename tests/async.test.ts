import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { abortable } from '../src/async';

test('pre-canceled waits observe an operation that later rejects', async () => {
  const controller = new AbortController();
  controller.abort();
  let reject!: (error: Error) => void;
  const operation = new Promise<void>((_, fail) => { reject = fail; });
  await assert.rejects(abortable(operation, controller.signal), { name: 'AbortError' });
  reject(new Error('late native failure'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('completed and failed waits detach cancellation listeners', async () => {
  const controller = new AbortController();
  assert.equal(await abortable(Promise.resolve(42), controller.signal), 42);
  const failure = new Error('resource failed');
  await assert.rejects(abortable(Promise.reject(failure), controller.signal), error => error === failure);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('timed out waits release listeners and still observe late rejections', async () => {
  const controller = new AbortController();
  let reject!: (error: Error) => void;
  const operation = new Promise<void>((_, fail) => { reject = fail; });
  await assert.rejects(abortable(operation, controller.signal, 1), /超时/);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  reject(new Error('late timeout failure'));
  await new Promise(resolve => setImmediate(resolve));
});

test('abort releases wait resources and observes eventual operation rejection', async () => {
  const controller = new AbortController();
  let reject!: (error: Error) => void;
  const operation = new Promise<void>((_, fail) => { reject = fail; });
  const waiting = abortable(operation, controller.signal);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 1);
  controller.abort();
  await assert.rejects(waiting, { name: 'AbortError' });
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  reject(new Error('late cancellation failure'));
  await new Promise(resolve => setImmediate(resolve));
});
