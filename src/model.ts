export interface Snapshot { path: string; name: string; text: string; capturedAt: number }
export interface Issue { line: number; message: string; blocksExport?: boolean }
export interface PhotoField { line: number; markdown: string }
export interface Prepared { markdown: string; issues: Issue[]; hiddenFields: number; photo?: PhotoField }

const fieldPattern = /^\s*\*\*([^*\r\n]+?)[：:]\*\*(.*)$/;
const repairableField = /^(\s*)\*\*(照片|求职方向|手机号码|邮箱地址|作品集或博客|职位|时间|工作内容|角色|学历|专业名称)[：:]\s*([^*]+)$/;

export function isPhotoEmbed(value: string): boolean {
  return /^(?:!\[\[[^\r\n]+\]\]|!\[[^\r\n]*\]\([^\r\n]+\))$/.test(value);
}

function commentGuard(): (line: string) => boolean {
  let closing: string | undefined;
  return line => {
    if (!closing && /^ {4}|^\t/.test(line)) return false;
    let hidden = !!closing;
    for (const match of line.matchAll(/%%|<!--|-->/g)) {
      const token = match[0];
      hidden = true;
      if (closing) { if (token === closing) closing = undefined; }
      else if (token !== '-->') closing = token === '<!--' ? '-->' : '%%';
    }
    return hidden;
  };
}

