import { ItemView, TFile, setIcon } from 'obsidian';
import type { WorkspaceLeaf, ViewStateResult } from 'obsidian';
import type MarkdownToCvPlugin from './main';
import { RevisionGate, abortIfNeeded } from './model';
import type { Snapshot } from './model';
import { exportHtml } from './render';
import type { RenderedResume } from './render';
import { writePdfAtomically } from './pdf';

export const VIEW_TYPE = 'markdown-to-cv-preview';
const PAGE_WIDTH = 210 * 96 / 25.4;
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2];
type PreviewAnchor = { x: number; y: number };
export class ResumeView extends ItemView {
  source: TFile | null = null;
  current: RenderedResume | null = null;
  readonly metrics = { renders: [] as number[], exports: [] as number[], commits: 0 };
  lastExport: { status: string; source: string; path?: string; milliseconds: number; message?: string } | null = null;
  private gate = new RevisionGate();
  private timer: number | null = null;
  private rendering: AbortController | null = null;
  private exporting: AbortController | null = null;
  private viewport!: HTMLElement;
  private status!: HTMLElement;
  private sourceLabel!: HTMLElement;
  private issues!: HTMLElement;
  private exportStatus!: HTMLElement;
  private exportButton!: HTMLButtonElement;
  private cancelButton!: HTMLButtonElement;
  private repairButton!: HTMLButtonElement;
  private zoomOut!: HTMLButtonElement;
  private zoomIn!: HTMLButtonElement;
  private zoomSelect!: HTMLSelectElement;
  private fitButton!: HTMLButtonElement;
  private zoomLevel: number | null = null;
  private displayScale = 1;
  private ready = false;
  private closed = false;
  constructor(leaf: WorkspaceLeaf, readonly plugin: MarkdownToCvPlugin) { super(leaf); }
  getViewType(): string { return VIEW_TYPE; }
  getDisplayText(): string { return '简历预览'; }
  getIcon(): string { return 'file-user'; }
  getState(): Record<string, unknown> { return { sourcePath: this.source?.path, previewZoom: this.zoomLevel ?? 'fit' }; }
  async setState(state: { sourcePath?: string; previewZoom?: number | 'fit' }, result: ViewStateResult): Promise<void> {
    this.zoomLevel = typeof state.previewZoom === 'number' && ZOOM_LEVELS.includes(state.previewZoom) ? state.previewZoom : null;
    const file = state.sourcePath ? this.app.vault.getAbstractFileByPath(state.sourcePath) : null;
    if (file instanceof TFile && file.extension === 'md') this.bindFile(file);
    if (this.ready) this.fit();
    await super.setState(state, result);
  }
  async onOpen(): Promise<void> {
    this.contentEl.empty(); this.contentEl.addClass('markdown-to-cv-view');
    const toolbar = this.contentEl.createDiv('mcv-toolbar');
    toolbar.setAttribute('aria-label', '简历操作');
    const button = (parent: HTMLElement, text: string, icon: string, fn: () => void, cls = '') => {
      const el = parent.createEl('button', { cls: `mcv-button ${cls}`, attr: { type: 'button', 'aria-label': text, title: text } });
      const symbol = el.createSpan({ cls: 'mcv-button-icon', attr: { 'aria-hidden': 'true' } }); setIcon(symbol, icon);
      el.createSpan({ text }); this.registerDomEvent(el, 'click', fn); return el;
    };
    const actions = toolbar.createDiv('mcv-toolbar-actions');
    button(actions, '新建简历', 'file-plus', () => this.plugin.run(() => this.plugin.createResume()));
    this.repairButton = button(actions, '回到模板', 'rotate-ccw', () => { if (this.source) this.plugin.run(() => this.plugin.repair(this.source!)); });
    this.repairButton.title = '保留原文快照并生成修复副本';
    const output = toolbar.createDiv('mcv-toolbar-output');
    this.exportButton = button(output, '导出 PDF', 'download', () => { void this.exportPdf(); }, 'mcv-button-primary');
    this.cancelButton = button(output, '取消导出', 'x', () => this.cancelExport()); this.cancelButton.hidden = true;
    this.sourceLabel = this.contentEl.createDiv('mcv-source');
    const previewBar = this.contentEl.createDiv('mcv-preview-bar');
    this.status = previewBar.createDiv('mcv-status'); this.status.setAttribute('aria-live', 'polite');
    const zoom = previewBar.createDiv('mcv-zoom'); zoom.setAttribute('aria-label', '简历预览缩放');
    this.zoomOut = button(zoom, '缩小预览', 'minus', () => this.stepZoom(-1), 'mcv-icon-button');
    this.zoomSelect = zoom.createEl('select', { cls: 'mcv-zoom-select', attr: { 'aria-label': '预览缩放比例', title: '仅调整预览大小，不改变 PDF 排版' } });
    this.zoomSelect.createEl('option', { value: 'fit', text: '适应宽度' });
    for (const level of ZOOM_LEVELS) this.zoomSelect.createEl('option', { value: String(level), text: `${level * 100}%` });
    this.registerDomEvent(this.zoomSelect, 'change', () => this.setZoom(this.zoomSelect.value === 'fit' ? null : Number(this.zoomSelect.value)));
    this.zoomIn = button(zoom, '放大预览', 'plus', () => this.stepZoom(1), 'mcv-icon-button');
    this.fitButton = button(zoom, '适应宽度', 'maximize', () => this.setZoom(null), 'mcv-fit-button');
    this.exportStatus = this.contentEl.createDiv('mcv-export-status'); this.exportStatus.setAttribute('aria-live', 'polite');
    this.issues = this.contentEl.createDiv('mcv-issues');
    this.viewport = this.contentEl.createDiv('mcv-viewport');
    const observer = new ResizeObserver(() => this.fit()); observer.observe(this.viewport);
    this.register(() => observer.disconnect());
    this.ready = true;
    this.updateZoomControls(); this.repairButton.disabled = !this.source;
    if (this.source) this.bindFile(this.source);
    else { this.sourceLabel.textContent = '尚未选择源笔记'; this.viewport.createDiv({ cls: 'mcv-empty', text: '打开一篇 Markdown 笔记，或点击“新建简历”。' }); this.exportButton.disabled = true; }
  }
  bindFile(file: TFile): void {
    const changed = this.source !== file || (this.current && this.current.snapshot.path !== file.path);
    this.source = file;
    if (!this.ready || this.closed) return;
    this.sourceLabel.textContent = `源笔记 · ${file.path}`;
    this.sourceLabel.title = file.path;
    this.repairButton.disabled = false;
    this.exportButton.disabled = !!this.exporting;
    if (changed) { this.current?.dispose(); this.current = null; this.viewport.empty(); this.viewport.scrollTop = 0; this.viewport.scrollLeft = 0; this.issues.empty(); this.updateZoomControls(); }
    this.schedule();
  }
  sourceDeleted(): void {
    this.source = null; this.gate.invalidate(); this.rendering?.abort();
    if (this.timer) this.contentEl.win.clearTimeout(this.timer);
    this.current?.dispose(); this.current = null;
    this.viewport.empty(); this.issues.empty(); this.sourceLabel.textContent = '源笔记已删除'; this.status.textContent = '请选择另一篇 Markdown 笔记。'; this.exportButton.disabled = true;
    this.sourceLabel.removeAttribute('title'); this.repairButton.disabled = true; this.updateZoomControls();
  }
  schedule(snapshot?: Snapshot): void {
    if (!this.source || !this.ready || this.closed) return;
    const ticket = this.gate.request(this.source.path);
    const file = this.source;
    const started = performance.now();
    this.rendering?.abort();
    if (this.timer) this.contentEl.win.clearTimeout(this.timer);
    const metadata = this.current ? `A4 · ${this.current.pageCount} 页` : '';
    if (this.status.textContent !== metadata) this.status.textContent = metadata;
    this.status.dataset.state = 'updating';
    this.timer = this.contentEl.win.setTimeout(() => {
      this.timer = null;
      void this.update(snapshot ? Promise.resolve(snapshot) : this.plugin.capture(file), ticket, started);
    }, 70);
  }
  private async update(pending: Promise<Snapshot>, ticket: { path: string; generation: number }, started: number): Promise<void> {
    const controller = new AbortController(); this.rendering = controller;
    let result: RenderedResume | null = null;
    try {
      const snapshot = await pending;
      if (!this.gate.accepts(ticket) || this.closed) return;
      result = await this.plugin.render(snapshot, this, controller.signal, this.contentEl.ownerDocument);
      if (!this.gate.accepts(ticket) || this.closed) { result.dispose(); return; }
      const anchor = this.previewAnchor();
      this.current?.dispose(); this.current = result;
      result.host.classList.remove('mcv-measure'); this.viewport.replaceChildren(result.host); this.fit(anchor);
      this.issues.empty();
      for (const issue of result.issues) {
        const b = this.issues.createEl('button', { text: `第 ${issue.line + 1} 行：${issue.message}` });
        b.onclick = () => { if (this.source) this.plugin.run(() => this.plugin.revealSource(this.source!, issue.line)); };
      }
      const metadata = `A4 · ${result.pageCount} 页`;
      if (this.status.textContent !== metadata) this.status.textContent = metadata;
      this.status.dataset.state = 'ready'; this.metrics.commits++;
      this.metrics.renders.push(performance.now() - started); if (this.metrics.renders.length > 100) this.metrics.renders.shift();
    } catch (error) {
      if (controller.signal.aborted || !this.gate.accepts(ticket) || this.closed) return;
      this.status.textContent = `预览未更新：${String(error instanceof Error ? error.message : error)}${this.current ? '（仍显示上一版）' : ''}`; this.status.dataset.state = 'error';
    }
  }
  private previewAnchor(): PreviewAnchor | null {
    if (!this.current) return null;
    const viewport = this.viewport.getBoundingClientRect(), host = this.current.host.getBoundingClientRect();
    return {
      x: (viewport.left + this.viewport.clientLeft + this.viewport.clientWidth / 2 - host.left) / this.displayScale,
      y: (viewport.top + this.viewport.clientTop + this.viewport.clientHeight / 2 - host.top) / this.displayScale,
    };
  }
  private fit(anchor = this.previewAnchor()): void {
    if (!this.current) { this.updateZoomControls(); return; }
    const style = this.viewport.ownerDocument.defaultView!.getComputedStyle(this.viewport);
    const width = this.viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const scale = this.zoomLevel ?? Math.min(1, Math.max(0.15, width / PAGE_WIDTH));
    const host = this.current.host;
    host.addClass('mcv-paper'); host.style.zoom = String(scale);
    this.displayScale = scale;
    if (anchor) {
      const viewport = this.viewport.getBoundingClientRect(), page = host.getBoundingClientRect();
      this.viewport.scrollLeft += page.left + anchor.x * scale - (viewport.left + this.viewport.clientLeft + this.viewport.clientWidth / 2);
      this.viewport.scrollTop += page.top + anchor.y * scale - (viewport.top + this.viewport.clientTop + this.viewport.clientHeight / 2);
    }
    this.updateZoomControls();
  }
  private setZoom(level: number | null): void {
    if (!this.current || (level !== null && !ZOOM_LEVELS.includes(level))) return;
    const anchor = this.previewAnchor(); this.zoomLevel = level; this.fit(anchor);
    this.app.workspace.requestSaveLayout();
  }
  private stepZoom(direction: -1 | 1): void {
    const next = direction > 0 ? ZOOM_LEVELS.find(level => level > this.displayScale + 0.001)
      : [...ZOOM_LEVELS].reverse().find(level => level < this.displayScale - 0.001);
    if (next !== undefined) this.setZoom(next);
  }
  private updateZoomControls(): void {
    if (!this.zoomSelect) return;
    const available = !!this.current;
    this.zoomSelect.disabled = !available;
    this.zoomSelect.options[0]!.text = available && this.zoomLevel === null ? `适宽 ${Math.round(this.displayScale * 100)}%` : '适应宽度';
    this.zoomSelect.value = this.zoomLevel === null ? 'fit' : String(this.zoomLevel);
    this.zoomOut.disabled = !available || this.displayScale <= ZOOM_LEVELS[0]! + 0.001;
    this.zoomIn.disabled = !available || this.displayScale >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]! - 0.001;
    this.fitButton.disabled = !available;
    this.fitButton.setAttribute('aria-pressed', String(this.zoomLevel === null));
  }
  cancelExport(): void { this.exporting?.abort(); }
  /** Same operation as the button; destination is optional for reproducible local host tests. */
  async exportPdf(destination?: string, capturedSnapshot?: Snapshot): Promise<void> {
    if (!this.source || this.exporting || this.closed) return;
    const started = performance.now();
    const file = this.source;
    // Ribbon/command exports capture before opening the preview; toolbar exports capture here.
    const snapshotPromise = capturedSnapshot ? Promise.resolve(capturedSnapshot) : this.plugin.capture(file);
    const controller = new AbortController(); this.exporting = controller;
    this.exportButton.disabled = true; this.cancelButton.hidden = false;
    this.exportStatus.textContent = '导出中 · 正在固定当前内容…';
    let rendered: RenderedResume | null = null;
    try {
      const snapshot = await snapshotPromise; abortIfNeeded(controller.signal);
      const path = destination ?? await this.plugin.pdf.choosePath(snapshot.name);
      if (!path) { controller.abort(); abortIfNeeded(controller.signal); }
      abortIfNeeded(controller.signal);
      this.exportStatus.textContent = '导出中 · 正在等待字体、资源与分页…';
      rendered = await this.plugin.render(snapshot, this, controller.signal, this.contentEl.ownerDocument);
      const html = await exportHtml(rendered, controller.signal);
      this.exportStatus.textContent = '导出中 · 正在生成 PDF…';
      const bytes = await this.plugin.pdf.print(html, controller.signal);
      this.exportStatus.textContent = '导出中 · 正在写入文件…';
      await writePdfAtomically(bytes, path!, controller.signal);
      const milliseconds = performance.now() - started;
      this.lastExport = { status: 'success', source: snapshot.path, path: path!, milliseconds };
      this.metrics.exports.push(milliseconds); if (this.metrics.exports.length > 30) this.metrics.exports.shift();
      this.exportStatus.textContent = `已导出 · ${path}`;
    } catch (error) {
      const canceled = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError');
      const message = error instanceof Error ? error.message : String(error);
      this.lastExport = { status: canceled ? 'canceled' : 'error', source: capturedSnapshot?.path ?? file.path, milliseconds: performance.now() - started, message };
      this.exportStatus.textContent = canceled ? '已取消导出，未写入 PDF。' : `导出失败：${message}。可点击“导出 PDF”重试。`;
    } finally {
      rendered?.dispose(); this.exporting = null; this.cancelButton.hidden = true; this.exportButton.disabled = !this.source;
    }
  }
  async onClose(): Promise<void> {
    this.closed = true; this.gate.invalidate(); if (this.timer) this.contentEl.win.clearTimeout(this.timer);
    this.rendering?.abort(); this.exporting?.abort(); this.current?.dispose(); this.current = null;
  }
}
