return (async () => {
  const fs = require('fs'), path = require('path'), crypto = require('crypto');
  const { vault, evidence, output, version } = config;
  if (app.vault.adapter.getBasePath() !== vault || fs.readFileSync(path.join(vault, '.mcv-release-qa'), 'utf8') !== version) throw Error('Refusing non-release-test Vault');
  const result = { status: 'running', version, hostVersion: config.hostVersion, electron: process.versions.electron, checks: {}, metrics: {}, fixtures: [] };
  const save = () => fs.writeFileSync(path.join(evidence, 'host-results.json'), JSON.stringify(result, null, 2));
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const waitFor = async fn => { for (let i = 0; i < 150; i++) { if (fn()) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw Error('Timed out waiting for preview'); };
  const pluginDir = path.join(vault, '.obsidian/plugins/markdown-to-cv');
  let plugin = app.plugins.plugins['markdown-to-cv'];
  const remote = require('@electron/remote'), wc = remote.getCurrentWebContents();
  const sessions = [];
  async function offline(contents) {
    // An offscreen export window has no renderer until its first navigation.
    if (!contents.getURL()) await contents.loadURL('about:blank');
    const debuggerApi = contents.debugger;
    assert(!debuggerApi.isAttached(), 'Debugger already in use; refusing to replace it');
    debuggerApi.attach('1.3'); sessions.push(debuggerApi);
    await debuggerApi.sendCommand('Network.enable');
    await debuggerApi.sendCommand('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    return debuggerApi;
  }
  save();
  try {
    assert(plugin && plugin.manifest.version === version, 'Enable the release plugin first');
    assert(fs.readdirSync(pluginDir).sort().join(',') === 'main.js,manifest.json,styles.css', 'Plugin is not a clean three-file installation');
    for (const file of ['main.js', 'manifest.json', 'styles.css']) assert(fs.readFileSync(path.join(pluginDir, file)).equals(fs.readFileSync(path.join(config.root, 'release', version, file))), 'Installed asset differs: ' + file);
    result.checks.threeFilesOnly = true;
    assert(plugin.fonts.data === null && plugin.fonts.faces.size === 0, 'Font decoded before first preview');
    result.checks.lazyFontBeforePreview = true;
    let decodes = 0;
    const read = plugin.fonts.read;
    plugin.fonts.read = () => { decodes++; return read(); };
    await offline(wc);
    await waitFor(() => !navigator.onLine);
    result.checks.previewRendererOffline = !navigator.onLine;
    const initialMemory = process.memoryUsage();
    let view;
    for (const name of ['standard', 'two-page', 'photo']) {
      const file = app.vault.getAbstractFileByPath(`fixtures/release-${name}.md`);
      assert(file, 'Fixture not found');
      const started = performance.now();
      const editorLeaf = app.workspace.getLeavesOfType('markdown')[0] ?? app.workspace.getLeaf('tab');
      await editorLeaf.openFile(file, { state: { mode: 'source' } });
      view = await plugin.openPreview(file);
      await waitFor(() => view.current?.snapshot.path === file.path && view.contentEl.querySelector('.mcv-status')?.dataset.state === 'ready');
      const rendered = view.current;
      assert(!rendered.issues.some(issue => issue.blocksExport), 'Export-blocking render issue');
      const weights = {};
      for (const selector of ['.cv-root', 'h1', 'h2', 'h3', 'strong', 'em']) {
        const el = selector === '.cv-root' ? rendered.pages : rendered.pages.querySelector(selector);
        const css = getComputedStyle(el); weights[selector] = { family: css.fontFamily, weight: css.fontWeight, style: css.fontStyle };
      }
      assert(weights['.cv-root'].weight === '400' && weights.h1.weight === '700' && weights.h2.weight === '500', 'Wrong font weights');
      assert(Object.values(weights).every(value => value.family.includes('MCV Source Han Sans CN')), 'Font family mismatch');
      const item = { name, previewPages: rendered.pageCount, previewMilliseconds: performance.now() - started, pageText: Array.from(rendered.pages.querySelectorAll('.cv-page-content')).map(el => el.textContent), weights, offlineFontSources: true };
      if (name === 'standard') {
        const bytes = await plugin.fonts.data;
        assert(crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex') === 'f971e3bff46f76b49e1d5510556c2297c618ec4b491a295a4e741cdd38257799', 'Runtime font differs from original');
        result.checks.runtimeFontHashMatches = true;
        const face = plugin.fonts.faces.get(document);
        const cache = plugin.fonts.data;
        const samples = [];
        for (let i = 0; i < 8; i++) {
          const start = performance.now();
          const next = await plugin.render({ ...rendered.snapshot, text: rendered.snapshot.text.replace('# 林示例', '# 林示例 ' + i) }, plugin, new AbortController().signal);
          samples.push(performance.now() - start); next.dispose();
        }
        assert(plugin.fonts.data === cache && plugin.fonts.faces.get(document) === face && decodes === 1, 'Font cache not reused');
        result.checks.singleFontDecodeAcrossEdits = true;
        result.metrics.warmRenderMilliseconds = samples;
        result.metrics.memoryDeltaWithoutGc = { heapUsed: process.memoryUsage().heapUsed - initialMemory.heapUsed, external: process.memoryUsage().external - initialMemory.external };
      }
      if (name === 'photo') {
        const image = rendered.pages.querySelector('.cv-profile-photo img');
        assert(image?.naturalWidth > 0 && image.src.startsWith('app://'), 'Local photo did not load offline');
        const bounds = image.getBoundingClientRect();
        const scale = view.displayScale;
        assert(bounds.width / scale <= 28 * 96 / 25.4 + 1 && bounds.height / scale <= 36 * 96 / 25.4 + 1, 'Photo dimensions changed');
        result.checks.localPhotoOffline = true;
        const originalPageCount = rendered.pageCount;
        view.setZoom(1.5);
        assert(view.displayScale === 1.5 && view.current.pageCount === originalPageCount, 'Zoom changed pagination');
        result.checks.zoomKeepsPagination = true;
      }
      assert(/^A4 · \d+ 页$/.test(view.contentEl.querySelector('.mcv-status').textContent), 'Noisy preview status');
      // A fresh export renderer per fixture makes each check a cold, offline
      // install test. Chromium resets per-target emulation across data: navigations.
      const printDebugger = await offline(plugin.pdf.getWindow().webContents);
      const destination = path.join(output, name + '.pdf');
      await view.exportPdf(destination);
      assert(view.lastExport?.status === 'success', 'PDF export failed: ' + JSON.stringify(view.lastExport));
      item.exportMilliseconds = view.lastExport.milliseconds; item.pdf = destination; item.pdfBytes = fs.statSync(destination).size;
      const printState = JSON.parse(await plugin.pdf.window.webContents.executeJavaScript('JSON.stringify({offline:!navigator.onLine,faces:Array.from(document.fonts).map(f=>({family:f.family,status:f.status})),pages:document.querySelectorAll(".cv-page").length,overflow:Array.from(document.querySelectorAll(".cv-page-content")).map(p=>({x:p.scrollWidth-p.clientWidth,y:p.scrollHeight-p.clientHeight}))})'));
      assert(printState.offline && printState.pages === item.previewPages && printState.faces.some(face => face.family === 'MCV Source Han Sans CN' && face.status === 'loaded'), 'PDF is not offline/font-matched: ' + JSON.stringify({ expectedPages: item.previewPages, ...printState }));
      assert(printState.overflow.every(bounds => bounds.x <= 1 && bounds.y <= 1), 'Print overflow');
      item.printDocument = printState;
      result.fixtures.push(item); save();
      printDebugger.detach();
      sessions.splice(sessions.indexOf(printDebugger), 1);
      plugin.pdf.dispose();
    }
    result.checks.allExportsOffline = true;
    assert(decodes === 1, 'Font decoded again for export');
    result.metrics.fontDecodes = decodes;
    // Reinstall/reload must not retain a font face or PDF window from the first instance.
    for (const session of sessions.splice(1)) if (session.isAttached()) session.detach();
    const oldFonts = plugin.fonts;
    await app.plugins.unloadPlugin('markdown-to-cv');
    assert(oldFonts.disposed && oldFonts.faces.size === 0 && oldFonts.data === null, 'Font cache leaked after unload');
    assert(app.workspace.getLeavesOfType('markdown-to-cv-preview').length === 0, 'Preview leaked after unload');
    assert(remote.BrowserWindow.getAllWindows().every(window => window.isDestroyed() || window.webContents.getTitle() !== 'Markdown to CV'), 'PDF window leaked');
    const start = performance.now();
    await app.plugins.loadPlugin('markdown-to-cv');
    result.metrics.reloadMilliseconds = performance.now() - start;
    plugin = app.plugins.plugins['markdown-to-cv'];
    assert(plugin.fonts.data === null, 'Reload decoded font eagerly');
    view = await plugin.openPreview(app.vault.getAbstractFileByPath('fixtures/release-photo.md'));
    await waitFor(() => view.current && view.contentEl.querySelector('.mcv-status')?.dataset.state === 'ready');
    result.checks.reloadWithoutFontDirectory = true;
    result.status = 'complete';
  } catch (error) { result.status = 'failed'; result.error = String(error.stack ?? error); }
  finally {
    for (const session of sessions) {
      try { if (session.isAttached()) { await session.sendCommand('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); session.detach(); } } catch {}
    }
    save();
  }
  return JSON.stringify({ status: result.status, evidence, error: result.error });
})();
