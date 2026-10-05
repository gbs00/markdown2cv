import { Buffer } from 'node:buffer';
import fontBase64 from '../assets/fonts/SourceHanSansCN-VF.ttf.woff2';
import { fontStylesheet } from './fonts';

/** The community installer only downloads main.js, manifest.json and styles.css.
 * Keep the original font in the bundle; decode only when a preview first needs it.
 * ResumeFonts caches the resulting bytes and the loaded faces for subsequent edits.
 */
export function readBundledFont(): Promise<ArrayBuffer> {
  const bytes = Buffer.from(fontBase64, 'base64');
  if (bytes.buffer instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return Promise.resolve(bytes.buffer);
  }
  return Promise.resolve(Uint8Array.from(bytes).buffer);
}

/** Reuse the bundled encoding rather than re-encoding the full font on export. */
export function readBundledFontCss(): Promise<string> {
  return Promise.resolve(fontStylesheet(fontBase64));
}
