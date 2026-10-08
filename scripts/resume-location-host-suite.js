return (async () => {
  const fs = require('node:fs/promises');
  if (app.vault.adapter.getBasePath() !== config.vault
    || await fs.readFile(`${config.vault}/.mcv-release-qa`, 'utf8') !== config.version) throw Error('Refusing non-test Vault');
  const result = { status: 'running', checks: {}, created: [] };
  const save = () => fs.writeFile(config.result, JSON.stringify(result, null, 2));
  const assert = (value, message) => { if (!value) throw Error(message); };
  const wait = async condition => {
    for (let i = 0; i < 100; i++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
    throw Error('Host state timed out');
  };
  const prefix = `location-qa-${Date.now()}`;
  const originalFiles = new Map(app.vault.getMarkdownFiles().map(file => [file.path, file.stat.mtime]));
  const active = app.workspace.activeLeaf;
  let editor;
  try {
    const plugin = app.plugins.getPlugin('markdown-to-cv');
    assert(plugin?.creationLocation, 'Install the current test build first');
    const originalText = new Map();
    for (const name of originalFiles.keys()) originalText.set(name, await app.vault.read(app.vault.getFileByPath(name)));
    await app.vault.createFolder(prefix);
    const a = await app.vault.createFolder(`${prefix}/甲`), b = await app.vault.createFolder(`${prefix}/乙`);
    const source = await app.vault.create(`${a.path}/当前笔记.md`, '# 虚构目录验收\n\n原笔记保留。\n');
    editor = app.workspace.getLeaf('tab');
    const openSource = async () => { await editor.openFile(source); app.workspace.setActiveLeaf(editor, { focus: true }); };
    const created = async folder => {
      const file = await plugin.createResume(); result.created.push(file.path);
      assert(file.parent === folder, `Wrong folder: ${file.path}; expected ${folder.path}`);
      assert((await app.vault.read(file)).includes('cv_template: basic'), 'Template missing');
      assert(plugin.views()[0]?.source === file, 'Preview source mismatch');
      return file;
    };
    await openSource(); await created(a); result.checks.currentNoteFolder = true;
    const preview = plugin.views()[0]; app.workspace.setActiveLeaf(preview.leaf, { focus: true });
    const second = await created(a);
    assert(second.basename === '新简历 2', 'Collision did not receive a suffix');
    result.checks.previewSourceAndCollision = true;

    const explorer = await app.workspace.ensureSideLeaf('file-explorer', 'left', { reveal: true });
    await wait(() => explorer.view.fileItems?.[b.path]);
    app.workspace.setActiveLeaf(explorer, { focus: true });
    // Exercise the guarded integration using real core-explorer objects. Native
    // pointer/keyboard selection is also verified separately through the UI.
    explorer.view.tree.activeDom = explorer.view.fileItems[b.path];
    await created(b); result.checks.coreExplorerSelection = true;

    await openSource(); await created(a); result.checks.oldFolderDoesNotOverrideNote = true;
    plugin.showResumeMenu(new MouseEvent('contextmenu'));
    const menu = new plugin.ribbonMenu.constructor(); plugin.ribbonMenu.hide(); let createInFolder;
    const add = menu.addItem.bind(menu);
    menu.addItem = callback => add(item => {
      const title = item.setTitle.bind(item), click = item.onClick.bind(item); let name;
      item.setTitle = value => { name = value; return title(value); };
      item.onClick = fn => { if (name === '新建简历') createInFolder = fn; return click(fn); };
      callback(item);
    });
    app.workspace.trigger('file-menu', menu, b, 'file-explorer', explorer);
    assert(createInFolder, 'Folder context menu command missing');
    createInFolder();
    await wait(() => app.vault.getFileByPath(`${b.path}/新简历 2.md`));
    await wait(() => plugin.views()[0]?.source?.path === `${b.path}/新简历 2.md`);
    result.checks.folderContextMenu = true;

    await wait(() => app.plugins.getPlugin('notebook-navigator')?.api);
    const api = app.plugins.getPlugin('notebook-navigator').api;
    const navigator = await app.workspace.ensureSideLeaf('notebook-navigator', 'left', { reveal: true });
    app.workspace.setActiveLeaf(navigator, { focus: true });
    assert(await api.navigation.navigateToFolder(b), 'Navigator folder selection failed');
    await wait(() => api.selection.getNavItem().folder === b);
    await created(b); result.checks.notebookNavigatorSelection = true;
    await openSource(); await created(a); result.checks.navigatorDoesNotOverrideNewNote = true;

    for (const [name, text] of originalText) assert(await app.vault.read(app.vault.getFileByPath(name)) === text, `Existing note changed: ${name}`);
    result.checks.existingNotesUnchanged = true;
    result.status = 'complete'; result.fixtureFolder = prefix;
  } catch (error) { result.status = 'failed'; result.error = String(error.stack ?? error); }
  finally {
    editor?.detach();
    if (active) app.workspace.setActiveLeaf(active, { focus: false });
    await save();
  }
})();
