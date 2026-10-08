import test from 'node:test';
import assert from 'node:assert/strict';
import type { App, TFile, TFolder, View } from 'obsidian';
import { ResumeLocation } from '../src/resume-location';

function setup() {
  const root = { path: '/' } as TFolder;
  const a = { path: '项目/甲', parent: root } as TFolder;
  const b = { path: '项目/乙', parent: root } as TFolder;
  const file = { path: '项目/甲/笔记.md', parent: a } as TFile;
  const folders = new Map([root, a, b].map(folder => [folder.path, folder]));
  const views: View[] = [];
  let navItem: { type: string; folder?: TFolder } = { type: 'folder', folder: b };
  let apiAvailable = true;
  const app = {
    vault: { getFolderByPath: (path: string) => folders.get(path) ?? null, getRoot: () => root },
    workspace: { getLeavesOfType: (type: string) => views.filter(view => view.getViewType() === type).map(view => ({ view })) },
    plugins: { getPlugin: () => apiAvailable ? { api: { selection: { getNavItem: () => navItem } } } : undefined },
  } as unknown as App;
  function view(type: string, target: TFile | TFolder = b) {
    const element = { isShown: () => true };
    const result = { getViewType: () => type, containerEl: element, tree: { activeDom: { file: target } } } as unknown as View;
    views.push(result);
    return result;
  }
  return { location: new ResumeLocation(app), root, a, b, file, folders, views, view,
    setItem: (item: typeof navItem) => { navItem = item; }, disableApi: () => { apiAvailable = false; } };
}

test('new resume defaults to the current note folder, or vault root without context', () => {
  const s = setup();
  assert.equal(s.location.resolve(s.file), s.a);
  assert.equal(s.location.resolve(null), s.root);
});

test('selected core folder wins over a different note and survives the preview toolbar', () => {
  const s = setup();
  s.location.activate(s.view('file-explorer'));
  assert.equal(s.location.resolve(s.file), s.b);
  s.location.activate(s.view('markdown-to-cv-preview'));
  assert.equal(s.location.resolve(s.file), s.b);
  s.location.activate(s.view('markdown'));
  assert.equal(s.location.resolve(s.file), s.a);
});

test('Notebook Navigator reads the latest selected folder; tags and unavailable APIs fall back', () => {
  const s = setup();
  s.location.activate(s.view('notebook-navigator'));
  assert.equal(s.location.resolve(s.file), s.b);
  s.setItem({ type: 'folder', folder: s.root });
  assert.equal(s.location.resolve(s.file), s.root);
  s.setItem({ type: 'tag' });
  assert.equal(s.location.resolve(s.file), s.a);
  s.disableApi();
  assert.equal(s.location.resolve(s.file), s.a);
});

test('switching or closing a note clears stale navigation even if its folder stays selected', () => {
  const s = setup();
  s.location.activate(s.view('notebook-navigator'));
  s.location.activate(null);
  assert.equal(s.location.resolve(s.file), s.a);
  assert.equal(s.location.resolve(null), s.root);
});

test('a folder context-menu target takes priority; deleted targets never redirect silently', () => {
  const s = setup();
  s.location.activate(s.view('file-explorer'));
  assert.equal(s.location.resolve(s.file, s.a), s.a);
  assert.equal(s.location.resolve(s.file, s.root), s.root);
  s.folders.delete(s.a.path);
  assert.throws(() => s.location.resolve(s.file, s.a), /目标文件夹已不存在/);
});

test('deleted, hidden and detached folder selections fall back to the current note', () => {
  const s = setup();
  const v = s.view('file-explorer'); s.location.activate(v);
  s.folders.delete(s.b.path);
  assert.equal(s.location.resolve(s.file), s.a);
  s.folders.set(s.b.path, s.b);
  v.containerEl.isShown = () => false;
  assert.equal(s.location.resolve(s.file), s.a);
  v.containerEl.isShown = () => true;
  s.views.length = 0;
  assert.equal(s.location.resolve(s.file), s.a);
});

test('a file selected in the explorer is never treated as a folder', () => {
  const s = setup();
  s.location.activate(s.view('file-explorer', s.file));
  assert.equal(s.location.resolve(s.file), s.a);
});
