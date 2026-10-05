import { Buffer } from 'node:buffer';
import { abortable, abortIfNeeded } from './async';

export const FONT_FAMILY = 'MCV Source Han Sans CN';
export const FONT_WEIGHTS = [400, 500, 700] as const;
export const FONT_PROBE = '工作方向页面长 ABC 0123456789';

export function fontStylesheet(base64: string): string {
  return `@font-face{font-family:"${FONT_FAMILY}";src:url(data:font/woff2;base64,${base64}) format("woff2");font-weight:250 900;font-style:normal;font-display:block;}`;
}

/** One unmodified bundled font, shared by preview documents and self-contained PDF HTML. */
export class ResumeFonts {
  private data: Promise<ArrayBuffer> | null = null;
  private stylesheet: Promise<string> | null = null;
  private documents = new Map<Document, Promise<void>>();
  private faces = new Map<Document, FontFace>();
  private cleanups = new Map<Document, () => void>();
  private disposed = false;
  constructor(private readonly read: () => Promise<ArrayBuffer>, private readonly readCss?: () => Promise<string>) {}

  private bytes(): Promise<ArrayBuffer> {
    if (this.disposed) return Promise.reject(new Error('简历字体资源已释放，请重新打开预览。'));
    return this.data ??= this.read().catch(() => {
      this.data = null;
      throw new Error('无法读取插件内置的思源黑体，请重新安装插件。');
    });
  }

  async prepare(doc: Document, signal: AbortSignal): Promise<void> {
    abortIfNeeded(signal);
    if (this.disposed) throw new Error('简历字体资源已释放，请重新打开预览。');
    let ready = this.documents.get(doc);
    if (!ready) {
      let released = false;
      const release = () => {
        released = true;
        const face = this.faces.get(doc); if (face) doc.fonts.delete(face);
        this.faces.delete(doc); this.documents.delete(doc); this.cleanups.delete(doc);
        doc.defaultView?.removeEventListener('unload', release);
      };
      this.cleanups.set(doc, release);
      doc.defaultView?.addEventListener('unload', release, { once: true });
      ready = (async () => {
        const bytes = await this.bytes();
        if (released || this.disposed) throw new Error('简历字体资源已释放。');
        const Face = doc.defaultView?.FontFace ?? FontFace;
        const face = new Face(FONT_FAMILY, bytes, { weight: '250 900', style: 'normal' });
        await face.load();
        if (released || this.disposed) throw new Error('简历字体资源已释放。');
        doc.fonts.add(face); this.faces.set(doc, face);
        for (const weight of FONT_WEIGHTS) {
          const loaded = await doc.fonts.load(`${weight} 12px "${FONT_FAMILY}"`, FONT_PROBE);
          if (released || this.disposed) throw new Error('简历字体资源已释放。');
          if (!loaded.includes(face) || face.status !== 'loaded') throw new Error('Font not ready');
        }
      })().catch(error => {
        if (!released) release();
        throw new Error(`内置思源黑体加载失败，无法预览或导出：${error instanceof Error ? error.message : String(error)}`);
      });
      this.documents.set(doc, ready);
    }
    await abortable(ready, signal);
  }

  async css(signal: AbortSignal): Promise<string> {
    abortIfNeeded(signal);
    if (this.disposed) throw new Error('简历字体资源已释放，请重新打开预览。');
    const pending = this.stylesheet ??= (this.readCss ? this.readCss() : this.bytes().then(bytes => fontStylesheet(Buffer.from(bytes).toString('base64'))))
      .catch(error => { this.stylesheet = null; throw error; });
    return abortable(pending, signal);
  }

  dispose(): void {
    this.disposed = true;
    for (const release of this.cleanups.values()) release();
    this.data = null; this.stylesheet = null;
  }
}