/** A thin line-preserving adapter, not a Markdown parser. MarkdownRenderer owns syntax. */
export function prepareMarkdown(text: string): Prepared {
  const lines = text.split('\n');
  const issues: Issue[] = [];
  let frontmatterEnd = -1;
  if (lines[0]?.trim() === '---') {
    frontmatterEnd = lines.findIndex((line, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(line));
    if (frontmatterEnd === -1) issues.push({ line: 0, message: '属性区未闭合，按原文保留，请检查分隔线。' });
  }
  let fence: { char: string; length: number } | null = null;
  let previousHeading = 0;
  let inProfile = false;
  const photos: PhotoField[] = [];
  const photoContinuations = new Set<number>();
  const inComment = commentGuard();
  let hiddenFields = 0;
  const result = lines.map((line, index) => {
    if (photoContinuations.has(index)) return '';
    if (index <= frontmatterEnd) return '';
    if (!fence && inComment(line)) return line;
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      const token = marker[1]!;
      if (!fence) {
        fence = { char: token[0]!, length: token.length };
        if (/^(dataview|dataviewjs|tasks|query)\b/i.test(line.slice(line.indexOf(token) + token.length).trim())) {
          issues.push({ line: index, message: '动态查询保留为静态代码文本；开发版不执行第三方查询。' });
          return `${token}text`;
        }
      }
      else if (token[0] === fence.char && token.length >= fence.length && /^\s*(?:`+|~+)\s*$/.test(line)) fence = null;
      return line;
    }
    if (fence || /^ {4}|^\t/.test(line)) return line;
    const heading = line.match(/^(#{1,6})\s+\S/);
    if (heading) {
      const level = heading[1]!.length;
      inProfile = !previousHeading && level === 1;
      if (previousHeading && level > previousHeading + 1) issues.push({ line: index, message: '标题层级有跳跃；内容保留，请核对是否为预期结构。' });
      previousHeading = level;
    } else if (/^#{1,6}[^#\s]/.test(line)) issues.push({ line: index, message: '标题标记后缺少空格，当前按普通文本保留。' });
    const field = line.match(fieldPattern);
    if (inProfile && field?.[1]?.trim() === '照片') {
      let markdown = field[2]!.trim();
      // Native drag/drop may place the image on the next paragraph. Consume only
      // a standalone embed, never an unrelated paragraph, field or code block.
      if (!markdown) {
        let next = index + 1;
        while (next < lines.length && !lines[next]!.trim()) next++;
        const candidate = lines[next] ?? '';
        if (/^ {0,3}!\[/.test(candidate) && isPhotoEmbed(candidate.trim())) {
          markdown = candidate.trim(); photoContinuations.add(next);
        }
      }
      if (markdown) photos.push({ line: index, markdown }); else hiddenFields++;
      return '';
    }
    if (repairableField.test(line)) issues.push({ line: index, message: '字段加粗标记可能未闭合，当前按普通文本保留。' });
    if (/!\[\[/.test(line)) issues.push({ line: index, message: '嵌入内容的完整打印兼容性未验证，请核对输出。' });
    if (/<\/?(?:iframe|script|style|canvas|video|audio|object|embed)\b/i.test(line)) {
      issues.push({ line: index, message: '动态 HTML 保留为文本，请改为标准 Markdown 后再核对版式。' });
      return line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    if (field && !field[2]!.trim()) {
      const next = lines.slice(index + 1).find(x => x.trim());
      // A label followed by body text/list is a populated block (e.g. 工作内容).
      if (next === undefined || /^#{1,6}(?:\s|$)/.test(next) || fieldPattern.test(next)) {
        hiddenFields++;
        return '';
      }
    }
    return line;
  });
  if (fence) issues.push({ line: lines.length - 1, message: '代码围栏未闭合，余下内容按原始代码保留。' });
  if (photos.length > 1) issues.push({ line: photos[1]!.line, message: '基础信息只支持一张照片，请保留一个照片字段后再导出。', blocksExport: true });
  return { markdown: result.join('\n'), issues, hiddenFields, photo: photos.length === 1 ? photos[0] : undefined };
}

/** Only unmistakable punctuation repairs; no inferred ownership, section insertion or sorting. */
export function repairMarkdown(text: string): { text: string; changes: Issue[]; issues: Issue[] } {
  const lines = text.split('\n');
  const changes: Issue[] = [];
  let fence: { char: string; length: number } | null = null;
  let inFrontmatter = lines[0]?.trim() === '---';
  const inComment = commentGuard();
  const repaired = lines.map((line, index) => {
    if (inFrontmatter) {
      if (index > 0 && /^(---|\.\.\.)\s*$/.test(line)) inFrontmatter = false;
      return line;
    }
    if (!fence && inComment(line)) return line;
    const m = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (m) {
      const token = m[1]!;
      if (!fence) fence = { char: token[0]!, length: token.length };
      else if (token[0] === fence.char && token.length >= fence.length && /^\s*(?:`+|~+)\s*$/.test(line)) fence = null;
      return line;
    }
    if (fence || /^ {4}|^\t/.test(line)) return line;
    if (/^#{1,6}[^#\s]/.test(line)) {
      changes.push({ line: index, message: '补上标题标记后的空格；标题文字未改。' });
      return line.replace(/^(#{1,6})/, '$1 ');
    }
    const field = line.match(repairableField);
    if (field) {
      changes.push({ line: index, message: `补齐“${field[2]}”字段的加粗标记；字段值未改。` });
      return line.replace(/^((?:\s*)\*\*[^：:]+[：:])/, '$1**');
    }
    return line;
  }).join('\n');
  return { text: repaired, changes, issues: prepareMarkdown(repaired).issues };
}

export class RevisionGate {
  private generation = 0;
  private path = '';
  request(path: string): Readonly<{ path: string; generation: number }> {
    this.path = path;
    return { path, generation: ++this.generation };
  }
  accepts(ticket: { path: string; generation: number }): boolean {
    return ticket.path === this.path && ticket.generation === this.generation;
  }
  invalidate(): void { this.generation++; }
}

export function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('操作已取消', 'AbortError');
}

export async function abortable<T>(promise: Promise<T>, signal: AbortSignal, timeoutMs = 15000): Promise<T> {
  abortIfNeeded(signal);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      onAbort = () => reject(new DOMException('操作已取消', 'AbortError'));
      signal.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => reject(new Error('等待资源或排版超时，请检查内容后重试。')), timeoutMs);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}
