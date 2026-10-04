import { Buffer } from 'node:buffer';
import { abortable, abortIfNeeded } from './model';

export const FONT_FAMILY = 'MCV Source Han Sans CN';
export const FONT_FILE = 'SourceHanSansCN-VF.ttf.woff2';
export const FONT_WEIGHTS = [400, 500, 700] as const;
export const FONT_PROBE = '工作方向页面长 ABC 0123456789';

/** One unmodified bundled font, shared by preview documents and self-contained PDF HTML. */
export class ResumeFonts {
  private data: Promise<ArrayBuffer> | null = null;
  private stylesheet: Promise<string> | null = null;
  private documents = new Map<Document, Promise<void>>();
  private faces = new Map<Document, FontFace>();
  private disposed = false;
  constructor(private readonly read: () => Promise<ArrayBuffer>) {}

  private bytes(): Promise<ArrayBuffer> {
    if (this.disposed) return Promise.reject(new Error('简历字体资源已释放，请重新打开预览。'));
    return this.data ??= this.read().catch(() => {
      this.data = null;
      throw new Error('无法读取插件内置的思源黑体，请重新安装完整插件（包含 fonts 目录）。');
    });
  }

  async prepare(doc: Document, signal: AbortSignal): Promise<void> {
    abortIfNeeded(signal);
    let ready = this.documents.get(doc);
    if (!ready) {
      ready = (async () => {
        const face = new FontFace(FONT_FAMILY, await this.bytes(), { weight: '250 900', style: 'normal' });
        await face.load();
        if (this.disposed) throw new Error('简历字体资源已释放。');
        doc.fonts.add(face); this.faces.set(doc, face);
        for (const weight of FONT_WEIGHTS) {
          const loaded = await doc.fonts.load(`${weight} 12px "${FONT_FAMILY}"`, FONT_PROBE);
          if (!loaded.includes(face) || face.status !== 'loaded') throw new Error('Font not ready');
        }
      })().catch(error => {
        const face = this.faces.get(doc); if (face) doc.fonts.delete(face);
        this.faces.delete(doc); this.documents.delete(doc);
        throw new Error(`内置思源黑体加载失败，无法预览或导出：${error instanceof Error ? error.message : String(error)}`);
      });
      this.documents.set(doc, ready);
    }
    await abortable(ready, signal);
  }

  async css(signal: AbortSignal): Promise<string> {
    abortIfNeeded(signal);
    const pending = this.stylesheet ??= this.bytes().then(bytes =>
      `@font-face{font-family:"${FONT_FAMILY}";src:url(data:font/woff2;base64,${Buffer.from(bytes).toString('base64')}) format("woff2");font-weight:250 900;font-style:normal;font-display:block;}`
    ).catch(error => { this.stylesheet = null; throw error; });
    return abortable(pending, signal);
  }

  dispose(): void {
    this.disposed = true;
    for (const [doc, face] of this.faces) doc.fonts.delete(face);
    this.faces.clear(); this.documents.clear(); this.data = null; this.stylesheet = null;
  }
}
