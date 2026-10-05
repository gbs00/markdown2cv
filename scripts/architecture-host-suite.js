return (async () => {
  const fs = require('fs'), path = require('path');
  if (app.vault.adapter.getBasePath() !== config.vault || fs.readFileSync(path.join(config.vault, '.mcv-release-qa'), 'utf8') !== config.version) throw Error('Refusing non-test Vault');
  const plugin = app.plugins.plugins['markdown-to-cv'];
  const result = { status: 'running', phase: config.phase, checks: {}, metrics: {} };
  const save = () => fs.writeFileSync(config.result, JSON.stringify(result, null, 2));
  const assert = (ok, message) => { if (!ok) throw Error(message); };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async predicate => { for (let i = 0; i < 200; i++) { if (predicate()) return; await sleep(50); } throw Error('Preview timeout'); };
  const leaves = []; app.workspace.iterateAllLeaves(leaf => leaves.push(leaf));
  const active = app.workspace.activeLeaf;
  const editors = app.workspace.getLeavesOfType('markdown').map(leaf => ({ leaf, text: leaf.view.editor?.getValue() }));
  const measurements = document.querySelectorAll('.mcv-measure').length;
  let view, wrapper, service, createdPhoto, popoutLeaf, popout, calls = 0;
  save();
  try {
    assert(plugin && !plugin.views().some(v => v.exporting), 'Plugin unavailable or exporting');
    const bound = plugin.views()[0]; assert(bound, 'Expected existing test preview');
    const leaf = Object.create(bound.leaf);
    Object.defineProperty(leaf, 'containerEl', { value: document.createElement('div') });
    const facade = Object.create(plugin);
    service = new plugin.pdf.constructor(); facade.pdf = service;
    const file = app.vault.getFileByPath('fixtures/01-standard.md');
    let snapshot = { path: file.path, name: 'Architecture QA', text: fs.readFileSync(path.join(config.root, 'fixtures/01-standard.md'), 'utf8'), capturedAt: Date.now() };
    facade.capture = async () => snapshot;
    facade.render = (...args) => { calls++; return plugin.render(...args); };
    view = new bound.constructor(leaf, facade);
    wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;left:-20000px;top:0;width:850px;height:850px;pointer-events:none';
    wrapper.append(view.containerEl); document.body.append(wrapper);
    view.containerEl.style.cssText = 'height:100%;width:100%'; view.contentEl.style.height = '100%';
    view.load(); await view.onOpen(); view.bindFile(file);
    const ready = () => view.status.dataset.state === 'ready';
    await wait(ready);
    const standard = view.current;
    result.standard = { pages: standard.pageCount, text: standard.pages.textContent };
    const before = calls;
    for (let i = 0; i < 10; i++) { view.schedule({ ...snapshot, capturedAt: Date.now() }); await wait(ready); }
    result.metrics.identicalEvents = 10; result.metrics.identicalEventRenders = calls - before;
    if (config.phase !== 'before') assert(calls === before, 'Identical content rendered again');
    result.checks.identicalContent = true;
    if (config.phase !== 'before') {
      let captures = 0;
      snapshot = { ...snapshot, text: snapshot.text + '\n\nDeferred editor capture' };
      for (let i = 0; i < 50; i++) view.schedule(() => { captures++; return snapshot; });
      assert(captures === 0, 'Editor read before debounce');
      await wait(() => ready() && view.current.snapshot.text === snapshot.text);
      assert(captures === 1, 'Editor read repeatedly during burst');
      result.metrics.burstSnapshotReads = captures;
      result.checks.deferredEditorCapture = true;
    }
    const burstStart = calls;
    for (let i = 0; i < 50; i++) { snapshot = { ...snapshot, text: standard.snapshot.text + '\n\nLatest edit ' + i }; view.schedule(snapshot); }
    await wait(() => ready() && view.current.snapshot.text === snapshot.text);
    assert(calls - burstStart === 1, 'Burst was not coalesced'); result.checks.burstLatestOnly = true;
    result.metrics.burstEvents = 50; result.metrics.burstRenders = calls - burstStart;
    const normalRender = facade.render;
    let slowStarted = false;
    facade.render = async (...args) => { slowStarted = true; await sleep(180); return normalRender(...args); };
    view.schedule({ ...snapshot, text: '# Stale result' }); await wait(() => slowStarted);
    facade.render = normalRender;
    snapshot = { ...snapshot, text: standard.snapshot.text + '\n\nFresh result' }; view.schedule(snapshot);
    await wait(() => ready() && view.current.snapshot.text === snapshot.text); await sleep(250);
    assert(view.current.snapshot.text === snapshot.text, 'Stale render committed'); result.checks.staleResultRejected = true;
    snapshot = { ...snapshot, text: standard.snapshot.text + '\n\n![Body photo](assets/photo-portrait.png)\n' }; view.schedule(snapshot);
    await wait(() => ready() && view.current.snapshot.text === snapshot.text);
    if (config.phase !== 'before') {
      const image = app.metadataCache.getFirstLinkpathDest('assets/photo-portrait.png', file.path);
      assert(view.current.resourcePaths.has(image.path), 'Body photo dependency missing');
      const previous = calls;
      view.resourceChanged('unrelated-file.png'); await sleep(140);
      assert(calls === previous, 'Unrelated resource caused rendering');
      view.resourceChanged(image.path); await wait(ready);
      assert(calls === previous + 1, 'Changed image skipped by content dedupe');
      result.checks.resourceInvalidation = true;
      const photoName = 'architecture-photo-' + Date.now() + '.png';
      snapshot = { ...snapshot, text: '# Missing image\n\n**照片：** ![[' + photoName + ']]' }; view.schedule(snapshot);
      await wait(() => ready() && view.current.snapshot.text === snapshot.text);
      assert(view.current.hasUnresolvedResources && view.current.issues.some(i => i.blocksExport), 'Missing photo dependency not marked');
      const bytes = fs.readFileSync(path.join(config.root, 'fixtures/assets/photo-portrait.png'));
      createdPhoto = await app.vault.createBinary('fixtures/assets/' + photoName, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      await wait(() => app.metadataCache.getFirstLinkpathDest(photoName, file.path));
      view.resourceChanged(createdPhoto.path); await wait(ready);
      assert(!view.current.hasUnresolvedResources && !view.current.issues.some(i => i.blocksExport) && view.current.pages.querySelector('.cv-profile-photo img')?.naturalWidth > 0, 'New photo did not recover unchanged Markdown');
      result.checks.missingPhotoRecoversAfterCreate = true;
    }
    snapshot = { ...snapshot, text: fs.readFileSync(path.join(config.root, 'fixtures/04-pagination.md'), 'utf8') }; view.schedule(snapshot);
    await wait(() => ready() && view.current.snapshot.text === snapshot.text);
    result.multipage = { pages: view.current.pageCount, text: view.current.pages.textContent };
    view.setZoom(1.5);
    const destination = path.join(path.dirname(config.result), config.phase + '.pdf');
    await view.exportPdf(destination, snapshot);
    assert(view.lastExport?.status === 'success', 'PDF failed: ' + JSON.stringify(view.lastExport));
    const printed = JSON.parse(await service.window.webContents.executeJavaScript('JSON.stringify({pages:document.querySelectorAll(".cv-page").length,text:document.querySelector(".cv-pages").textContent})'));
    assert(printed.pages === result.multipage.pages && printed.text === result.multipage.text, 'Print content differs from preview');
    result.pdf = { pages: printed.pages, bytes: fs.statSync(destination).size, milliseconds: view.lastExport.milliseconds };
    result.checks.zoomedExportContent = true;
    const longSnapshot = { ...snapshot, text: fs.readFileSync(path.join(config.root, 'fixtures/04b-long-paragraph.md'), 'utf8') };
    const longStarted = performance.now();
    const long = await plugin.render(longSnapshot, view, new AbortController().signal);
    result.longParagraph = { pages: long.pageCount, text: long.pages.textContent, milliseconds: performance.now() - longStarted };
    long.dispose();
    if (config.phase !== 'before') {
      popoutLeaf = app.workspace.getLeaf('tab');
      await popoutLeaf.setViewState({ type: 'markdown-to-cv-preview', active: false, state: { sourcePath: file.path } });
      const migrated = popoutLeaf.view;
      await wait(() => migrated.current && migrated.status.dataset.state === 'ready');
      const commits = migrated.metrics.commits;
      migrated.schedule();
      popout = app.workspace.moveLeafToPopout(popoutLeaf, { size: { width: 850, height: 850 } });
      await wait(() => popout.doc && migrated.contentEl.ownerDocument === popout.doc && migrated.renderedDocument === popout.doc && migrated.status.dataset.state === 'ready');
      assert(migrated.metrics.commits > commits && plugin.fonts.faces.has(popout.doc), 'Migrated preview did not register fonts');
      const popoutDocument = popout.doc;
      popoutLeaf.detach(); popoutLeaf = null;
      if (popout.win && !popout.win.closed) popout.win.close();
      await wait(() => !plugin.fonts.faces.has(popoutDocument));
      popout = null;
      result.checks.popoutMigrationAndFontRelease = true;
    }
    result.status = 'complete';
  } catch (error) { result.status = 'failed'; result.error = String(error.stack ?? error); }
  finally {
    if (view) { await view.onClose(); view.unload(); view.containerEl.remove(); }
    wrapper?.remove(); service?.dispose();
    popoutLeaf?.detach(); if (popout?.win && !popout.win.closed) popout.win.close();
    if (active && app.workspace.activeLeaf !== active) app.workspace.setActiveLeaf(active, { focus: false });
    if (createdPhoto) await app.vault.delete(createdPhoto);
    const after = []; app.workspace.iterateAllLeaves(leaf => after.push(leaf));
    result.safety = { editorsUnchanged: editors.every(v => v.leaf.view.editor?.getValue() === v.text), activeLeafUnchanged: app.workspace.activeLeaf === active, leavesUnchanged: after.length === leaves.length && leaves.every(l => after.includes(l)), measurementNodesReleased: document.querySelectorAll('.mcv-measure').length === measurements };
    save();
  }
  return result.status;
})();
