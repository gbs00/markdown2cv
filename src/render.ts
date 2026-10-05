import { Component, MarkdownRenderer } from 'obsidian';
import type { App } from 'obsidian';
import paperCss from './paper.css';
import { abortable, abortIfNeeded } from './async';
import { isPhotoEmbed, prepareMarkdown } from './model';
import type { Issue, PhotoField, Snapshot } from './model';
import type { ResumeFonts } from './fonts';

export interface RenderedResume {
  host: HTMLElement;
  shadow: ShadowRoot;
  pages: HTMLElement;
  pageCount: number;
  issues: Issue[];
  hiddenFields: number;
  snapshot: Snapshot;
  fonts: ResumeFonts;
  photoPath?: string;
  resourcePaths: ReadonlySet<string>;
  hasUnresolvedResources: boolean;
  dispose(): void;
}

interface RenderResources { paths: Set<string>; unresolved: boolean }

function collectResources(app: App, root: HTMLElement, sourcePath: string, resources: RenderResources): void {
  for (const embed of Array.from(root.querySelectorAll('.internal-embed[src]'))) {
    const linkpath = embed.getAttribute('src')?.split('#')[0];
    if (!linkpath) continue;
    const file = app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
    if (file) resources.paths.add(file.path); else resources.unresolved = true;
  }
}

function semanticBlocks(container: HTMLElement): HTMLElement[] {
  const result: HTMLElement[] = [];
  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent?.trim()) {
        const p = container.ownerDocument.createElement('p'); p.textContent = node.textContent; result.push(p);
      }
      continue;
    }
    if (!(node.instanceOf(HTMLElement))) continue;
    if (node.matches('style,script,button,.frontmatter,.metadata-container')) continue;
    if (node.tagName === 'DIV' && (Array.from(node.classList).some(c => c.startsWith('el-')) || node.classList.contains('markdown-preview-section'))) result.push(...semanticBlocks(node));
    else result.push(node);
  }
  return result;
}

function flowUnits(blocks: HTMLElement[], doc: Document): HTMLElement[] {
  const expanded: HTMLElement[] = [];
  for (const block of blocks) {
    if (block.matches('ul,ol')) {
      let index = Number(block.getAttribute('start') ?? 1);
      for (const li of Array.from(block.children)) {
        const list = block.cloneNode(false) as HTMLElement;
        if (block.tagName === 'OL') list.setAttribute('start', String(index++));
        list.append(li); expanded.push(list);
      }
    } else expanded.push(block);
  }
  const units: HTMLElement[] = [];
  let current = doc.createElement('div'); current.className = 'cv-unit';
  for (const block of expanded) {
    // Move the already-loaded renderer nodes: cloning images could briefly reset
    // intrinsic dimensions, causing pagination before the cloned resource is ready.
    current.append(block);
    if (!/^H[1-6]$/.test(block.tagName)) {
      units.push(current); current = doc.createElement('div'); current.className = 'cv-unit';
    }
  }
  if (current.childNodes.length) units.push(current);
  return units;
}

function textLength(node: Node): number { return node.textContent?.length ?? 0; }

/** Only clone the trailing slice when committing a split, not on every size probe. */
function splitAt(element: HTMLElement, offset: number): { first: HTMLElement; rest: () => HTMLElement } {
  const doc = element.ownerDocument;
  const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let consumed = 0;
  while (node && consumed + textLength(node) < offset) { consumed += textLength(node); node = walker.nextNode(); }
  if (!node) throw new Error('无法安全拆分过长内容，请调整该段落后重试。');
  const left = doc.createRange(); left.selectNodeContents(element); left.setEnd(node, offset - consumed);
  const right = doc.createRange(); right.selectNodeContents(element); right.setStart(node, offset - consumed);
  const first = element.cloneNode(false) as HTMLElement;
  first.append(left.cloneContents());
  return { first, rest: () => {
    const rest = element.cloneNode(false) as HTMLElement;
    rest.append(right.cloneContents()); rest.classList.add('cv-continuation');
    return rest;
  } };
}

