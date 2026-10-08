import type { App, TFile, TFolder, View } from 'obsidian';

// Optional integrations stay here. Notebook Navigator exposes selection through
// its public API; Obsidian's core explorer has no public folder-selection API.
type NavigatorHost = App & { plugins?: { getPlugin(id: string): {
  api?: { selection?: { getNavItem(): { type: string; folder?: TFolder | null } } };
} | null | undefined } };
type ExplorerView = View & { tree?: { activeDom?: { file?: TFolder | TFile } | null } };

export class ResumeLocation {
  private navigation: View | null = null;
  constructor(private readonly app: App) {}

  activate(view: View | null): void {
    const type = view?.getViewType();
    if (type === 'file-explorer' || type === 'notebook-navigator') this.navigation = view;
    // Clicking our toolbar must not discard the folder just chosen in the sidebar.
    else if (type !== 'markdown-to-cv-preview') this.navigation = null;
  }

  private liveFolder(candidate: TFolder | TFile | null | undefined): TFolder | null {
    if (!candidate || typeof candidate.path !== 'string') return null;
    const folder = this.app.vault.getFolderByPath(candidate.path);
    return folder === candidate ? folder : null;
  }

  private selectedFolder(): TFolder | null {
    const view = this.navigation;
    if (!view || !view.containerEl.isShown()
      || !this.app.workspace.getLeavesOfType(view.getViewType()).some(leaf => leaf.view === view)) return null;
    try {
      if (view.getViewType() === 'notebook-navigator') {
        const item = (this.app as NavigatorHost).plugins?.getPlugin('notebook-navigator')?.api?.selection?.getNavItem();
        return item?.type === 'folder' ? this.liveFolder(item.folder) : null;
      }
      // Guard the private core-explorer boundary; a host change falls back to the note.
      return this.liveFolder((view as ExplorerView).tree?.activeDom?.file);
    } catch { return null; }
  }

  resolve(source: TFile | null, explicit?: TFolder): TFolder {
    if (explicit) {
      const folder = this.liveFolder(explicit);
      if (!folder) throw new Error('目标文件夹已不存在，请重新选择后新建简历。');
      return folder;
    }
    return this.selectedFolder() ?? this.liveFolder(source?.parent) ?? this.app.vault.getRoot();
  }
}
