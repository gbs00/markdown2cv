// The ONLY non-public Obsidian host bridge. Do not import it in editor/model/render code.
// Electron APIs are documented; availability of @electron/remote in Obsidian is not guaranteed.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { abortable, abortIfNeeded } from './model';
import { FONT_FAMILY, FONT_WEIGHTS, FONT_PROBE } from './fonts';

interface ExportWindow {
  isDestroyed(): boolean;
  destroy(): void;
  loadURL(url: string): Promise<void>;
  webContents: {
    printToPDF(options: Record<string, unknown>): Promise<Uint8Array>;
    executeJavaScript(code: string): Promise<unknown>;
    on(name: string, fn: (event: { preventDefault(): void }) => void): void;
    setWindowOpenHandler(handler: () => { action: string }): void;
  };
}
interface Remote {
  BrowserWindow: new (options: Record<string, unknown>) => ExportWindow;
  getCurrentWindow(): unknown;
  dialog: { showSaveDialog(parent: unknown, options: Record<string, unknown>): Promise<{ canceled: boolean; filePath?: string }> };
}

function bridge(): Remote {
  try {
    // Externalized: use host's bridge; never install/initialize/patch its main process.
    const remote = require('@electron/remote') as Remote;
    if (typeof remote.BrowserWindow !== 'function' || !remote.dialog?.showSaveDialog) throw new Error('missing capability');
    return remote;
  } catch { throw new Error('当前 Obsidian 未提供开发版 PDF 所需的桌面兼容接口；HTML 预览仍可用。'); }
}

export async function writePdfAtomically(bytes: Uint8Array, destination: string, signal: AbortSignal): Promise<void> {
  abortIfNeeded(signal);
  const temporary = path.join(path.dirname(destination), `.${path.basename(destination)}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, bytes, { flag: 'wx' });
    abortIfNeeded(signal);
    await fs.rename(temporary, destination);
  } finally { await fs.unlink(temporary).catch(() => {}); }
}

export class PdfService {
  private window: ExportWindow | null = null;
  private printing = false;
  async choosePath(name: string): Promise<string | null> {
    const remote = bridge();
    const result = await remote.dialog.showSaveDialog(remote.getCurrentWindow(), {
      title: '导出简历 PDF', defaultPath: `${name}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    return result.canceled ? null : result.filePath ?? null;
  }
  private getWindow(): ExportWindow {
    if (!this.window || this.window.isDestroyed()) {
      const remote = bridge();
      this.window = new remote.BrowserWindow({
        show: false, width: 794, height: 1123,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false, partition: 'markdown-to-cv-export' },
      });
      this.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      this.window.webContents.on('will-navigate', event => event.preventDefault());
    }
    return this.window;
  }
  async print(html: string, signal: AbortSignal): Promise<Uint8Array> {
    abortIfNeeded(signal);
    if (this.printing) throw new Error('另一个 PDF 正在生成，请完成或取消后重试。');
    this.printing = true;
    let win: ExportWindow;
    try { win = this.getWindow(); } catch (error) { this.printing = false; throw error; }
    const onAbort = () => this.dispose(); signal.addEventListener('abort', onAbort, { once: true });
    try {
      // A full CJK font exceeds Chromium's navigation URL limit. Keep all document
      // data in memory and install it into a small blank page, without a temp file.
      await abortable(win.loadURL('data:text/html;charset=utf-8,<!doctype html><meta charset="utf-8">'), signal);
      await abortable(win.webContents.executeJavaScript(`document.open();document.write(${JSON.stringify(html)});document.close();true;`), signal);
      await abortable(win.webContents.executeJavaScript(`(async () => {
        const family = ${JSON.stringify(FONT_FAMILY)};
        for (const weight of ${JSON.stringify(FONT_WEIGHTS)}) {
          const faces = await document.fonts.load(weight + ' 12px "' + family + '"', ${JSON.stringify(FONT_PROBE)});
          if (!faces.length || faces.some(face => face.status !== 'loaded')) throw Error('内置思源黑体未加载，已停止导出。');
        }
        await document.fonts.ready;
        await Promise.all(Array.from(document.images).map(img => img.complete ? (img.naturalWidth ? Promise.resolve() : Promise.reject(Error('Image failed'))) : new Promise((resolve,reject) => { img.onload=resolve; img.onerror=reject; })));
        document.body.getBoundingClientRect();
        return true;
      })()`), signal);
      if (typeof win.webContents.printToPDF !== 'function') throw new Error('当前宿主不支持 PDF 打印。');
      return await abortable(win.webContents.printToPDF({
        printBackground: true, preferCSSPageSize: true, pageSize: 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 }, generateTaggedPDF: true,
      }), signal, 30000);
    } catch (error) { this.dispose(); throw error; }
    finally { signal.removeEventListener('abort', onAbort); this.printing = false; }
  }
  dispose(): void {
    if (this.window && !this.window.isDestroyed()) this.window.destroy();
    this.window = null;
  }
}