function copyWithLast(unit: HTMLElement, last: HTMLElement): HTMLElement {
  const copy = unit.cloneNode(false) as HTMLElement;
  // The oversized final block is already sliced; do not clone and discard it.
  for (const child of Array.from(unit.children).slice(0, -1)) copy.append(child.cloneNode(true));
  copy.append(last);
  return copy;
}

function paginate(source: HTMLElement, pages: HTMLElement): void {
  const doc = source.ownerDocument;
  const units = flowUnits(semanticBlocks(source), doc);
  let content: HTMLElement;
  function newPage(): HTMLElement {
    const page = doc.createElement('section'); page.className = 'cv-page';
    const body = doc.createElement('div'); body.className = 'cv-page-content'; page.append(body);
    const footer = doc.createElement('div'); footer.className = 'cv-page-number'; page.append(footer);
    pages.append(page); content = body; return body;
  }
  newPage();
  // Use fractional geometry, not rounded scrollHeight, to avoid a print-only extra line.
  function fits(): boolean {
    const last = content.lastElementChild;
    return !last || last.getBoundingClientRect().bottom <= content.getBoundingClientRect().bottom + 0.2;
  }
  let operations = 0;
  for (let unit of units) {
    while (true) {
      if (++operations > 3000) throw new Error('内容超过当前排版容量，请拆分笔记后再导出。');
      const hadContent = content!.children.length > 0;
      content!.append(unit);
      if (fits()) break;
      unit.remove();
      if (hadContent) { newPage(); content!.append(unit); if (fits()) break; unit.remove(); }
      // Oversized atomic blocks can flow across pages while headings stay with the first slice.
      const last = unit.lastElementChild as HTMLElement | null;
      const text = last?.textContent ?? '';
      if (!last || text.length < 2 || last.querySelector('img,svg,canvas,table') || last.matches('table')) {
        throw new Error('有一个内容块高于整页，无法无损分页；请拆分表格或缩小图片后重试。');
      }
      const boundaries = [0];
      for (const char of text) boundaries.push(boundaries[boundaries.length - 1]! + char.length);
      let low = 1, high = boundaries.length - 2, best = 0;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const { first } = splitAt(last, boundaries[mid]!);
        const candidate = copyWithLast(unit, first); content!.append(candidate);
        const ok = fits(); candidate.remove();
        if (ok) { best = mid; low = mid + 1; } else high = mid - 1;
      }
      if (!best) throw new Error('无法为当前内容块找到安全分页位置，请检查标题或段落。');
      // Prefer word boundaries for English, with a bounded fallback for unbroken links/CJK.
      let offset = boundaries[best]!;
      const nearby = text.slice(Math.max(0, offset - 36), offset).match(/[\s，。；、.!?;][^\s，。；、.!?;]*$/);
      if (nearby && nearby.index !== undefined) offset = Math.max(0, offset - 36) + nearby.index + 1;
      const { first, rest } = splitAt(last, offset);
      const head = copyWithLast(unit, first);
      content!.append(head);
      unit = doc.createElement('div'); unit.className = 'cv-unit'; unit.append(rest());
      newPage();
    }
  }
  const count = pages.children.length;
  Array.from(pages.children).forEach((page, index) => {
    const footer = page.querySelector('.cv-page-number'); if (footer) footer.textContent = `${index + 1} / ${count}`;
  });
}

async function imageReady(img: HTMLImageElement, signal: AbortSignal): Promise<void> {
  abortIfNeeded(signal);
  if (img.complete) {
    if (!img.naturalWidth) throw new Error('图片未能加载，请检查附件路径。');
    return;
  }
  let cleanup = () => {};
  try {
    await abortable(new Promise<void>((resolve, reject) => {
      const loaded = () => img.naturalWidth ? resolve() : failed();
      const failed = () => reject(new Error('图片未能加载，请检查附件路径。'));
      cleanup = () => { img.removeEventListener('load', loaded); img.removeEventListener('error', failed); };
      img.addEventListener('load', loaded, { once: true }); img.addEventListener('error', failed, { once: true });
      if (img.complete) loaded();
    }), signal);
  } finally { cleanup(); }
}

