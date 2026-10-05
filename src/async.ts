import { clearTimeout, setTimeout } from 'node:timers';

export function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('操作已取消', 'AbortError');
}

/** Stops waiting, not the underlying operation; callers still own its cleanup. */
export function abortable<T>(promise: Promise<T>, signal: AbortSignal, timeoutMs = 15000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (complete: () => void) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      complete();
    };
    const onAbort = () => finish(() => reject(new DOMException('操作已取消', 'AbortError')));
    // The operation already exists when passed here. Observe its rejection even
    // when cancellation happened before this call, or after this wait timed out.
    void promise.then(
      value => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error instanceof Error ? error : new Error(String(error)))),
    );
    if (signal.aborted) { onAbort(); return; }
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => finish(() => reject(new Error('等待资源或排版超时，请检查内容后重试。'))), timeoutMs);
  });
}
