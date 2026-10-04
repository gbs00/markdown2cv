import { Plugin, MarkdownView, TFile, Notice, Menu, normalizePath } from 'obsidian';
import type { Editor, Component } from 'obsidian';
import template from './template.md';
import { ResumeView, VIEW_TYPE } from './view';
import { PdfService } from './pdf';
import { repairMarkdown } from './model';
import type { Snapshot } from './model';
import { FONT_FILE, ResumeFonts } from './fonts';
import { renderResume } from './render';
import type { RenderedResume } from './render';

export default class MarkdownToCvPlugin extends Plugin {
  readonly pdf = new PdfService();
  private fonts!: ResumeFonts;
  private edits = new WeakMap<Editor, number>();
  private editSequence = 0;
  private repairBusy = false;
  private ribbonMenu: Menu | null = null;
  async onload(): Promise<void> {
    this.fonts = new ResumeFonts(() => {
      if (!this.manifest.dir) throw new Error('插件目录不可用');
      return this.app.vault.adapter.readBinary(normalizePath(`${this.manifest.dir}/fonts/${FONT_FILE}`));
    });
    this.register(() => this.fonts.dispose());
    this.registerView(VIEW_TYPE, leaf => new ResumeView(leaf, this));
    const ribbon = this.addRibbonIcon('file-user', '新建简历（右键更多操作）', () => this.run(() => this.createResume()));
    this.registerDomEvent(ribbon, 'contextmenu', event => {
      event.preventDefault(); event.stopPropagation();
      this.showResumeMenu(event);
    });
    this.addCommand({ id: 'new-resume', name: '新建简历', callback: () => this.run(() => this.createResume()) });
    this.addCommand({ id: 'open-preview', name: '打开简历预览', checkCallback: checking => {
      const file = this.activeResumeFile();
      if (!file) return false;
      if (!checking) this.run(() => this.openPreview(file)); return true;
    } });
    this.addCommand({ id: 'export-pdf', name: '导出 PDF', checkCallback: checking => {
      const file = this.activeResumeFile();
      if (!file) return false;
      if (!checking) this.run(() => this.exportResume(file)); return true;
    } });
    this.addCommand({ id: 'restore-framework', name: '回到模板（保留原文并新建副本）', callback: () => this.run(async () => {
      const file = this.views()[0]?.source ?? this.app.workspace.getActiveFile();
      if (file?.extension === 'md') await this.repair(file);
    }) });
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (file instanceof TFile && file.extension === 'md') menu.addItem(item => item.setTitle('打开简历预览').setIcon('file-user').onClick(() => this.run(() => this.openPreview(file))));
    }));
    this.registerEvent(this.app.workspace.on('editor-change', (editor, info) => {
      this.edits.set(editor, ++this.editSequence);
      const file = info.file; if (!file) return;
      for (const view of this.views()) if (view.source === file) view.schedule(this.editorSnapshot(file, editor));
    }));
    this.registerEvent(this.app.workspace.on('file-open', file => {
      if (file?.extension === 'md') this.views().forEach(view => view.bindFile(file));
    }));
    this.registerEvent(this.app.workspace.on('active-leaf-change', leaf => {
      if (leaf?.view instanceof MarkdownView && leaf.view.file?.extension === 'md') this.views().forEach(view => view.bindFile((leaf.view as MarkdownView).file!));
    }));
    this.registerEvent(this.app.vault.on('modify', file => { this.views().forEach(view => { if (view.source === file || view.current?.photoPath === file.path) view.schedule(); }); }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => { if (file instanceof TFile) this.views().forEach(view => {
      if (view.source === file) view.bindFile(file); else if (view.current?.photoPath === oldPath) view.schedule();
    }); }));
    this.registerEvent(this.app.vault.on('delete', file => { this.views().forEach(view => {
      if (view.source === file) view.sourceDeleted(); else if (view.current?.photoPath === file.path) view.schedule();
    }); }));
  }
  onunload(): void {
    this.ribbonMenu?.hide();
    this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach(leaf => leaf.detach());
    this.pdf.dispose();
  }
  private activeResumeFile(): TFile | null {
    const preview = this.app.workspace.getActiveViewOfType(ResumeView);
    const file = preview ? preview.source : this.app.workspace.getActiveFile();
    return file?.extension === 'md' ? file : null;
  }
  private showResumeMenu(event: MouseEvent): void {
    this.ribbonMenu?.hide();
    const menu = this.ribbonMenu = new Menu();
    const file = this.activeResumeFile();
    menu.addItem(item => item.setTitle('新建简历').setIcon('file-plus').onClick(() => this.run(() => this.createResume())));
    menu.addItem(item => item.setTitle('预览简历').setIcon('file-user').setDisabled(!file).onClick(() => {
      if (file) this.run(() => this.openPreview(file));
    }));
    menu.addItem(item => item.setTitle('导出简历').setIcon('download').setDisabled(!file).onClick(() => {
      if (file) this.run(() => this.exportResume(file));
    }));
    menu.onHide(() => { if (this.ribbonMenu === menu) this.ribbonMenu = null; });
    menu.showAtMouseEvent(event);
  }
  views(): ResumeView[] { return this.app.workspace.getLeavesOfType(VIEW_TYPE).map(leaf => leaf.view).filter((view): view is ResumeView => view instanceof ResumeView); }
  render(snapshot: Snapshot, owner: Component, signal: AbortSignal, doc: Document = document): Promise<RenderedResume> {
    return renderResume(this.app, snapshot, owner, signal, this.fonts, doc);
  }
  run(task: () => Promise<unknown>): void { void task().catch(error => { console.error('[Markdown to CV]', error); new Notice(error instanceof Error ? error.message : String(error)); }); }
  private editorSnapshot(file: TFile, editor: Editor): Snapshot {
    return { path: file.path, name: file.basename, text: editor.getValue(), capturedAt: Date.now() };
  }
  capture(file: TFile): Promise<Snapshot> {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    const views = this.app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view)
      .filter((view): view is MarkdownView => view instanceof MarkdownView && view.file === file && view.getMode() === 'source');
    views.sort((a, b) => (a === active ? -1 : b === active ? 1 : (this.edits.get(b.editor) ?? 0) - (this.edits.get(a.editor) ?? 0)));
    if (views[0]) return Promise.resolve(this.editorSnapshot(file, views[0].editor));
    const path = file.path, name = file.basename, capturedAt = Date.now();
    return this.app.vault.read(file).then(text => ({ path, name, text, capturedAt }));
  }
  async openPreview(file: TFile): Promise<ResumeView> {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf('split', 'vertical'); await leaf.setViewState({ type: VIEW_TYPE, active: false, state: { sourcePath: file.path } }); }
    const view = leaf.view as ResumeView; view.bindFile(file); await this.app.workspace.revealLeaf(leaf); return view;
  }
  async exportResume(file: TFile): Promise<void> {
    const snapshot = await this.capture(file);
    const view = await this.openPreview(file);
    await view.exportPdf(undefined, snapshot);
  }
  async createResume(): Promise<TFile> {
    const parent = this.app.workspace.getActiveFile()?.parent?.path ?? '';
    const file = await this.createUnique(parent, '新简历', template);
    await this.app.workspace.getLeaf('tab').openFile(file, { state: { mode: 'source' } });
    await this.openPreview(file); return file;
  }
  private async createUnique(parent: string, name: string, text: string): Promise<TFile> {
    const prefix = parent && parent !== '/' ? `${parent}/` : '';
    for (let i = 0; i < 1000; i++) {
      const path = normalizePath(`${prefix}${name}${i ? ` ${i + 1}` : ''}.md`);
      if (!this.app.vault.getAbstractFileByPath(path)) return this.app.vault.create(path, text);
    }
    throw new Error('无法生成唯一文件名，请整理同名文件后重试。');
  }
  async revealSource(file: TFile, line?: number): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType('markdown').find(leaf => leaf.view instanceof MarkdownView && leaf.view.file === file);
    const leaf = existing ?? this.app.workspace.getLeaf('tab');
    await leaf.openFile(file, { state: { mode: 'source' } }); await this.app.workspace.revealLeaf(leaf);
    if (line !== undefined && leaf.view instanceof MarkdownView) {
      leaf.view.editor.setCursor({ line, ch: 0 }); leaf.view.editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true); leaf.view.editor.focus();
    }
  }
  async repair(file: TFile): Promise<{ original: TFile; repaired: TFile }> {
    if (this.repairBusy) throw new Error('正在创建修复副本，请稍候。');
    this.repairBusy = true;
    try {
      const snapshot = await this.capture(file);
      const stamp = new Date(snapshot.capturedAt).toISOString().replace(/[:.]/g, '-');
      const parent = file.parent?.path ?? '';
      const original = await this.createUnique(parent, `${snapshot.name} 原文快照 ${stamp}`, snapshot.text);
      const repair = repairMarkdown(snapshot.text);
      const notes = [
        '', '', '## 修复与待整理说明', '',
        `点击时的完整原文：[[${original.path.replace(/\.md$/, '')}|原文快照]]。原笔记未修改。`, '',
        `自动处理 ${repair.changes.length} 处明确标记损坏；其余文字保留原位，不推测归属，不补回删除的模块。`, '',
        ...repair.changes.map(change => `- 原文第 ${change.line + 1} 行：${change.message}`),
        ...repair.issues.map(issue => `- 待整理 · 原文第 ${issue.line + 1} 行：${issue.message}`),
        '- 归属不明确的段落保留在原位置，请逐段核对；严重结构损坏需手工整理。', '',
      ].join('\n');
      const repaired = await this.createUnique(parent, `${snapshot.name} 修复副本 ${stamp}`, repair.text + notes);
      await this.app.workspace.getLeaf('tab').openFile(repaired, { state: { mode: 'source' } }); await this.openPreview(repaired);
      new Notice(`已创建原文快照与修复副本，处理 ${repair.changes.length} 处。请核对待整理说明。`);
      return { original, repaired };
    } finally { this.repairBusy = false; }
  }
}