async function resourcesReady(element: HTMLElement, signal: AbortSignal): Promise<void> {
  // ResumeFonts.prepare already verifies our font. Waiting for the entire
  // document also waits for unrelated themes/plugins and can delay every edit.
  abortIfNeeded(signal);
  const pending = new AbortController();
  const cancel = () => pending.abort();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    await Promise.all(Array.from(element.querySelectorAll('img')).map(img => imageReady(img, pending.signal)));
  } finally {
    // One failed image must release the other image listeners and timeout tasks.
    pending.abort(); signal.removeEventListener('abort', cancel);
  }
}

async function profilePhoto(app: App, field: PhotoField, source: HTMLElement, sourcePath: string, owner: Component, signal: AbortSignal, issues: Issue[], resources: RenderResources): Promise<string | undefined> {
  const doc = source.ownerDocument;
  const staging = doc.createElement('div'); source.after(staging);
  let photoPath: string | undefined;
  try {
    // Obsidian still owns image syntax/resolution. Restrict this dedicated field
    // to a local inline embed before rendering so remote URLs aren't requested.
    if (!isPhotoEmbed(field.markdown)) throw new Error('请填入本地图片引用，例如 ![[附件/头像.jpg]]。');
    if (/[a-z][a-z0-9+.-]*:|(?:\]\(|<)\s*\/\//i.test(field.markdown)) throw new Error('请先将照片保存到 Vault，再引用本地附件。');
    await abortable(MarkdownRenderer.render(app, field.markdown, staging, sourcePath, owner), signal);
    collectResources(app, staging, sourcePath, resources);
    const images = Array.from(staging.querySelectorAll('img'));
    if (images.length !== 1 || staging.textContent?.trim()) throw new Error('请引用一张有效的本地图片，并将说明文字放到其他段落。');
    const img = images[0]!;
    const linkpath = img.closest('.internal-embed')?.getAttribute('src');
    const file = linkpath ? app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath) : null;
    photoPath = file?.path;
    if (!file) resources.unresolved = true;
    if (!file || !img.getAttribute('src')?.startsWith('app://')) throw new Error('找不到照片附件，请检查图片路径。');
    if (!/^(png|jpe?g|webp)$/i.test(file.extension)) throw new Error('照片支持 PNG、JPEG 和 WebP，请转换后再引用。');
    await imageReady(img, signal);
    img.removeAttribute('width'); img.removeAttribute('height'); img.removeAttribute('style');
    const blocks = semanticBlocks(source);
    const start = blocks.findIndex(block => block.tagName === 'H1');
    if (start < 0) throw new Error('请将照片字段放在姓名一级标题下方。');
    let end = start + 1;
    while (end < blocks.length && !/^H[1-6]$/.test(blocks[end]!.tagName)) end++;
    const header = doc.createElement('div'); header.className = 'cv-profile';
    const details = doc.createElement('div'); details.className = 'cv-profile-details';
    details.append(...blocks.slice(start, end));
    const photo = doc.createElement('div'); photo.className = 'cv-profile-photo'; photo.append(img);
    header.append(details, photo);
    source.replaceChildren(...blocks.slice(0, start), header, ...blocks.slice(end));
  } catch (error) {
    abortIfNeeded(signal);
    issues.push({ line: field.line, message: `照片未显示：${error instanceof Error ? error.message : String(error)} 请修正或清空照片字段后再导出。`, blocksExport: true });
  } finally { staging.remove(); }
  return photoPath;
}

export async function renderResume(app: App, snapshot: Snapshot, owner: Component, signal: AbortSignal, fonts: ResumeFonts, doc: Document = document): Promise<RenderedResume> {
  abortIfNeeded(signal);
  const component = owner.addChild(new Component());
  const host = doc.createElement('div'); host.className = 'mcv-measure';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style'); style.textContent = paperCss; shadow.append(style);
  const source = doc.createElement('div'); source.className = 'cv-root cv-source'; shadow.append(source);
  const pages = doc.createElement('div'); pages.className = 'cv-root cv-pages'; shadow.append(pages);
  doc.body.append(host);
  const prepared = prepareMarkdown(snapshot.text);
  const resources: RenderResources = { paths: new Set(), unresolved: false };
  const dispose = () => { owner.removeChild(component); host.remove(); };
  try {
    await fonts.prepare(doc, signal);
    await abortable(MarkdownRenderer.render(app, prepared.markdown, source, snapshot.path, component), signal);
    abortIfNeeded(signal);
    source.querySelectorAll('p').forEach(p => { if (p.firstElementChild?.tagName === 'STRONG' && /[：:]$/.test(p.firstElementChild.textContent ?? '')) p.classList.add('cv-field'); });
    collectResources(app, source, snapshot.path, resources);
    const photoPath = prepared.photo ? await profilePhoto(app, prepared.photo, source, snapshot.path, component, signal, prepared.issues, resources) : undefined;
    await resourcesReady(source, signal);
    // Capture static Markdown output. Arbitrary dynamic postprocessors are outside this build's contract.
    paginate(source, pages);
    source.remove();
    return { host, shadow, pages, pageCount: pages.children.length, snapshot, fonts, photoPath, resourcePaths: resources.paths, hasUnresolvedResources: resources.unresolved, issues: prepared.issues, hiddenFields: prepared.hiddenFields, dispose };
  } catch (error) { dispose(); throw error; }
}

async function localImageDataUrl(img: HTMLImageElement, src: string, signal: AbortSignal): Promise<string> {
  // Only local app:// attachments; requestUrl cannot read this Vault protocol.
  abortIfNeeded(signal);
  const pending = new AbortController();
  const cancel = () => pending.abort();
  signal.addEventListener('abort', cancel, { once: true });
  let blob: Blob;
  try {
    blob = await abortable(img.ownerDocument.win.fetch(src, { signal: pending.signal }).then(r => { if (!r.ok) throw new Error('本地图片读取失败'); return r.blob(); }), signal);
  } finally {
    pending.abort(); signal.removeEventListener('abort', cancel);
  }
  const Reader = img.ownerDocument.defaultView?.FileReader ?? FileReader;
  const reader = new Reader();
  try {
    return await abortable(new Promise<string>((resolve, reject) => {
      reader.onload = () => { if (typeof reader.result === 'string') resolve(reader.result); else reject(new Error('本地图片转换失败')); };
      reader.onerror = () => reject(new Error('本地图片转换失败'));
      reader.readAsDataURL(blob);
    }), signal);
  } finally {
    reader.onload = null; reader.onerror = null;
    if (reader.readyState === 1) reader.abort();
  }
}

export async function exportHtml(rendered: RenderedResume, signal: AbortSignal): Promise<string> {
  abortIfNeeded(signal);
  const blocking = rendered.issues.find(issue => issue.blocksExport);
  if (blocking) throw new Error(`第 ${blocking.line + 1} 行：${blocking.message}`);
  const copy = rendered.pages.cloneNode(true) as HTMLElement;
  if (copy.querySelector('iframe,object,embed,video,audio,canvas')) throw new Error('包含开发版 PDF 不支持的动态内容，请改为静态 Markdown 后重试。');
  for (const el of Array.from(copy.querySelectorAll('*'))) {
    if (el.matches('script,style,iframe,object,embed,button,input,video,audio,canvas')) {
      if (el.textContent?.trim()) el.replaceWith(copy.ownerDocument.createTextNode(el.textContent)); else el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) if (/^on/i.test(attr.name) || attr.name === 'style') el.removeAttribute(attr.name);
    if (el.instanceOf(HTMLAnchorElement) && !/^(https?:|mailto:|tel:)/i.test(el.getAttribute('href') ?? '')) el.removeAttribute('href');
  }
  const images = new Map<string, string>();
  for (const img of Array.from(copy.querySelectorAll('img'))) {
    const src = img.getAttribute('src') ?? '';
    if (src.startsWith('data:')) continue;
    if (!src.startsWith('app://')) throw new Error('开发版 PDF 仅支持已加载的本地附件图片；请将远程图片保存到 Vault 后重试。');
    let data = images.get(src);
    if (!data) { data = await localImageDataUrl(img, src, signal); images.set(src, data); }
    img.src = data;
  }
  const fontCss = await rendered.fonts.css(signal);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:"><title>Markdown to CV</title><style>${fontCss}\n${paperCss}</style></head><body>${copy.outerHTML}</body></html>`;
}
